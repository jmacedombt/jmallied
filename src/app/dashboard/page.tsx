import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";

export default async function DashboardPage() {
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

  return (
    <AppShell titulo="Início" perfil={perfil}>
      <h1 className="text-xl font-semibold mb-2" style={{ color: "var(--ink)" }}>
        Painel inicial
      </h1>
      <p className="text-sm mb-8" style={{ color: "var(--muted)" }}>
        Este é o ponto de partida do sistema Allied. As demais telas e regras
        vão sendo adicionadas conforme forem definidas.
      </p>

      <div className="grid sm:grid-cols-2 gap-4">
        <Link
          href="/usuarios"
          className="rounded-xl border p-6 hover:border-allied-accent2 transition"
          style={{ background: "var(--surface)", borderColor: "var(--line)" }}
        >
          <h2 className="font-medium mb-1" style={{ color: "var(--ink)" }}>
            Usuários
          </h2>
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            Consultar e cadastrar usuários com acesso ao sistema.
          </p>
        </Link>
      </div>
    </AppShell>
  );
}
