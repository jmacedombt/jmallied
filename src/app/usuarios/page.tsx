import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function UsuariosPage() {
  const supabase = createClient();

  const { data: usuarios } = await supabase
    .from("usuarios")
    .select("nome, sobrenome, usuario, email, telefone, cargo, is_master, must_change_password")
    .order("nome", { ascending: true });

  return (
    <main className="min-h-screen bg-allied-bg px-6 py-10">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link href="/dashboard" className="text-xs text-allied-silver/60 hover:text-white">
              ← Painel inicial
            </Link>
            <h1 className="text-2xl font-semibold text-white mt-3">Usuários</h1>
          </div>
          <Link
            href="/usuarios/novo"
            className="rounded-lg bg-allied-accent hover:bg-allied-accent2 text-white text-sm font-medium px-4 py-2.5 transition shadow-glow"
          >
            + Novo usuário
          </Link>
        </div>

        <div className="rounded-xl border border-allied-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-allied-panel2 text-allied-silver/70 text-left">
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
                <tr key={u.usuario} className="border-t border-allied-border bg-allied-panel/50">
                  <td className="px-4 py-3 text-allied-silver">
                    {u.nome} {u.sobrenome}
                  </td>
                  <td className="px-4 py-3 text-allied-silver/80">{u.usuario}</td>
                  <td className="px-4 py-3 text-allied-silver/80">
                    {u.is_master ? "Administrador" : u.cargo}
                  </td>
                  <td className="px-4 py-3 text-allied-silver/80">{u.email}</td>
                  <td className="px-4 py-3 text-allied-silver/80">{u.telefone || "—"}</td>
                  <td className="px-4 py-3">
                    {u.must_change_password ? (
                      <span className="text-amber-400 text-xs">Aguardando 1º acesso</span>
                    ) : (
                      <span className="text-emerald-400 text-xs">Ativo</span>
                    )}
                  </td>
                </tr>
              ))}

              {(!usuarios || usuarios.length === 0) && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-allied-silver/40">
                    Nenhum usuário cadastrado ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
