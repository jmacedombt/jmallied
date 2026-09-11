import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { podeConfirmarAprovacaoOrcamento } from "@/lib/orcamentos";
import { prepararEnvioReorcamento } from "@/lib/reorcamentoEnvio";
import { persistirEEnviarLote } from "@/lib/orcamentoEnvio";

export const maxDuration = 60;

// "Enviar planilha Complementar" (4 - Ag. Resposta de Reorçamento) —
// manda de uma vez só TODOS os reorçamentos pendentes de envio, não
// importa o lote/NF Remessa (ver prepararEnvioReorcamento). Marca cada
// um como enviado (reorcamento_enviado_em/_por); o status_operacional
// NÃO muda — continua em "4", só que agora o botão Aprovar libera (ver
// [id]/aprovar-reorcamento). Gera/persiste o Excel (mesmo formato dos
// outros envios, STATUS ORÇAMENTO = "COMPLEMENTAR", com as colunas
// PEÇA ADD/CUSTO PEÇA ADD preenchidas) e manda por e-mail.
export async function POST() {
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
    return NextResponse.json({ error: "Seu cargo não tem permissão para enviar a planilha Complementar." }, { status: 403 });
  }

  const preparo = await prepararEnvioReorcamento(admin);
  if (!preparo.ok) {
    return NextResponse.json({ error: preparo.erro }, { status: preparo.status });
  }

  const ids = preparo.itens.map((i) => i.id);
  const agora = new Date().toISOString();
  const { error: erroUpdate } = await admin
    .from("orcamentos")
    .update({ reorcamento_enviado_em: agora, reorcamento_enviado_por: user.id })
    .in("id", ids)
    .is("reorcamento_enviado_em", null);

  if (erroUpdate) {
    return NextResponse.json({ error: erroUpdate.message }, { status: 400 });
  }

  const nfsUnicas = Array.from(new Set(preparo.itens.map((i) => i.nfRemessa))).sort((a, b) => a.localeCompare(b, "pt-BR"));
  const linhasPlanilha = preparo.itens.map((i) => i.linha);
  const email = await persistirEEnviarLote({
    admin,
    tipo: "reorcamento",
    nfRemessa: nfsUnicas.join(", "),
    quantidade: ids.length,
    linhasPlanilha,
    userId: user.id,
    nomeArquivoPrefixo: "complementar",
  });

  return NextResponse.json({ ok: true, quantidade: ids.length, email });
}
