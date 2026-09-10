"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, CheckCircle2, Clock, FileQuestion, Gauge, Loader2, PackageCheck, UploadCloud, XCircle } from "lucide-react";
import { CORES_RESULTADO_APROVACAO, podeConfirmarAprovacaoOrcamento, type ResultadoAprovacaoAllied } from "@/lib/orcamentos";
import PopupUploadAprovacao from "@/components/PopupUploadAprovacao";
import PopupReprovarOrcamento, { type AparelhoReprovavel } from "@/components/PopupReprovarOrcamento";
import PopupConfirmar from "@/components/PopupConfirmar";

export type AparelhoRespostaOrcamento = {
  id: string;
  os_reparadora: string | null;
  trade_allied: string;
  os_care_allied: string | null;
  modelo_comercial: string | null;
  sku: string | null;
  descricao_completa: string | null;
  resultado_aprovacao_allied: ResultadoAprovacaoAllied;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ICONE_RESULTADO: Record<ResultadoAprovacaoAllied, React.ComponentType<any>> = {
  Aguardando: Clock,
  Aprovado: CheckCircle2,
  "Contra Proposta": FileQuestion,
  Reprovado: XCircle,
};

function BadgeResultado({ resultado }: { resultado: ResultadoAprovacaoAllied }) {
  const cores = CORES_RESULTADO_APROVACAO[resultado];
  const Icone = ICONE_RESULTADO[resultado];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold"
      style={{ color: cores.cor, background: cores.fundo, border: `1px solid ${cores.borda}` }}
    >
      <Icone size={11} />
      {resultado}
    </span>
  );
}

