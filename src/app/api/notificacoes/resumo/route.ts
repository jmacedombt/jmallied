import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { podeGerenciarUsuarios } from "@/lib/usuarios";

/**
 * Resumo usado pelo sininho de notificações no topo da tela:
 * - pendenciasBid: pendências de cadastro no BID (peças sem Custo Peça
 *   Samsung) — qualquer usuário autenticado vê, não é informação
 *   sensível por cargo.
 * - solicitacoesResetSenha: pedidos de "esqueci minha senha" pendentes
 *   — só conta (e só aparece no sininho) pra quem pode gerenciar
 *   usuários (Administrador/Gerente/Diretor); qualquer outro cargo
 *   sempre recebe 0 aqui, mesmo que existam pedidos.
 */
export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const admin = createAdminClient();
  const { count } = await admin
    .from("bid_pecas")
    .select("id", { count: "exact", head: true })
    .is("custo_peca_samsung", null);

  const { data: perfil } = await admin.from("usuarios").select("cargo, is_master").eq("id", user.id).single();

  let solicitacoesResetSenha = 0;
  if (podeGerenciarUsuarios(perfil)) {
    const { count: countReset } = await admin
      .from("solicitacoes_reset_senha")
      .select("id", { count: "exact", head: true })
      .eq("status", "pendente");
    solicitacoesResetSenha = countReset ?? 0;
  }

  return NextResponse.json({ pendenciasBid: count ?? 0, solicitacoesResetSenha });
}
