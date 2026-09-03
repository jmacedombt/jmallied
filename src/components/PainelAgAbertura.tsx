"use client";

import { useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  SearchX,
  UploadCloud,
  X,
  XCircle,
} from "lucide-react";
import TabelaAgAbertura, { type AparelhoAgAbertura, type TabelaAgAberturaHandle } from "@/components/TabelaAgAbertura";

type ItemEncontrado = {
  id: string;
  os_care_allied: string;
  trade_allied: string;
  modelo_comercial: string | null;
  os_reparadora_nova: string;
};

type Analise = {
  totalLinhasArquivo: number;
  duplicadasNoArquivo: number;
  encontrados: ItemEncontrado[];
  naoEncontradosNoSistema: number;
  osReparadoraInvalida: number;
};

// Tela de Ag. Abertura: mantém a rotina de upload de planilha (OS Care
// Allied -> OS Reparadora) junto com a tabela, já que o preenchimento
// em massa precisa "falar" com as linhas da tabela pra fazer o efeito
// de ir marcando uma por uma de verde conforme processa.
export default function PainelAgAbertura({
  aparelhos,
  mensagemVazia,
  topo,
}: {
  aparelhos: AparelhoAgAbertura[];
  mensagemVazia?: string;
  /** botão "voltar" + badge de contagem, renderizados na mesma linha da barra de upload */
  topo?: React.ReactNode;
}) {
  const tabelaRef = useRef<TabelaAgAberturaHandle>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null);
  const [analisando, setAnalisando] = useState(false);
  const [erroAnalise, setErroAnalise] = useState<string | null>(null);
  const [analise, setAnalise] = useState<Analise | null>(null);
  const [processando, setProcessando] = useState(false);

  async function analisarArquivo() {
    const arquivo = inputRef.current?.files?.[0];
    if (!arquivo) return;

    setAnalisando(true);
    setErroAnalise(null);
    setAnalise(null);

    const formData = new FormData();
    formData.append("arquivo", arquivo);

    try {
      const res = await fetch("/api/operacional/ag-abertura/analisar-planilha", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setErroAnalise(data.error || "Não foi possível analisar essa planilha.");
      } else {
        setAnalise(data);
      }
    } catch {
      setErroAnalise("Falha de conexão ao enviar o arquivo. Tente novamente.");
    }
    setAnalisando(false);
  }

  async function confirmarAplicacao() {
    if (!analise || analise.encontrados.length === 0) return;
    setProcessando(true);

    const itens = analise.encontrados.map((item) => ({
      id: item.id,
      valorExibicao: item.os_reparadora_nova,
      executar: async () => {
        try {
          const res = await fetch(`/api/operacional/orcamentos/${item.id}/os-reparadora`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ os_reparadora: item.os_reparadora_nova }),
          });
          const data = await res.json();
          if (!res.ok) return { ok: false, erro: data.error || "Falha ao salvar." };
          return { ok: true };
        } catch {
          return { ok: false, erro: "Falha de conexão." };
        }
      },
    }));

    setAnalise(null);
    if (inputRef.current) inputRef.current.value = "";
    setNomeArquivo(null);

    await tabelaRef.current?.processarLote(itens);
    setProcessando(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-x-4 gap-y-2">
        <div className="flex items-center flex-wrap [&>*]:!mb-0">{topo}</div>

        <div className="flex items-center flex-wrap gap-1.5" title="Preencher OS Reparadora em massa via planilha">
          <FileSpreadsheet size={14} className="mr-0.5 shrink-0" style={{ color: "var(--accent2)" }} />
          <a
            href="/api/operacional/ag-abertura/modelo-planilha"
            title="Baixar modelo (.xlsx)"
            className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition hover:border-[var(--accent2)]"
            style={{ borderColor: "var(--line)", color: "var(--ink)" }}
          >
            <Download size={13} />
            Modelo
          </a>

          <label
            title={nomeArquivo || "Escolher planilha preenchida"}
            className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs cursor-pointer transition hover:border-[var(--accent2)] max-w-[9rem] sm:max-w-[12rem]"
            style={{ borderColor: "var(--line)", color: "var(--ink)" }}
          >
            <UploadCloud size={13} className="shrink-0" />
            <span className="truncate">{nomeArquivo || "Escolher planilha"}</span>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                setNomeArquivo(e.target.files?.[0]?.name ?? null);
                setAnalise(null);
                setErroAnalise(null);
              }}
            />
          </label>

          <button
            type="button"
            onClick={analisarArquivo}
            disabled={!nomeArquivo || analisando}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent2)] disabled:opacity-60 text-white text-xs font-medium px-3 py-1.5 transition"
            style={{ boxShadow: "0 0 20px var(--accent-glow)" }}
          >
            {analisando && <Loader2 size={12} className="animate-spin" />}
            {analisando ? "Analisando..." : "Analisar"}
          </button>
        </div>
      </div>

      {erroAnalise && (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
          {erroAnalise}
        </p>
      )}

      {analise && (
        <PopupConfirmarAnalise
          analise={analise}
          processando={processando}
          onConfirmar={confirmarAplicacao}
          onFechar={() => setAnalise(null)}
        />
      )}

      <TabelaAgAbertura ref={tabelaRef} aparelhos={aparelhos} mensagemVazia={mensagemVazia} />
    </div>
  );
}