// "3 - Ag. Resposta de Orçamento" — chegam daqui de Validação de
// Orçamentos, todos "Aguardando". O Upload (aprovação de orçamentos) lê
// o arquivo de volta da Allied e marca o resultado de cada um (casando
// por OS Reparadora); "Confirmar" move cada aparelho resolvido pro
// destino certo (Aprovado -> 5 - Ag. Peças, Reprovado -> 8 - Orçamento
// Reprovado, Contra Proposta -> Ag. Contra Proposta) — quem ainda está
// Aguardando não é tocado.
export default function PainelRespostaOrcamento({
  aparelhos,
  perfil,
  topo,
  mensagemVazia = "Nenhum aparelho em 3 - Ag. Resposta de Orçamento no momento.",
}: {
  aparelhos: AparelhoRespostaOrcamento[];
  perfil: { cargo: string; is_master: boolean } | null;
  topo: React.ReactNode;
  mensagemVazia?: string;
}) {
  const router = useRouter();
  const [mostrarUpload, setMostrarUpload] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [confirmandoDeVerdade, setConfirmandoDeVerdade] = useState(false);
  const [erroConfirmar, setErroConfirmar] = useState<string | null>(null);
  const [reprovando, setReprovando] = useState<AparelhoReprovavel | null>(null);

  const podeConfirmar = podeConfirmarAprovacaoOrcamento(perfil);

  const contagens = useMemo(() => {
    const total = aparelhos.length;
    const porResultado: Record<ResultadoAprovacaoAllied, number> = { Aguardando: 0, Aprovado: 0, "Contra Proposta": 0, Reprovado: 0 };
    for (const a of aparelhos) porResultado[a.resultado_aprovacao_allied] += 1;
    return { total, porResultado };
  }, [aparelhos]);

  const quantidadeResolvidos = contagens.total - contagens.porResultado.Aguardando;

  function percentual(qtd: number): string {
    if (contagens.total === 0) return "0%";
    return `${Math.round((qtd / contagens.total) * 100)}%`;
  }

  async function confirmar() {
    setConfirmandoDeVerdade(true);
    setErroConfirmar(null);
    try {
      const res = await fetch("/api/operacional/orcamentos/confirmar-resultado-aprovacao", { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setErroConfirmar(data?.error || "Não foi possível confirmar.");
        setConfirmandoDeVerdade(false);
        return;
      }
      setConfirmando(false);
      setConfirmandoDeVerdade(false);
      router.refresh();
    } catch {
      setErroConfirmar("Falha de conexão. Tente novamente.");
      setConfirmandoDeVerdade(false);
    }
  }

  const CARDS: { key: ResultadoAprovacaoAllied; label: string }[] = [
    { key: "Aprovado", label: "Aprovados" },
    { key: "Contra Proposta", label: "Contra Proposta" },
    { key: "Reprovado", label: "Recusados" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        {topo}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 flex-1">
          <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--line)", background: "var(--surface2)" }}>
            <div className="h-[3px] w-full" style={{ background: "linear-gradient(90deg, var(--accent), var(--accent2))" }} />
            <div className="flex items-center gap-2 px-3 py-1.5">
              <Gauge size={14} style={{ color: "var(--accent2)" }} />
              <span className="flex flex-col leading-tight">
                <span className="text-[10px] uppercase tracking-wide" style={{ color: "var(--muted)" }}>
                  Nessa etapa
                </span>
                <span className="text-xs font-semibold" style={{ color: "var(--ink)" }}>
                  {contagens.total} ({contagens.porResultado.Aguardando} aguardando)
                </span>
              </span>
            </div>
          </div>
          {CARDS.map((c) => {
            const cores = CORES_RESULTADO_APROVACAO[c.key];
            const Icone = ICONE_RESULTADO[c.key];
            const qtd = contagens.porResultado[c.key];
            return (
              <div key={c.key} className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--line)", background: "var(--surface2)" }}>
                <div className="h-[3px] w-full" style={{ background: "linear-gradient(90deg, var(--accent), var(--accent2))" }} />
                <div className="flex items-center gap-2 px-3 py-1.5">
                  <Icone size={14} style={{ color: cores.cor }} />
                  <span className="flex flex-col leading-tight">
                    <span className="text-[10px] uppercase tracking-wide" style={{ color: "var(--muted)" }}>
                      {c.label}
                    </span>
                    <span className="text-xs font-semibold" style={{ color: cores.cor }}>
                      {qtd} ({percentual(qtd)})
                    </span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setMostrarUpload(true)}
          disabled={!podeConfirmar}
          title={podeConfirmar ? undefined : "Seu cargo não tem permissão pra subir esse arquivo."}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition hover:bg-[var(--surface2)] disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ color: "var(--ink)", border: "1px solid var(--line)" }}
        >
          <UploadCloud size={13} style={{ color: "var(--accent2)" }} />
          Upload (aprovação de orçamentos)
        </button>
        <button
          type="button"
          onClick={() => setConfirmando(true)}
          disabled={!podeConfirmar || quantidadeResolvidos === 0}
          title={
            !podeConfirmar
              ? "Seu cargo não tem permissão pra confirmar."
              : quantidadeResolvidos === 0
                ? "Nenhum aparelho tem resultado definido ainda (suba o arquivo de aprovação primeiro)."
                : undefined
          }
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: "var(--accent)" }}
        >
          <PackageCheck size={13} />
          Confirmar
        </button>
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
              <th className="px-4 py-2.5 font-medium">Status Orçamento</th>
              <th className="px-4 py-2.5 font-medium text-right">Ação</th>
            </tr>
          </thead>
          <tbody>
            {aparelhos.map((a) => {
              const cores = CORES_RESULTADO_APROVACAO[a.resultado_aprovacao_allied];
              const resolvido = a.resultado_aprovacao_allied !== "Aguardando";
              return (
                <tr
                  key={a.id}
                  className="border-t"
                  style={{
                    borderColor: resolvido ? cores.borda : "var(--line)",
                    background: resolvido ? cores.fundo : "var(--surface)",
                  }}
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
                  <td className="px-4 py-2.5">
                    <BadgeResultado resultado={a.resultado_aprovacao_allied} />
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => setReprovando({ id: a.id, trade_allied: a.trade_allied, os_reparadora: a.os_reparadora })}
                      title="Reprovar orçamento manualmente"
                      className="inline-flex items-center justify-center w-8 h-8 rounded-lg border transition hover:border-[#ef4444]"
                      style={{ borderColor: "var(--line)", color: "#ef4444" }}
                    >
                      <Ban size={15} />
                    </button>
                  </td>
                </tr>
              );
            })}
            {aparelhos.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center" style={{ color: "var(--muted)", background: "var(--surface)" }}>
                  {mensagemVazia}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {mostrarUpload && (
        <PopupUploadAprovacao onFechar={() => setMostrarUpload(false)} onAtualizado={() => router.refresh()} />
      )}

      {reprovando && (
        <PopupReprovarOrcamento
          aparelho={reprovando}
          onFechar={() => setReprovando(null)}
          onReprovado={() => {
            setReprovando(null);
            router.refresh();
          }}
        />
      )}

      {confirmando && (
        <PopupConfirmar
          titulo="Confirmar resultado de aprovação"
          mensagem={
            <>
              <strong>{contagens.porResultado.Aprovado}</strong> aparelho(s) vão pra 5 - Ag. Peças,{" "}
              <strong>{contagens.porResultado.Reprovado}</strong> vão pra 8 - Orçamento Reprovado, e{" "}
              <strong>{contagens.porResultado["Contra Proposta"]}</strong> vão pra Ag. Contra Proposta. Quem ainda está
              Aguardando não é alterado. Confirma?
            </>
          }
          rotuloConfirmar="Confirmar"
          carregando={confirmandoDeVerdade}
          erro={erroConfirmar}
          onConfirmar={confirmar}
          onFechar={() => !confirmandoDeVerdade && setConfirmando(false)}
        />
      )}
    </div>
  );
}
