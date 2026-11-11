"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck2, CircleDollarSign, Landmark, Pencil, Plus, Receipt, TrendingUp, Wallet } from "lucide-react";
import GraficoFinanceiroMensal from "@/components/GraficoFinanceiroMensal";
import type { PontoGrafico } from "@/components/GraficoLinhaGradiente";
import PopupLancamentoFinanceiro, { type DadosLancamentoFinanceiro } from "@/components/PopupLancamentoFinanceiro";
import PopupReceberValor from "@/components/PopupReceberValor";
import PopupBaixaEmMassa from "@/components/PopupBaixaEmMassa";
import { ROTULO_TIPO_NOTA, hojeIso, ultimosNMeses, type LinhaFinanceiro, type NotaFinanceiro } from "@/lib/financeiro";

function formatarReal(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

type Granularidade = "mes" | "semana";
const QTD_MESES = 6;
const QTD_SEMANAS = 12;
const NOMES_MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** segunda-feira (aaaa-mm-dd) da semana de uma data aaaa-mm-dd — em UTC
 * puro, pra não escorregar um dia por fuso. */
function inicioSemana(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  const dia = d.getUTCDay() || 7; // domingo = 7
  d.setUTCDate(d.getUTCDate() - (dia - 1));
  return d.toISOString().slice(0, 10);
}

function ultimasNSemanas(n: number): string[] {
  const atual = new Date(`${inicioSemana(hojeIso())}T00:00:00Z`);
  const lista: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(atual);
    d.setUTCDate(d.getUTCDate() - 7 * i);
    lista.push(d.toISOString().slice(0, 10));
  }
  return lista;
}

/** número da semana ISO (segunda a domingo) — mesmo padrão "W34" das Métricas */
function numeroSemanaIso(iso: string): number {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  const diaSemana = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - diaSemana);
  const inicioAno = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - inicioAno.getTime()) / 86400000 + 1) / 7);
}

function rotuloPeriodo(chave: string, g: Granularidade): string {
  const [ano, mes] = chave.split("-");
  if (g === "mes") return `${NOMES_MES[Number(mes) - 1]}/${ano.slice(2)}`;
  return `W${numeroSemanaIso(chave)}`;
}

/** Soma {data, valor} por mês ou semana nos últimos períodos (período sem
 * nada aparece com R$ 0). */
function montarPontos(itens: { data: string; valor: number }[], g: Granularidade): PontoGrafico[] {
  const periodos = g === "mes" ? ultimosNMeses(QTD_MESES) : ultimasNSemanas(QTD_SEMANAS);
  const mapa: Record<string, number> = {};
  for (const it of itens) {
    const chave = g === "mes" ? `${it.data.slice(0, 7)}-01` : inicioSemana(it.data);
    mapa[chave] = (mapa[chave] ?? 0) + it.valor;
  }
  return periodos.map((p) => ({ rotulo: rotuloPeriodo(p, g), valor: mapa[p] ?? 0 }));
}

function formatarDataCurta(iso: string | null): string {
  if (!iso) return "—";
  return new Date(`${iso}T00:00:00`).toLocaleDateString("pt-BR");
}

/**
 * Tela principal do módulo Financeiro: KPIs no topo, os 2 gráficos de
 * linha com sombreamento ("Notas emitidas" e "Valores recebidos", os dois
 * nos últimos 6 meses, mesmo gráfico mudando só a cor — pedido explícito,
 * 07/10/2026) e a tabela com UMA LINHA POR NOTA FISCAL (pedido
 * explícito, 07/10/2026): cada NF (Mão de Obra ou Peças) tem o próprio
 * status e a própria data de recebimento, e a baixa é feita por nota —
 * individual (clicando no status) ou em massa (selecionando várias).
 * A grande maioria das notas chega sozinha (ver salvar-nf/route.ts →
 * registrarLancamentoFinanceiro) — "+ Novo lançamento" e o lápis são o
 * complemento manual / correção de número, valor e data de emissão.
 */
