import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { podeImportarOrcamentos } from "@/lib/orcamentos";

// Grava UM pacote de aparelhos da importação da Base de Orçamentos
// (pedido explícito, 21/10/2026) — a tela (ImportarOrcamentosForm.tsx)
// manda as linhas já preparadas por importar/route.ts em pacotes
// pequenos, uma requisição curta por pacote, pra nunca estourar o tempo
// máximo de uma função na Vercel. Aparelho que já existe na mesma NF
// Remessa (mesmo Trade Allied) é ignorado, sem duplicar — por isso subir
// de novo os mesmos arquivos depois de uma importação interrompida só
// grava o que faltou.
export const maxDuration = 30;
const MAX_LINHAS_POR_PACOTE = 100;

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const admin = createAdminClient();
  const { data: perfil } = await admin.from("usuarios").select("cargo, is_master").eq("id", user.id).single();
  if (!podeImportarOrcamentos(perfil)) {
    return NextResponse.json({ error: "Seu cargo não tem permissão para importar a base de orçamentos." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const loteId = typeof body?.loteId === "string" ? body.loteId : null;
  const linhas = Array.isArray(body?.linhas) ? (body.linhas as Record<string, unknown>[]) : null;
  if (!loteId || !linhas || linhas.length === 0 || linhas.length > MAX_LINHAS_POR_PACOTE) {
    return NextResponse.json({ error: "Pacote de importação inválido." }, { status: 400 });
  }

  const { data: lote } = await admin.from("orcamentos_lotes").select("id, nf_remessa_allied").eq("id", loteId).single();
  if (!lote) return NextResponse.json({ error: "Importação não encontrada." }, { status: 404 });

  // toda linha tem que ser da MESMA NF Remessa do lote registrado, e
  // fica sempre ligada a esse lote (nunca confia no lote_id que veio).
  if (linhas.some((l) => String(l.nf_remessa_allied ?? "") !== String(lote.nf_remessa_allied))) {
    return NextResponse.json({ error: "Há linhas de outra NF Remessa nesse pacote." }, { status: 400 });
  }
  const pacote = linhas.map((l) => ({ ...l, lote_id: lote.id }));

  const { data, error } = await admin
    .from("orcamentos")
    .upsert(pacote, { onConflict: "nf_remessa_allied,trade_allied", ignoreDuplicates: true })
    .select("reincidente");

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({
    inseridos: (data ?? []).length,
    reincidentes: ((data ?? []) as { reincidente: boolean }[]).filter((r) => r.reincidente).length,
  });
}
