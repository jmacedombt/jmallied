import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { buscarMensagensConversa, enviarMensagem, marcarConversaComoLida } from "@/lib/chat";

// Histórico de uma conversa (?com=<usuarioId>) — já marca como lidas as
// mensagens que essa pessoa tinha mandado (abrir a conversa = ler,
// pedido explícito de confirmação de leitura).
export async function GET(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const outroId = new URL(request.url).searchParams.get("com");
  if (!outroId) {
    return NextResponse.json({ error: "Informe com quem é a conversa (com=<id>)." }, { status: 400 });
  }

  const admin = createAdminClient();
  try {
    await marcarConversaComoLida(admin, user.id, outroId);
    const mensagens = await buscarMensagensConversa(admin, user.id, outroId);
    return NextResponse.json({ mensagens });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Não foi possível carregar essa conversa." },
      { status: 400 }
    );
  }
}

// Envia mensagem direta (pedido explícito) — pra qualquer login,
// inclusive ALLIED; funciona com o destinatário online ou não (fica
// gravada, ele vê quando entrar/der o próximo polling).
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
  const texto = String(body?.texto ?? "").trim();

  if (!destinatarioId) {
    return NextResponse.json({ error: "Selecione pra quem mandar a mensagem." }, { status: 400 });
  }
  if (!texto) {
    return NextResponse.json({ error: "Escreva uma mensagem." }, { status: 400 });
  }
  if (destinatarioId === user.id) {
    return NextResponse.json({ error: "Não dá pra mandar mensagem pra você mesmo." }, { status: 400 });
  }

  const admin = createAdminClient();
  try {
    const mensagem = await enviarMensagem(admin, user.id, destinatarioId, texto);
    return NextResponse.json({ mensagem });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Não foi possível enviar a mensagem." },
      { status: 400 }
    );
  }
}