export default function PainelFinanceiro({
  linhas,
  notas,
}: {
  linhas: LinhaFinanceiro[];
  notas: NotaFinanceiro[];
}) {
  const router = useRouter();
  // período dos 2 gráficos (pedido explícito, 10/11/2026): mês ou semana
  const [granularidade, setGranularidade] = useState<Granularidade>("mes");
  const pontosEmitidas = useMemo(
    () => montarPontos(notas.map((n) => ({ data: n.dataEmissao, valor: n.valor ?? 0 })), granularidade),
    [notas, granularidade]
  );
  const pontosRecebidas = useMemo(
    () =>
      montarPontos(
        notas
          .filter((n) => n.status === "Vlr. Recebido" && n.dataRecebimento)
          .map((n) => ({ data: n.dataRecebimento as string, valor: n.valor ?? 0 })),
        granularidade
      ),
    [notas, granularidade]
  );
  const descricaoPeriodo = granularidade === "mes" ? `últimos ${QTD_MESES} meses` : `últimas ${QTD_SEMANAS} semanas`;
  const [criando, setCriando] = useState(false);
  const [editando, setEditando] = useState<LinhaFinanceiro | null>(null);
  const [alterandoStatus, setAlterandoStatus] = useState<NotaFinanceiro | null>(null);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [baixaEmMassa, setBaixaEmMassa] = useState(false);

  const totalEmitido = notas.reduce((soma, n) => soma + (n.valor ?? 0), 0);
  const totalRecebido = notas.filter((n) => n.status === "Vlr. Recebido").reduce((soma, n) => soma + (n.valor ?? 0), 0);
  const totalEmAberto = totalEmitido - totalRecebido;
  const percentualRecebido = totalEmitido > 0 ? (totalRecebido / totalEmitido) * 100 : 0;
  const percentualEmAberto = totalEmitido > 0 ? (totalEmAberto / totalEmitido) * 100 : 0;

  const notasEmAberto = notas.filter((n) => n.status === "Em Aberto");
  // só notas Em Aberto entram na seleção (a baixa em massa só confirma recebimento)
  const notasSelecionadas = notasEmAberto.filter((n) => selecionadas.has(n.chave));
  const todasSelecionadas = notasEmAberto.length > 0 && notasSelecionadas.length === notasEmAberto.length;

  function alternarSelecao(chave: string) {
    setSelecionadas((atual) => {
      const nova = new Set(atual);
      if (nova.has(chave)) nova.delete(chave);
      else nova.add(chave);
      return nova;
    });
  }

  function alternarTodas() {
    setSelecionadas(todasSelecionadas ? new Set() : new Set(notasEmAberto.map((n) => n.chave)));
  }

  async function salvarNovoLancamento(dados: DadosLancamentoFinanceiro) {
    const res = await fetch("/api/financeiro/notas-fiscais", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dados),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body?.error ?? "Não foi possível salvar esse lançamento.");
    setCriando(false);
    router.refresh();
  }

  async function salvarEdicaoLancamento(dados: DadosLancamentoFinanceiro) {
    if (!editando) return;
    const res = await fetch(`/api/financeiro/notas-fiscais/${editando.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dados),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body?.error ?? "Não foi possível salvar essa edição.");
    setEditando(null);
    router.refresh();
  }

  async function confirmarRecebimento(dataRecebimento: string) {
    if (!alterandoStatus) return;
    const res = await fetch(`/api/financeiro/notas-fiscais/${alterandoStatus.lancamentoId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nf: alterandoStatus.tipo, status: "Vlr. Recebido", data_recebimento: dataRecebimento }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body?.error ?? "Não foi possível confirmar o recebimento.");
    setAlterandoStatus(null);
    router.refresh();
  }

  async function reverterParaEmAberto() {
    if (!alterandoStatus) return;
    const res = await fetch(`/api/financeiro/notas-fiscais/${alterandoStatus.lancamentoId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nf: alterandoStatus.tipo, status: "Em Aberto" }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body?.error ?? "Não foi possível reverter essa nota fiscal.");
    setAlterandoStatus(null);
    router.refresh();
  }

  async function confirmarBaixaEmMassa(dataRecebimento: string) {
    const res = await fetch("/api/financeiro/notas-fiscais/baixa-em-massa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data_recebimento: dataRecebimento,
        notas: notasSelecionadas.map((n) => ({ id: n.lancamentoId, tipo: n.tipo })),
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body?.error ?? "Não foi possível dar baixa nas notas selecionadas.");
    setBaixaEmMassa(false);
    setSelecionadas(new Set());
    router.refresh();
  }

  return (
    <>
      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <CardKpi
          icone={Receipt}
          animacao="icone-flutuar"
          cor="#0d9488"
          rotulo="Valor total de notas emitidas"
          valor={formatarReal(totalEmitido)}
        />
        <CardKpi
          icone={CircleDollarSign}
          animacao="icone-moeda-girar"
          cor="#f59e0b"
          rotulo="Valores em aberto"
          valor={formatarReal(totalEmAberto)}
          sublinha={totalEmitido > 0 ? `${percentualEmAberto.toFixed(1)}% do total` : undefined}
        />
        <CardKpi
          icone={CalendarCheck2}
          animacao="icone-pulsar"
          cor="#16a34a"
          rotulo="Valores recebidos"
          valor={formatarReal(totalRecebido)}
          sublinha={totalEmitido > 0 ? `${percentualRecebido.toFixed(1)}% do total` : undefined}
        />
      </div>

      {/* seletor Mês / Semana — vale para os 2 gráficos */}
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          Mostrando os {descricaoPeriodo}
        </p>
        <div className="inline-flex rounded-lg border p-0.5" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
          {(
            [
              ["mes", "Por mês"],
              ["semana", "Por semana"],
            ] as [Granularidade, string][]
          ).map(([valor, rotulo]) => (
            <button
              key={valor}
              type="button"
              onClick={() => setGranularidade(valor)}
              className="rounded-md px-3 py-1.5 text-xs font-semibold transition"
              style={
                granularidade === valor
                  ? { background: "var(--accent)", color: "#fff" }
                  : { color: "var(--muted)" }
              }
            >
              {rotulo}
            </button>
          ))}
        </div>
      </div>

      {/* um abaixo do outro (pedido explícito, 10/11/2026) */}
      <div className="grid grid-cols-1 gap-4 mb-6">
        <GraficoFinanceiroMensal
          titulo={`Notas emitidas por ${granularidade === "mes" ? "mês" : "semana"} (Mão de Obra + Peças)`}
          icone={<TrendingUp size={17} className="icone-subir" style={{ color: "#0d9488" }} />}
          pontos={pontosEmitidas}
          cor="#0d9488"
          mensagemVazia={`Nenhuma NF emitida nas ${descricaoPeriodo}.`}
        />
        <GraficoFinanceiroMensal
          titulo={`Valores recebidos por ${granularidade === "mes" ? "mês" : "semana"}`}
          icone={<Wallet size={17} className="icone-flutuar" style={{ color: "#16a34a" }} />}
          pontos={pontosRecebidas}
          cor="#16a34a"
          mensagemVazia={`Nenhum recebimento confirmado nas ${descricaoPeriodo}.`}
        />
      </div>

      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <h2 className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
          Notas fiscais
        </h2>
        <div className="flex items-center gap-2">
          {notasSelecionadas.length > 0 && (
            <button
              type="button"
              onClick={() => setBaixaEmMassa(true)}
              className="inline-flex items-center gap-2 rounded-lg text-white text-sm font-medium px-4 py-2 transition"
              style={{ background: "#16a34a" }}
            >
              <CalendarCheck2 size={15} />
              Dar baixa ({notasSelecionadas.length})
            </button>
          )}
          <button
            type="button"
            onClick={() => setCriando(true)}
            className="inline-flex items-center gap-2 rounded-lg text-white text-sm font-medium px-4 py-2 transition"
            style={{ background: "var(--accent2)" }}
          >
            <Plus size={15} />
            Novo lançamento
          </button>
        </div>
      </div>

      <div className="rounded-xl border overflow-hidden overflow-x-auto" style={{ borderColor: "var(--line)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left" style={{ background: "var(--surface2)", color: "var(--muted)" }}>
              <th className="pl-4 pr-1 py-2.5 w-8">
                <input
                  type="checkbox"
                  checked={todasSelecionadas}
                  onChange={alternarTodas}
                  disabled={notasEmAberto.length === 0}
                  title="Selecionar todas as notas em aberto"
                  className="accent-[var(--accent2)] cursor-pointer"
                />
              </th>
              <th className="px-4 py-2.5 font-medium whitespace-nowrap">Data emissão</th>
              <th className="px-4 py-2.5 font-medium">Tipo</th>
              <th className="px-4 py-2.5 font-medium whitespace-nowrap">Nº NF</th>
              <th className="px-4 py-2.5 font-medium text-right">Valor</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium whitespace-nowrap">Data recebimento</th>
              <th className="px-4 py-2.5 font-medium text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {notas.map((n) => {
              const recebido = n.status === "Vlr. Recebido";
              const lancamento = linhas.find((l) => l.id === n.lancamentoId) ?? null;
              return (
                <tr key={n.chave} className="border-t" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
                  <td className="pl-4 pr-1 py-2.5">
                    {!recebido && (
                      <input
                        type="checkbox"
                        checked={selecionadas.has(n.chave)}
                        onChange={() => alternarSelecao(n.chave)}
                        title="Selecionar para baixa em massa"
                        className="accent-[var(--accent2)] cursor-pointer"
                      />
                    )}
                  </td>
                  <td className="px-4 py-2.5 font-medium whitespace-nowrap" style={{ color: "var(--ink)" }}>
                    {formatarDataCurta(n.dataEmissao)}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap" style={{ color: "var(--muted)" }}>
                    {ROTULO_TIPO_NOTA[n.tipo]}
                  </td>
                  <td className="px-4 py-2.5 font-medium whitespace-nowrap" style={{ color: "var(--ink)" }}>
                    {n.numero}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold whitespace-nowrap" style={{ color: "var(--ink)" }}>
                    {n.valor != null ? formatarReal(n.valor) : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <button
                      type="button"
                      onClick={() => setAlterandoStatus(n)}
                      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition whitespace-nowrap"
                      style={
                        recebido
                          ? { background: "rgba(22, 163, 74, 0.12)", color: "#16a34a" }
                          : { background: "rgba(245, 158, 11, 0.12)", color: "#f59e0b" }
                      }
                      title="Clique para alterar o status desta nota"
                    >
                      <Landmark size={12} />
                      {n.status}
                    </button>
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap" style={{ color: "var(--muted)" }}>
                    {formatarDataCurta(n.dataRecebimento)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => lancamento && setEditando(lancamento)}
                      title="Editar lançamento (Nº, valor e data de emissão das NFs do dia)"
                      className="inline-flex items-center justify-center w-8 h-8 rounded-lg border transition hover:border-[var(--accent2)]"
                      style={{ borderColor: "var(--line)", color: "var(--muted)" }}
                    >
                      <Pencil size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
            {notas.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center" style={{ color: "var(--muted)", background: "var(--surface)" }}>
                  Nenhuma nota fiscal ainda — as NFs de Mão de Obra e Peças entram aqui sozinhas ao serem emitidas em Ag.
                  Emissão de Nota Fiscal, ou use "Novo lançamento" pra cadastrar na mão.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {criando && (
        <PopupLancamentoFinanceiro linha={null} onFechar={() => setCriando(false)} onSalvar={salvarNovoLancamento} />
      )}

      {editando && (
        <PopupLancamentoFinanceiro linha={editando} onFechar={() => setEditando(null)} onSalvar={salvarEdicaoLancamento} />
      )}

      {alterandoStatus && (
        <PopupReceberValor
          nota={alterandoStatus}
          onFechar={() => setAlterandoStatus(null)}
          onConfirmarRecebimento={confirmarRecebimento}
          onReverterParaEmAberto={reverterParaEmAberto}
        />
      )}

      {baixaEmMassa && notasSelecionadas.length > 0 && (
        <PopupBaixaEmMassa notas={notasSelecionadas} onFechar={() => setBaixaEmMassa(false)} onConfirmar={confirmarBaixaEmMassa} />
      )}
    </>
  );
}

function CardKpi({
  icone: Icone,
  animacao,
  cor,
  rotulo,
  valor,
  sublinha,
}: {
  icone: typeof Receipt;
  /** classe de animação do ícone (globals.css) */
  animacao?: string;
  cor: string;
  rotulo: string;
  valor: string;
  sublinha?: string;
}) {
  return (
    <div className="rounded-xl border p-4" style={{ background: "var(--surface)", borderColor: "var(--line)" }}>
      <div className="flex items-center gap-2 mb-2">
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg" style={{ background: `${cor}1f` }}>
          <Icone size={16} className={animacao} style={{ color: cor }} />
        </span>
        <p className="text-xs font-medium" style={{ color: "var(--muted)" }}>
          {rotulo}
        </p>
      </div>
      <p className="text-xl font-semibold" style={{ color: "var(--ink)" }}>
        {valor}
      </p>
      {sublinha && (
        <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
          {sublinha}
        </p>
      )}
    </div>
  );
}
