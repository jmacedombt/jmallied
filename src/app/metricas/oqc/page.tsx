import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import { podeConfirmarAnaliseEmLote } from "@/lib/orcamentos";
import {
  granularidadeValida,
  dataIsoValida,
  intervaloPadrao,
  unidadePostgres,
  type LinhaOqc,
  type PontoPeriodoOqc,
} from "@/lib/metricas";
import FiltroPeriodoMetricas from "@/components/FiltroPeriodoMetricas";
import PainelMetricasOqc from "@/components/PainelMetricasOqc";

export default async function MetricasOqcPage({
  searchParams,
}: {
  searchParams: { granularidade?: string; inicio?: string; fim?: string };
}) {
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

  const voltar = (
    <Link
      href="/metricas"
      title="Voltar para Métricas"
      aria-label="Voltar para Métricas"
      className="botao-voltar-brilho relative inline-flex items-center justify-center w-11 h-11 rounded-full mb-3 transition-transform hover:scale-110 active:scale-100"
    >
      <ArrowLeft size={20} strokeWidth={2.5} style={{ color: "var(--accent2)", filter: "drop-shadow(0 0 5px var(--accent2))" }} />
    </Link>
  );

  if (!podeConfirmarAnaliseEmLote(perfil)) {
    return (
      <AppShell titulo="OQC" perfil={perfil}>
        {voltar}
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Seu cargo não tem permissão para acessar o menu Métricas.
        </p>
      </AppShell>
    );
  }

  const granularidade = granularidadeValida(searchParams.granularidade) ? searchParams.granularidade : "semana";
  const padrao = intervaloPadrao(granularidade);
  const inicio = dataIsoValida(searchParams.inicio) ? searchParams.inicio : padrao.inicio;
  const fim = dataIsoValida(searchParams.fim) ? searchParams.fim : padrao.fim;
  const unidade = unidadePostgres(granularidade);

  const [{ data: avaliacoesBrutas, error: erroAvaliacoes }, { data: serieBruta, error: erroSerie }] = await Promise.all([
    supabase.rpc("oqc_avaliacoes_periodo", { p_inicio: inicio, p_fim: fim }),
    supabase.rpc("oqc_serie_por_periodo", { p_granularidade: unidade, p_inicio: inicio, p_fim: fim }),
  ]);

  const linhas: LinhaOqc[] = (avaliacoesBrutas ?? []).map(
    (l: { orcamento_id: string; nf_remessa_allied: string | null; trade_allied: string | null; resultado: string; avaliado_em: string }) => ({
      orcamentoId: l.orcamento_id,
      nfRemessaAllied: l.nf_remessa_allied,
      tradeAllied: l.trade_allied,
      resultado: l.resultado as LinhaOqc["resultado"],
      avaliadoEm: l.avaliado_em,
    })
  );

  const serie: PontoPeriodoOqc[] = (serieBruta ?? []).map(
    (p: { periodo: string; resultado: string; quantidade: number }) => ({
      periodo: p.periodo,
      resultado: p.resultado as PontoPeriodoOqc["resultado"],
      quantidade: Number(p.quantidade),
    })
  );

  const erro = erroAvaliacoes?.message ?? erroSerie?.message ?? null;

  return (
    <AppShell
      titulo="OQC"
      tituloInfo='Métrica do controle de qualidade: quantidade de PASS/FAIL e % de FAIL (sobre quem já foi avaliado) por lote (NF Remessa), reincidência de falha por aparelho, e a evolução de PASS x FAIL ao longo do tempo.'
      perfil={perfil}
    >
      {voltar}
      <FiltroPeriodoMetricas granularidade={granularidade} inicio={inicio} fim={fim} />
      {erro ? (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
          Não foi possível carregar a métrica: {erro}
        </p>
      ) : (
        <PainelMetricasOqc linhas={linhas} serie={serie} granularidade={granularidade} inicio={inicio} fim={fim} />
      )}
    </AppShell>
  );
}
