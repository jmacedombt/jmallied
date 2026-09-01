"use client";

import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { faixaMarkupPara, type FaixaMarkup } from "@/lib/bid";
import type { PecaBid } from "@/components/TabelaBidPecas";

function formatarMoeda(valor: number | null) {
  if (valor == null) return "—";
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function ordenarSolucoes(peca: PecaBid) {
  return [...(peca.bid_solucoes ?? [])].sort((a, b) => Number(b.principal) - Number(a.principal));
}

function TooltipCalculo({ peca, faixas }: { peca: PecaBid; faixas: FaixaMarkup[] }) {
  if (peca.custo_peca_samsung == null) {
    return (
      <div className="text-xs space-y-1">
        <p className="font-medium text-amber-400">Ainda sem custo calculado</p>
        <p style={{ color: "var(--muted)" }}>
          Esse Part Number ainda não foi encontrado na Base Peças — assim que for importado lá, o custo aparece aqui
          (ou clique em "Recalcular" na tela BID).
        </p>
      </div>
    );
  }

  const faixa = faixaMarkupPara(peca.custo_peca_samsung, faixas);

  return (
    <div className="text-xs space-y-1.5 min-w-[220px]">
      <p className="flex justify-between gap-4">
        <span style={{ color: "var(--muted)" }}>Custo Peça (Base Peças)</span>
        <strong>{formatarMoeda(peca.custo_peca_samsung)}</strong>
      </p>
      <p className="flex justify-between gap-4">
        <span style={{ color: "var(--muted)" }}>Faixa aplicada</span>
        <strong>
          {faixa ? `${formatarMoeda(faixa.valor_min)} ${faixa.valor_max == null ? "acima" : `– ${formatarMoeda(faixa.valor_max)}`}` : "—"}
        </strong>
      </p>
      <p className="flex justify-between gap-4">
        <span style={{ color: "var(--muted)" }}>Markup usado</span>
        <strong>{faixa ? `× ${faixa.multiplicador}` : "—"}</strong>
      </p>
      <div className="border-t pt-1.5 mt-1.5" style={{ borderColor: "var(--line)" }}>
        <p className="flex justify-between gap-4">
          <span style={{ color: "var(--muted)" }}>Cálculo</span>
          <span>
            {formatarMoeda(peca.custo_peca_samsung)} {faixa ? `× ${faixa.multiplicador}` : ""}
          </span>
        </p>
        <p className="flex justify-between gap-4">
          <span style={{ color: "var(--muted)" }}>= Custo Peça (Allied)</span>
          <strong style={{ color: "var(--accent2)" }}>{formatarMoeda(peca.custo_peca_allied)}</strong>
        </p>
      </div>
      <p style={{ color: "var(--muted)" }}>(arredondado pra cima, 2 casas decimais)</p>
    </div>
  );
}

export default function ConsultaBidPanel({ faixas }: { faixas: FaixaMarkup[] }) {
  const [termo, setTermo] = useState("");
  const [pecas, setPecas] = useState<PecaBid[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (termo.trim().length < 2) {
      setPecas([]);
      setBuscando(false);
      return;
    }

    setBuscando(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/bases/bid/consulta?q=${encodeURIComponent(termo.trim())}`);
        const data = await res.json();
        setPecas(res.ok ? data.pecas ?? [] : []);
      } catch {
        setPecas([]);
      }
      setBuscando(false);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [termo]);

  return (
    <div>
      <div className="relative max-w-md mb-5">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "var(--muted)" }} />
        <input
          type="text"
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          placeholder="Digite o Part Number (ou parte dele)..."
          autoFocus
          className="w-full rounded-lg border pl-10 pr-4 py-3 text-sm outline-none focus:border-[var(--accent2)] focus:ring-1 focus:ring-[var(--accent2)] transition bg-[var(--surface2)] border-[var(--line)]"
          style={{ color: "var(--ink)" }}
        />
      </div>

      {termo.trim().length > 0 && termo.trim().length < 2 && (
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Digite pelo menos 2 caracteres.
        </p>
      )}

      {termo.trim().length >= 2 && (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--line)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left" style={{ background: "var(--surface2)", color: "var(--muted)" }}>
                <th className="px-4 py-2.5 font-medium">Modelo</th>
                <th className="px-4 py-2.5 font-medium">Part Number</th>
                <th className="px-4 py-2.5 font-medium">Peça Solução</th>
                <th className="px-4 py-2.5 font-medium">Mão de Obra</th>
                <th className="px-4 py-2.5 font-medium">Custo Peça (Allied)</th>
              </tr>
            </thead>
            <tbody>
              {pecas.map((peca) => {
                const principal = ordenarSolucoes(peca)[0];
                return (
                  <tr key={peca.id} className="border-t" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
                    <td className="px-4 py-2.5" style={{ color: "var(--ink)" }}>
                      {peca.modelo}
                    </td>
                    <td className="px-4 py-2.5 font-mono" style={{ color: "var(--ink)" }}>
                      {peca.part_number}
                    </td>
                    <td className="px-4 py-2.5" style={{ color: "var(--ink)" }}>
                      {principal?.peca_solucao ?? "—"}
                    </td>
                    <td className="px-4 py-2.5" style={{ color: "var(--muted)" }}>
                      {formatarMoeda(peca.mao_de_obra)}
                    </td>
                    <td className="px-4 py-2.5 relative">
                      <span
                        onMouseEnter={() => setHoverId(peca.id)}
                        onMouseLeave={() => setHoverId(null)}
                        className="font-medium cursor-help border-b border-dashed"
                        style={{ color: "var(--ink)", borderColor: "var(--muted)" }}
                      >
                        {formatarMoeda(peca.custo_peca_allied)}
                      </span>

                      {hoverId === peca.id && (
                        <div
                          className="absolute z-40 right-4 top-full mt-1 rounded-lg border shadow-2xl p-3"
                          style={{ background: "var(--surface2)", borderColor: "var(--line)" }}
                        >
                          <TooltipCalculo peca={peca} faixas={faixas} />
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}

              {!buscando && pecas.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center" style={{ color: "var(--muted)", background: "var(--surface)" }}>
                    Nenhuma peça encontrada com esse Part Number.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
