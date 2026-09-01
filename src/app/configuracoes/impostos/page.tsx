import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import ConfigImpostoForm from "@/components/ConfigImpostoForm";

export default async function ConfigImpostosPage() {
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

  const { data: config } = await supabase.from("configuracoes_impostos").select("*").eq("id", 1).single();

  return (
    <AppShell titulo="Imposto (ICMS)" perfil={perfil}>
      <h1 className="text-xl font-semibold mb-1" style={{ color: "var(--ink)" }}>
        Imposto (ICMS)
      </h1>
      <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>
        Usado no cálculo de lucro do BID, em Bases &gt; BID.
      </p>
      <ConfigImpostoForm icmsInicial={config?.icms_percentual ?? 8.45} />
    </AppShell>
  );
}
