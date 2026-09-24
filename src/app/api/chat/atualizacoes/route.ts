import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { buscarAtualizacoesChat } from "@/lib/chat";

// Polling do ChatWidget (a cada poucos segundos, ver ChatWidget.tsx) —
// mensagens recebidas desde a última checagem (pra disparar o balão
// flutuante + som + piscar a aba) e o total de não lidas (pro número no
// ícone do chat). Vale pra qualquer login, inclusive ALLIED.
export async function GET(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const desde = new URL(request.url).searchParams.get("desde") || new Date(0).toISOString();

  const admin = createAdminClient();
  try {
    const atualizacoes = await buscarAtualizacoesChat(admin, user.id, desde);
    return NextResponse.json(atualizacoes);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Não foi possível buscar atualizações do chat." },
      { status: 400 }
    );
  }
}
