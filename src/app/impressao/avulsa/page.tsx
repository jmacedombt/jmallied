import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import PainelBipagem from "@/components/PainelBipagem";

export default async function ImpressaoAvulsaPage() {
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
    <AppShell titulo="Impressão Avulsa" perfil={perfil}>
      <p className="text-sm mb-5" style={{ color: "var(--muted)" }}>
        Bipe ou digite o Trade Allied de qualquer aparelho da base de orçamentos pra reimprimir a etiqueta — não
        precisa estar em Ag. Triagem, e não mexe no status do aparelho.
      </p>
      <div className="max-w-lg">
        <PainelBipagem modo="avulsa" />
      </div>
    </AppShell>
  );
}
