import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { marcarAtividade } from "@/lib/presenca";

// "Heartbeat" chamado periodicamente enquanto o sistema está aberto
// (ver InactivityGuard.tsx, montado dentro do AppShell) — só atualiza a
// data/hora da última atividade (usuarios_atividade, migration 0058),
// base de "Usuários Online". Vale pra qualquer login, inclusive ALLIED.
export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  try {
    await marcarAtividade(supabase);
  } catch {
    // silencioso — não é crítico o suficiente pra incomodar quem está usando o sistema.
  }

  return NextResponse.json({ ok: true });
}
