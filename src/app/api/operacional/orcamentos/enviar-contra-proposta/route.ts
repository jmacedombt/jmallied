import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { podeConfirmarAprovacaoOrcamento, STATUS_AG_PECAS, STATUS_ORCAMENTO_REPROVADO } from "@/lib/orcamentos";
import { prepararGeracaoContraProposta } from "@/lib/contraPropostaDecisao";
import { montarPlanilhaOrcamentos } from "@/lib/email";

export const maxDuration = 60;

// "Enviar Contra Proposta" (Ag. Contra Proposta) — reescrito por completo
// (pedido explícito, substitui o antigo envio por e-mail): revalida que
// TODO aparelho do lote já tem uma decisão (Aprovado/Reprovado — ver
// decidir-contra-proposta), monta a planilha final combinando os 3 grupos
// (aprovados inicialmente + Contra Proposta aceita + Contra Proposta
// recusada — ver prepararGeracaoContraProposta), move cada aparelho pra
// etapa certa, registra no histórico "Contra Propostas" (mesmo princípio
// do Modelo de Retorno — snapshot das linhas, sem guardar o arquivo) e
// devolve o Excel pronto pra download direto no navegador (sem e-mail).
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

  if (!podeConfirmarAprovacaoOrcamento(perfil)) {
    return NextResponse.json({ error: "Seu cargo não tem permissão para enviar a Contra Proposta." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const nfRemessa = String(body?.nf_remessa_allied ?? "").trim();
  if (!nfRemessa) {
    return NextResponse.json({ error: "Selecione um lote (NF Remessa)." }, { status: 400 });
  }

  const preparo = await prepararGeracaoContraProposta(admin, nfRemessa);
  if (!preparo.ok) {
    return NextResponse.json({ error: preparo.erro }, { status: preparo.status });
  }

  const agora = new Date().toISOString();

  if (preparo.idsAprovados.length > 0) {
    const { error } = await admin
      .from("orcamentos")
      .update({ status_operacional: STATUS_AG_PECAS })
      .in("id", preparo.idsAprovados);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  for (const { id, motivo } of preparo.idsReprovados) {
    const { error } = await admin
      .from("orcamentos")
      .update({
        status_operacional: STATUS_ORCAMENTO_REPROVADO,
        motivo_reprova: motivo,
        reprovado_por: user.id,
        reprovado_em: agora,
      })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const nfRemessaArquivo = nfRemessa.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const nomeArquivo = `Contra_Proposta_${nfRemessaArquivo}.xlsx`;
  const planilha = montarPlanilhaOrcamentos(preparo.linhas);

  const { error: erroHistorico } = await admin.from("contra_proposta_geracoes").insert({
    gerado_por: user.id,
    nf_remessa_allied: nfRemessa,
    quantidade_aprovados_iniciais: preparo.quantidadeAprovadosIniciais,
    quantidade_contra_proposta_aceita: preparo.quantidadeContraPropostaAceita,
    quantidade_reprovados: preparo.quantidadeReprovados,
    nome_arquivo: nomeArquivo,
    dados: { linhas: preparo.linhas },
  });
  // uma falha ao registrar no histórico não pode impedir a pessoa de
  // baixar o arquivo agora — o lote já avançou de etapa de qualquer
  // jeito; só fica sem entrada no histórico "Contra Propostas" pra essa
  // geração específica.
  if (erroHistorico) {
    console.error("Falha ao registrar histórico de Contra Proposta:", erroHistorico.message);
  }

  return new NextResponse(new Uint8Array(planilha), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nomeArquivo}"`,
      "Cache-Control": "no-store",
      "X-Quantidade-Aprovados-Iniciais": String(preparo.quantidadeAprovadosIniciais),
      "X-Quantidade-Contra-Proposta-Aceita": String(preparo.quantidadeContraPropostaAceita),
      "X-Quantidade-Reprovados": String(preparo.quantidadeReprovados),
    },
  });
}
