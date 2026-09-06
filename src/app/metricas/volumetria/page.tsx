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
  type PontoPeriodo,
  type PontoPeriodoStatus,
  type ContagemStatus,
} from "@/lib/metricas";
import FiltroPeriodoMetricas from "@/components/FiltroPeriodoMetricas";
import PainelVolumetria from "@/components/PainelVolumetria";

export default async function VolumetriaPage({
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
      <AppShell titulo="Volumetria" perfil={perfil}>
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

  const [{ data: reconhecidosBrutos }, { data: entradasBrutas }, { data: estoqueBruto }] = await Promise.all([
    supabase.rpc("metricas_reconhecidos_por_periodo", { p_granularidade: unidade, p_inicio: inicio, p_fim: fim }),
    supabase.rpc("metricas_entradas_status_por_periodo", { p_granularidade: unidade, p_inicio: inicio, p_fim: fim }),
    supabase.rpc("orcamentos_metricas_status"),
  ]);

  const reconhecidos: PontoPeriodo[] = (reconhecidosBrutos ?? []).map((p: { periodo: string; quantidade: number }) => ({
    periodo: p.periodo,
    quantidade: Number(p.quantidade),
  }));

  const entradasPorStatus: PontoPeriodoStatus[] = (entradasBrutas ?? []).map(
    (p: { periodo: string; status: string; quantidade: number }) => ({
      periodo: p.periodo,
      status: p.status,
      quantidade: Number(p.quantidade),
    })
  );

  const estoqueAtual: ContagemStatus[] = (estoqueBruto ?? []).map(
    (p: { status_operacional: string; quantidade: number }) => ({
      status_operacional: p.status_operacional,
      quantidade: Number(p.quantidade),
    })
  );

  return (
    <AppShell titulo="Volumetria" perfil={perfil}>
      {voltar}
      <FiltroPeriodoMetricas granularidade={granularidade} inicio={inicio} fim={fim} />
      <PainelVolumetria
        granularidade={granularidade}
        inicio={inicio}
        fim={fim}
        reconhecidos={reconhecidos}
        entradasPorStatus={entradasPorStatus}
        estoqueAtual={estoqueAtual}
      />
    </AppShell>
  );
}
