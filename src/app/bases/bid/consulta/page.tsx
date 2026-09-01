import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import ConsultaBidPanel from "@/components/ConsultaBidPanel";
import type { FaixaMarkup } from "@/lib/bid";

export default async function ConsultaBidPage() {
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

  const { data: faixasBrutas } = await supabase
    .from("configuracoes_bid_markup")
    .select("valor_min, valor_max, multiplicador")
    .order("ordem", { ascending: true });

  const faixas: FaixaMarkup[] = (faixasBrutas ?? []).map((f) => ({
    valor_min: Number(f.valor_min),
    valor_max: f.valor_max == null ? null : Number(f.valor_max),
    multiplicador: Number(f.multiplicador),
  }));

  return (
    <AppShell titulo="Consulta BID" perfil={perfil}>
      <p className="text-sm mb-5" style={{ color: "var(--muted)" }}>
        Busca rápida por Part Number. Passe o mouse sobre o Custo Peça (Allied) pra ver como o valor foi calculado.
      </p>
      <ConsultaBidPanel faixas={faixas} />
    </AppShell>
  );
}
