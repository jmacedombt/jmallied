"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheck, Loader2, Search } from "lucide-react";
import PopupConfirmar from "@/components/PopupConfirmar";
import PopupPecasOrcamento, { type AparelhoComPecas } from "@/components/PopupPecasOrcamento";

export type AparelhoAgAnalise = AparelhoComPecas & {
  id: string;
  os_care_allied: string | null;
  modelo_comercial: string | null;
  sku: string | null;
  descricao_completa: string | null;
};

export default function PainelAgAnalise({
  aparelhos,
  topo,
  mensagemVazia = "Nenhum aparelho em Ag. Análise no momento.",
}: {
  aparelhos: AparelhoAgAnalise[];
  topo: React.ReactNode;
  mensagemVazia?: string;
}) {
  const router = useRouter();

  const [itens, setItens] = useState(aparelhos);
  const [buscaOs, setBuscaOs] = useState("");
  const [buscaTrade, setBuscaTrade] = useState("");
  const [detalhe, setDetalhe] = useState<AparelhoAgAnalise | null>(null);
  const [confirmando, setConfirmando] = useState<AparelhoAgAnalise | null>(null);
  const [processandoId, setProcessandoId] = useState<string | null>(null);
  const [erroConfirmar, setErroConfirmar] = useState<string | null>(null);

  useEffect(() => setItens(aparelhos), [aparelhos]);

  const filtrados = useMemo(() => {
    const os = buscaOs.trim();
    const trade = buscaTrade.trim().toLowerCase();
    return itens.filter((a) => {
      if (os && !(a.os_reparadora ?? "").includes(os)) return false;
      if (trade && !a.trade_allied.toLowerCase().includes(trade)) return false;
      return true;
    });
  }, [itens, buscaOs, buscaTrade]);

  async function confirmarAnalise() {
    if (!confirmando) return;
    setProcessandoId(confirmando.id);
    setErroConfirmar(null);

    try {
      const res = await fetch(`/api/operacional/orcamentos/${confirmando.id}/confirmar-analise`, {
        method: "POST",
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setErroConfirmar(data?.error || "Não foi possível confirmar a análise.");
        setProcessandoId(null);
        return;
      }

      setItens((atual) => atual.filter((a) => a.id !== confirmando.id));
      setConfirmando(null);
      router.refresh();
    } catch {
      setErroConfirmar("Falha de conexão. Tente novamente.");
    }

    setProcessandoId(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-x-4 gap-y-2">
        <div className="flex items-center flex-wrap [&>*]:!mb-0">{topo}</div>

        <div className="flex items-center flex-wrap gap-2">
          <div className="relative">
            <Search
              size={13}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: "var(--muted)" }}
            />
            <input
              type="text"
              value={buscaOs}
              onChange={(e) => setBuscaOs(e.target.value)}
              placeholder="Buscar por OS Reparadora"
              className="pl-7 pr-3 py-1.5 rounded-lg border text-xs w-48"
              style={{ borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink)" }}
            />
          </div>
          <div className="relative">
            <Search
              size={13}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: "var(--muted)" }}
            />
            <input
              type="text"
              value={buscaTrade}
              onChange={(e) => setBuscaTrade(e.target.value)}
              placeholder="Buscar por Trade Allied"
              className="pl-7 pr-3 py-1.5 rounded-lg border text-xs w-48"
              style={{ borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink)" }}
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--line)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left" style={{ background: "var(--surface2)", color: "var(--muted)" }}>
              <th className="px-4 py-2.5 font-medium">OS Reparadora</th>
              <th className="px-4 py-2.5 font-medium">Trade Allied</th>
              <th className="px-4 py-2.5 font-medium">OS Care Allied</th>
              <th className="px-4 py-2.5 font-medium">Modelo comercial</th>
              <th className="px-4 py-2.5 font-medium">SKU</th>
              <th className="px-4 py-2.5 font-medium">Descrição</th>
              <th className="px-4 py-2.5 font-medium text-right">Ação</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((a) => (
              <tr
                key={a.id}
                onClick={() => setDetalhe(a)}
                className="border-t cursor-pointer transition hover:bg-[var(--surface2)]"
                style={{ borderColor: "var(--line)", background: "var(--surface)" }}
                title="Clique pra ver as peças desse orçamento"
              >
                <td className="px-4 py-2.5 font-medium" style={{ color: "var(--ink)" }}>
                  {a.os_reparadora || "—"}
                </td>
                <td className="px-4 py-2.5" style={{ color: "var(--ink)" }}>
                  {a.trade_allied}
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
                <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => setConfirmando(a)}
                    disabled={processandoId === a.id}
                    className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition hover:border-[var(--accent2)] disabled:opacity-60"
                    style={{ borderColor: "var(--line)", color: "var(--ink)" }}
                    title="Confirmar que a análise foi realizada"
                  >
                    {processandoId === a.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <ClipboardCheck size={14} style={{ color: "#14b8a6" }} />
                    )}
                    Análise realizada
                  </button>
                </td>
              </tr>
            ))}
            {filtrados.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center"
                  style={{ color: "var(--muted)", background: "var(--surface)" }}
                >
                  {itens.length === 0 ? mensagemVazia : "Nenhum aparelho encontrado com essa busca."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs" style={{ color: "var(--muted)" }}>
        Clique numa linha pra ver as peças lançadas nesse orçamento.
      </p>

      {confirmando && (
        <PopupConfirmar
          titulo="Confirmar análise"
          mensagem={
            <>
              Confirma que a análise do aparelho <strong>{confirmando.trade_allied}</strong>
              {confirmando.os_reparadora && <> (OS Reparadora {confirmando.os_reparadora})</>} foi realizada? Ele vai
              avançar para <strong>Validação de Orçamentos</strong>.
            </>
          }
          rotuloConfirmar="Confirmar"
          carregando={processandoId === confirmando.id}
          erro={erroConfirmar}
          onConfirmar={confirmarAnalise}
          onFechar={() => {
            if (processandoId) return;
            setConfirmando(null);
            setErroConfirmar(null);
          }}
        />
      )}

      {detalhe && <PopupPecasOrcamento aparelho={detalhe} onFechar={() => setDetalhe(null)} />}
    </div>
  );
}
