import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";

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
    .select("nome, sobrenome, usuario, email, telefone, cargo, is_master, must_change_password")
    .order("nome", { ascending: true });

  return (
    <AppShell titulo="Usuários" perfil={perfil}>
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          {usuarios?.length ?? 0} usuário(s) cadastrado(s)
        </p>
        <Link
          href="/usuarios/novo"
          className="rounded-lg bg-allied-accent hover:bg-allied-accent2 text-white text-sm font-medium px-4 py-2.5 transition shadow-glow"
        >
          + Novo usuário
        </Link>
      </div>

      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--line)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left" style={{ background: "var(--surface2)", color: "var(--muted)" }}>
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium">Usuário</th>
              <th className="px-4 py-3 font-medium">Cargo</th>
              <th className="px-4 py-3 font-medium">E-mail</th>
              <th className="px-4 py-3 font-medium">Telefone</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {(usuarios ?? []).map((u) => (
              <tr
                key={u.usuario}
                className="border-t"
                style={{ borderColor: "var(--line)", background: "var(--surface)" }}
              >
                <td className="px-4 py-3" style={{ color: "var(--ink)" }}>
                  {u.nome} {u.sobrenome}
                </td>
                <td className="px-4 py-3" style={{ color: "var(--muted)" }}>
                  {u.usuario}
                </td>
                <td className="px-4 py-3" style={{ color: "var(--muted)" }}>
                  {u.is_master ? "Administrador" : u.cargo}
                </td>
                <td className="px-4 py-3" style={{ color: "var(--muted)" }}>
                  {u.email}
                </td>
                <td className="px-4 py-3" style={{ color: "var(--muted)" }}>
                  {u.telefone || "—"}
                </td>
                <td className="px-4 py-3">
                  {u.must_change_password ? (
                    <span className="text-amber-500 text-xs">Aguardando 1º acesso</span>
                  ) : (
                    <span className="text-emerald-500 text-xs">Ativo</span>
                  )}
                </td>
              </tr>
            ))}

            {(!usuarios || usuarios.length === 0) && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center"
                  style={{ color: "var(--muted)", background: "var(--surface)" }}
                >
                  Nenhum usuário cadastrado ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
