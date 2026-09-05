import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import {
  podeConfirmarAnaliseEmLote,
  STATUS_OPERACIONAL,
  STATUS_VALIDACAO_ORCAMENTOS,
} from "@/lib/orcamentos";

const STATUS_AG_RESPOSTA_ORCAMENTO = STATUS_OPERACIONAL.find((s) => s.slug === "3-ag-resposta-orcamento")!.valor;

const COLUNAS_PECAS =
  "peca_1, peca_2, peca_3, peca_4, peca_5, peca_6, peca_7, peca_8, peca_9, peca_10, peca_add_1, peca_add_2, peca_add_3, peca_add_4, peca_add_5";

const TAMANHO_LOTE_CODIGOS = 400;

type LinhaOrcamentoLote = {
  id: string;
  validacao_confirmado_sem_peca: boolean;
  peca_1: string | null; peca_2: string | null; peca_3: string | null; peca_4: string | null; peca_5: string | null;
  peca_6: string | null; peca_7: string | null; peca_8: string | null; peca_9: string | null; peca_10: string | null;
  peca_add_1: string | null; peca_add_2: string | null; peca_add_3: string | null; peca_add_4: string | null; peca_add_5: string | null;
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

  const agora = new Date().toISOString();
  const ids = lista.map((a) => a.id);

  const { data: atualizados, error: erroUpdate } = await admin
    .from("orcamentos")
    .update({
      status_operacional: STATUS_AG_RESPOSTA_ORCAMENTO,
      validacao_concluida_por: user.id,
      validacao_concluida_em: agora,
    })
    .in("id", ids)
    .eq("status_operacional", STATUS_VALIDACAO_ORCAMENTOS)
    .select("id");

  if (erroUpdate) {
    return NextResponse.json({ error: erroUpdate.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, quantidade: atualizados?.length ?? 0 });
}
