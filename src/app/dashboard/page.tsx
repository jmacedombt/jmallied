import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import LogoutButton from "@/components/LogoutButton";

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
    <main className="min-h-screen bg-allied-bg">
      <header className="border-b border-allied-border bg-allied-panel/60">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="relative h-9 w-9">
              <Image src="/logo-allied.png" alt="Allied" fill sizes="36px" className="object-contain" />
            </div>
            <span className="text-sm font-semibold text-white">Grupo J.Macedo | Allied</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-allied-silver/70">
              {perfil ? `${perfil.nome} ${perfil.sobrenome}` : ""}
              {perfil?.is_master ? " · Administrador" : perfil?.cargo ? ` · ${perfil.cargo}` : ""}
            </span>
            <LogoutButton />
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-semibold text-white mb-2">Painel inicial</h1>
        <p className="text-sm text-allied-silver/60 mb-8">
          Este é o ponto de partida do sistema Allied. As demais telas e regras
          vão sendo adicionadas conforme forem definidas.
        </p>

        <div className="grid sm:grid-cols-2 gap-4">
          <Link
            href="/usuarios"
            className="rounded-xl border border-allied-border bg-allied-panel/70 p-6 hover:border-allied-accent2 transition"
          >
            <h2 className="text-white font-medium mb-1">Usuários</h2>
            <p className="text-xs text-allied-silver/60">
              Consultar e cadastrar usuários com acesso ao sistema.
            </p>
          </Link>
        </div>
      </div>
    </main>
  );
}
