import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import { podeConfirmarAnaliseEmLote } from "@/lib/orcamentos";
import { dataIsoValida, intervaloPadraoDias } from "@/lib/metricas";
import FiltroPeriodoSimples from "@/components/FiltroPeriodoSimples";
import PainelDevolucaoPorLotes, { type LoteDevolucao } from "@/components/PainelDevolucaoPorLotes";

// Métricas > Devolução por Lotes (migration 0084). Período filtra pela
// Data Reconhecimento do lote; janela padrão de 90 dias.
const JANELA_PADRAO_DIAS = 90;

export default async function DevolucaoPorLotesPage({
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
      <AppShell titulo="Devolução por Lotes" perfil={perfil}>
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

  const { data, error } = await supabase.rpc("metricas_devolucao_por_lote", { p_inicio: inicio, p_fim: fim });

  const n = (v: unknown) => Number(v ?? 0);
  const lotes: LoteDevolucao[] = ((data ?? []) as Record<string, unknown>[]).map((l) => ({
    nf: String(l.nf_remessa_allied ?? ""),
    dataReconhecimento: String(l.data_reconhecimento ?? ""),
    recebidos: n(l.recebidos),
    entregues: n(l.entregues),
    faixas: [n(l.ate_7), n(l.ate_14), n(l.ate_21), n(l.ate_28), n(l.acima_28)],
    emAberto: n(l.em_aberto),
    abertoAtrasado: n(l.aberto_atrasado),
    abertoMaxDias: l.aberto_max_dias == null ? null : n(l.aberto_max_dias),
    reprovados: n(l.reprovados),
    somaDias: n(l.soma_dias),
    diasEntregues: Array.isArray(l.dias_entregues) ? (l.dias_entregues as unknown[]).map(n) : [],
    ultimaEntrega: l.ultima_entrega ? String(l.ultima_entrega) : null,
  }));

  return (
    <AppShell
      titulo="Devolução por Lotes"
      tituloInfo="Dias corridos da Data Reconhecimento do lote até o aparelho virar Produto Entregue. Meta: entregar em até 7 dias. Reprovados ficam fora da conta."
      perfil={perfil}
    >
      {voltar}
      <FiltroPeriodoSimples inicio={inicio} fim={fim} rotulo="Período (data de reconhecimento do lote):" />
      {error ? (
        <p className="text-sm text-red-500">
          Não foi possível carregar os dados ({error.message}). Confira se a migration 0084 já foi rodada no Supabase.
        </p>
      ) : (
        <PainelDevolucaoPorLotes lotes={lotes} />
      )}
    </AppShell>
  );
}