function PopupConfirmarAnalise({
  analise,
  processando,
  onConfirmar,
  onFechar,
}: {
  analise: Analise;
  processando: boolean;
  onConfirmar: () => void;
  onFechar: () => void;
}) {
  const semNadaPraFazer = analise.encontrados.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.55)" }}>
      <div
        className="w-full max-w-lg rounded-2xl border shadow-2xl p-6"
        style={{ background: "var(--surface)", borderColor: "var(--line)" }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold flex items-center gap-2" style={{ color: "var(--ink)" }}>
            <FileSpreadsheet size={18} style={{ color: "var(--accent2)" }} />
            Confirmar preenchimento em massa
          </h2>
          <button
            type="button"
            onClick={onFechar}
            disabled={processando}
            aria-label="Fechar"
            className="w-7 h-7 flex items-center justify-center rounded-md transition hover:bg-[var(--surface2)] disabled:opacity-50"
            style={{ color: "var(--muted)" }}
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-2.5 text-sm mb-5">
          <LinhaResumo
            icone={FileSpreadsheet}
            cor="var(--muted)"
            texto={<>{analise.totalLinhasArquivo} linha(s) lida(s) na planilha.</>}
          />
          <LinhaResumo
            icone={CheckCircle2}
            cor="#22c55e"
            texto={
              <>
                <strong>{analise.encontrados.length}</strong> aparelho(s) vão ganhar a OS Reparadora e avançar pra{" "}
                <strong>1 - Ag. Triagem</strong>.
              </>
            }
          />
          {analise.duplicadasNoArquivo > 0 && (
            <LinhaResumo
              icone={AlertTriangle}
              cor="#f59e0b"
              texto={<>{analise.duplicadasNoArquivo} OS Care Allied duplicada(s) no arquivo — usei a última linha de cada.</>}
            />
          )}
          {analise.naoEncontradosNoSistema > 0 && (
            <LinhaResumo
              icone={SearchX}
              cor="var(--muted)"
              texto={
                <>
                  {analise.naoEncontradosNoSistema} OS Care Allied do arquivo não bateu com nenhuma pendência de Ag.
                  Abertura.
                </>
              }
            />
          )}
          {analise.osReparadoraInvalida > 0 && (
            <LinhaResumo
              icone={XCircle}
              cor="#ef4444"
              texto={<>{analise.osReparadoraInvalida} linha(s) com OS Reparadora inválida (precisa 10 números) — ignoradas.</>}
            />
          )}
        </div>

        {analise.encontrados.length > 0 && (
          <div
            className="max-h-48 overflow-y-auto rounded-lg border mb-5 text-xs"
            style={{ borderColor: "var(--line)" }}
          >
            {analise.encontrados.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between px-3 py-2 border-t first:border-t-0"
                style={{ borderColor: "var(--line)" }}
              >
                <span style={{ color: "var(--ink)" }}>{item.trade_allied}</span>
                <span className="font-mono" style={{ color: "var(--accent2)" }}>
                  {item.os_reparadora_nova}
                </span>
              </div>
            ))}
          </div>
        )}

        {semNadaPraFazer && (
          <p className="text-sm mb-5" style={{ color: "var(--muted)" }}>
            Nenhuma pendência bateu com essa planilha — nada será alterado.
          </p>
        )}

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onFechar}
            disabled={processando}
            className="rounded-lg px-4 py-2.5 text-sm font-medium transition hover:bg-[var(--surface2)] disabled:opacity-60"
            style={{ color: "var(--muted)" }}
          >
            Cancelar
          </button>
          {!semNadaPraFazer && (
            <button
              type="button"
              onClick={onConfirmar}
              disabled={processando}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent2)] disabled:opacity-60 text-white text-sm font-medium px-5 py-2.5 transition"
              style={{ boxShadow: "0 0 30px var(--accent-glow)" }}
            >
              {processando && <Loader2 size={14} className="animate-spin" />}
              {processando ? "Processando..." : `Confirmar e enviar ${analise.encontrados.length}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function LinhaResumo({
  icone: Icone,
  cor,
  texto,
}: {
  icone: typeof FileSpreadsheet;
  cor: string;
  texto: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2" style={{ color: "var(--muted)" }}>
      <Icone size={15} style={{ color: cor, marginTop: 1 }} className="shrink-0" />
      <span>{texto}</span>
    </div>
  );
}
