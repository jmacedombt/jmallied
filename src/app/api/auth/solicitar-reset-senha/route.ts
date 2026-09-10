import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * "Esqueci minha senha" (pop-up da tela de login, ninguém autenticado
 * ainda) — só registra o pedido pra um administrador ver na tela
 * Usuários e resetar manualmente; não manda e-mail nem link nenhum (os
 * logins usam e-mail técnico fake, não uma caixa de entrada de verdade).
 *
 * Responde sempre a mesma mensagem de sucesso, ache ou não o usuário —
 * não é uma rota autenticada, então não deve confirmar pra quem está
 * pedindo quais logins existem no sistema.
 */
export async function POST(request: Request) {
  const respostaGenerica = NextResponse.json({
    ok: true,
    mensagem: "Se esse usuário existir, avisamos o administrador. Aguarde o contato dele.",
  });

  const body = await request.json().catch(() => null);
  const usuarioLogin = typeof body?.usuario === "string" ? body.usuario.trim().toLowerCase() : "";
  if (!usuarioLogin) return respostaGenerica;

  const admin = createAdminClient();

  const { data: alvo } = await admin
    .from("usuarios")
    .select("id, bloqueado_em")
    .eq("usuario", usuarioLogin)
    .single();

  // usuário não existe ou está bloqueado — mesma resposta genérica, sem
  // registrar nada.
  if (!alvo || alvo.bloqueado_em) return respostaGenerica;

  const { data: pendenteExistente } = await admin
    .from("solicitacoes_reset_senha")
    .select("id")
    .eq("usuario_id", alvo.id)
    .eq("status", "pendente")
    .limit(1);

  // já tem um pedido pendente dessa mesma pessoa — não duplica a cada
  // clique (a pessoa pode tentar de novo achando que não funcionou).
  if (!pendenteExistente || pendenteExistente.length === 0) {
    await admin.from("solicitacoes_reset_senha").insert({ usuario_id: alvo.id });
  }

  return respostaGenerica;
}
