"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BarChart3, CheckCircle2, Loader2, RotateCcw, Sparkles, X } from "lucide-react";
import { arredondarParaCima, type FaixaMarkup } from "@/lib/bid";
import { type PecaDetalheValidacao } from "@/lib/orcamentos";
import { corPercentualLucro } from "@/components/CelulaLucroPercentual";

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

function rotuloFaixa(faixa: FaixaMarkup): string {
  const de = formatarReal(faixa.valor_min);
  if (faixa.valor_max == null) return `Acima de ${de}`;
  return `${de} – ${formatarReal(faixa.valor_max)}`;
}

function margemPercentual(venda: number, custo: number, imposto: number): number {
  return venda > 0 ? ((venda - custo - imposto) / venda) * 100 : 0;
}

type LinhaFaixa = {
  faixa: FaixaMarkup;
  quantidade: number;
  custoTotal: number;
  vendaTotalAtual: number;
  impostoTotalAtual: number;
  vendaTotalSimulado: number;
  impostoTotalSimulado: number;
};

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

/**
 * "Resumo de Peças" de Validação de Orçamentos (pedido explícito) —
 * quebra as peças que estão na tela agora (respeita o filtro de lote
 * selecionado, mesma lista que alimenta os cards do topo) por FAIXA de
 * Markup (Configurações > Faixas de Markup — mesmas faixas usadas de
 * verdade pro cálculo), mostrando quantidade de peças e valor total por
 * faixa. É só CONSULTA — não mexe na configuração real de jeito nenhum.
 *
 * O multiplicador "Simulado" de cada faixa é editável na hora (estado
 * local, nunca salvo em lugar nenhum) — mudar ele recalcula na hora,
 * pra cada peça daquela faixa, a mesma cascata usada de verdade em
 * lib/bid.ts (calcularCustoPecaAllied): teto(custo×mult,2) → +ICMS
 * teto(...,2) → teto(total,0). O objetivo (pedido explícito) é achar,
 * por tentativa, o multiplicador que faça a margem de peças daquela
 * faixa bater pelo menos 30% — por isso o selo de margem usa a mesma
 * escala de cor já usada no resto do sistema (ver corPercentualLucro em
 * CelulaLucroPercentual.tsx): abaixo de 20% vermelho, 20–30% laranja,
 * 30–40% verde, acima de 40% azul.
 */
