"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock, Send } from "lucide-react";
import { podeConfirmarAprovacaoOrcamento, calcularResumoContraProposta, type PecaContraProposta } from "@/lib/orcamentos";
import PopupPecasContraProposta from "@/components/PopupPecasContraProposta";
import PopupEnviarContraProposta from "@/components/PopupEnviarContraProposta";

export type AparelhoContraPropostaLista = {
  id: string;
  nf_remessa_allied: string;
  os_reparadora: string | null;
  trade_allied: string;
  os_care_allied: string | null;
  modelo_comercial: string | null;
  sku: string | null;
  contra_proposta_pecas: PecaContraProposta[] | null;
  contra_proposta_mao_de_obra: number | null;
  contra_proposta_ajustado: boolean;
};

// "Ag. Contra Proposta" — aparelhos que a Allied respondeu com Contra
// Proposta em "3 - Ag. Resposta de Orçamento". Cada um precisa ser
// aberto e ter o valor de peça/mão de obra ajustado (fica com a flag
// azul depois); só quando TODO aparelho do lote selecionado estiver
// ajustado é que "Enviar Contra Proposta" libera.
export default function PainelContraProposta({
  aparelhos,
  perfil,
  topo,
  mensagemVazia = "Nenhum aparelho em Ag. Contra Proposta no momento.",
}: {
  aparelhos: AparelhoContraPropostaLista[];
  perfil: { cargo: string; is_master: boolean } | null;
  topo: React.ReactNode;
  mensagemVazia?: string;
}) {
  const router = useRouter();
  const [loteSelecionado, setLoteSelecionado] = useState("");
  const [editando, setEditando] = useState<AparelhoContraPropostaLista | null>(null);
  const [mostrarEnvio, setMostrarEnvio] = useState(false);

  const podeAjustar = podeConfirmarAprovacaoOrcamento(perfil);

  useEffect(() => {
    if (!editando) return;
    const atualizado = aparelhos.find((a) => a.id === editando.id);
    setEditando(atualizado ?? null);
  }, [aparelhos, editando]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const todosAjustados = filtrados.length > 0 && filtrados.every((a) => a.contra_proposta_ajustado);

  // resumo agregado do lote selecionado (mão de obra total, peça total,
  // lucro%) — mesma conta usada no pop-up individual, só somando todos.
  const resumoLote = useMemo(() => {
    const todasPecas: PecaContraProposta[] = filtrados.flatMap((a) => a.contra_proposta_pecas ?? []);
    const maoDeObraTotal = filtrados.reduce((soma, a) => soma + Number(a.contra_proposta_mao_de_obra ?? 0), 0);
    return calcularResumoContraProposta(todasPecas, maoDeObraTotal);
  }, [filtrados]);

  return (
    <div className="space-y-4">
      <div className="flex items-center flex-wrap gap-3">{topo}</div>

      <div className="flex items-center justify-between flex-wrap gap-3">
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

        <button
          type="button"
          onClick={() => setMostrarEnvio(true)}
          disabled={!loteSelecionado || !todosAjustados || !podeAjustar}
          title={
            !loteSelecionado
              ? "Selecione um lote específico pra enviar."
              : !todosAjustados
                ? "Ainda existem aparelhos desse lote sem o ajuste confirmado."
                : !podeAjustar
                  ? "Seu cargo não tem permissão pra enviar a Contra Proposta."
                  : undefined
          }
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: "var(--accent)" }}
        >
          <Send size={13} />
          Enviar Contra Proposta
        </button>
      </div>

      {loteSelecionado && !todosAjustados && (
        <p className="text-xs flex items-center gap-1.5" style={{ color: "#ea580c" }}>
          <Clock size={13} />
          {filtrados.filter((a) => !a.contra_proposta_ajustado).length} aparelho(s) desse lote ainda sem ajuste — abra
          cada um e confirme antes de enviar.
        </p>
      )}

      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--line)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left" style={{ background: "var(--surface2)", color: "var(--muted)" }}>
              <th className="px-4 py-2.5 font-medium">NF Remessa</th>
              <th className="px-4 py-2.5 font-medium">OS Reparadora</th>
              <th className="px-4 py-2.5 font-medium">OS Care Allied</th>
              <th className="px-4 py-2.5 font-medium">Modelo comercial</th>
              <th className="px-4 py-2.5 font-medium">SKU</th>
              <th className="px-4 py-2.5 font-medium">Ajuste</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((a) => (
              <tr
                key={a.id}
                onClick={() => setEditando(a)}
                className="border-t cursor-pointer transition hover:brightness-110"
                style={{
                  borderColor: a.contra_proposta_ajustado ? "#3b82f6" : "var(--line)",
                  background: a.contra_proposta_ajustado ? "rgba(59, 130, 246, 0.1)" : "var(--surface)",
                }}
                title="Clique pra ajustar peça a peça e mão de obra"
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
                <td className="px-4 py-2.5">
                  {a.contra_proposta_ajustado ? (
                    <span
                      className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold"
                      style={{ color: "#2563eb", background: "rgba(59, 130, 246, 0.15)" }}
                    >
                      <CheckCircle2 size={11} />
                      Ajustado
                    </span>
                  ) : (
                    <span
                      className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold"
                      style={{ color: "var(--muted)", background: "var(--surface2)" }}
                    >
                      <Clock size={11} />
                      Pendente
                    </span>
                  )}
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

      {editando && (
        <PopupPecasContraProposta
          aparelho={{
            id: editando.id,
            nf_remessa_allied: editando.nf_remessa_allied,
            os_reparadora: editando.os_reparadora,
            trade_allied: editando.trade_allied,
            pecasIniciais: editando.contra_proposta_pecas ?? [],
            maoDeObraInicial: Number(editando.contra_proposta_mao_de_obra ?? 0),
            jaAjustado: editando.contra_proposta_ajustado,
          }}
          onAtualizado={() => {
            setEditando(null);
            router.refresh();
          }}
          onFechar={() => setEditando(null)}
        />
      )}

      {mostrarEnvio && loteSelecionado && (
        <PopupEnviarContraProposta
          loteNf={loteSelecionado}
          quantidade={filtrados.length}
          resumo={resumoLote}
          onFechar={() => setMostrarEnvio(false)}
          onEnviado={() => {
            setMostrarEnvio(false);
            setLoteSelecionado("");
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
