import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { marcarLogin } from "@/lib/presenca";

// Chamada uma vez, logo depois de "Entrar" dar certo (ver LoginForm.tsx)
// — grava data/hora do login (usuarios_atividade, migration 0058), a
// mesma linha que alimenta "Usuários Online". Vale pra qualquer login,
// inclusive ALLIED (o logout automático por inatividade também vale
// pra esse cargo — pedido explícito); só a LISTAGEM (GET
// /api/usuarios/online) é que fica de fora pro ALLIED.
export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  try {
    await marcarLogin(supabase);
  } catch {
    // nunca trava o login por causa disso — só deixa de aparecer em
    // "Usuários Online" dessa vez.
  }

  return NextResponse.json({ ok: true });
}
