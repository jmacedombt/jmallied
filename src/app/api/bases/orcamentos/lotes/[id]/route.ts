import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { podeMovimentarOrcamentos, STATUS_AG_ABERTURA } from "@/lib/orcamentos";

export const maxDuration = 30;

// "Excluir lote" (pedido explícito, 27/10/2026) — apaga uma NF Remessa
// importada errada (ex: base fora do padrão) do histórico de Bases > Base
// Orçamentos, junto com TODOS os aparelhos dela e os arquivos guardados.
// Travas:
//   - só Administrador ou Gerente (mesma trava do Movimentar);
//   - só se NENHUM aparelho da NF saiu de "Ag. Abertura" — se algum já
//     andou, recusa e lista quais (pra não perder análise/orçamento).
//   - precisa mandar a NF digitada igual (confirmação na tela).
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const admin = createAdminClient();
  const { data: perfil } = await admin.from("usuarios").select("cargo, is_master").eq("id", user.id).single();
  if (!podeMovimentarOrcamentos(perfil)) {
    return NextResponse.json({ error: "Só Administrador ou Gerente pode excluir um lote." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const confirmacao = String(body?.confirmacao ?? "").trim();

  const { data: lote } = await admin.from("orcamentos_lotes").select("id, nf_remessa_allied").eq("id", params.id).single();
  if (!lote) return NextResponse.json({ error: "Lote não encontrado." }, { status: 404 });
  if (confirmacao !== String(lote.nf_remessa_allied).trim()) {
    return NextResponse.json({ error: "Digite a NF Remessa exatamente igual para confirmar a exclusão." }, { status: 400 });
  }

  const { data: aparelhos, error: erroAparelhos } = await admin
    .from("orcamentos")
    .select("id, trade_allied, status_operacional")
    .eq("nf_remessa_allied", lote.nf_remessa_allied);
  if (erroAparelhos) return NextResponse.json({ error: erroAparelhos.message }, { status: 400 });

  type Aparelho = { id: string; trade_allied: string; status_operacional: string };
  const lista = (aparelhos ?? []) as Aparelho[];
  const andaram = lista.filter((a) => a.status_operacional !== STATUS_AG_ABERTURA);
  if (andaram.length > 0) {
    const exemplos = andaram
      .slice(0, 10)
      .map((a) => `${a.trade_allied} (${a.status_operacional})`)
      .join(", ");
    return NextResponse.json(
      {
        error: `Não dá pra excluir: ${andaram.length} aparelho(s) dessa NF já saíram de Ag. Abertura — ${exemplos}${andaram.length > 10 ? "..." : ""}. Volte esses aparelhos para Ag. Abertura (Movimentar) ou fale com o Administrador.`,
      },
      { status: 409 }
    );
  }

  // aparelhos (histórico de status, auditoria etc. saem juntos por cascata)
  const ids = lista.map((a) => a.id);
  for (let i = 0; i < ids.length; i += 200) {
    const { error } = await admin.from("orcamentos").delete().in("id", ids.slice(i, i + 200));
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // arquivos guardados dessa importação (Base de Orçamentos e Pré-Ordem)
  const { data: arquivos } = await admin.storage.from("bases-orcamentos").list(lote.id);
  if (arquivos && arquivos.length > 0) {
    await admin.storage.from("bases-orcamentos").remove(arquivos.map((f: { name: string }) => `${lote.id}/${f.name}`));
  }

  const { error: erroLote } = await admin.from("orcamentos_lotes").delete().eq("id", lote.id);
  if (erroLote) return NextResponse.json({ error: erroLote.message }, { status: 400 });

  console.log(`[excluir-lote] NF ${lote.nf_remessa_allied}: ${ids.length} aparelho(s) excluído(s) por ${user.id}`);
  return NextResponse.json({ ok: true, aparelhosExcluidos: ids.length });
}
