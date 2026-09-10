import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { podeConfirmarAprovacaoOrcamento, STATUS_AG_CONTRA_PROPOSTA, STATUS_AG_RESPOSTA_REORCAMENTO } from "@/lib/orcamentos";
import { prepararEnvioContraProposta } from "@/lib/contraProposta";
import { persistirEEnviarLote } from "@/lib/orcamentoEnvio";

export const maxDuration = 60;

// "Enviar Contra Proposta" (Ag. Contra Proposta) — equivalente ao
// "Confirmar Envio" de Validação de Orçamentos: revalida que todo mundo
// do lote já foi ajustado peça a peça (prepararEnvioContraProposta),
// avança todos pra "4 - Ag. Resposta de Reorçamento", gera/persiste o
// Excel (mesmo formato do envio original) e manda por e-mail.
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

  const preparo = await prepararEnvioContraProposta(admin, nfRemessa);
  if (!preparo.ok) {
    return NextResponse.json({ error: preparo.erro }, { status: preparo.status });
  }

  const ids = preparo.itens.map((i) => i.id);
  const { error: erroUpdate } = await admin
    .from("orcamentos")
    .update({ status_operacional: STATUS_AG_RESPOSTA_REORCAMENTO })
    .in("id", ids)
    .eq("status_operacional", STATUS_AG_CONTRA_PROPOSTA);

  if (erroUpdate) {
    return NextResponse.json({ error: erroUpdate.message }, { status: 400 });
  }

  const linhasPlanilha = preparo.itens.map((i) => i.linha);
  const email = await persistirEEnviarLote({
    admin,
    tipo: "contra_proposta",
    nfRemessa,
    quantidade: ids.length,
    linhasPlanilha,
    userId: user.id,
    nomeArquivoPrefixo: "contra-proposta",
  });

  return NextResponse.json({ ok: true, quantidade: ids.length, email });
}
