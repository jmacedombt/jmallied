import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import TabelaUsuarios from "@/components/TabelaUsuarios";
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

  return (
    <AppShell titulo="Usuários" perfil={perfil}>
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
        podeGerenciar={podeGerenciarUsuarios(perfil)}
        souMaster={!!perfil?.is_master}
        meuId={user?.id ?? ""}
      />
    </AppShell>
  );
}
