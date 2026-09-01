import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import ConfigBidMarkupForm, { type FaixaMarkupLinha } from "@/components/ConfigBidMarkupForm";

export default async function ConfigBidMarkupPage() {
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

  const { data: faixas } = await supabase
    .from("configuracoes_bid_markup")
    .select("id, valor_min, valor_max, multiplicador, ordem")
    .order("ordem", { ascending: true })
    .returns<FaixaMarkupLinha[]>();

  return (
    <AppShell titulo="Faixas de Markup (BID)" perfil={perfil}>
      <h1 className="text-xl font-semibold mb-1" style={{ color: "var(--ink)" }}>
        Faixas de Markup (BID)
      </h1>
      <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>
        Definem o multiplicador aplicado sobre o custo da Base Peças pra formar o Custo Peça (Allied) de cada peça do
        BID, em Bases &gt; BID.
      </p>
      <ConfigBidMarkupForm faixasIniciais={faixas ?? []} />
    </AppShell>
  );
}
