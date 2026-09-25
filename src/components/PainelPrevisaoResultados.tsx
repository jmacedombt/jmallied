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

function CelulaValor({ valor, destaque }: { valor: number; destaque?: boolean }) {
  return (
    <td
      className="px-4 py-2.5 text-right whitespace-nowrap"
      style={{ color: destaque ? "var(--accent2)" : "var(--ink)", fontWeight: destaque ? 600 : undefined }}
    >
      {formatarReal(valor)}
    </td>
  );
}

// "Previsão de Resultados" (menu Financeiro, pedido explícito,
// 25/09/2026) — cada linha (NF Remessa) já mostra todos os valores
// direto na tabela, sem precisar abrir pop-up; os checkboxes + o resumo
// no topo servem pra somar só um SUBCONJUNTO de lotes selecionados (ex:
// só as NFs de um cliente específico), atualizando ao vivo. A linha
// "Total (nessa lista)" no rodapé soma sempre o que está sendo exibido
// (considerando a busca).
export default function PainelPrevisaoResultados({ linhas }: { linhas: LinhaPrevisaoResultadoLote[] }) {
  const [busca, setBusca] = useState("");
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());

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
              <th className="px-4 py-2.5 font-medium text-right">Mão de Obra</th>
              <th className="px-4 py-2.5 font-medium text-right">Custo de Peças</th>
              <th className="px-4 py-2.5 font-medium text-right">Venda de Peças</th>
              <th className="px-4 py-2.5 font-medium text-right">Margem de Peças</th>
              <th className="px-4 py-2.5 font-medium text-right">Margem Total</th>
              <th className="px-4 py-2.5 font-medium text-right">Valor Líquido</th>
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
                  <CelulaValor valor={m.maoDeObra} />
                  <CelulaValor valor={m.custoPecas} />
                  <CelulaValor valor={m.vendaPecas} />
                  <CelulaValor valor={m.margemPecas} />
                  <CelulaValor valor={m.margemTotal} />
                  <CelulaValor valor={m.valorLiquido} destaque />
                </tr>
              );
            })}
            {filtradas.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center" style={{ color: "var(--muted)", background: "var(--surface)" }}>
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
                <CelulaValor valor={totalExibido.maoDeObra} destaque />
                <CelulaValor valor={totalExibido.custoPecas} destaque />
                <CelulaValor valor={totalExibido.vendaPecas} destaque />
                <CelulaValor valor={totalExibido.margemPecas} destaque />
                <CelulaValor valor={totalExibido.margemTotal} destaque />
                <CelulaValor valor={totalExibido.valorLiquido} destaque />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
