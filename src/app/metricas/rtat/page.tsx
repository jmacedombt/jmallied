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
  type PontoRTatTotal,
  type PontoRTatStatus,
} from "@/lib/metricas";
import FiltroPeriodoMetricas from "@/components/FiltroPeriodoMetricas";
import PainelRTat from "@/components/PainelRTat";

export default async function RTatPage({
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
      <AppShell titulo="R-TAT" perfil={perfil}>
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

  const [{ data: rtatTotalBruto }, { data: rtatStatusBruto }] = await Promise.all([
    supabase.rpc("metricas_rtat_total_por_periodo", { p_granularidade: unidade, p_inicio: inicio, p_fim: fim }),
    supabase.rpc("metricas_rtat_por_status", { p_granularidade: unidade, p_inicio: inicio, p_fim: fim }),
  ]);

  const rtatTotal: PontoRTatTotal[] = (rtatTotalBruto ?? []).map(
    (p: { periodo: string; tat_medio_dias: number; quantidade: number }) => ({
      periodo: p.periodo,
      tat_medio_dias: Number(p.tat_medio_dias),
      quantidade: Number(p.quantidade),
    })
  );

  const rtatPorStatus: PontoRTatStatus[] = (rtatStatusBruto ?? []).map(
    (p: { periodo: string; status: string; tat_medio_dias: number; quantidade: number }) => ({
      periodo: p.periodo,
      status: p.status,
      tat_medio_dias: Number(p.tat_medio_dias),
      quantidade: Number(p.quantidade),
    })
  );

  return (
    <AppShell titulo="R-TAT" perfil={perfil}>
      {voltar}
      <FiltroPeriodoMetricas granularidade={granularidade} inicio={inicio} fim={fim} />
      <PainelRTat granularidade={granularidade} inicio={inicio} fim={fim} rtatTotal={rtatTotal} rtatPorStatus={rtatPorStatus} />
    </AppShell>
  );
}
