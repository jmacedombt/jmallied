import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import TabelaUsuarios from "@/components/TabelaUsuarios";
import PainelSolicitacoesResetSenha, { type SolicitacaoResetSenhaLinha } from "@/components/PainelSolicitacoesResetSenha";
import { podeGerenciarUsuarios } from "@/lib/usuarios";

export default async function UsuariosPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let perfil: { nome: string; sobrenome: string; cargo: string; is_master: boolean } | null = null;
  if (user) {
    const { data } = await supabase
      .from("usuarios")
      .select("nome, sobrenome, cargo, is_master")
      .eq("id", user.id)
      .single();
    perfil = data;
  }

  const { data: usuarios } = await supabase
    .from("usuarios")
    .select("id, nome, sobrenome, usuario, email, telefone, cargo, is_master, must_change_password, bloqueado_em")
    .order("nome", { ascending: true });

  const podeGerenciar = podeGerenciarUsuarios(perfil);

  // pedidos de "esqueci minha senha" pendentes — só busca pra quem pode
  // resetar senha de qualquer um mesmo (ver PainelSolicitacoesResetSenha.tsx).
  let solicitacoesPendentes: SolicitacaoResetSenhaLinha[] = [];
  if (podeGerenciar) {
    const { data: pendentes } = await supabase
      .from("solicitacoes_reset_senha")
      .select("id, criado_em, usuario_id")
      .eq("status", "pendente")
      .order("criado_em", { ascending: true });

    if (pendentes && pendentes.length > 0) {
      const idsAlvo = pendentes.map((p) => p.usuario_id);
      const { data: donosDosPedidos } = await supabase
        .from("usuarios")
        .select("id, nome, sobrenome, usuario")
        .in("id", idsAlvo);
      const mapaDonos = new Map((donosDosPedidos ?? []).map((d) => [d.id, d]));

      solicitacoesPendentes = pendentes.flatMap((p) => {
        const dono = mapaDonos.get(p.usuario_id);
        if (!dono) return [];
        return [{ id: p.id, criado_em: p.criado_em, usuario_id: p.usuario_id, nome: dono.nome, sobrenome: dono.sobrenome, usuario: dono.usuario }];
      });
    }
  }

  return (
    <AppShell titulo="Usuários" perfil={perfil}>
      <PainelSolicitacoesResetSenha solicitacoes={solicitacoesPendentes} />

      <div className="flex items-center justify-between mb-6">
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          {usuarios?.length ?? 0} usuário(s) cadastrado(s)
        </p>
        <Link
          href="/usuarios/novo"
          className="rounded-lg bg-[var(--accent)] hover:bg-[var(--accent2)] text-white text-sm font-medium px-4 py-2.5 transition"
          style={{ boxShadow: "0 0 40px var(--accent-glow)" }}
        >
          + Novo usuário
        </Link>
      </div>

      <TabelaUsuarios
        usuarios={usuarios ?? []}
        podeGerenciar={podeGerenciar}
        souMaster={!!perfil?.is_master}
        meuId={user?.id ?? ""}
      />
    </AppShell>
  );
}
