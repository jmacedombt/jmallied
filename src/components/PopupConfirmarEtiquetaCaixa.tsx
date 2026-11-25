"use client";

import { useState } from "react";
import { Check, Loader2, Plus, Printer, RotateCcw, Tag, Trash2, X } from "lucide-react";
import {
  imprimirCaixasDoGrupo,
  sugerirDivisaoCaixas,
  ErroImpressaoAgente,
  type DadosEtiquetaCaixa,
} from "@/lib/etiquetas";
import PreviewEtiquetaCaixa from "@/components/PreviewEtiquetaCaixa";

export type GrupoCaixas = {
  /** dados fixos das etiquetas desse grupo (mesmo lote, status e tipo) */
  base: Omit<DadosEtiquetaCaixa, "qtde" | "caixaAtual" | "caixaTotal">;
  quantidadeAparelhos: number;
};

/**
 * Montagem das caixas + impressão das etiquetas (pedido explícito,
 * 25/11/2026, "opção 1"): como muitas vezes não se sabe de antemão
 * quantas caixas serão usadas, as etiquetas são impressas NO FIM. O
 * sistema sugere 21 aparelhos por caixa, o operador ajusta como montou
 * de verdade (adiciona/remove caixa, muda a quantidade de cada uma) e a
 * soma precisa bater com o total de aparelhos do grupo. Aí imprime tudo
 * de uma vez, cada etiqueta com "Caixa X de Y" e a Qtde certa.
 *
 * Um lote pode ter mais de um grupo (Reparo x Reincidência) — cada grupo
 * tem as próprias caixas e a própria numeração.
 */
