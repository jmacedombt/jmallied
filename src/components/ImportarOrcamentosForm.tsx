"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Info, UploadCloud, XCircle } from "lucide-react";
import BarraProgresso from "@/components/BarraProgresso";
import PopupConfirmar from "@/components/PopupConfirmar";
import { EXPLICACAO_PRE_ORDEM } from "@/lib/preOrdem";

type Resultado = {
  aparelhosNoArquivo: number;
  linhasInvalidas: number;
  duplicadasNoArquivo: number;
  aparelhosNovosInseridos: number;
  aparelhosDuplicadosIgnorados: number;
  aparelhosReincidentes: number;
  modelosComerciaisUnicos: number;
  skusUnicos: number;
};

type LinhaLog = { tipo: "etapa" | "validacao"; ok?: boolean; mensagem: string };

type Evento =
  | { tipo: "etapa"; mensagem: string }
  | { tipo: "validacao"; ok: boolean; mensagem: string }
  | { tipo: "progresso"; atual: number; total: number }
  | { tipo: "erro"; mensagem: string }
  | { tipo: "concluido"; resultado: Resultado }
  | { tipo: "preparado"; loteId: string; linhas: Record<string, unknown>[]; resumo: ResumoPreparado };

type ResumoPreparado = {
  aparelhosNoArquivo: number;
  linhasInvalidas: number;
  duplicadasNoArquivo: number;
  linhasValidas: number;
  modelosComerciaisUnicos: number;
  skusUnicos: number;
};

// pacotes pequenos, uma requisição por pacote (pedido explícito,
// 21/10/2026 — ver api/bases/orcamentos/importar/lote/route.ts).
const TAMANHO_PACOTE = 40;

