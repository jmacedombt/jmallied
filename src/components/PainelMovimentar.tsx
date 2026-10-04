"use client";

import { useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Shuffle, UploadCloud, XCircle } from "lucide-react";
import PopupConfirmar from "@/components/PopupConfirmar";

type StatusOpcao = { valor: string; slug: string; label: string };

type ItemBusca =
  | {
      valorBuscado: string;
      encontrado: true;
      id: string;
      trade_allied: string;
      os_care_allied: string | null;
      os_reparadora: string | null;
      modelo_comercial: string | null;
      status_operacional: string;
    }
  | { valorBuscado: string; encontrado: false };

const SEM_MUDANCA = "";

// "Movimentar" (menu Operacional, pedido explícito, 03/10/2026) — sobe
// uma lista (Trade Allied ou OS Reparadora, .xlsx ou .txt) e mostra a
// Etapa atual de cada aparelho encontrado. O seletor "Aplicar a todos"
// preenche a coluna "Novo status" de toda a lista de uma vez, mas cada
// linha continua com seu próprio seletor — dá pra ajustar uma ou outra
// depois de aplicar em massa, ou simplesmente nunca usar o "aplicar a
// todos" e escolher linha por linha. Pula todas as regras normais de
// cada etapa (não preenche nenhum campo de aprovação/detalhe) — é uma
// ferramenta de correção manual, por isso toda mudança fica registrada
// na Auditoria (ver /api/operacional/movimentar/confirmar).
export default function PainelMovimentar({ statusDisponiveis }: { statusDisponiveis: StatusOpcao[] }) {
  const inputRef = useRef<HTMLInputElement>(null);

  const [tipoBusca, setTipoBusca] = useState<"trade_allied" | "os_reparadora">("trade_allied");
  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [erroBusca, setErroBusca] = useState<string | null>(null);
  const [itens, setItens] = useState<ItemBusca[] | null>(null);

  const [statusGeral, setStatusGeral] = useState("");
  const [novoStatusPorId, setNovoStatusPorId] = useState<Record<string, string>>({});

  const [confirmando, setConfirmando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  const encontrados = (itens ?? []).filter((i): i is ItemBusca & { encontrado: true } => i.encontrado);
  const naoEncontrados = (itens ?? []).filter((i) => !i.encontrado);

  async function buscar(e: React.FormEvent) {
    e.preventDefault();
    const arquivo = inputRef.current?.files?.[0];
    if (!arquivo) return;

    setBuscando(true);
    setErroBusca(null);
    setItens(null);
    setSucesso(null);
    setNovoStatusPorId({});
    setStatusGeral("");

    const formData = new FormData();
    formData.append("arquivo", arquivo);
    formData.append("tipo", tipoBusca);

    try {
      const res = await fetch("/api/operacional/movimentar/buscar", { method: "POST", body: formData });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setErroBusca(data?.error || "Não foi possível ler esse arquivo.");
      } else {
        setItens(data.itens);
      }
    } catch {
      setErroBusca("Falha de conexão. Tente novamente.");
    }
    setBuscando(false);
  }

  function aplicarATodos() {
    if (!statusGeral) return;
    const atualizado: Record<string, string> = {};
    for (const item of encontrados) atualizado[item.id] = statusGeral;
    setNovoStatusPorId(atualizado);
  }

  function limpar() {
    setNomeArquivo(null);
    setItens(null);
    setErroBusca(null);
    setSucesso(null);
    setNovoStatusPorId({});
    setStatusGeral("");
    if (inputRef.current) inputRef.current.value = "";
  }

  // só quem realmente vai mudar (tem novo status escolhido e diferente do atual)
  const mudancas = encontrados
    .map((item) => ({ item, statusNovo: novoStatusPorId[item.id] ?? SEM_MUDANCA }))
    .filter((m) => m.statusNovo && m.statusNovo !== m.item.status_operacional);

  const resumoPorStatus = mudancas.reduce<Record<string, number>>((resumo, m) => {
    resumo[m.statusNovo] = (resumo[m.statusNovo] ?? 0) + 1;
    return resumo;
  }, {});

  async function confirmarMovimentacao() {
    setSalvando(true);
    setErroSalvar(null);
    try {
      const res = await fetch("/api/operacional/movimentar/confirmar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itens: mudancas.map((m) => ({ orcamentoId: m.item.id, statusNovo: m.statusNovo })),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setErroSalvar(data?.error || "Não foi possível movimentar.");
        setSalvando(false);
        return;
      }

      // reflete localmente o novo status, sem precisar buscar tudo de novo
      const porId = new Map(mudancas.map((m) => [m.item.id, m.statusNovo]));
      setItens((atual) =>
        (atual ?? []).map((i) => (i.encontrado && porId.has(i.id) ? { ...i, status_operacional: porId.get(i.id)! } : i))
      );
      setNovoStatusPorId({});
      setStatusGeral("");
      setConfirmando(false);
      setSalvando(false);
      setSucesso(
        `${data.quantidade} orçamento(s) movimentado(s).${data.avisoAuditoria ? ` ${data.avisoAuditoria}` : ""}`
      );
    } catch {
      setErroSalvar("Falha de conexão. Tente novamente.");
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-4">
      <div
        className="rounded-xl border p-4 text-sm flex items-start gap-2"
        style={{ borderColor: "rgba(249, 115, 22, 0.35)", background: "rgba(249, 115, 22, 0.08)", color: "#c2410c" }}
      >
        <AlertTriangle size={16} className="shrink-0 mt-0.5" />
        <p>
          Essa ferramenta troca o status direto, sem passar pelas regras normais de cada etapa (não preenche campo de
          aprovação, detalhe de reorçamento, etc.) — use pra corrigir, não como fluxo normal. Toda movimentação fica
          registrada na Auditoria.
        </p>
      </div>

      <form onSubmit={buscar} className="rounded-xl border p-5 space-y-3" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center rounded-lg border overflow-hidden text-sm" style={{ borderColor: "var(--line)" }}>
            {(["trade_allied", "os_reparadora"] as const).map((valor) => (
              <button
                key={valor}
                type="button"
                onClick={() => setTipoBusca(valor)}
                className="px-3 py-2 transition"
                style={
                  tipoBusca === valor
                    ? { background: "var(--accent)", color: "#fff" }
                    : { color: "var(--muted)", background: "var(--surface)" }
                }
              >
                {valor === "trade_allied" ? "Trade Allied" : "OS Reparadora"}
              </button>
            ))}
          </div>

          <label
            className="flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm cursor-pointer transition hover:border-[var(--accent2)]"
            style={{ borderColor: "var(--line)", color: "var(--ink)" }}
          >
            <UploadCloud size={16} />
            {nomeArquivo || "Lista (.xlsx ou .txt)"}
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.txt"
              className="hidden"
              onChange={(e) => setNomeArquivo(e.target.files?.[0]?.name ?? null)}
            />
          </label>

          <button
            type="submit"
            disabled={buscando || !nomeArquivo}
            className="rounded-lg bg-[var(--accent)] hover:bg-[var(--accent2)] disabled:opacity-60 text-white text-sm font-medium px-5 py-2.5 transition"
          >
            {buscando ? "Buscando..." : "Buscar"}
          </button>

          {itens && (
            <button
              type="button"
              onClick={limpar}
              className="rounded-lg px-3 py-2.5 text-sm font-medium transition hover:bg-[var(--surface2)]"
              style={{ color: "var(--muted)" }}
            >
              Limpar
            </button>
          )}
        </div>

        <p className="text-xs" style={{ color: "var(--muted)" }}>
          Um valor por linha (.txt) ou por célula da primeira coluna (.xlsx) — sem cabeçalho.
        </p>
      </form>

      {erroBusca && (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 flex items-start gap-2">
          <AlertTriangle size={15} className="shrink-0 mt-0.5" />
          {erroBusca}
        </p>
      )}

      {sucesso && (
        <p className="text-sm rounded-lg px-3 py-2 flex items-start gap-2" style={{ background: "rgba(34, 197, 94, 0.12)", color: "#16a34a" }}>
          <CheckCircle2 size={15} className="shrink-0 mt-0.5" />
          {sucesso}
        </p>
      )}

      {naoEncontrados.length > 0 && (
        <p className="text-sm rounded-lg px-3 py-2 flex items-start gap-2" style={{ background: "rgba(239, 68, 68, 0.08)", color: "#ef4444" }}>
          <XCircle size={15} className="shrink-0 mt-0.5" />
          {naoEncontrados.length} valor(es) não encontrado(s): {naoEncontrados.map((i) => i.valorBuscado).join(", ")}
        </p>
      )}

      {encontrados.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 rounded-xl border p-3" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
            <span className="text-sm" style={{ color: "var(--muted)" }}>
              Aplicar a todos:
            </span>
            <select
              value={statusGeral}
              onChange={(e) => setStatusGeral(e.target.value)}
              className="rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: "var(--line)", background: "var(--surface2)", color: "var(--ink)" }}
            >
              <option value="">Escolha um status...</option>
              {statusDisponiveis.map((s) => (
                <option key={s.valor} value={s.valor}>
                  {s.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={aplicarATodos}
              disabled={!statusGeral}
              className="rounded-lg px-3 py-2 text-sm font-medium transition disabled:opacity-50"
              style={{ color: "var(--accent2)" }}
            >
              Aplicar a todas as {encontrados.length} linha(s)
            </button>
            <span className="text-xs" style={{ color: "var(--muted)" }}>
              (substitui a escolha individual de cada linha)
            </span>
          </div>

          <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--line)" }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left" style={{ background: "var(--surface2)", color: "var(--muted)" }}>
                  <th className="px-4 py-2.5 font-medium">Trade Allied</th>
                  <th className="px-4 py-2.5 font-medium">OS Reparadora</th>
                  <th className="px-4 py-2.5 font-medium">Modelo comercial</th>
                  <th className="px-4 py-2.5 font-medium">Etapa atual</th>
                  <th className="px-4 py-2.5 font-medium">Novo status</th>
                </tr>
              </thead>
              <tbody>
                {encontrados.map((item) => {
                  const selecionado = novoStatusPorId[item.id] ?? "";
                  const vaiMudar = !!selecionado && selecionado !== item.status_operacional;
                  return (
                    <tr key={item.id} className="border-t" style={{ borderColor: "var(--line)" }}>
                      <td className="px-4 py-2.5 font-medium" style={{ color: "var(--ink)" }}>
                        {item.trade_allied}
                      </td>
                      <td className="px-4 py-2.5" style={{ color: "var(--muted)" }}>
                        {item.os_reparadora || "—"}
                      </td>
                      <td className="px-4 py-2.5" style={{ color: "var(--muted)" }}>
                        {item.modelo_comercial || "—"}
                      </td>
                      <td className="px-4 py-2.5" style={{ color: "var(--muted)" }}>
                        {item.status_operacional}
                      </td>
                      <td className="px-4 py-2.5">
                        <select
                          value={selecionado}
                          onChange={(e) =>
                            setNovoStatusPorId((atual) => ({ ...atual, [item.id]: e.target.value }))
                          }
                          className="rounded-lg border px-2.5 py-1.5 text-sm"
                          style={{
                            borderColor: vaiMudar ? "var(--accent2)" : "var(--line)",
                            background: "var(--surface2)",
                            color: vaiMudar ? "var(--accent2)" : "var(--ink)",
                          }}
                        >
                          <option value="">(sem mudança)</option>
                          {statusDisponiveis.map((s) => (
                            <option key={s.valor} value={s.valor}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={() => setConfirmando(true)}
              disabled={mudancas.length === 0}
              className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-white transition disabled:opacity-50"
              style={{ background: "#f97316" }}
            >
              <Shuffle size={14} />
              Movimentar {mudancas.length > 0 && `(${mudancas.length})`}
            </button>
          </div>
        </div>
      )}

      {confirmando && (
        <PopupConfirmar
          titulo="Confirmar movimentação"
          perigo
          mensagem={
            <>
              <strong>{mudancas.length}</strong> orçamento(s) vão mudar de status, sem passar pelas regras normais de
              cada etapa:
              <ul className="mt-2 space-y-1">
                {Object.entries(resumoPorStatus).map(([status, quantidade]) => (
                  <li key={status}>
                    <strong>{quantidade}</strong> para <strong>{status}</strong>
                  </li>
                ))}
              </ul>
            </>
          }
          rotuloConfirmar="Movimentar"
          carregando={salvando}
          erro={erroSalvar}
          onConfirmar={confirmarMovimentacao}
          onFechar={() => {
            if (salvando) return;
            setConfirmando(false);
            setErroSalvar(null);
          }}
        />
      )}
    </div>
  );
}
