import { Info } from "lucide-react";
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
      <div className="flex items-center gap-2 mb-5">
        <p className="text-sm" style={{ color: "var(--ink)" }}>
          Busca instantânea na base completa do BID.
        </p>
        <div className="group relative inline-flex">
          <Info size={15} style={{ color: "var(--muted)" }} className="cursor-help" />
          <div
            className="pointer-events-none absolute left-0 top-6 z-20 hidden w-80 rounded-lg border p-3 text-xs shadow-2xl group-hover:block"
            style={{ background: "var(--surface2)", borderColor: "var(--line)", color: "var(--muted)" }}
          >
            Combine os filtros de Part Number, Modelo e Peça Solução, e passe o mouse sobre o Custo Peça (Allied) pra
            ver como o valor foi calculado.
          </div>
        </div>
      </div>
      <ConsultaBidPanel pecasIniciais={pecas} faixas={faixas} icmsPercentual={icmsPercentual} podeEditar={podeEditar} />
    </AppShell>
  );
}
