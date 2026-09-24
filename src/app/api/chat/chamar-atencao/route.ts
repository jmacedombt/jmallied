import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { enviarChamarAtencao } from "@/lib/chat";

// "Chamar atenção" (nudge estilo MSN, pedido explícito) — igual ao
// "Buzz" do antigo MSN Messenger: dispara um alerta mais forte que uma
// mensagem normal (balão treme + som mais forte, ver ChatWidget.tsx),
// pra qualquer login, inclusive ALLIED.
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const destinatarioId = String(body?.destinatarioId ?? "").trim();
  const texto = typeof body?.texto === "string" ? body.texto : null;

  if (!destinatarioId) {
    return NextResponse.json({ error: "Selecione pra quem chamar atenção." }, { status: 400 });
  }
  if (destinatarioId === user.id) {
    return NextResponse.json({ error: "Não dá pra chamar sua própria atenção." }, { status: 400 });
  }

  const admin = createAdminClient();
  try {
    const mensagem = await enviarChamarAtencao(admin, user.id, destinatarioId, texto);
    return NextResponse.json({ mensagem });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Não foi possível chamar atenção dessa pessoa." },
      { status: 400 }
    );
  }
}
