import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import ConsultaBidPanel from "@/components/ConsultaBidPanel";
import { podeImportarBid, type FaixaMarkup, type PecaBidConsulta } from "@/lib/bid";

const LOTE_BUSCA = 1000;

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

  const [{ data: faixasBrutas }, { data: configImposto }] = await Promise.all([
    supabase.from("configuracoes_bid_markup").select("valor_min, valor_max, multiplicador").order("ordem", { ascending: true }),
    supabase.from("configuracoes_impostos").select("icms_percentual").eq("id", 1).single(),
  ]);

  const faixas: FaixaMarkup[] = (faixasBrutas ?? []).map((f) => ({
    valor_min: Number(f.valor_min),
    valor_max: f.valor_max == null ? null : Number(f.valor_max),
    multiplicador: Number(f.multiplicador),
  }));

  const icmsPercentual = Number(configImposto?.icms_percentual ?? 0);

  // Consulta BID trabalha com a base completa carregada no navegador
  // (busca e filtros instantâneos, sem ida ao servidor) — busca tudo
  // aqui em lotes de 1000 (limite padrão de uma única consulta).
  const pecas: PecaBidConsulta[] = [];
  for (let inicio = 0; ; inicio += LOTE_BUSCA) {
    const { data, error } = await supabase
      .from("bid_pecas")
      .select(
        "id, modelo, part_number, custo_peca_samsung, valor_com_margem, custo_peca_allied, valor_imposto, mao_de_obra, travado, travado_em, valor_atualizado_em, valor_direcao, bid_solucoes(id, peca_solucao, principal)"
      )
      .order("modelo", { ascending: true })
      .order("part_number", { ascending: true })
      .range(inicio, inicio + LOTE_BUSCA - 1)
      .returns<PecaBidConsulta[]>();

    if (error || !data || data.length === 0) break;
    pecas.push(...data);
    if (data.length < LOTE_BUSCA) break;
  }

  const podeEditar = podeImportarBid(perfil);

  return (
    <AppShell titulo="Consulta BID" perfil={perfil}>
      <p className="text-sm mb-5" style={{ color: "var(--muted)" }}>
        Busca instantânea na base completa do BID. Combine os filtros de Part Number, Modelo e Peça Solução, e passe
        o mouse sobre o Custo Peça (Allied) pra ver como o valor foi calculado.
      </p>
      <ConsultaBidPanel pecasIniciais={pecas} faixas={faixas} icmsPercentual={icmsPercentual} podeEditar={podeEditar} />
    </AppShell>
  );
}