export default function PopupConfirmarEtiquetaCaixa({
  titulo,
  grupos,
  onFechar,
}: {
  titulo: string;
  grupos: GrupoCaixas[];
  onFechar: () => void;
}) {
  const [caixas, setCaixas] = useState<number[][]>(() => grupos.map((g) => sugerirDivisaoCaixas(g.quantidadeAparelhos)));
  const [grupoPrevia, setGrupoPrevia] = useState(0);
  const [imprimindo, setImprimindo] = useState(false);
  const [progresso, setProgresso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  function alterar(gi: number, novo: number[]) {
    setSucesso(false);
    setErro(null);
    setCaixas((atual) => atual.map((c, i) => (i === gi ? novo : c)));
  }

  const somas = caixas.map((c) => c.reduce((s, q) => s + q, 0));
  const tudoCerto = grupos.every((g, i) => somas[i] === g.quantidadeAparelhos && caixas[i].every((q) => q > 0));
  const totalEtiquetas = caixas.reduce((s, c) => s + c.length, 0);

  async function imprimir() {
    setErro(null);
    setSucesso(false);
    setImprimindo(true);
    try {
      for (let gi = 0; gi < grupos.length; gi++) {
        const g = grupos[gi];
        await imprimirCaixasDoGrupo(g.base, caixas[gi], (n) =>
          setProgresso(`${g.base.tipo} - ${g.base.status}: ${n} de ${caixas[gi].length}`)
        );
      }
      setSucesso(true);
    } catch (e) {
      setErro(e instanceof ErroImpressaoAgente ? e.message : "Não foi possível imprimir as etiquetas de caixa.");
    }
    setProgresso(null);
    setImprimindo(false);
  }

  const gPrev = grupos[grupoPrevia];
  const dadosPrevia: DadosEtiquetaCaixa | null = gPrev
    ? { ...gPrev.base, qtde: caixas[grupoPrevia]?.[0] ?? 0, caixaAtual: 1, caixaTotal: caixas[grupoPrevia]?.length ?? 1 }
    : null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-4"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={() => !imprimindo && onFechar()}
    >
      <div
        className="w-full max-w-3xl max-h-[calc(100vh-1.5rem)] flex flex-col rounded-2xl border shadow-2xl"
        style={{ background: "var(--surface)", borderColor: "var(--line)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 px-5 pt-5 pb-3 border-b" style={{ borderColor: "var(--line)" }}>
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold flex items-center gap-2" style={{ color: "var(--ink)" }}>
              <Tag size={18} style={{ color: "var(--accent2)" }} />
              Etiquetas de Caixa — {titulo}
            </h2>
            <button
              type="button"
              onClick={onFechar}
              disabled={imprimindo}
              aria-label="Fechar"
              className="w-7 h-7 flex items-center justify-center rounded-md transition hover:bg-[var(--surface2)] disabled:opacity-50"
              style={{ color: "var(--muted)" }}
            >
              <X size={16} />
            </button>
          </div>
          <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
            Monte as caixas como ficaram de verdade: a sugestão é de 21 aparelhos por caixa, mas dá para adicionar,
            remover e mudar a quantidade de cada uma. A soma de cada grupo precisa bater com o total de aparelhos.
          </p>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 grid md:grid-cols-[1fr_auto] gap-5">
          <div className="space-y-4 min-w-0">
            {grupos.map((g, gi) => {
              const soma = somas[gi];
              const diferenca = g.quantidadeAparelhos - soma;
              const ok = diferenca === 0 && caixas[gi].every((q) => q > 0);
              return (
                <div
                  key={`${g.base.tipo}-${g.base.status}`}
                  className="rounded-xl border p-3"
                  style={{ borderColor: grupoPrevia === gi ? "var(--accent2)" : "var(--line)" }}
                  onClick={() => setGrupoPrevia(gi)}
                >
                  <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                    <p className="text-sm font-bold" style={{ color: "var(--ink)" }}>
                      {g.base.tipo} - {g.base.status}
                      <span className="ml-2 text-xs font-medium" style={{ color: "var(--muted)" }}>
                        {g.quantidadeAparelhos} aparelho(s)
                      </span>
                    </p>
                    <span
                      className="text-[11px] font-semibold rounded-md px-1.5 py-0.5"
                      style={
                        ok
                          ? { color: "#15803d", background: "rgba(22,163,74,0.12)" }
                          : { color: "#b91c1c", background: "rgba(220,38,38,0.12)" }
                      }
                    >
                      {ok ? (
                        <span className="inline-flex items-center gap-1">
                          <Check size={11} /> Soma {soma} — confere
                        </span>
                      ) : diferenca > 0 ? (
                        `Faltam ${diferenca} aparelho(s)`
                      ) : diferenca < 0 ? (
                        `Sobram ${-diferenca} aparelho(s)`
                      ) : (
                        "Caixa com quantidade 0"
                      )}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {caixas[gi].map((q, ci) => (
                      <div
                        key={ci}
                        className="flex items-center gap-1 rounded-lg border pl-2 pr-1 py-1"
                        style={{ borderColor: "var(--line)", background: "var(--surface2)" }}
                      >
                        <span className="text-[11px] font-semibold whitespace-nowrap" style={{ color: "var(--muted)" }}>
                          Caixa {ci + 1}
                        </span>
                        <input
                          type="number"
                          min={1}
                          value={q}
                          disabled={imprimindo}
                          onChange={(e) => {
                            const n = Math.max(0, parseInt(e.target.value || "0", 10) || 0);
                            alterar(gi, caixas[gi].map((x, i) => (i === ci ? n : x)));
                          }}
                          className="w-14 text-center rounded-md border px-1 py-1 text-sm font-bold outline-none"
                          style={{ background: "var(--surface)", borderColor: "var(--line)", color: "var(--ink)" }}
                        />
                        <button
                          type="button"
                          disabled={imprimindo || caixas[gi].length <= 1}
                          onClick={() => alterar(gi, caixas[gi].filter((_, i) => i !== ci))}
                          aria-label={`Remover caixa ${ci + 1}`}
                          className="w-6 h-6 flex items-center justify-center rounded-md transition hover:bg-[var(--surface)] disabled:opacity-30"
                          style={{ color: "#dc2626" }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      disabled={imprimindo}
                      onClick={() => alterar(gi, [...caixas[gi], Math.max(1, diferenca)])}
                      className="inline-flex items-center gap-1 rounded-lg border border-dashed px-2.5 py-1 text-xs font-medium"
                      style={{ borderColor: "var(--accent2)", color: "var(--accent2)" }}
                    >
                      <Plus size={12} /> Caixa
                    </button>
                    <button
                      type="button"
                      disabled={imprimindo}
                      onClick={() => alterar(gi, sugerirDivisaoCaixas(g.quantidadeAparelhos))}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] underline decoration-dotted"
                      style={{ color: "var(--muted)" }}
                    >
                      <RotateCcw size={11} /> usar sugestão
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {dadosPrevia && (
            <div className="md:w-[300px] shrink-0">
              <p className="text-xs font-medium mb-1.5" style={{ color: "var(--muted)" }}>
                Prévia (Caixa 1 de {gPrev.base.tipo} - {gPrev.base.status})
              </p>
              <PreviewEtiquetaCaixa dados={dadosPrevia} />
              {grupos.length > 1 && (
                <p className="text-[11px] mt-1.5" style={{ color: "var(--muted)" }}>
                  Clique num grupo para ver a prévia dele.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="shrink-0 px-5 py-3 border-t" style={{ borderColor: "var(--line)" }}>
          {erro && (
            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mb-2">{erro}</p>
          )}
          {sucesso && !erro && (
            <p
              className="text-sm rounded-lg px-3 py-2 mb-2"
              style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.35)", color: "#22c55e" }}
            >
              {totalEtiquetas} etiqueta(s) enviada(s) pra impressão.
            </p>
          )}
          <div className="flex items-center justify-end gap-2 flex-wrap">
            {progresso && (
              <span className="text-xs mr-auto" style={{ color: "var(--muted)" }}>
                Imprimindo {progresso}…
              </span>
            )}
            <button
              type="button"
              onClick={onFechar}
              disabled={imprimindo}
              className="rounded-lg px-4 py-2.5 text-sm font-medium transition hover:bg-[var(--surface2)] disabled:opacity-60"
              style={{ color: "var(--muted)" }}
            >
              Fechar
            </button>
            {!sucesso && (
              <button
                type="button"
                onClick={imprimir}
                disabled={imprimindo || !tudoCerto}
                title={!tudoCerto ? "A soma das caixas de cada grupo precisa bater com o total de aparelhos" : undefined}
                className="inline-flex items-center gap-2 rounded-lg text-white text-sm font-medium px-5 py-2.5 transition disabled:opacity-50"
                style={{ background: "var(--accent2)" }}
              >
                {imprimindo ? <Loader2 size={15} className="animate-spin" /> : <Printer size={15} />}
                {imprimindo ? "Imprimindo..." : `Confirmar e Imprimir (${totalEtiquetas})`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
