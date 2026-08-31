import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import UserForm from "@/components/UserForm";

export default async function NovoUsuarioPage() {
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
    <AppShell titulo="Novo usuário" perfil={perfil}>
      <Link
        href="/usuarios"
        className="inline-flex items-center gap-1.5 text-xs hover:opacity-80 mb-4"
        style={{ color: "var(--muted)" }}
      >
        <ArrowLeft size={14} />
        Voltar para usuários
      </Link>
      <h1 className="text-xl font-semibold mb-1" style={{ color: "var(--ink)" }}>
        Novo usuário
      </h1>
      <p className="text-sm mb-8" style={{ color: "var(--muted)" }}>
        O usuário (login) é sugerido automaticamente a partir do nome e
        sobrenome. A senha inicial é sempre <strong>Allied001</strong> e a
        troca é obrigatória no primeiro acesso.
      </p>
      <UserForm />
    </AppShell>
  );
}
