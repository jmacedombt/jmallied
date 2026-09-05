import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import {
  calcularDetalheValidacao,
  podeConfirmarAnaliseEmLote,
  STATUS_OPERACIONAL,
  STATUS_VALIDACAO_ORCAMENTOS,
  type CamposPecasOrcamento,
  type ConfiguracaoMaoDeObra,
} from "@/lib/orcamentos";
import { type FaixaMarkup } from "@/lib/bid";

export const maxDuration = 60;

const STATUS_AG_RESPOSTA_ORCAMENTO = STATUS_OPERACIONAL.find((s) => s.slug === "3-ag-resposta-orcamento")!.valor;

const COLUNAS_PECAS =
  "peca_1, peca_2, peca_3, peca_4, peca_5, peca_6, peca_7, peca_8, peca_9, peca_10, peca_add_1, peca_add_2, peca_add_3, peca_add_4, peca_add_5";

const TAMANHO_LOTE_CODIGOS = 400;
const TAMANHO_LOTE_UPDATE_PARALELO = 20;

type LinhaOrcamentoLote = CamposPecasOrcamento & {
  id: string;
  validacao_confirmado_sem_peca: boolean;
};

// Avança TODOS os aparelhos de um lote (NF Remessa) de "Validação de
// Orçamentos" pra "3 - Ag. Resposta de Orçamento" de uma vez (botão
// "Confirmar Envio") — sempre por lote, nunca lotes misturados, porque a
// validação é sempre feita por NF Remessa. Revalida as duas travas no
// servidor (nunca confia só na checagem que a tela já fez):
//   1) nenhum aparelho do lote pode ter peça lançada sem custo na Base
//      Peças (peça "prioridade", destaque vermelho);
//   2) todo aparelho sem nenhuma peça lançada (destaque amarelo) precisa
//      já ter sido confirmado individualmente (validacao_confirmado_sem_peca).
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: perfil } = await admin.from("usuarios").select("cargo, is_master").eq("id", user.id).single();

  if (!podeConfirmarAnaliseEmLote(perfil)) {
    return NextResponse.json(
      { error: "Seu cargo não tem permissão para confirmar o envio de um lote." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  const nfRemessa = String(body?.nf_remessa_allied ?? "").trim();

  if (!nfRemessa) {
    return NextResponse.json({ error: "Selecione um lote (NF Remessa)." }, { status: 400 });
  }

  const { data: aparelhos, error: erroBusca } = await admin
    .from("orcamentos")
    .select(`id, validacao_confirmado_sem_peca, ${COLUNAS_PECAS}`)
    .eq("status_operacional", STATUS_VALIDACAO_ORCAMENTOS)
    .eq("nf_remessa_allied", nfRemessa);

  if (erroBusca) {
    return NextResponse.json({ error: erroBusca.message }, { status: 400 });
  }

  const lista = (aparelhos ?? []) as LinhaOrcamentoLote[];
  if (lista.length === 0) {
    return NextResponse.json(
      { error: "Não há aparelhos desse lote em Validação de Orçamentos no momento." },
      { status: 409 }
    );
  }

  const codigosUnicos = Array.from(
    new Set(
      lista
        .flatMap((a) => [
          a.peca_1, a.peca_2, a.peca_3, a.peca_4, a.peca_5, a.peca_6, a.peca_7, a.peca_8, a.peca_9, a.peca_10,
          a.peca_add_1, a.peca_add_2, a.peca_add_3, a.peca_add_4, a.peca_add_5,
        ])
        .map((c) => (typeof c === "string" ? c.trim() : c))
        .filter((c): c is string => !!c)
    )
  );

  const custosPorCodigo = new Map<string, number>();
  for (let i = 0; i < codigosUnicos.length; i += TAMANHO_LOTE_CODIGOS) {
    const lote = codigosUnicos.slice(i, i + TAMANHO_LOTE_CODIGOS);
    const { data } = await admin.from("pecas_vigentes").select("codigo, valor_unitario").in("codigo", lote);
    for (const linha of data ?? []) custosPorCodigo.set(linha.codigo, Number(linha.valor_unitario));
  }

  let temPecaSemCusto = false;
  let temAparelhoNaoConfirmado = false;

  for (const a of lista) {
    const codigos = [
      a.peca_1, a.peca_2, a.peca_3, a.peca_4, a.peca_5, a.peca_6, a.peca_7, a.peca_8, a.peca_9, a.peca_10,
      a.peca_add_1, a.peca_add_2, a.peca_add_3, a.peca_add_4, a.peca_add_5,
    ]
      .map((c) => (typeof c === "string" ? c.trim() : c))
      .filter((c): c is string => !!c);

    if (codigos.length === 0) {
      if (!a.validacao_confirmado_sem_peca) temAparelhoNaoConfirmado = true;
    } else if (codigos.some((c) => !custosPorCodigo.has(c))) {
      temPecaSemCusto = true;
    }
  }

  if (temPecaSemCusto) {
    return NextResponse.json(
      {
        error:
          "Existem peças sem custo na Base Peças nesse lote (destaque em vermelho / Prioridade). Cadastre o valor delas antes de confirmar o envio.",
      },
      { status: 409 }
    );
  }
  if (temAparelhoNaoConfirmado) {
    return NextResponse.json(
      {
        error:
          "Existem aparelhos sem nenhuma peça lançada (destaque em amarelo) que ainda não foram confirmados. Abra cada um e confirme antes de enviar o lote.",
      },
      { status: 409 }
    );
  }

  // 3ª trava: o BID (custo_peca_samsung persistido) precisa refletir o
  // mesmo valor que a Base Peças tem agora pra cada código usado nesse
  // lote — senão o valor que vai ser informado ao cliente no BID pode já
  // estar desatualizado em relação ao que a Validação está calculando
  // aqui. Ignora peça travada no BID (preço fixado na mão, não segue a
  // Base Peças de propósito).
  const pecasDesatualizadas = new Set<string>();
  for (let i = 0; i < codigosUnicos.length; i += TAMANHO_LOTE_CODIGOS) {
    const lote = codigosUnicos.slice(i, i + TAMANHO_LOTE_CODIGOS);
    const { data } = await admin
      .from("bid_pecas")
      .select("part_number, custo_peca_samsung, travado")
      .in("part_number", lote);
    for (const linha of (data ?? []) as { part_number: string; custo_peca_samsung: number | null; travado: boolean }[]) {
      if (linha.travado) continue;
      const valorVivo = custosPorCodigo.get(linha.part_number) ?? null;
      const diferente =
        (linha.custo_peca_samsung == null) !== (valorVivo == null) ||
        (linha.custo_peca_samsung != null && valorVivo != null && Math.abs(linha.custo_peca_samsung - valorVivo) > 0.001);
      if (diferente) pecasDesatualizadas.add(linha.part_number);
    }
  }

  if (pecasDesatualizadas.size > 0) {
    return NextResponse.json(
      {
        error:
          "A Base Peças mudou desde o último Recalcular BID pra alguma peça desse lote — recalcule o BID (Bases > BID) antes de confirmar o envio, pra garantir que o valor informado ao cliente seja o mesmo que será cobrado.",
        pecasDesatualizadas: Array.from(pecasDesatualizadas),
      },
      { status: 409 }
    );
  }

  const [{ data: configImposto }, { data: configMaoObraBruta }, { data: faixasMarkupBrutas }] = await Promise.all([
    admin.from("configuracoes_impostos").select("icms_percentual").eq("id", 1).single(),
    admin.from("configuracoes_mao_de_obra").select("valor_uma_peca, valor_mais_de_uma_peca").eq("id", 1).single(),
    admin.from("configuracoes_bid_markup").select("valor_min, valor_max, multiplicador").order("ordem", { ascending: true }),
  ]);

  const icmsPercentual = Number(configImposto?.icms_percentual ?? 0);
  const configMaoDeObra: Pick<ConfiguracaoMaoDeObra, "valor_uma_peca" | "valor_mais_de_uma_peca"> = {
    valor_uma_peca: Number(configMaoObraBruta?.valor_uma_peca ?? 0),
    valor_mais_de_uma_peca: Number(configMaoObraBruta?.valor_mais_de_uma_peca ?? 0),
  };
  const faixasMarkup: FaixaMarkup[] = (
    (faixasMarkupBrutas ?? []) as { valor_min: number; valor_max: number | null; multiplicador: number }[]
  ).map((f) => ({
    valor_min: Number(f.valor_min),
    valor_max: f.valor_max == null ? null : Number(f.valor_max),
    multiplicador: Number(f.multiplicador),
  }));

  const agora = new Date().toISOString();

  // trava + retrato do cálculo (validacao_snapshot) — congela peça a
  // peça o custo/imposto/venda desse orçamento no momento da confirmação,
  // pra mudanças futuras na Base Peças/markup/ICMS não alterarem
  // retroativamente o valor que já foi informado ao cliente. O snapshot
  // difere por orçamento, então precisa de um update por linha (em vez
  // do update em lote usado antes) — roda em paralelo, em grupos
  // pequenos, pra não estourar o tempo de execução da função.
  let quantidade = 0;
  for (let i = 0; i < lista.length; i += TAMANHO_LOTE_UPDATE_PARALELO) {
    const grupo = lista.slice(i, i + TAMANHO_LOTE_UPDATE_PARALELO);
    const resultados = await Promise.all(
      grupo.map(async (a) => {
        const detalhe = calcularDetalheValidacao(a, custosPorCodigo, icmsPercentual, configMaoDeObra, faixasMarkup);
        const { error } = await admin
          .from("orcamentos")
          .update({
            status_operacional: STATUS_AG_RESPOSTA_ORCAMENTO,
            validacao_concluida_por: user.id,
            validacao_concluida_em: agora,
            validacao_travado: true,
            validacao_travado_em: agora,
            validacao_travado_por: user.id,
            validacao_snapshot: detalhe,
          })
          .eq("id", a.id)
          .eq("status_operacional", STATUS_VALIDACAO_ORCAMENTOS);
        return !error;
      })
    );
    quantidade += resultados.filter(Boolean).length;
  }

  return NextResponse.json({ ok: true, quantidade });
}
