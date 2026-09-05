"use client";

import { useState } from "react";
import { Check, Copy, X } from "lucide-react";

export type LinhaDetalheCard = { rotulo: string; valor: string };

// Base de cálculo (todos os lotes juntos) mostrada como contexto extra
// nos cards de Lucro Líquido da Peça / Lucro Total / % Lucro Peças /
// % Lucro Total — em vez de criar mais cards na linha de cima, os
// valores que compõem a conta aparecem aqui. maoDeObra fica de fora
// (undefined) nos cards que são só de peça (Lucro Líquido da Peça e
// % Lucro Peças) — não faz sentido misturar mão de obra ali.
export type BaseCalculoResumo = {
  custoTotalPecas: number;
  impostoTotalPecas: number;
  vendaTotalPecas: number;
  maoDeObra?: number;
};

function formatarReal(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// explica como cada valor da base de cálculo chega no número mostrado —
// aparece ao passar o mouse em cima da linha.
const EXPLICACAO_CUSTO = "Soma do valor mais recente de compra de cada peça, direto da Base Peças.";
const EXPLICACAO_IMPOSTO =
  "ICMS sobre o valor já com a margem de markup aplicada (não sobre o custo cru) — arredondado pra cima, 2 casas.";
const EXPLICACAO_VENDA =
  "Custo × markup da faixa configurada, mais o Imposto — arredondado pra cima pro inteiro mais próximo (mesma regra do Custo Peça Allied no BID).";
const EXPLICACAO_MAO_DE_OBRA =
  "Valor fixo configurado em Configurações > Mão de obra, conforme a quantidade de peças de cada orçamento.";

function LinhaComExplicacao({
  label,
  valor,
  explicacao,
}: {
  label: string;
  valor: string;
  explicacao: string;
}) {
  return (
    <div className="group relative flex justify-between gap-4 cursor-help">
      <span style={{ color: "var(--muted)" }}>{label}</span>
      <strong style={{ color: "var(--ink)" }}>{valor}</strong>
      <div
        className="pointer-events-none absolute right-0 top-full mt-1 z-20 hidden w-56 rounded-lg border p-2.5 text-[11px] leading-snug shadow-2xl group-hover:block"
        style={{ background: "var(--surface)", borderColor: "var(--line)", color: "var(--muted)" }}
      >
        {explicacao}
      </div>
    </div>
  );
}

// Pop-up genérico de "resumo relacionado ao card clicado" — qualquer
// card da linha de totais (Nessa etapa, Quantidade de Peças, Custo,
// Imposto, Venda, Lucro Total, % Lucro Peças, % Lucro Total) abre esse
// mesmo pop-up, só trocando ícone/rótulo/fórmula/linhas. As linhas são
// sempre o valor daquele card quebrado por lote (NF Remessa), pra dar
// contexto de como o total exibido se formou. Fecha clicando fora.
export default function PopupDetalheCard({
  icone: Icone,
  label,
  valorAtual,
  corValor,
  formula,
  baseCalculo,
  linhas,
  onFechar,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icone: React.ComponentType<any>;
  label: string;
  valorAtual: string;
  corValor?: string;
  formula?: string;
  /** só nos cards de Lucro Total / % Lucro Peças / % Lucro Total — mostra
   * Custo, Imposto, Venda e Mão de obra (agregados) como base do cálculo. */
  baseCalculo?: BaseCalculoResumo;
  linhas: LinhaDetalheCard[];
  onFechar: () => void;
}) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    const linhasBase = baseCalculo
      ? [
          "",
          "Base de cálculo (todos os lotes):",
          `Custo das peças: ${formatarReal(baseCalculo.custoTotalPecas)}`,
          `Imposto (ICMS): ${formatarReal(baseCalculo.impostoTotalPecas)}`,
          `Venda de peças: ${formatarReal(baseCalculo.vendaTotalPecas)}`,
          ...(baseCalculo.maoDeObra != null ? [`Mão de obra: ${formatarReal(baseCalculo.maoDeObra)}`] : []),
        ]
      : [];
    const texto = [
      `${label}: ${valorAtual}`,
      formula ? `Fórmula: ${formula}` : null,
      ...linhasBase,
      "",
      "Por lote (NF Remessa):",
      ...linhas.map((l) => `${l.rotulo}: ${l.valor}`),
    ]
      .filter((l): l is string => l != null)
      .join("\n");
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1200);
    } catch {
      // clipboard indisponível — ignora silenciosamente
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={(e) => {
        e.stopPropagation();
        onFechar();
      }}
    >
      <div
        className="w-full max-w-sm rounded-2xl border shadow-2xl p-5"
        style={{ background: "var(--surface)", borderColor: "var(--line)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: "var(--ink)" }}>
            <Icone size={16} style={{ color: corValor ?? "var(--accent2)" }} />
            {label}
          </h3>
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

        <p className="text-2xl font-semibold mb-1" style={{ color: corValor ?? "var(--ink)" }}>
          {valorAtual}
        </p>
        {formula && (
          <p className="text-[11px] mb-3" style={{ color: "var(--muted)" }}>
            {formula}
          </p>
        )}

        {baseCalculo && (
          <div
            className="rounded-xl border p-3 mb-3 text-xs space-y-2"
            style={{ background: "var(--surface2)", borderColor: "var(--line)" }}
          >
            <LinhaComExplicacao
              label="Custo das peças"
              valor={formatarReal(baseCalculo.custoTotalPecas)}
              explicacao={EXPLICACAO_CUSTO}
            />
            <LinhaComExplicacao
              label="Imposto (ICMS)"
              valor={formatarReal(baseCalculo.impostoTotalPecas)}
              explicacao={EXPLICACAO_IMPOSTO}
            />
            <LinhaComExplicacao
              label="Venda de peças"
              valor={formatarReal(baseCalculo.vendaTotalPecas)}
              explicacao={EXPLICACAO_VENDA}
            />
            {baseCalculo.maoDeObra != null && (
              <LinhaComExplicacao
                label="Mão de obra"
                valor={formatarReal(baseCalculo.maoDeObra)}
                explicacao={EXPLICACAO_MAO_DE_OBRA}
              />
            )}
          </div>
        )}

        <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--line)" }}>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left" style={{ background: "var(--surface2)", color: "var(--muted)" }}>
                <th className="px-3 py-1.5 font-medium">Lote (NF Remessa)</th>
                <th className="px-3 py-1.5 font-medium text-right">{label}</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.rotulo} className="border-t" style={{ borderColor: "var(--line)" }}>
                  <td className="px-3 py-1.5 font-mono" style={{ color: "var(--muted)" }}>
                    {l.rotulo}
                  </td>
                  <td className="px-3 py-1.5 text-right" style={{ color: "var(--ink)" }}>
                    {l.valor}
                  </td>
                </tr>
              ))}
              {linhas.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-3 py-3 text-center" style={{ color: "var(--muted)" }}>
                    Nenhum lote nessa etapa.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <button
          type="button"
          onClick={copiar}
          className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition hover:bg-[var(--surface2)]"
          style={{ color: "var(--muted)", border: "1px solid var(--line)" }}
        >
          {copiado ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
          Copiar
        </button>
      </div>
    </div>
  );
}
