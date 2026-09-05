"use client";

import { useMemo, useState } from "react";
import { Coins, LayoutList, Percent, Wallet } from "lucide-react";
import PopupPecasValidacao, { type AparelhoValidacaoDetalhe } from "@/components/PopupPecasValidacao";

export type AparelhoValidacao = AparelhoValidacaoDetalhe & {
  id: string;
  os_care_allied: string | null;
  modelo_comercial: string | null;
  sku: string | null;
  descricao_completa: string | null;
};

function formatarReal(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const CARDS_CONFIG = [
  { chave: "quantidadePecas" as const, label: "Quantidade de Peças", icone: LayoutList, moeda: false },
  { chave: "custoTotalPecas" as const, label: "Total de Custo de Peças", icone: Coins, moeda: true },
  { chave: "impostoTotalPecas" as const, label: "Total de Imposto (ICMS)", icone: Percent, moeda: true },
  { chave: "valorTotalPecas" as const, label: "Valor Total das Peças", icone: Wallet, moeda: true },
];

export default function PainelValidacaoOrcamentos({
  aparelhos,
  topo,
  mensagemVazia = "Nenhum aparelho em Validação de Orçamentos no momento.",
}: {
  aparelhos: AparelhoValidacao[];
  topo: React.ReactNode;
  mensagemVazia?: string;
}) {
  const [loteSelecionado, setLoteSelecionado] = useState("");
  const [detalhe, setDetalhe] = useState<AparelhoValidacao | null>(null);

  // lotes (NF Remessa) disponíveis nessa etapa — sempre com base em
  // TODOS os aparelhos, não só nos já filtrados, pra caixa de seleção
  // nunca "sumir" com opções conforme o usuário troca de lote.
  const lotes = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const a of aparelhos) mapa.set(a.nf_remessa_allied, (mapa.get(a.nf_remessa_allied) ?? 0) + 1);
    return Array.from(mapa.entries())
      .sort((a, b) => a[0].localeCompare(b[0], "pt-BR"))
      .map(([nf, quantidade]) => ({ nf, quantidade }));
  }, [aparelhos]);

  const filtrados = useMemo(() => {
    if (!loteSelecionado) return aparelhos;
    return aparelhos.filter((a) => a.nf_remessa_allied === loteSelecionado);
  }, [aparelhos, loteSelecionado]);

  // cards sempre somam o que está sendo exibido na tabela agora — todos
  // os lotes juntos quando nenhum está selecionado, ou só o escolhido.
  const totais = useMemo(
    () =>
      filtrados.reduce(
        (acc, a) => ({
          quantidadePecas: acc.quantidadePecas + a.quantidadePecas,
          custoTotalPecas: acc.custoTotalPecas + a.custoTotalPecas,
          impostoTotalPecas: acc.impostoTotalPecas + a.impostoTotalPecas,
          valorTotalPecas: acc.valorTotalPecas + a.valorTotalPecas,
        }),
        { quantidadePecas: 0, custoTotalPecas: 0, impostoTotalPecas: 0, valorTotalPecas: 0 }
      ),
    [filtrados]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-x-4 gap-y-2">
        <div className="flex items-center flex-wrap [&>*]:!mb-0">{topo}</div>

        <div className="flex items-center flex-wrap gap-2">
          {CARDS_CONFIG.map((c) => {
            const Icone = c.icone;
            const valorBruto = totais[c.chave];
            return (
              <div
                key={c.chave}
                className="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5"
                style={{ borderColor: "var(--line)", background: "var(--surface2)" }}
              >
                <Icone size={14} style={{ color: "var(--accent2)" }} />
                <span className="flex flex-col leading-tight">
                  <span className="text-[10px] uppercase tracking-wide" style={{ color: "var(--muted)" }}>
                    {c.label}
                  </span>
                  <span className="text-xs font-semibold" style={{ color: "var(--ink)" }}>
                    {c.moeda ? formatarReal(valorBruto) : valorBruto}
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <label className="text-xs" style={{ color: "var(--muted)" }}>
          Lote (NF Remessa):
        </label>
        <select
          value={loteSelecionado}
          onChange={(e) => setLoteSelecionado(e.target.value)}
          className="rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--accent2)] focus:ring-1 focus:ring-[var(--accent2)] transition"
          style={{ borderColor: "var(--line)", background: "var(--surface2)", color: "var(--ink)" }}
        >
          <option value="">Todos os lotes ({aparelhos.length})</option>
          {lotes.map((l) => (
            <option key={l.nf} value={l.nf}>
              {l.nf} ({l.quantidade})
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--line)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left" style={{ background: "var(--surface2)", color: "var(--muted)" }}>
              <th className="px-4 py-2.5 font-medium">NF Remessa</th>
              <th className="px-4 py-2.5 font-medium">OS Reparadora</th>
              <th className="px-4 py-2.5 font-medium">OS Care Allied</th>
              <th className="px-4 py-2.5 font-medium">Modelo comercial</th>
              <th className="px-4 py-2.5 font-medium">SKU</th>
              <th className="px-4 py-2.5 font-medium">Descrição</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((a) => (
              <tr
                key={a.id}
                onClick={() => setDetalhe(a)}
                className="border-t cursor-pointer transition hover:bg-[var(--surface2)]"
                style={{ borderColor: "var(--line)", background: "var(--surface)" }}
                title="Clique pra ver mão de obra e peças desse orçamento"
              >
                <td className="px-4 py-2.5 font-mono" style={{ color: "var(--muted)" }}>
                  {a.nf_remessa_allied}
                </td>
                <td className="px-4 py-2.5 font-medium" style={{ color: "var(--ink)" }}>
                  {a.os_reparadora || "—"}
                </td>
                <td className="px-4 py-2.5" style={{ color: "var(--muted)" }}>
                  {a.os_care_allied}
                </td>
                <td className="px-4 py-2.5" style={{ color: "var(--muted)" }}>
                  {a.modelo_comercial}
                </td>
                <td className="px-4 py-2.5" style={{ color: "var(--muted)" }}>
                  {a.sku}
                </td>
                <td className="px-4 py-2.5" style={{ color: "var(--muted)" }} title={a.descricao_completa ?? ""}>
                  {(a.descricao_completa ?? "").split(" ")[0]}
                </td>
              </tr>
            ))}
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center" style={{ color: "var(--muted)", background: "var(--surface)" }}>
                  {aparelhos.length === 0 ? mensagemVazia : "Nenhum aparelho encontrado nesse lote."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs" style={{ color: "var(--muted)" }}>
        Clique numa linha pra ver a mão de obra e os códigos de peça desse orçamento. O custo de cada peça vem sempre
        do valor mais recente da Base Peças.
      </p>

      {detalhe && <PopupPecasValidacao aparelho={detalhe} onFechar={() => setDetalhe(null)} />}
    </div>
  );
}
