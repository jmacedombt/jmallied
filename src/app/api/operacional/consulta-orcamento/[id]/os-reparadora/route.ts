import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { osReparadoraValida, podeConfirmarAnaliseEmLote } from "@/lib/orcamentos";

// Corrige a OS Reparadora de um orçamento já existente, em QUALQUER
// etapa (pedido explícito, "Consulta/Alteração", migration 0070) — só
// esse campo, nunca mexe em status_operacional nem em nenhum outro dado
// (diferente da rota .../orcamentos/[id]/os-reparadora, que é do
// cadastro inicial em Ag. Abertura e tem outra regra: aceita apagar e
// devolve o aparelho pra Ag. Abertura). Só Supervisor/Gerente/
// Administrador (mesma trava de podeConfirmarAnaliseEmLote) — ALLIED
// nunca cai aqui (nem o botão de alterar aparece pra ele, ver
// PainelConsultaAlteracao.tsx). Toda alteração fica gravada em
// orcamento_auditoria (menu Sistema > Auditoria, só pro Administrador).
export async function POST(request: Request, { params }: { params: { id: string } }) {
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
    return NextResponse.json({ error: "Seu cargo não tem permissão pra alterar a OS Reparadora." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const osReparadoraNova = String(body?.os_reparadora ?? "").trim();

  if (!osReparadoraValida(osReparadoraNova)) {
    return NextResponse.json({ error: "A OS Reparadora deve ter exatamente 10 números." }, { status: 400 });
  }

  const { data: atual, error: erroAtual } = await admin
    .from("orcamentos")
    .select("os_reparadora, trade_allied, os_care_allied")
    .eq("id", params.id)
    .single();

  if (erroAtual || !atual) {
    return NextResponse.json({ error: "Orçamento não encontrado." }, { status: 404 });
  }

  const { data: atualizado, error } = await admin
    .from("orcamentos")
    .update({ os_reparadora: osReparadoraNova })
    .eq("id", params.id)
    .select("id, os_reparadora")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Essa OS Reparadora já está registrada em outro aparelho." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // registro em auditoria é best-effort: se falhar (rede/banco), a
  // alteração em si já foi feita e confirmada — não desfaz nem barra a
  // resposta por causa só do log.
  const { error: erroAuditoria } = await admin.from("orcamento_auditoria").insert({
    orcamento_id: params.id,
    trade_allied: atual.trade_allied,
    os_care_allied: atual.os_care_allied,
    os_reparadora_anterior: atual.os_reparadora,
    os_reparadora_nova: osReparadoraNova,
    alterado_por: user.id,
  });

  return NextResponse.json({ ...atualizado, auditoriaRegistrada: !erroAuditoria });
}
