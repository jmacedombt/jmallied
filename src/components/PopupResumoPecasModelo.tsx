"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Layers, Loader2, RotateCcw, Sparkles, X } from "lucide-react";
import { arredondarParaCima, chaveOverrideModeloPeca, faixaMarkupPara, type FaixaMarkup } from "@/lib/bid";
import { type PecaDetalheValidacao } from "@/lib/orcamentos";
import { corPercentualLucro } from "@/components/CelulaLucroPercentual";

export type PecaComModelo = PecaDetalheValidacao & { modelo: string | null };

function formatarDataHora(iso: string | null): string {
  if (!iso) return "Nenhuma importação registrada ainda";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function formatarReal(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarPercentual(valor: number): string {
  return `${valor.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

function formatarMultiplicador(valor: number): string {
  return valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 3 });
}

function rotuloFaixa(faixa: FaixaMarkup | null): string {
  if (!faixa) return "Fora de qualquer faixa";
  const de = formatarReal(faixa.valor_min);
  if (faixa.valor_max == null) return `Acima de ${de}`;
  return `${de} – ${formatarReal(faixa.valor_max)}`;
}

function margemPercentual(venda: number, custo: number, imposto: number): number {
  return venda > 0 ? ((venda - custo - imposto) / venda) * 100 : 0;
}

function Selo({ percentual }: { percentual: number }) {
  const cor = corPercentualLucro(percentual);
  return (
    <span
      className="inline-flex items-center rounded-md px-2 py-0.5 font-semibold"
      style={{ color: cor, background: `${cor}1a`, border: `1px solid ${cor}55` }}
    >
      {formatarPercentual(percentual)}
    </span>
  );
}

type LinhaPecaModelo = {
  codigo: string;
  custo: number;
  quantidade: number;
  custoTotal: number;
  vendaTotalHoje: number;
  impostoTotalHoje: number;
  multiplicadorHoje: number | null;
  faixaHoje: FaixaMarkup | null;
};

type GrupoModelo = {
  modelo: string | null;
  rotulo: string;
  linhas: LinhaPecaModelo[];
  quantidade: number;
  custoTotal: number;
  vendaTotalHoje: number;
  impostoTotalHoje: number;
  semCusto: number;
  /** quantidade de APARELHOS (não de peças) desse modelo na tela atual —
   * inclusive os que não têm peça nenhuma lançada, por isso vem de uma
   * lista à parte (ver prop `aparelhos`), não das peças acima. */
  quantidadeAparelhos: number;
  /** soma de Venda de Peças de cada aparelho desse modelo — base do
   * Ticket Médio (junto com maoDeObraSoma abaixo), guardada separada pra
   * poder detalhar o cálculo no tooltip. */
  vendaPecasSoma: number;
  /** soma de Mão de Obra de cada aparelho desse modelo. */
  maoDeObraSoma: number;
};

/**
 * "Resumo de Peças por Modelo" de Validação de Orçamentos (pedido
 * explícito, 25/09/2026) — mesma ideia do "Resumo de Peças por Faixa de
 * Markup" (ver PopupResumoPecasMarkup.tsx), só que agrupando as peças
 * que estão na tela agora (respeita o filtro de lote selecionado, mesmo
 * escopo do resumo por Faixa) por MODELO COMERCIAL em vez de faixa de
 * custo. Cada modelo mostra Qtd. de Peças / Custo Total / Venda Total
 * (recalculada ao vivo pelo multiplicador simulado) — clicar no modelo
 * expande e mostra cada código de peça (agrupado, com a quantidade),
 * a faixa de custo em que ele cai hoje e o multiplicador efetivo (override
 * já aplicado, se tiver, senão o da faixa), com opção de simular um
 * multiplicador diferente peça a peça.
 *
 * O botão "Aplicar" (dentro do modelo expandido) grava, de uma vez, o
 * multiplicador simulado ATUAL de cada peça daquele modelo em
 * orcamentos_modelo_peca_markup_override (ver migration 0072) — esse
 * override é mais específico que qualquer Faixa de Markup (inclusive o
 * override por lote da tela "por Faixa") e passa a valer pra sempre
 * nessa combinação de modelo + peça em Validação de Orçamentos, até
 * alguém aplicar um valor novo. Exige o mesmo checklist de confirmação
 * (GSPN importado + "sem peça" confirmado) que "Utilizar nova margem"
 * já exige na tela por Faixa.
 */
export default function PopupResumoPecasModelo({
  pecas,
  aparelhos,
  faixas,
  icmsPercentual,
  overridesModeloPeca,
  podePersonalizarMargem = false,
  ultimaImportacaoGspn = null,
  qtdSemPecaPendenteNoLote = 0,
  onMargemAplicada,
  onFechar,
}: {
  pecas: PecaComModelo[];
  /** 1 entrada por APARELHO (não por peça) na tela agora, com Venda de
   * Peças e Mão de Obra separadas — usado só pra contar Quantidade de
   * Aparelhos e apurar o Ticket Médio de cada modelo (e o cálculo
   * detalhado mostrado ao passar o mouse em cima do valor), já que isso
   * inclui até aparelho sem peça nenhuma lançada. */
  aparelhos: { modelo: string | null; vendaPecas: number; maoDeObra: number }[];
  /** faixas efetivas (mesmo valor passado pro Resumo por Faixa: override
   * do lote selecionado, ou a faixa global) — usadas só pra mostrar em
   * que faixa cada peça cai hoje quando ela não tem override próprio. */
  faixas: FaixaMarkup[];
  icmsPercentual: number;
  /** override de Markup por Modelo + Peça já gravado (ver
   * buscarOverridesModeloPeca em lib/bid.ts) — mapa `${modelo}::${codigo}`
   * -> multiplicador. Tem prioridade sobre `faixas` na coluna "Mult. hoje". */
  overridesModeloPeca: Record<string, number>;
  podePersonalizarMargem?: boolean;
  ultimaImportacaoGspn?: string | null;
  qtdSemPecaPendenteNoLote?: number;
  onMargemAplicada?: () => void;
  onFechar: () => void;
}) {
  // Quantidade de Aparelhos + soma de Venda de Peças / Mão de Obra por
  // modelo — vem de `aparelhos` (1 por aparelho), não de `pecas`, pra não
  // deixar de contar quem ainda não tem peça lançada. Guardar as duas
  // somas separadas (em vez de já somar) é o que permite detalhar o
  // cálculo do Ticket Médio no tooltip.
  const resumoAparelhosPorModelo = useMemo(() => {
    const mapa = new Map<string | null, { quantidadeAparelhos: number; vendaPecasSoma: number; maoDeObraSoma: number }>();
    for (const a of aparelhos) {
      const modelo = a.modelo?.trim() ? a.modelo.trim() : null;
      const atual = mapa.get(modelo) ?? { quantidadeAparelhos: 0, vendaPecasSoma: 0, maoDeObraSoma: 0 };
      atual.quantidadeAparelhos += 1;
      atual.vendaPecasSoma += a.vendaPecas;
      atual.maoDeObraSoma += a.maoDeObra;
      mapa.set(modelo, atual);
    }
    return mapa;
  }, [aparelhos]);

  const grupos = useMemo<GrupoModelo[]>(() => {
    const porModelo = new Map<string | null, Map<string, LinhaPecaModelo>>();
    const semCustoPorModelo = new Map<string | null, number>();

    // garante que todo modelo com aparelho na tela apareça como linha,
    // mesmo que nenhum deles tenha peça lançada ainda.
    for (const modelo of resumoAparelhosPorModelo.keys()) {
      if (!porModelo.has(modelo)) porModelo.set(modelo, new Map());
    }

    for (const p of pecas) {
      const modelo = p.modelo?.trim() ? p.modelo.trim() : null;
      if (!porModelo.has(modelo)) porModelo.set(modelo, new Map());
      const porCodigo = porModelo.get(modelo)!;

      if (p.custo == null) {
        semCustoPorModelo.set(modelo, (semCustoPorModelo.get(modelo) ?? 0) + 1);
        continue;
      }

      const existente = porCodigo.get(p.codigo);
      if (existente) {
        existente.quantidade += 1;
        existente.custoTotal += p.custo;
        existente.vendaTotalHoje += p.vendaPeca ?? 0;
        existente.impostoTotalHoje += p.imposto ?? 0;
        continue;
      }

      const faixaHoje = faixaMarkupPara(p.custo, faixas);
      const multiplicadorHoje = overridesModeloPeca[chaveOverrideModeloPeca(modelo, p.codigo)] ?? faixaHoje?.multiplicador ?? null;

      porCodigo.set(p.codigo, {
        codigo: p.codigo,
        custo: p.custo,
        quantidade: 1,
        custoTotal: p.custo,
        vendaTotalHoje: p.vendaPeca ?? 0,
        impostoTotalHoje: p.imposto ?? 0,
        multiplicadorHoje,
        faixaHoje,
      });
    }

    return Array.from(porModelo.entries())
      .map(([modelo, porCodigo]) => {
        const linhas = Array.from(porCodigo.values()).sort((a, b) => a.codigo.localeCompare(b.codigo, "pt-BR"));
        const resumoAparelhos = resumoAparelhosPorModelo.get(modelo) ?? { quantidadeAparelhos: 0, vendaPecasSoma: 0, maoDeObraSoma: 0 };
        return {
          modelo,
          rotulo: modelo ?? "(sem modelo)",
          linhas,
          quantidade: linhas.reduce((s, l) => s + l.quantidade, 0),
          custoTotal: linhas.reduce((s, l) => s + l.custoTotal, 0),
          vendaTotalHoje: linhas.reduce((s, l) => s + l.vendaTotalHoje, 0),
          impostoTotalHoje: linhas.reduce((s, l) => s + l.impostoTotalHoje, 0),
          semCusto: semCustoPorModelo.get(modelo) ?? 0,
          quantidadeAparelhos: resumoAparelhos.quantidadeAparelhos,
          vendaPecasSoma: resumoAparelhos.vendaPecasSoma,
          maoDeObraSoma: resumoAparelhos.maoDeObraSoma,
        };
      })
      .sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR"));
  }, [pecas, faixas, overridesModeloPeca, resumoAparelhosPorModelo]);

  // multiplicador simulado por (modelo, código) — estado local, nunca
  // salvo sozinho (só via "Aplicar"). Reinicia pro "hoje" de cada peça
  // sempre que os grupos mudarem (ex.: depois de aplicar com sucesso e o
  // pai atualizar via router.refresh()).
  const [simulados, setSimulados] = useState<Record<string, number>>({});
  useEffect(() => {
    const inicial: Record<string, number> = {};
    for (const g of grupos) {
      for (const l of g.linhas) {
        inicial[chaveOverrideModeloPeca(g.modelo, l.codigo)] = l.multiplicadorHoje ?? 0;
      }
    }
    setSimulados(inicial);
  }, [grupos]);

  const [bulkInputs, setBulkInputs] = useState<Record<string, string>>({});
  const [modeloAberto, setModeloAberto] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState<GrupoModelo | null>(null);
  const [checkGspn, setCheckGspn] = useState(false);
  const [checkSemPeca, setCheckSemPeca] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function alterarSimulado(modelo: string | null, codigo: string, valor: number) {
    setSimulados((atual) => ({ ...atual, [chaveOverrideModeloPeca(modelo, codigo)]: valor }));
  }

  function aplicarBulkAoModelo(grupo: GrupoModelo, texto: string) {
    setBulkInputs((atual) => ({ ...atual, [grupo.rotulo]: texto }));
    const valor = Number(texto);
    if (!Number.isFinite(valor) || valor <= 0) return;
    setSimulados((atual) => {
      const novo = { ...atual };
      for (const l of grupo.linhas) novo[chaveOverrideModeloPeca(grupo.modelo, l.codigo)] = valor;
      return novo;
    });
  }

  function restaurarPadraoModelo(grupo: GrupoModelo) {
    setBulkInputs((atual) => ({ ...atual, [grupo.rotulo]: "" }));
    setSimulados((atual) => {
      const novo = { ...atual };
      for (const l of grupo.linhas) novo[chaveOverrideModeloPeca(grupo.modelo, l.codigo)] = l.multiplicadorHoje ?? 0;
      return novo;
    });
  }

  function calcularSimulado(custo: number, multiplicador: number) {
    const valorComMargem = arredondarParaCima(custo * multiplicador, 2);
    const impostoUnit = arredondarParaCima(valorComMargem * (icmsPercentual / 100), 2);
    const vendaUnit = arredondarParaCima(valorComMargem + impostoUnit, 0);
    return { vendaUnit, impostoUnit };
  }

  function totaisSimuladosDoGrupo(grupo: GrupoModelo) {
    let vendaTotalSimulado = 0;
    let impostoTotalSimulado = 0;
    for (const l of grupo.linhas) {
      const multiplicador = simulados[chaveOverrideModeloPeca(grupo.modelo, l.codigo)] ?? l.multiplicadorHoje ?? 0;
      if (multiplicador > 0) {
        const { vendaUnit, impostoUnit } = calcularSimulado(l.custo, multiplicador);
        vendaTotalSimulado += vendaUnit * l.quantidade;
        impostoTotalSimulado += impostoUnit * l.quantidade;
      }
    }
    return { vendaTotalSimulado, impostoTotalSimulado };
  }

  function houveEdicaoModelo(grupo: GrupoModelo): boolean {
    return grupo.linhas.some((l) => (simulados[chaveOverrideModeloPeca(grupo.modelo, l.codigo)] ?? l.multiplicadorHoje ?? 0) !== (l.multiplicadorHoje ?? 0));
  }

  function abrirConfirmacao(grupo: GrupoModelo) {
    setCheckGspn(false);
    setCheckSemPeca(false);
    setErro(null);
    setConfirmando(grupo);
  }

  async function confirmarAplicar() {
    if (!confirmando || !confirmando.modelo) return;
    setEnviando(true);
    setErro(null);
    try {
      const pecasBody = confirmando.linhas.map((l) => ({
        codigo: l.codigo,
        multiplicador: simulados[chaveOverrideModeloPeca(confirmando.modelo, l.codigo)] ?? l.multiplicadorHoje ?? 0,
      }));
      const res = await fetch("/api/operacional/orcamentos/modelo-markup-override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modeloComercial: confirmando.modelo, pecas: pecasBody }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Não foi possível aplicar a nova margem.");
      setConfirmando(null);
      onMargemAplicada?.();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível aplicar a nova margem.");
    }
    setEnviando(false);
  }

  const totaisGerais = useMemo(
    () =>
      grupos.reduce(
        (acc, g) => ({
          quantidade: acc.quantidade + g.quantidade,
          custoTotal: acc.custoTotal + g.custoTotal,
          vendaTotalHoje: acc.vendaTotalHoje + g.vendaTotalHoje,
          impostoTotalHoje: acc.impostoTotalHoje + g.impostoTotalHoje,
          quantidadeAparelhos: acc.quantidadeAparelhos + g.quantidadeAparelhos,
          vendaPecasSoma: acc.vendaPecasSoma + g.vendaPecasSoma,
          maoDeObraSoma: acc.maoDeObraSoma + g.maoDeObraSoma,
        }),
        { quantidade: 0, custoTotal: 0, vendaTotalHoje: 0, impostoTotalHoje: 0, quantidadeAparelhos: 0, vendaPecasSoma: 0, maoDeObraSoma: 0 }
      ),
    [grupos]
  );
  const semCustoTotal = grupos.reduce((s, g) => s + g.semCusto, 0);

  // Ticket Médio = (Venda de Peças + Mão de Obra) médio por aparelho —
  // não muda com a simulação de multiplicador (a Mão de Obra não depende
  // de faixa de Markup, e o "hoje" já reflete o que está
  // congelado/calculado pra cada aparelho).
  function ticketMedio(quantidadeAparelhos: number, vendaPecasSoma: number, maoDeObraSoma: number): number {
    return quantidadeAparelhos > 0 ? (vendaPecasSoma + maoDeObraSoma) / quantidadeAparelhos : 0;
  }

  // tooltip com o cálculo detalhado do Ticket Médio, ao passar o mouse em
  // cima do valor — mesmo padrão de TooltipCalculoBid.tsx (estado com
  // posição calculada a partir do elemento, div fixed renderizada no fim).
  const [tooltipTicket, setTooltipTicket] = useState<{
    x: number;
    y: number;
    rotulo: string;
    quantidadeAparelhos: number;
    vendaPecasSoma: number;
    maoDeObraSoma: number;
  } | null>(null);

  function mostrarTooltipTicket(
    e: React.MouseEvent,
    rotulo: string,
    quantidadeAparelhos: number,
    vendaPecasSoma: number,
    maoDeObraSoma: number
  ) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const largura = 260;
    const x = Math.min(rect.left, Math.max(8, window.innerWidth - largura - 8));
    setTooltipTicket({ x, y: rect.bottom + 8, rotulo, quantidadeAparelhos, vendaPecasSoma, maoDeObraSoma });
  }

  function ocultarTooltipTicket() {
    setTooltipTicket(null);
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.55)" }} onClick={onFechar}>
      <div
        className="w-full max-w-6xl rounded-2xl border shadow-2xl p-5 max-h-[92vh] overflow-y-auto"
        style={{ background: "var(--surface)", borderColor: "var(--line)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-semibold flex items-center gap-2" style={{ color: "var(--ink)" }}>
            <Layers size={18} style={{ color: "var(--accent2)" }} />
            Resumo de Peças por Modelo
          </h2>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="w-7 h-7 flex items-center justify-center rounded-md transition hover:bg-[var(--surface2)]"
            style={{ color: "var(--muted)" }}
          >
            <X size={16} />
          </button>
        </div>

        <p className="text-xs mb-4" style={{ color: "var(--muted)" }}>
          Consulta — não altera nada até clicar em "Aplicar" dentro de um modelo. Agrupa as {pecas.length} peça(s) e{" "}
          {aparelhos.length} aparelho(s) que estão nessa tela agora por Modelo Comercial. Ticket Médio = Venda de Peças
          + Mão de Obra, na média por aparelho desse modelo (não muda com a simulação). Clique num modelo pra ver cada
          código de peça, a faixa de custo em que ele cai hoje e simular um multiplicador diferente — peça a peça ou
          pra todas do modelo de uma vez.
        </p>

        <div className="rounded-xl border overflow-x-auto" style={{ borderColor: "var(--line)" }}>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left" style={{ background: "var(--surface2)", color: "var(--muted)" }}>
                <th className="px-3 py-2 font-medium">Modelo</th>
                <th className="px-3 py-2 font-medium text-right">Aparelhos</th>
                <th className="px-3 py-2 font-medium text-right">Peças</th>
                <th className="px-3 py-2 font-medium text-right">Custo Total</th>
                <th className="px-3 py-2 font-medium text-right">Venda Total</th>
                <th className="px-3 py-2 font-medium text-right">Ticket Médio</th>
                <th className="px-3 py-2 font-medium text-right">Margem</th>
                <th className="px-3 py-2 font-medium text-right">Margem (simulada c/ mult. abaixo)</th>
              </tr>
            </thead>
            <tbody>
              {grupos.map((g) => {
                const aberto = modeloAberto === g.rotulo;
                const margemHoje = margemPercentual(g.vendaTotalHoje, g.custoTotal, g.impostoTotalHoje);
                const { vendaTotalSimulado, impostoTotalSimulado } = totaisSimuladosDoGrupo(g);
                const margemSimulada = margemPercentual(vendaTotalSimulado, g.custoTotal, impostoTotalSimulado);
                const editado = houveEdicaoModelo(g);
                return (
                  <Fragment key={g.rotulo}>
                    <tr
                      className="border-t cursor-pointer transition hover:bg-[var(--surface2)]"
                      style={{ borderColor: "var(--line)" }}
                      onClick={() => setModeloAberto(aberto ? null : g.rotulo)}
                    >
                      <td className="px-3 py-2 font-medium whitespace-nowrap" style={{ color: "var(--ink)" }}>
                        <span className="inline-flex items-center gap-1.5">
                          {aberto ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                          {g.rotulo}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right" style={{ color: "var(--ink)" }}>
                        {g.quantidadeAparelhos}
                      </td>
                      <td className="px-3 py-2 text-right" style={{ color: "var(--ink)" }}>
                        {g.quantidade}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap" style={{ color: "var(--ink)" }}>
                        {formatarReal(g.custoTotal)}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap font-medium" style={{ color: "var(--ink)" }}>
                        {formatarReal(g.vendaTotalHoje)}
                      </td>
                      <td
                        className="px-3 py-2 text-right whitespace-nowrap"
                        style={{ color: "var(--ink)", cursor: g.quantidadeAparelhos > 0 ? "help" : undefined }}
                        onMouseEnter={(e) =>
                          g.quantidadeAparelhos > 0 &&
                          mostrarTooltipTicket(e, g.rotulo, g.quantidadeAparelhos, g.vendaPecasSoma, g.maoDeObraSoma)
                        }
                        onMouseLeave={ocultarTooltipTicket}
                      >
                        {g.quantidadeAparelhos > 0 ? formatarReal(ticketMedio(g.quantidadeAparelhos, g.vendaPecasSoma, g.maoDeObraSoma)) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {g.quantidade > 0 ? <Selo percentual={margemHoje} /> : <span style={{ color: "var(--muted)" }}>—</span>}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {g.quantidade > 0 ? (
                          <span className="inline-flex items-center gap-2">
                            {editado && (
                              <span className="whitespace-nowrap" style={{ color: "var(--muted)" }}>
                                {formatarReal(vendaTotalSimulado)}
                              </span>
                            )}
                            <Selo percentual={margemSimulada} />
                          </span>
                        ) : (
                          <span style={{ color: "var(--muted)" }}>—</span>
                        )}
                      </td>
                    </tr>
                    {aberto && (
                      <tr className="border-t" style={{ borderColor: "var(--line)" }}>
                        <td colSpan={8} className="px-3 py-3" style={{ background: "var(--surface2)" }}>
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                            <div className="flex items-center gap-2">
                              <label className="text-[11px]" style={{ color: "var(--muted)" }}>
                                Aplicar um multiplicador a TODAS as peças desse modelo:
                              </label>
                              <input
                                type="number"
                                step="0.001"
                                min="0"
                                placeholder="ex: 1,50"
                                value={bulkInputs[g.rotulo] ?? ""}
                                onChange={(e) => aplicarBulkAoModelo(g, e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                className="w-24 rounded-md border px-2 py-1 text-right text-xs outline-none focus:border-[var(--accent2)] transition"
                                style={{ borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink)" }}
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  restaurarPadraoModelo(g);
                                }}
                                disabled={!editado}
                                className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition hover:bg-[var(--surface)] disabled:opacity-40 disabled:cursor-not-allowed"
                                style={{ borderColor: "var(--line)", color: "var(--ink)" }}
                              >
                                <RotateCcw size={12} />
                                Restaurar padrão
                              </button>
                              {podePersonalizarMargem && g.modelo && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    abrirConfirmacao(g);
                                  }}
                                  disabled={!editado}
                                  title="Grava esse multiplicador pra cada peça abaixo, específico desse modelo"
                                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition disabled:opacity-40 disabled:cursor-not-allowed"
                                  style={{ background: "var(--accent)", boxShadow: editado ? "0 0 20px var(--accent-glow)" : undefined }}
                                >
                                  <Sparkles size={12} />
                                  Aplicar margem desse modelo
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="rounded-lg border overflow-x-auto" style={{ borderColor: "var(--line)" }}>
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-left" style={{ background: "var(--surface)", color: "var(--muted)" }}>
                                  <th className="px-3 py-2 font-medium">Código</th>
                                  <th className="px-3 py-2 font-medium">Faixa (custo)</th>
                                  <th className="px-3 py-2 font-medium text-right">Mult. hoje</th>
                                  <th className="px-3 py-2 font-medium text-right">Mult. simulado</th>
                                  <th className="px-3 py-2 font-medium text-right">Peças</th>
                                  <th className="px-3 py-2 font-medium text-right">Custo total</th>
                                  <th className="px-3 py-2 font-medium text-right">Venda total</th>
                                  <th className="px-3 py-2 font-medium text-right">Margem</th>
                                </tr>
                              </thead>
                              <tbody>
                                {g.linhas.map((l) => {
                                  const chave = chaveOverrideModeloPeca(g.modelo, l.codigo);
                                  const multiplicadorSimulado = simulados[chave] ?? l.multiplicadorHoje ?? 0;
                                  const editadoLinha = multiplicadorSimulado !== (l.multiplicadorHoje ?? 0);
                                  const { vendaUnit, impostoUnit } =
                                    multiplicadorSimulado > 0 ? calcularSimulado(l.custo, multiplicadorSimulado) : { vendaUnit: 0, impostoUnit: 0 };
                                  const vendaTotalSim = vendaUnit * l.quantidade;
                                  const impostoTotalSim = impostoUnit * l.quantidade;
                                  const margem = margemPercentual(vendaTotalSim, l.custoTotal, impostoTotalSim);
                                  return (
                                    <tr key={l.codigo} className="border-t" style={{ borderColor: "var(--line)" }}>
                                      <td className="px-3 py-2 font-medium whitespace-nowrap" style={{ color: "var(--ink)" }}>
                                        {l.codigo}
                                      </td>
                                      <td className="px-3 py-2 whitespace-nowrap" style={{ color: "var(--muted)" }}>
                                        {rotuloFaixa(l.faixaHoje)}
                                      </td>
                                      <td className="px-3 py-2 text-right" style={{ color: "var(--muted)" }}>
                                        {l.multiplicadorHoje != null ? formatarMultiplicador(l.multiplicadorHoje) : "—"}
                                      </td>
                                      <td className="px-3 py-2 text-right">
                                        <input
                                          type="number"
                                          step="0.001"
                                          min="0"
                                          value={multiplicadorSimulado}
                                          onChange={(e) => {
                                            const valor = Number(e.target.value);
                                            if (Number.isFinite(valor) && valor >= 0) alterarSimulado(g.modelo, l.codigo, valor);
                                          }}
                                          className="w-20 rounded-md border px-2 py-1 text-right text-xs outline-none focus:border-[var(--accent2)] transition"
                                          style={{
                                            borderColor: editadoLinha ? "var(--accent2)" : "var(--line)",
                                            background: editadoLinha ? "var(--accent-glow)" : "var(--surface2)",
                                            color: "var(--ink)",
                                          }}
                                        />
                                      </td>
                                      <td className="px-3 py-2 text-right" style={{ color: "var(--ink)" }}>
                                        {l.quantidade}
                                      </td>
                                      <td className="px-3 py-2 text-right whitespace-nowrap" style={{ color: "var(--ink)" }}>
                                        {formatarReal(l.custoTotal)}
                                      </td>
                                      <td className="px-3 py-2 text-right whitespace-nowrap font-medium" style={{ color: "var(--ink)" }}>
                                        {formatarReal(vendaTotalSim)}
                                      </td>
                                      <td className="px-3 py-2 text-right">
                                        {vendaTotalSim > 0 ? <Selo percentual={margem} /> : <span style={{ color: "var(--muted)" }}>—</span>}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>

                          {g.linhas.length === 0 && (
                            <p className="text-[11px] mt-2" style={{ color: "var(--muted)" }}>
                              Nenhuma peça lançada ainda nos {g.quantidadeAparelhos} aparelho(s) desse modelo.
                            </p>
                          )}
                          {g.semCusto > 0 && (
                            <p className="text-[11px] mt-2" style={{ color: "var(--muted)" }}>
                              {g.semCusto} peça(s) desse modelo sem custo cadastrado na Base Peças (fora dessa análise).
                            </p>
                          )}
                          {!g.modelo && (
                            <p className="text-[11px] mt-2 flex items-center gap-1" style={{ color: "#ef4444" }}>
                              <AlertTriangle size={12} />
                              Esses aparelhos não têm Modelo Comercial cadastrado — não é possível aplicar um override sem modelo.
                            </p>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {grupos.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center" style={{ color: "var(--muted)" }}>
                    Nenhum aparelho nessa tela agora.
                  </td>
                </tr>
              )}
            </tbody>
            {grupos.length > 0 && (
              <tfoot>
                <tr className="border-t font-semibold" style={{ borderColor: "var(--line)", background: "var(--surface2)" }}>
                  <td className="px-3 py-2" style={{ color: "var(--ink)" }}>
                    Total
                  </td>
                  <td className="px-3 py-2 text-right" style={{ color: "var(--ink)" }}>
                    {totaisGerais.quantidadeAparelhos}
                  </td>
                  <td className="px-3 py-2 text-right" style={{ color: "var(--ink)" }}>
                    {totaisGerais.quantidade}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap" style={{ color: "var(--ink)" }}>
                    {formatarReal(totaisGerais.custoTotal)}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap" style={{ color: "var(--ink)" }}>
                    {formatarReal(totaisGerais.vendaTotalHoje)}
                  </td>
                  <td
                    className="px-3 py-2 text-right whitespace-nowrap"
                    style={{ color: "var(--ink)", cursor: totaisGerais.quantidadeAparelhos > 0 ? "help" : undefined }}
                    onMouseEnter={(e) =>
                      totaisGerais.quantidadeAparelhos > 0 &&
                      mostrarTooltipTicket(
                        e,
                        "Total",
                        totaisGerais.quantidadeAparelhos,
                        totaisGerais.vendaPecasSoma,
                        totaisGerais.maoDeObraSoma
                      )
                    }
                    onMouseLeave={ocultarTooltipTicket}
                  >
                    {totaisGerais.quantidadeAparelhos > 0
                      ? formatarReal(ticketMedio(totaisGerais.quantidadeAparelhos, totaisGerais.vendaPecasSoma, totaisGerais.maoDeObraSoma))
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Selo percentual={margemPercentual(totaisGerais.vendaTotalHoje, totaisGerais.custoTotal, totaisGerais.impostoTotalHoje)} />
                  </td>
                  <td className="px-3 py-2" />
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {semCustoTotal > 0 && (
          <p className="text-xs mt-2" style={{ color: "var(--muted)" }}>
            {semCustoTotal} peça(s), no total, sem custo cadastrado na Base Peças (fora dessa análise).
          </p>
        )}
      </div>

      {tooltipTicket && (
        <div
          className="fixed z-[85] rounded-lg border shadow-2xl p-3"
          style={{ background: "var(--surface2)", borderColor: "var(--line)", left: tooltipTicket.x, top: tooltipTicket.y }}
        >
          <div className="text-xs space-y-1.5 min-w-[220px]">
            <p className="font-medium" style={{ color: "var(--ink)" }}>
              Ticket Médio — {tooltipTicket.rotulo}
            </p>
            <p className="flex justify-between gap-4">
              <span style={{ color: "var(--muted)" }}>Venda de Peças (soma)</span>
              <strong>{formatarReal(tooltipTicket.vendaPecasSoma)}</strong>
            </p>
            <p className="flex justify-between gap-4">
              <span style={{ color: "var(--muted)" }}>Mão de Obra (soma)</span>
              <strong>+ {formatarReal(tooltipTicket.maoDeObraSoma)}</strong>
            </p>
            <div className="border-t pt-1.5 mt-1.5" style={{ borderColor: "var(--line)" }}>
              <p className="flex justify-between gap-4">
                <span style={{ color: "var(--muted)" }}>= Valor Total Reparo (soma)</span>
                <strong>{formatarReal(tooltipTicket.vendaPecasSoma + tooltipTicket.maoDeObraSoma)}</strong>
              </p>
              <p className="flex justify-between gap-4">
                <span style={{ color: "var(--muted)" }}>÷ Quantidade de Aparelhos</span>
                <strong>{tooltipTicket.quantidadeAparelhos}</strong>
              </p>
            </div>
            <div className="border-t pt-1.5 mt-1.5" style={{ borderColor: "var(--line)" }}>
              <p className="flex justify-between gap-4">
                <span style={{ color: "var(--muted)" }}>= Ticket Médio</span>
                <strong style={{ color: "var(--accent2)" }}>
                  {formatarReal(
                    ticketMedio(tooltipTicket.quantidadeAparelhos, tooltipTicket.vendaPecasSoma, tooltipTicket.maoDeObraSoma)
                  )}
                </strong>
              </p>
            </div>
          </div>
        </div>
      )}

      {confirmando && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="w-full max-w-md rounded-2xl border shadow-2xl p-6"
            style={{ background: "var(--surface)", borderColor: "var(--line)" }}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold flex items-center gap-2" style={{ color: "var(--ink)" }}>
                <Sparkles size={17} style={{ color: "var(--accent2)" }} />
                Aplicar margem desse modelo
              </h3>
              <button
                type="button"
                onClick={() => setConfirmando(null)}
                aria-label="Fechar"
                className="w-7 h-7 flex items-center justify-center rounded-md transition hover:bg-[var(--surface2)]"
                style={{ color: "var(--muted)" }}
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-sm mb-4" style={{ color: "var(--muted)" }}>
              Vai fixar o multiplicador simulado de cada peça acima especificamente pro modelo{" "}
              <strong style={{ color: "var(--ink)" }}>{confirmando.rotulo}</strong> — todo cálculo dessas peças
              nesse modelo em Validação de Orçamentos (inclusive depois de "Recalcular") passa a usar essa margem, com
              prioridade sobre a Faixa de Markup (global ou por lote), até alguém aplicar um valor novo.
            </p>

            <label className="flex items-start gap-2.5 mb-3 cursor-pointer">
              <input type="checkbox" checked={checkGspn} onChange={(e) => setCheckGspn(e.target.checked)} className="mt-0.5" />
              <span className="text-sm" style={{ color: "var(--ink)" }}>
                Confirmo que a base do GSPN com a última atualização foi importada (atualiza os Part Number dos orçamentos).
                <br />
                <span
                  className="text-xs inline-flex items-center gap-1 mt-0.5"
                  style={{ color: ultimaImportacaoGspn ? "var(--muted)" : "#ef4444" }}
                >
                  {ultimaImportacaoGspn ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                  Última importação: {formatarDataHora(ultimaImportacaoGspn)}
                </span>
              </span>
            </label>

            <label className="flex items-start gap-2.5 mb-4 cursor-pointer">
              <input type="checkbox" checked={checkSemPeca} onChange={(e) => setCheckSemPeca(e.target.checked)} className="mt-0.5" />
              <span className="text-sm" style={{ color: "var(--ink)" }}>
                Já confirmei os orçamentos da tela atual que seguirão sem peça.
                <br />
                <span
                  className="text-xs inline-flex items-center gap-1 mt-0.5"
                  style={{ color: qtdSemPecaPendenteNoLote > 0 ? "#ef4444" : "var(--muted)" }}
                >
                  {qtdSemPecaPendenteNoLote > 0 ? <AlertTriangle size={12} /> : <CheckCircle2 size={12} />}
                  {qtdSemPecaPendenteNoLote > 0
                    ? `${qtdSemPecaPendenteNoLote} orçamento(s) na tela atual ainda pendente(s) de confirmação "sem peça".`
                    : "Nenhum pendente na tela atual."}
                </span>
              </span>
            </label>

            {erro && (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mb-4">{erro}</p>
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmando(null)}
                disabled={enviando}
                className="rounded-lg px-4 py-2.5 text-sm font-medium transition hover:bg-[var(--surface2)] disabled:opacity-60"
                style={{ color: "var(--muted)" }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarAplicar}
                disabled={enviando || !checkGspn || !checkSemPeca}
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: "var(--accent)", boxShadow: "0 0 30px var(--accent-glow)" }}
              >
                {enviando && <Loader2 size={14} className="animate-spin" />}
                Aplicar margem desse modelo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
