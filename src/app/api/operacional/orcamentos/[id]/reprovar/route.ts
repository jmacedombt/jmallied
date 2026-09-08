import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import {
  calcularDetalheValidacao,
  STATUS_ORCAMENTO_REPROVADO,
  STATUS_ORCAMENTO_FECHADOS,
  STATUS_VALIDACAO_ORCAMENTOS,
  type CamposPecasOrcamento,
  type ConfiguracaoMaoDeObra,
} from "@/lib/orcamentos";
import { type FaixaMarkup } from "@/lib/bid";

const COLUNAS_PECAS =
  "peca_1, peca_2, peca_3, peca_4, peca_5, peca_6, peca_7, peca_8, peca_9, peca_10, peca_add_1, peca_add_2, peca_add_3, peca_add_4, peca_add_5";

// Reprova manualmente um orçamento — ícone de cancelamento disponível em
// qualquer etapa do Operacional antes de "8 - Orçamento Reprovado" ou
// "Produto Entregue" (ver PopupReprovarOrcamento.tsx). Grava a
// justificativa e avança o orçamento direto pra "8 - Orçamento
// Reprovado", não importa em qual etapa ele estava.
//
// Quando a reprovação acontece ESTANDO em "Validação de Orçamentos" (ou
// seja, o orçamento já tem peça e custo apurados, mas ainda não tinha
// sido enviado/confirmado), o cálculo daquele momento é congelado em
// validacao_snapshot — exatamente igual ao que "Confirmar Envio" faz pra
// quem é aprovado (ver avancar-validacao-em-massa). Sem isso, o valor
// desse reprovado no Excel de envio seria recalculado depois com o custo
// que a Base Peças tiver NAQUELE momento, podendo vir diferente do que a
// pessoa viu na tela ao reprovar. Reprovação em qualquer outra etapa
// (antes ou depois da Validação) não mexe em snapshot: antes dela nunca
// houve preço apurado pra congelar, e depois dela (3/4) o snapshot já
// existe desde o envio — nunca é recalculado.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const motivo = String(body?.motivo_reprova ?? "").trim();
  if (!motivo) {
    return NextResponse.json({ error: "Informe a justificativa da reprovação." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: atual, error: erroAtual } = await admin
    .from("orcamentos")
    .select(`status_operacional, ${COLUNAS_PECAS}`)
    .eq("id", params.id)
    .single();

  if (erroAtual || !atual) {
    return NextResponse.json({ error: "Orçamento não encontrado." }, { status: 404 });
  }

  if ((STATUS_ORCAMENTO_FECHADOS as readonly string[]).includes(atual.status_operacional)) {
    return NextResponse.json(
      { error: "Esse orçamento já está numa etapa final (Reprovado ou Entregue) — não dá pra reprovar de novo." },
      { status: 409 }
    );
  }

  const agora = new Date().toISOString();
  const atualizacao: Record<string, unknown> = {
    status_operacional: STATUS_ORCAMENTO_REPROVADO,
    motivo_reprova: motivo,
    reprovado_por: user.id,
    reprovado_em: agora,
  };

  if (atual.status_operacional === STATUS_VALIDACAO_ORCAMENTOS) {
    const codigos = Array.from(
      new Set(
        [
          atual.peca_1, atual.peca_2, atual.peca_3, atual.peca_4, atual.peca_5,
          atual.peca_6, atual.peca_7, atual.peca_8, atual.peca_9, atual.peca_10,
          atual.peca_add_1, atual.peca_add_2, atual.peca_add_3, atual.peca_add_4, atual.peca_add_5,
        ]
          .map((c) => (typeof c === "string" ? c.trim() : c))
          .filter((c): c is string => !!c)
      )
    );

    const custosPorCodigo = new Map<string, number>();
    if (codigos.length > 0) {
      const { data: custosBrutos } = await admin.from("pecas_vigentes").select("codigo, valor_unitario").in("codigo", codigos);
      for (const linha of custosBrutos ?? []) custosPorCodigo.set(linha.codigo, Number(linha.valor_unitario));
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

    const detalhe = calcularDetalheValidacao(
      atual as CamposPecasOrcamento,
      custosPorCodigo,
      icmsPercentual,
      configMaoDeObra,
      faixasMarkup
    );

    atualizacao.validacao_snapshot = detalhe;
    atualizacao.validacao_travado = true;
    atualizacao.validacao_travado_em = agora;
    atualizacao.validacao_travado_por = user.id;
  }

  const { error } = await admin.from("orcamentos").update(atualizacao).eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