export default function ImportarOrcamentosForm() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const inputPreOrdemRef = useRef<HTMLInputElement>(null);

  const [enviando, setEnviando] = useState(false);
  const [log, setLog] = useState<LinhaLog[]>([]);
  const [progresso, setProgresso] = useState<{ atual: number; total: number } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null);
  const [nomeArquivoPreOrdem, setNomeArquivoPreOrdem] = useState<string | null>(null);
  // "Subir sem Pré-Ordem" (pedido explícito, 27/10/2026) — confirma antes
  const [confirmandoSemPreOrdem, setConfirmandoSemPreOrdem] = useState(false);
  // NF Remessa temporária (pedido explícito, 27/10/2026): o servidor
  // responde NF_VAZIA quando a coluna B vem vazia; a tela pergunta e
  // reenvia com nfTemporaria=true.
  const [confirmandoNfTemporaria, setConfirmandoNfTemporaria] = useState<{ semPreOrdem: boolean; mensagem: string } | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!inputRef.current?.files?.[0]) return;
    if (!inputPreOrdemRef.current?.files?.[0]) {
      setConfirmandoSemPreOrdem(true);
      return;
    }
    enviar(false);
  }

  async function enviar(semPreOrdem: boolean, nfTemporaria = false) {
    setConfirmandoSemPreOrdem(false);
    setConfirmandoNfTemporaria(null);
    const arquivo = inputRef.current?.files?.[0];
    const arquivoPreOrdem = semPreOrdem ? null : inputPreOrdemRef.current?.files?.[0];
    if (!arquivo || (!semPreOrdem && !arquivoPreOrdem)) return;

    setEnviando(true);
    setLog([]);
    setProgresso(null);
    setErro(null);
    setResultado(null);

    const formData = new FormData();
    formData.append("arquivo", arquivo);
    if (arquivoPreOrdem) formData.append("arquivoPreOrdem", arquivoPreOrdem);
    if (semPreOrdem) formData.append("semPreOrdem", "true");
    if (nfTemporaria) formData.append("nfTemporaria", "true");

    try {
      const res = await fetch("/api/bases/orcamentos/importar", { method: "POST", body: formData });

      if (!res.body) {
        const data = await res.json().catch(() => null);
        setErro(data?.error || "Não foi possível importar a base.");
        setEnviando(false);
        return;
      }

      if (!res.ok) {
        // erros anteriores ao início do processamento (auth, permissão,
        // arquivo ausente/inválido) voltam como JSON simples, sem stream.
        const data = await res.json().catch(() => null);
        if (data?.codigo === "NF_VAZIA") {
          setConfirmandoNfTemporaria({ semPreOrdem, mensagem: data.error });
          setEnviando(false);
          return;
        }
        setErro(data?.error || "Não foi possível importar a base.");
        setEnviando(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let sobra = "";
      let concluiuComSucesso = false;
      let preparado: { loteId: string; linhas: Record<string, unknown>[]; resumo: ResumoPreparado } | null = null;
      let houveErro = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        sobra += decoder.decode(value, { stream: true });
        const linhas = sobra.split("\n");
        sobra = linhas.pop() ?? "";

        for (const linha of linhas) {
          if (!linha.trim()) continue;
          let evento: Evento;
          try {
            evento = JSON.parse(linha);
          } catch {
            continue;
          }

          if (evento.tipo === "etapa") {
            setLog((atual) => [...atual, { tipo: "etapa", mensagem: evento.mensagem }]);
          } else if (evento.tipo === "validacao") {
            setLog((atual) => [...atual, { tipo: "validacao", ok: evento.ok, mensagem: evento.mensagem }]);
          } else if (evento.tipo === "progresso") {
            setProgresso({ atual: evento.atual, total: evento.total });
          } else if (evento.tipo === "erro") {
            houveErro = true;
            setErro(evento.mensagem);
          } else if (evento.tipo === "preparado") {
            preparado = { loteId: evento.loteId, linhas: evento.linhas, resumo: evento.resumo };
          } else if (evento.tipo === "concluido") {
            setResultado(evento.resultado);
            concluiuComSucesso = true;
          }
        }
      }

      // a preparação terminou: grava os aparelhos em pacotes
      if (preparado) {
        const { loteId, linhas, resumo } = preparado;
        setProgresso({ atual: 0, total: linhas.length });
        let gravados = 0;
        let falhou: string | null = null;
        for (let i = 0; i < linhas.length; i += TAMANHO_PACOTE) {
          const pacote = linhas.slice(i, i + TAMANHO_PACOTE);
          try {
            const resLote = await fetch("/api/bases/orcamentos/importar/lote", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ loteId, linhas: pacote }),
            });
            const dataLote = await resLote.json().catch(() => null);
            if (!resLote.ok) {
              falhou = dataLote?.error || "erro ao gravar um pacote";
              break;
            }
          } catch {
            falhou = "falha de conexão";
            break;
          }
          gravados = Math.min(i + TAMANHO_PACOTE, linhas.length);
          setProgresso({ atual: gravados, total: linhas.length });
        }

        // fecha o histórico mesmo se parou no meio — assim os números
        // mostram o que de fato entrou.
        const resFim = await fetch("/api/bases/orcamentos/importar/finalizar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            loteId,
            linhasValidas: resumo.linhasValidas,
            modelosComerciaisUnicos: resumo.modelosComerciaisUnicos,
            skusUnicos: resumo.skusUnicos,
          }),
        }).catch(() => null);
        const dataFim = resFim ? await resFim.json().catch(() => null) : null;

        if (falhou) {
          houveErro = true;
          setErro(
            `Importação interrompida (${falhou}) — gravados ${gravados} de ${linhas.length} aparelho(s). Suba os mesmos 2 arquivos de novo: os que já entraram são ignorados e só o que faltou é gravado.`
          );
        } else {
          setResultado({
            aparelhosNoArquivo: resumo.aparelhosNoArquivo,
            linhasInvalidas: resumo.linhasInvalidas,
            duplicadasNoArquivo: resumo.duplicadasNoArquivo,
            aparelhosNovosInseridos: dataFim?.aparelhosNovosInseridos ?? 0,
            aparelhosDuplicadosIgnorados: dataFim?.aparelhosDuplicadosIgnorados ?? 0,
            aparelhosReincidentes: dataFim?.aparelhosReincidentes ?? 0,
            modelosComerciaisUnicos: resumo.modelosComerciaisUnicos,
            skusUnicos: resumo.skusUnicos,
          });
          concluiuComSucesso = true;
        }
      } else if (!concluiuComSucesso && !houveErro) {
        // a requisição terminou sem "erro" nem resultado — foi cortada no meio
        setErro(
          "A importação foi interrompida antes de terminar (sem resposta do servidor). Suba os mesmos 2 arquivos de novo — o que já entrou não é duplicado."
        );
      }
      if (houveErro) router.refresh();

      if (concluiuComSucesso) {
        if (inputRef.current) inputRef.current.value = "";
        if (inputPreOrdemRef.current) inputPreOrdemRef.current.value = "";
        setNomeArquivo(null);
        setNomeArquivoPreOrdem(null);
        router.refresh();
      }
    } catch {
      setErro("Falha de conexão ao enviar os arquivos. Tente novamente.");
    }

    setEnviando(false);
  }

  const percentual = progresso && progresso.total > 0 ? Math.round((progresso.atual / progresso.total) * 100) : null;

  return (
    <div className="rounded-xl border p-5" style={{ background: "var(--surface)", borderColor: "var(--line)" }}>
      <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-3">
        <label
          className="flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm cursor-pointer transition hover:border-[var(--accent2)]"
          style={{ borderColor: "var(--line)", color: "var(--ink)" }}
        >
          <UploadCloud size={16} />
          {nomeArquivo || "Base de Orçamentos (.xlsx)"}
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => setNomeArquivo(e.target.files?.[0]?.name ?? null)}
          />
        </label>

        <label
          className="flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm cursor-pointer transition hover:border-[var(--accent2)]"
          style={{ borderColor: "var(--line)", color: "var(--ink)" }}
        >
          <UploadCloud size={16} />
          {nomeArquivoPreOrdem || "Base de Pré-Ordem (.xlsx)"}
          <input
            ref={inputPreOrdemRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => setNomeArquivoPreOrdem(e.target.files?.[0]?.name ?? null)}
          />
        </label>

        <div className="group relative inline-flex">
          <Info size={15} style={{ color: "var(--muted)" }} className="cursor-help" />
          <div
            className="pointer-events-none absolute left-0 top-6 z-20 hidden w-80 rounded-lg border p-3 text-xs shadow-2xl group-hover:block"
            style={{ background: "var(--surface2)", borderColor: "var(--line)", color: "var(--muted)" }}
          >
            {EXPLICACAO_PRE_ORDEM}
          </div>
        </div>

        <button
          type="submit"
          disabled={enviando || !nomeArquivo}
          className="rounded-lg bg-[var(--accent)] hover:bg-[var(--accent2)] disabled:opacity-60 text-white text-sm font-medium px-5 py-2.5 transition"
          style={{ boxShadow: "0 0 40px var(--accent-glow)" }}
        >
          {enviando ? "Importando..." : "Carregar base"}
        </button>

        <p className="text-xs w-full" style={{ color: "var(--muted)" }}>
          Sem o arquivo de Pré-Ordem em mãos? Dá pra subir só a Base de Orçamentos — a NF fica &quot;Pré-Ordem pendente&quot;
          e a Pré-Ordem é subida depois, no histórico abaixo.{" "}
          Um par de arquivos = uma NF Remessa Allied. A base acumula entre importações — o mesmo aparelho numa NF nova
          é marcado como reincidente (RRR).
        </p>
      </form>

      {(enviando || log.length > 0) && (
        <div
          className="mt-4 rounded-lg border p-3 space-y-1.5 max-h-52 overflow-y-auto"
          style={{ borderColor: "var(--line)", background: "var(--surface2)" }}
        >
          {log.map((linha, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              {linha.tipo === "validacao" ? (
                linha.ok ? (
                  <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-500" />
                ) : (
                  <XCircle size={14} className="mt-0.5 shrink-0 text-red-500" />
                )
              ) : (
                <span className="mt-1.5 h-1 w-1 rounded-full shrink-0" style={{ background: "var(--muted)" }} />
              )}
              <span style={{ color: linha.tipo === "validacao" && linha.ok === false ? "#ef4444" : "var(--muted)" }}>
                {linha.mensagem}
              </span>
            </div>
          ))}
        </div>
      )}

      {enviando && percentual !== null && progresso && (
        <BarraProgresso percentual={percentual} rotulo={`Gravando aparelhos... (${progresso.atual}/${progresso.total})`} />
      )}

      {erro && (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mt-4">{erro}</p>
      )}

      {resultado && (
        <div className="text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2.5 mt-4">
          <p>
            Importação concluída: <strong>{resultado.aparelhosNovosInseridos}</strong> aparelho(s)
            novo(s), <strong>{resultado.aparelhosDuplicadosIgnorados}</strong> já existente(s)
            ignorado(s){resultado.linhasInvalidas > 0 && (
              <>, <strong>{resultado.linhasInvalidas}</strong> linha(s) inválida(s) descartada(s)</>
            )} de {resultado.aparelhosNoArquivo} lida(s).
          </p>
          <p className="mt-1 text-emerald-400/80">
            {resultado.aparelhosReincidentes > 0 ? (
              <>
                <strong className="text-amber-400">{resultado.aparelhosReincidentes} reincidente(s) (RRR)</strong>{" "}
                identificado(s) neste lote.
              </>
            ) : (
              "Nenhum reincidente identificado neste lote."
            )}
            {" · "}
            {resultado.modelosComerciaisUnicos} modelo(s) comercial(is) · {resultado.skusUnicos} SKU(s) únicos.
          </p>
        </div>
      )}
      {confirmandoSemPreOrdem && (
        <PopupConfirmar
          titulo="Subir sem a Pré-Ordem?"
          mensagem={
            <>
              Você escolheu só a <strong>Base de Orçamentos</strong> ({nomeArquivo}). Os aparelhos entram normalmente em Ag.
              Abertura, mas a NF fica marcada como <strong>&quot;Pré-Ordem pendente&quot;</strong>. Quando o arquivo de
              Pré-Ordem chegar, use o botão <strong>Subir Pré-Ordem</strong> na linha dessa NF no histórico — ele casa na
              mesma ordem, com a mesma conferência de lote e SKU, e atualiza todos os aparelhos da NF.
            </>
          }
          rotuloConfirmar="Subir sem Pré-Ordem"
          onConfirmar={() => enviar(true)}
          onFechar={() => setConfirmandoSemPreOrdem(false)}
        />
      )}
      {confirmandoNfTemporaria && (
        <PopupConfirmar
          titulo="Arquivo sem NF Remessa — criar NF temporária?"
          mensagem={
            <>
              {confirmandoNfTemporaria.mensagem} Dá pra subir mesmo assim com uma <strong>NF temporária</strong> (TEMP + data
              de hoje): os aparelhos entram em Ag. Abertura e seguem o fluxo normal. Só o <strong>Confirmar Envio</strong> da
              Validação de Orçamentos fica bloqueado até a NF real. Quando chegar o arquivo definitivo (com a NF e, se
              tiver, a Pré-Ordem), use <strong>Definir NF definitiva</strong> na linha dessa NF no histórico.
            </>
          }
          rotuloConfirmar="Criar NF temporária e subir"
          onConfirmar={() => enviar(confirmandoNfTemporaria.semPreOrdem, true)}
          onFechar={() => setConfirmandoNfTemporaria(null)}
        />
      )}
    </div>
  );
}
