"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import {
  calcularMetricasPrevisaoResultado,
  type LinhaPrevisaoResultadoLote,
  type MetricasPrevisaoResultado,
} from "@/lib/financeiro";

function formatarReal(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Conteúdo dos tooltips (pedido explícito) — em cima do TÍTULO da coluna
// explica o que aquele número representa/como é calculado (texto fixo,
// igual pra qualquer linha); em cima do VALOR de uma linha mostra a
// mesma explicação já com os números daquela linha aplicados, pra dar
// pra conferir a conta. Mesmo padrão visual do tooltip de Ticket Médio
// (Resumo de Peças por Modelo) e do TooltipCalculoBid.
type InfoTooltip = { titulo: string; linhas: string[] };

const EXPLICACAO_CABECALHO: Record<
  "maoDeObra" | "custoPecas" | "impostoPecas" | "vendaPecas" | "margemPecas" | "margemTotal" | "valorLiquido",
  InfoTooltip
> = {
  maoDeObra: {
    titulo: "Mão de Obra",
    linhas: ["Soma do valor de mão de obra (Configurações > Mão de obra) de todos os orçamentos aprovados desse lote."],
  },
  custoPecas: {
    titulo: "Custo de Peças",
    linhas: ["Soma do custo das peças (Base Peças) de todos os orçamentos aprovados desse lote — sem markup nem ICMS."],
  },
  impostoPecas: {
    titulo: "Imposto (ICMS)",
    linhas: ["Soma do ICMS (Configurações > Impostos) aplicado sobre o custo das peças de todos os orçamentos aprovados desse lote."],
  },
  vendaPecas: {
    titulo: "Venda de Peças",
    linhas: [
      "Soma do valor de venda das peças de todos os orçamentos aprovados desse lote — custo com markup da faixa BID, já incluindo o ICMS.",
    ],
  },
  margemPecas: {
    titulo: "Margem de Peças",
    linhas: ["Venda de Peças menos Custo de Peças menos Imposto (ICMS) — o lucro só das peças, sem contar a mão de obra."],
  },
  margemTotal: {
    titulo: "Margem Total",
    linhas: ["Margem de Peças mais Mão de Obra — o lucro total do lote."],
  },
  valorLiquido: {
    titulo: "Valor Líquido",
    linhas: ["Venda de Peças mais Mão de Obra — o total cobrado da Allied, sem descontar custo nem imposto (não é lucro)."],
  },
};

function explicacaoValorMaoDeObra(m: MetricasPrevisaoResultado): InfoTooltip {
  return {
    titulo: "Mão de Obra",
    linhas: [`Soma da mão de obra de ${m.quantidadeAprovados} orçamento(s) aprovado(s) nesse lote = ${formatarReal(m.maoDeObra)}.`],
  };
}
function explicacaoValorCustoPecas(m: MetricasPrevisaoResultado): InfoTooltip {
  return {
    titulo: "Custo de Peças",
    linhas: [`Soma do custo (Base Peças) das peças de ${m.quantidadeAprovados} orçamento(s) aprovado(s) = ${formatarReal(m.custoPecas)}.`],
  };
}
function explicacaoValorImposto(m: MetricasPrevisaoResultado): InfoTooltip {
  return {
    titulo: "Imposto (ICMS)",
    linhas: [`Soma do ICMS sobre o custo das peças de ${m.quantidadeAprovados} orçamento(s) aprovado(s) = ${formatarReal(m.impostoPecas)}.`],
  };
}
function explicacaoValorVendaPecas(m: MetricasPrevisaoResultado): InfoTooltip {
  return {
    titulo: "Venda de Peças",
    linhas: [`Soma da venda das peças de ${m.quantidadeAprovados} orçamento(s) aprovado(s) = ${formatarReal(m.vendaPecas)}.`],
  };
}
function explicacaoValorMargemPecas(m: MetricasPrevisaoResultado): InfoTooltip {
  return {
    titulo: "Margem de Peças",
    linhas: [
      `Venda de Peças ${formatarReal(m.vendaPecas)}`,
      `− Custo de Peças ${formatarReal(m.custoPecas)}`,
      `− Imposto (ICMS) ${formatarReal(m.impostoPecas)}`,
      `= Margem de Peças ${formatarReal(m.margemPecas)}`,
    ],
  };
}
function explicacaoValorMargemTotal(m: MetricasPrevisaoResultado): InfoTooltip {
  return {
    titulo: "Margem Total",
    linhas: [
      `Margem de Peças ${formatarReal(m.margemPecas)}`,
      `+ Mão de Obra ${formatarReal(m.maoDeObra)}`,
      `= Margem Total ${formatarReal(m.margemTotal)}`,
    ],
  };
}
function explicacaoValorLiquido(m: MetricasPrevisaoResultado): InfoTooltip {
  return {
    titulo: "Valor Líquido",
    linhas: [
      `Venda de Peças ${formatarReal(m.vendaPecas)}`,
      `+ Mão de Obra ${formatarReal(m.maoDeObra)}`,
      `= Valor Líquido ${formatarReal(m.valorLiquido)}`,
    ],
  };
}

function CelulaValor({
  valor,
  destaque,
  info,
  onMostrar,
  onOcultar,
}: {
  valor: number;
  destaque?: boolean;
  info: InfoTooltip;
  onMostrar: (e: React.MouseEvent, info: InfoTooltip) => void;
  onOcultar: () => void;
}) {
  return (
    <td
      className="px-4 py-2.5 text-right whitespace-nowrap cursor-help"
      style={{ color: destaque ? "var(--accent2)" : "var(--ink)", fontWeight: destaque ? 600 : undefined }}
      onMouseEnter={(e) => onMostrar(e, info)}
      onMouseLeave={onOcultar}
    >
      {formatarReal(valor)}
    </td>
  );
}

function CabecalhoColuna({
  texto,
  info,
  onMostrar,
  onOcultar,
}: {
  texto: string;
  info: InfoTooltip;
  onMostrar: (e: React.MouseEvent, info: InfoTooltip) => void;
  onOcultar: () => void;
}) {
  return (
    <th
      className="px-4 py-2.5 font-medium text-right cursor-help"
      onMouseEnter={(e) => onMostrar(e, info)}
      onMouseLeave={onOcultar}
    >
      {texto}
    </th>
  );
}

// "Previsão de Resultados" (menu Financeiro, pedido explícito,
// 25/09/2026) — cada linha (NF Remessa) já mostra todos os valores
// direto na tabela, sem precisar abrir pop-up; os checkboxes + o resumo
// no topo servem pra somar só um SUBCONJUNTO de lotes selecionados (ex:
// só as NFs de um cliente específico), atualizando ao vivo. A linha
// "Total (nessa lista)" no rodapé soma sempre o que está sendo exibido
// (considerando a busca). Coluna Imposto (ICMS) + tooltips explicativos
// no cabeçalho e nos valores (pedido explícito, 29/09/2026).
export default function PainelPrevisaoResultados({ linhas }: { linhas: LinhaPrevisaoResultadoLote[] }) {
  const [busca, setBusca] = useState("");
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [tooltip, setTooltip] = useState<(InfoTooltip & { x: number; y: number }) | null>(null);

  function mostrarTooltip(e: React.MouseEvent, info: InfoTooltip) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = Math.min(Math.max(rect.left, 8), window.innerWidth - 320);
    setTooltip({ ...info, x, y: rect.bottom + 8 });
  }
  function ocultarTooltip() {
    setTooltip(null);
  }

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return linhas;
    return linhas.filter((l) => l.nfRemessaAllied.toLowerCase().includes(termo));
  }, [linhas, busca]);

  const totalExibido: MetricasPrevisaoResultado = useMemo(() => calcularMetricasPrevisaoResultado(filtradas), [filtradas]);

  const linhasSelecionadas = useMemo(() => filtradas.filter((l) => selecionados.has(l.nfRemessaAllied)), [filtradas, selecionados]);
  const totalSelecionado: MetricasPrevisaoResultado = useMemo(
    () => calcularMetricasPrevisaoResultado(linhasSelecionadas),
    [linhasSelecionadas]
  );

  const todosExibidosSelecionados = filtradas.length > 0 && filtradas.every((l) => selecionados.has(l.nfRemessaAllied));

  function alternarSelecionado(nf: string) {
    setSelecionados((atual) => {
      const novo = new Set(atual);
      if (novo.has(nf)) novo.delete(nf);
      else novo.add(nf);
      return novo;
    });
  }

  function alternarSelecionarTodos() {
    setSelecionados(todosExibidosSelecionados ? new Set() : new Set(filtradas.map((l) => l.nfRemessaAllied)));
  }

  return (
    <div className="space-y-3">
      <div className="relative w-64">
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--muted)" }} />
        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por NF Remessa"
          className="pl-7 pr-3 py-1.5 rounded-lg border text-xs w-full"
          style={{ borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink)" }}
        />
      </div>

      {selecionados.size > 0 && (
        <div
          className="flex flex-wrap items-center gap-x-5 gap-y-1.5 rounded-xl border px-4 py-3"
          style={{ borderColor: "var(--accent2)", background: "var(--accent-glow)" }}
        >
          <span className="text-xs font-semibold" style={{ color: "var(--ink)" }}>
            {selecionados.size} lote(s) selecionado(s)
            <span className="font-normal" style={{ color: "var(--muted)" }}>
              {" "}
              · {totalSelecionado.quantidadeAprovados} aprovado(s), {totalSelecionado.quantidadeReprovados} reprovado(s)
            </span>
          </span>
          <span className="text-xs" style={{ color: "var(--muted)" }}>
            Mão de Obra: <strong style={{ color: "var(--ink)" }}>{formatarReal(totalSelecionado.maoDeObra)}</strong>
          </span>
          <span className="text-xs" style={{ color: "var(--muted)" }}>
            Custo: <strong style={{ color: "var(--ink)" }}>{formatarReal(totalSelecionado.custoPecas)}</strong>
          </span>
          <span className="text-xs" style={{ color: "var(--muted)" }}>
            ICMS: <strong style={{ color: "var(--ink)" }}>{formatarReal(totalSelecionado.impostoPecas)}</strong>
          </span>
          <span className="text-xs" style={{ color: "var(--muted)" }}>
            Venda: <strong style={{ color: "var(--ink)" }}>{formatarReal(totalSelecionado.vendaPecas)}</strong>
          </span>
          <span className="text-xs" style={{ color: "var(--muted)" }}>
            Margem Total: <strong style={{ color: "var(--ink)" }}>{formatarReal(totalSelecionado.margemTotal)}</strong>
          </span>
          <span className="text-xs" style={{ color: "var(--accent2)" }}>
            Valor Líquido: <strong>{formatarReal(totalSelecionado.valorLiquido)}</strong>
          </span>
          <button type="button" onClick={() => setSelecionados(new Set())} className="text-xs underline ml-auto" style={{ color: "var(--muted)" }}>
            Limpar seleção
          </button>
        </div>
      )}

      <div className="rounded-xl border overflow-hidden overflow-x-auto" style={{ borderColor: "var(--line)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left" style={{ background: "var(--surface2)", color: "var(--muted)" }}>
              <th className="px-4 py-2.5 font-medium w-8">
                <input type="checkbox" checked={todosExibidosSelecionados} onChange={alternarSelecionarTodos} aria-label="Selecionar todos" />
              </th>
              <th className="px-4 py-2.5 font-medium">NF Remessa</th>
              <th className="px-4 py-2.5 font-medium text-right">Qtd. Orçamentos</th>
              <CabecalhoColuna texto="Mão de Obra" info={EXPLICACAO_CABECALHO.maoDeObra} onMostrar={mostrarTooltip} onOcultar={ocultarTooltip} />
              <CabecalhoColuna texto="Custo de Peças" info={EXPLICACAO_CABECALHO.custoPecas} onMostrar={mostrarTooltip} onOcultar={ocultarTooltip} />
              <CabecalhoColuna
                texto="Imposto (ICMS)"
                info={EXPLICACAO_CABECALHO.impostoPecas}
                onMostrar={mostrarTooltip}
                onOcultar={ocultarTooltip}
              />
              <CabecalhoColuna texto="Venda de Peças" info={EXPLICACAO_CABECALHO.vendaPecas} onMostrar={mostrarTooltip} onOcultar={ocultarTooltip} />
              <CabecalhoColuna
                texto="Margem de Peças"
                info={EXPLICACAO_CABECALHO.margemPecas}
                onMostrar={mostrarTooltip}
                onOcultar={ocultarTooltip}
              />
              <CabecalhoColuna texto="Margem Total" info={EXPLICACAO_CABECALHO.margemTotal} onMostrar={mostrarTooltip} onOcultar={ocultarTooltip} />
              <CabecalhoColuna texto="Valor Líquido" info={EXPLICACAO_CABECALHO.valorLiquido} onMostrar={mostrarTooltip} onOcultar={ocultarTooltip} />
            </tr>
          </thead>
          <tbody>
            {filtradas.map((l) => {
              const m = calcularMetricasPrevisaoResultado([l]);
              return (
                <tr key={l.nfRemessaAllied} className="border-t" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
                  <td className="px-4 py-2.5">
                    <input
                      type="checkbox"
                      checked={selecionados.has(l.nfRemessaAllied)}
                      onChange={() => alternarSelecionado(l.nfRemessaAllied)}
                      aria-label={`Selecionar ${l.nfRemessaAllied}`}
                    />
                  </td>
                  <td className="px-4 py-2.5 font-medium" style={{ color: "var(--ink)" }}>
                    {l.nfRemessaAllied}
                  </td>
                  <td className="px-4 py-2.5 text-right" style={{ color: "var(--muted)" }}>
                    {m.quantidadeAprovados}
                    {m.quantidadeReprovados > 0 && (
                      <span style={{ color: "#ef4444" }}> ({m.quantidadeReprovados} reprovado{m.quantidadeReprovados > 1 ? "s" : ""})</span>
                    )}
                  </td>
                  <CelulaValor valor={m.maoDeObra} info={explicacaoValorMaoDeObra(m)} onMostrar={mostrarTooltip} onOcultar={ocultarTooltip} />
                  <CelulaValor valor={m.custoPecas} info={explicacaoValorCustoPecas(m)} onMostrar={mostrarTooltip} onOcultar={ocultarTooltip} />
                  <CelulaValor valor={m.impostoPecas} info={explicacaoValorImposto(m)} onMostrar={mostrarTooltip} onOcultar={ocultarTooltip} />
                  <CelulaValor valor={m.vendaPecas} info={explicacaoValorVendaPecas(m)} onMostrar={mostrarTooltip} onOcultar={ocultarTooltip} />
                  <CelulaValor valor={m.margemPecas} info={explicacaoValorMargemPecas(m)} onMostrar={mostrarTooltip} onOcultar={ocultarTooltip} />
                  <CelulaValor valor={m.margemTotal} info={explicacaoValorMargemTotal(m)} onMostrar={mostrarTooltip} onOcultar={ocultarTooltip} />
                  <CelulaValor
                    valor={m.valorLiquido}
                    destaque
                    info={explicacaoValorLiquido(m)}
                    onMostrar={mostrarTooltip}
                    onOcultar={ocultarTooltip}
                  />
                </tr>
              );
            })}
            {filtradas.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center" style={{ color: "var(--muted)", background: "var(--surface)" }}>
                  {linhas.length === 0 ? "Nenhum orçamento aprovado (ou reprovado) no momento." : "Nenhum lote encontrado com essa busca."}
                </td>
              </tr>
            )}
          </tbody>
          {filtradas.length > 0 && (
            <tfoot>
              <tr className="border-t-2" style={{ borderColor: "var(--accent2)", background: "var(--surface2)" }}>
                <td />
                <td className="px-4 py-2.5 font-semibold" style={{ color: "var(--ink)" }}>
                  Total ({filtradas.length} lote{filtradas.length > 1 ? "s" : ""})
                </td>
                <td className="px-4 py-2.5 text-right font-semibold" style={{ color: "var(--muted)" }}>
                  {totalExibido.quantidadeAprovados}
                  {totalExibido.quantidadeReprovados > 0 && (
                    <span style={{ color: "#ef4444" }}> ({totalExibido.quantidadeReprovados})</span>
                  )}
                </td>
                <CelulaValor
                  valor={totalExibido.maoDeObra}
                  destaque
                  info={explicacaoValorMaoDeObra(totalExibido)}
                  onMostrar={mostrarTooltip}
                  onOcultar={ocultarTooltip}
                />
                <CelulaValor
                  valor={totalExibido.custoPecas}
                  destaque
                  info={explicacaoValorCustoPecas(totalExibido)}
                  onMostrar={mostrarTooltip}
                  onOcultar={ocultarTooltip}
                />
                <CelulaValor
                  valor={totalExibido.impostoPecas}
                  destaque
                  info={explicacaoValorImposto(totalExibido)}
                  onMostrar={mostrarTooltip}
                  onOcultar={ocultarTooltip}
                />
                <CelulaValor
                  valor={totalExibido.vendaPecas}
                  destaque
                  info={explicacaoValorVendaPecas(totalExibido)}
                  onMostrar={mostrarTooltip}
                  onOcultar={ocultarTooltip}
                />
                <CelulaValor
                  valor={totalExibido.margemPecas}
                  destaque
                  info={explicacaoValorMargemPecas(totalExibido)}
                  onMostrar={mostrarTooltip}
                  onOcultar={ocultarTooltip}
                />
                <CelulaValor
                  valor={totalExibido.margemTotal}
                  destaque
                  info={explicacaoValorMargemTotal(totalExibido)}
                  onMostrar={mostrarTooltip}
                  onOcultar={ocultarTooltip}
                />
                <CelulaValor
                  valor={totalExibido.valorLiquido}
                  destaque
                  info={explicacaoValorLiquido(totalExibido)}
                  onMostrar={mostrarTooltip}
                  onOcultar={ocultarTooltip}
                />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {tooltip && (
        <div
          className="fixed z-50 rounded-lg border px-3 py-2 text-xs shadow-2xl"
          style={{ left: tooltip.x, top: tooltip.y, maxWidth: 300, background: "var(--surface)", borderColor: "var(--accent2)" }}
        >
          <p className="font-semibold mb-1" style={{ color: "var(--ink)" }}>
            {tooltip.titulo}
          </p>
          {tooltip.linhas.map((linha, i) => (
            <p key={i} style={{ color: "var(--muted)" }}>
              {linha}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
