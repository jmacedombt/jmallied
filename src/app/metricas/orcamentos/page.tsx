import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import { podeConfirmarAnaliseEmLote } from "@/lib/orcamentos";
import { dataIsoValida, intervaloPadraoDias, type LinhaResultadoOrcamento, type LinhaResultadoPeca } from "@/lib/metricas";
import FiltroPeriodoSimples from "@/components/FiltroPeriodoSimples";
import PainelMetricasOrcamentos from "@/components/PainelMetricasOrcamentos";

// janela padrão bem mais larga que Volumetria/R-TAT (30/84/365 dias) —
// aqui o "período" é quando o orçamento FECHOU (decisão tomada), e como
// o ciclo de análise + resposta da Allied pode levar semanas, um período
// curto deixaria a tela praticamente vazia logo depois de publicada.
const JANELA_PADRAO_DIAS = 180;

export default async function MetricasOrcamentosPage({
  searchParams,
}: {
  searchParams: { inicio?: string; fim?: string };
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
      <AppShell titulo="Orçamentos" perfil={perfil}>
        {voltar}
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Seu cargo não tem permissão para acessar o menu Métricas.
        </p>
      </AppShell>
    );
  }

  const padrao = intervaloPadraoDias(JANELA_PADRAO_DIAS);
  const inicio = dataIsoValida(searchParams.inicio) ? searchParams.inicio : padrao.inicio;
  const fim = dataIsoValida(searchParams.fim) ? searchParams.fim : padrao.fim;

  const [{ data: resultadoBruto, error: erroResultado }, { data: pecasBruto, error: erroPecas }] = await Promise.all([
    supabase.rpc("metricas_resultado_orcamentos", { p_inicio: inicio, p_fim: fim }),
    supabase.rpc("metricas_resultado_pecas", { p_inicio: inicio, p_fim: fim }),
  ]);

  const linhas: LinhaResultadoOrcamento[] = (resultadoBruto ?? []).map(
    (l: {
      orcamento_id: string;
      nf_remessa_allied: string | null;
      modelo_comercial: string | null;
      resultado: string;
      fechado_em: string;
      venda_total_pecas: number | string | null;
      mao_de_obra: number | string | null;
      valor_total_reparo: number | string | null;
    }) => ({
      orcamento_id: l.orcamento_id,
      nf_remessa_allied: l.nf_remessa_allied,
      modelo_comercial: l.modelo_comercial,
      resultado: l.resultado as LinhaResultadoOrcamento["resultado"],
      fechado_em: l.fechado_em,
      venda_total_pecas: l.venda_total_pecas != null ? Number(l.venda_total_pecas) : null,
      mao_de_obra: l.mao_de_obra != null ? Number(l.mao_de_obra) : null,
      valor_total_reparo: l.valor_total_reparo != null ? Number(l.valor_total_reparo) : null,
    })
  );

  const linhasPeca: LinhaResultadoPeca[] = (pecasBruto ?? []).map(
    (p: { part_number: string; resultado: string; quantidade: number | string }) => ({
      part_number: p.part_number,
      resultado: p.resultado as LinhaResultadoPeca["resultado"],
      quantidade: Number(p.quantidade),
    })
  );

  const erro = erroResultado?.message ?? erroPecas?.message ?? null;

  return (
    <AppShell
      titulo="Orçamentos"
      tituloInfo='Classifica cada orçamento fechado no período em 4 resultados — Aprovado de primeira, Reprovado de primeira, Contra proposta aceita e Contra proposta recusada — usando o histórico de status (mesma base do R-TAT). "Contra proposta" é qualquer orçamento que passou por "4 - Ag. Resposta de Reorçamento" antes de fechar.'
      perfil={perfil}
    >
      {voltar}
      <FiltroPeriodoSimples inicio={inicio} fim={fim} />
      {erro ? (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
          Não foi possível carregar as métricas: {erro}
        </p>
      ) : (
        <PainelMetricasOrcamentos linhas={linhas} linhasPeca={linhasPeca} />
      )}
    </AppShell>
  );
}