export default function PopupResumoPecasMarkup({
  pecas,
  faixas,
  icmsPercentual,
  loteNf,
  podePersonalizarMargem = false,
  ultimaImportacaoGspn = null,
  qtdSemPecaPendenteNoLote = 0,
  onMargemAplicada,
  onFechar,
}: {
  pecas: PecaDetalheValidacao[];
  faixas: FaixaMarkup[];
  icmsPercentual: number;
  /** NF Remessa do lote selecionado na tela agora — undefined quando
   * "Todos os lotes" está selecionado. "Utilizar nova margem" só aparece
   * com um lote específico selecionado (pedido explícito: a ação vale só
   * pra ESSE lote). */
  loteNf?: string;
  /** mesma permissão de "Confirmar Envio" nessa tela. */
  podePersonalizarMargem?: boolean;
  /** data/hora (ISO) da última importação da base GSPN — mostrado real,
   * ao lado do 1º checkbox de confirmação (ver migration 0011). */
  ultimaImportacaoGspn?: string | null;
  /** quantos orçamentos do lote selecionado ainda estão sem peça e sem
   * confirmação — mostrado real, ao lado do 2º checkbox. */
  qtdSemPecaPendenteNoLote?: number;
  /** chamado depois de aplicar a nova margem com sucesso — o pai dá
   * router.refresh() pra tela toda (cards, tabela, "Mult. hoje") passar a
   * refletir o override recém-gravado (ver PainelValidacaoOrcamentos.tsx). */
  onMargemAplicada?: () => void;
  onFechar: () => void;
}) {
  const [multiplicadores, setMultiplicadores] = useState<number[]>(() => faixas.map((f) => f.multiplicador));

  // se as faixas efetivas mudarem (ex.: depois de aplicar um override e o
  // pai atualizar via router.refresh — ver onMargemAplicada), reflete o
  // novo "hoje" no simulado, senão o pop-up ficaria mostrando o
  // multiplicador antigo mesmo já tendo confirmado o novo.
  useEffect(() => {
    setMultiplicadores(faixas.map((f) => f.multiplicador));
  }, [faixas]);

  function restaurarPadrao() {
    setMultiplicadores(faixas.map((f) => f.multiplicador));
  }

  const [mostrarConfirmacaoMargem, setMostrarConfirmacaoMargem] = useState(false);
  const [checkGspn, setCheckGspn] = useState(false);
  const [checkSemPeca, setCheckSemPeca] = useState(false);
  const [enviandoMargem, setEnviandoMargem] = useState(false);
  const [erroMargem, setErroMargem] = useState<string | null>(null);

  function abrirConfirmacaoMargem() {
    setCheckGspn(false);
    setCheckSemPeca(false);
    setErroMargem(null);
    setMostrarConfirmacaoMargem(true);
  }

  async function confirmarNovaMargem() {
    if (!loteNf) return;
    setEnviandoMargem(true);
    setErroMargem(null);
    try {
      const res = await fetch("/api/operacional/orcamentos/lote-markup-override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nfRemessa: loteNf,
          faixas: faixas.map((f, i) => ({ valor_min: f.valor_min, valor_max: f.valor_max, multiplicador: multiplicadores[i] })),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "Não foi possível aplicar a nova margem.");
      }
      setMostrarConfirmacaoMargem(false);
      onMargemAplicada?.();
    } catch (e) {
      setErroMargem(e instanceof Error ? e.message : "Não foi possível aplicar a nova margem.");
    }
    setEnviandoMargem(false);
  }

  function alterarMultiplicador(indice: number, valor: number) {
    setMultiplicadores((atual) => atual.map((v, i) => (i === indice ? valor : v)));
  }

  const { linhas, semCusto, foraDeFaixa } = useMemo(() => {
    const linhas: LinhaFaixa[] = faixas.map((faixa) => ({
      faixa,
      quantidade: 0,
      custoTotal: 0,
      vendaTotalAtual: 0,
      impostoTotalAtual: 0,
      vendaTotalSimulado: 0,
      impostoTotalSimulado: 0,
    }));
    let semCusto = 0;
    let foraDeFaixa = 0;

    for (const p of pecas) {
      const custo = p.custo;
      if (custo == null) {
        semCusto++;
        continue;
      }
      const indice = faixas.findIndex((f) => custo >= f.valor_min && (f.valor_max === null || custo <= f.valor_max));
      if (indice === -1) {
        foraDeFaixa++;
        continue;
      }
      const linha = linhas[indice];
      linha.quantidade += 1;
      linha.custoTotal += custo;
      linha.vendaTotalAtual += p.vendaPeca ?? 0;
      linha.impostoTotalAtual += p.imposto ?? 0;

      const multiplicadorSimulado = multiplicadores[indice];
      const valorComMargemSim = arredondarParaCima(custo * multiplicadorSimulado, 2);
      const impostoSim = arredondarParaCima(valorComMargemSim * (icmsPercentual / 100), 2);
      const vendaSim = arredondarParaCima(valorComMargemSim + impostoSim, 0);
      linha.vendaTotalSimulado += vendaSim;
      linha.impostoTotalSimulado += impostoSim;
    }

    return { linhas, semCusto, foraDeFaixa };
  }, [pecas, faixas, multiplicadores, icmsPercentual]);

  const totais = useMemo(
    () =>
      linhas.reduce(
        (acc, l) => ({
          quantidade: acc.quantidade + l.quantidade,
          custoTotal: acc.custoTotal + l.custoTotal,
          vendaTotalAtual: acc.vendaTotalAtual + l.vendaTotalAtual,
          impostoTotalAtual: acc.impostoTotalAtual + l.impostoTotalAtual,
          vendaTotalSimulado: acc.vendaTotalSimulado + l.vendaTotalSimulado,
          impostoTotalSimulado: acc.impostoTotalSimulado + l.impostoTotalSimulado,
        }),
        {
          quantidade: 0,
          custoTotal: 0,
          vendaTotalAtual: 0,
          impostoTotalAtual: 0,
          vendaTotalSimulado: 0,
          impostoTotalSimulado: 0,
        }
      ),
    [linhas]
  );

  const houveEdicao = multiplicadores.some((m, i) => m !== faixas[i].multiplicador);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={onFechar}
    >
      <div
        className="w-full max-w-6xl rounded-2xl border shadow-2xl p-5 max-h-[92vh] overflow-y-auto"
        style={{ background: "var(--surface)", borderColor: "var(--line)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-semibold flex items-center gap-2" style={{ color: "var(--ink)" }}>
            <BarChart3 size={18} style={{ color: "var(--accent2)" }} />
            Resumo de Peças por Faixa de Markup
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
          Consulta — não altera a configuração de Faixas de Markup (Configurações). Edite o "Mult. simulado" de
          uma faixa pra ver o valor e a margem recalcularem na hora, com as {pecas.length} peça(s) que estão
          nessa tela agora. Objetivo: achar o multiplicador que faça a margem de peças bater pelo menos 30%.
        </p>

        <div className="flex justify-end items-center gap-2 mb-2">
          {loteNf && podePersonalizarMargem && (
            <button
              type="button"
              onClick={abrirConfirmacaoMargem}
              title={`Fixa o multiplicador simulado de cada faixa só pro lote ${loteNf} — outros lotes continuam na faixa global.`}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition"
              style={{ background: "var(--accent)", boxShadow: "0 0 20px var(--accent-glow)" }}
            >
              <Sparkles size={12} />
              Utilizar nova margem
            </button>
          )}
          <button
            type="button"
            onClick={restaurarPadrao}
            disabled={!houveEdicao}
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition hover:bg-[var(--surface2)] disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ borderColor: "var(--line)", color: "var(--ink)" }}
          >
            <RotateCcw size={12} />
            Restaurar padrão
          </button>
        </div>

        {loteNf && podePersonalizarMargem && (
          <p className="text-[11px] mb-3" style={{ color: "var(--muted)" }}>
            "Utilizar nova margem" vale só pro lote <strong style={{ color: "var(--ink)" }}>{loteNf}</strong> — se
            outro lote for selecionado depois, ele continua usando a faixa de Configurações &gt; Faixas de Markup (BID) normalmente.
          </p>
        )}

        <div className="rounded-xl border overflow-x-auto" style={{ borderColor: "var(--line)" }}>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left" style={{ background: "var(--surface2)", color: "var(--muted)" }}>
                <th className="px-3 py-2 font-medium">Faixa (custo)</th>
                <th className="px-3 py-2 font-medium text-right">Mult. hoje</th>
                <th className="px-3 py-2 font-medium text-right">Mult. simulado</th>
                <th className="px-3 py-2 font-medium text-right">Peças</th>
                <th className="px-3 py-2 font-medium text-right">Custo total</th>
                <th className="px-3 py-2 font-medium text-right">Venda total (hoje)</th>
                <th className="px-3 py-2 font-medium text-right">Venda total (simulado)</th>
                <th className="px-3 py-2 font-medium text-right">Margem hoje</th>
                <th className="px-3 py-2 font-medium text-right">Margem simulada</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l, i) => {
                const margemAtual = margemPercentual(l.vendaTotalAtual, l.custoTotal, l.impostoTotalAtual);
                const margemSimulada = margemPercentual(l.vendaTotalSimulado, l.custoTotal, l.impostoTotalSimulado);
                const editado = multiplicadores[i] !== l.faixa.multiplicador;
                return (
                  <tr key={i} className="border-t" style={{ borderColor: "var(--line)" }}>
                    <td className="px-3 py-2 font-medium whitespace-nowrap" style={{ color: "var(--ink)" }}>
                      {rotuloFaixa(l.faixa)}
                    </td>
                    <td className="px-3 py-2 text-right" style={{ color: "var(--muted)" }}>
                      {formatarMultiplicador(l.faixa.multiplicador)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        step="0.001"
                        min="0"
                        value={multiplicadores[i]}
                        onChange={(e) => {
                          const valor = Number(e.target.value);
                          if (Number.isFinite(valor) && valor > 0) alterarMultiplicador(i, valor);
                        }}
                        className="w-20 rounded-md border px-2 py-1 text-right text-xs outline-none focus:border-[var(--accent2)] transition"
                        style={{
                          borderColor: editado ? "var(--accent2)" : "var(--line)",
                          background: editado ? "var(--accent-glow)" : "var(--surface2)",
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
                    <td className="px-3 py-2 text-right whitespace-nowrap" style={{ color: "var(--ink)" }}>
                      {formatarReal(l.vendaTotalAtual)}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap font-medium" style={{ color: "var(--ink)" }}>
                      {formatarReal(l.vendaTotalSimulado)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {l.quantidade > 0 ? <Selo percentual={margemAtual} /> : <span style={{ color: "var(--muted)" }}>—</span>}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {l.quantidade > 0 ? (
                        <Selo percentual={margemSimulada} />
                      ) : (
                        <span style={{ color: "var(--muted)" }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t font-semibold" style={{ borderColor: "var(--line)", background: "var(--surface2)" }}>
                <td className="px-3 py-2" style={{ color: "var(--ink)" }} colSpan={3}>
                  Total
                </td>
                <td className="px-3 py-2 text-right" style={{ color: "var(--ink)" }}>
                  {totais.quantidade}
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap" style={{ color: "var(--ink)" }}>
                  {formatarReal(totais.custoTotal)}
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap" style={{ color: "var(--ink)" }}>
                  {formatarReal(totais.vendaTotalAtual)}
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap" style={{ color: "var(--ink)" }}>
                  {formatarReal(totais.vendaTotalSimulado)}
                </td>
                <td className="px-3 py-2 text-right">
                  <Selo percentual={margemPercentual(totais.vendaTotalAtual, totais.custoTotal, totais.impostoTotalAtual)} />
                </td>
                <td className="px-3 py-2 text-right">
                  <Selo
                    percentual={margemPercentual(totais.vendaTotalSimulado, totais.custoTotal, totais.impostoTotalSimulado)}
                  />
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {(semCusto > 0 || foraDeFaixa > 0) && (
          <p className="text-xs mt-2 flex items-center gap-3 flex-wrap" style={{ color: "var(--muted)" }}>
            {semCusto > 0 && <span>{semCusto} peça(s) sem custo cadastrado na Base Peças (fora dessa análise).</span>}
            {foraDeFaixa > 0 && <span>{foraDeFaixa} peça(s) com custo fora de qualquer faixa configurada.</span>}
          </p>
        )}
      </div>

      {mostrarConfirmacaoMargem && (
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
                Utilizar nova margem
              </h3>
              <button
                type="button"
                onClick={() => setMostrarConfirmacaoMargem(false)}
                aria-label="Fechar"
                className="w-7 h-7 flex items-center justify-center rounded-md transition hover:bg-[var(--surface2)]"
                style={{ color: "var(--muted)" }}
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-sm mb-4" style={{ color: "var(--muted)" }}>
              Vai fixar o multiplicador simulado de cada faixa acima especificamente pro lote{" "}
              <strong style={{ color: "var(--ink)" }}>{loteNf}</strong> — todo cálculo de peças desse lote (inclusive
              depois de "Recalcular") passa a usar essa margem, mesmo que a configuração global de Faixas de Markup
              (BID) mude depois. Outro lote selecionado continua usando a faixa global normalmente.
            </p>

            <label className="flex items-start gap-2.5 mb-3 cursor-pointer">
              <input
                type="checkbox"
                checked={checkGspn}
                onChange={(e) => setCheckGspn(e.target.checked)}
                className="mt-0.5"
              />
              <span className="text-sm" style={{ color: "var(--ink)" }}>
                Confirmo que a base do GSPN com a última atualização foi importada (atualiza os Part Number dos
                orçamentos).
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
              <input
                type="checkbox"
                checked={checkSemPeca}
                onChange={(e) => setCheckSemPeca(e.target.checked)}
                className="mt-0.5"
              />
              <span className="text-sm" style={{ color: "var(--ink)" }}>
                Já confirmei os orçamentos desse lote que seguirão sem peça.
                <br />
                <span
                  className="text-xs inline-flex items-center gap-1 mt-0.5"
                  style={{ color: qtdSemPecaPendenteNoLote > 0 ? "#ef4444" : "var(--muted)" }}
                >
                  {qtdSemPecaPendenteNoLote > 0 ? <AlertTriangle size={12} /> : <CheckCircle2 size={12} />}
                  {qtdSemPecaPendenteNoLote > 0
                    ? `${qtdSemPecaPendenteNoLote} orçamento(s) desse lote ainda pendente(s) de confirmação "sem peça".`
                    : "Nenhum pendente nesse lote."}
                </span>
              </span>
            </label>

            {erroMargem && (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mb-4">
                {erroMargem}
              </p>
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setMostrarConfirmacaoMargem(false)}
                disabled={enviandoMargem}
                className="rounded-lg px-4 py-2.5 text-sm font-medium transition hover:bg-[var(--surface2)] disabled:opacity-60"
                style={{ color: "var(--muted)" }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarNovaMargem}
                disabled={enviandoMargem || !checkGspn || !checkSemPeca}
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: "var(--accent)", boxShadow: "0 0 30px var(--accent-glow)" }}
              >
                {enviandoMargem && <Loader2 size={14} className="animate-spin" />}
                Utilizar nova margem
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
