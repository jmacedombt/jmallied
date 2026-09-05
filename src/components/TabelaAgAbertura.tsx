"use client";

import { Fragment, forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, Copy, Save, Pencil, Check, RotateCcw, Loader2, X } from "lucide-react";
import { deriveImeiReparadora, osReparadoraValida } from "@/lib/orcamentos";
import PopupReprovarOrcamento, { type AparelhoReprovavel } from "@/components/PopupReprovarOrcamento";

export type AparelhoAgAbertura = {
  id: string;
  os_reparadora: string | null;
  data_reconhecimento: string | null;
  os_care_allied: string | null;
  trade_allied: string;
  imei_allied: string | null;
  descricao_completa: string | null;
  modelo_comercial: string | null;
  descricao_defeito_1: string | null;
  descricao_defeito_2: string | null;
  descricao_defeito_3: string | null;
  descricao_defeito_4: string | null;
  descricao_defeito_5: string | null;
  descricao_defeito_6: string | null;
  descricao_defeito_7: string | null;
  descricao_defeito_8: string | null;
  descricao_defeito_9: string | null;
  descricao_defeito_10: string | null;
  peca_defeito_1: string | null;
  peca_defeito_2: string | null;
  peca_defeito_3: string | null;
  peca_defeito_4: string | null;
  peca_defeito_5: string | null;
  peca_defeito_6: string | null;
  peca_defeito_7: string | null;
  peca_defeito_8: string | null;
  peca_defeito_9: string | null;
  peca_defeito_10: string | null;
};

// Um item de uma rotina de processamento em massa (upload de planilha em
// Ag. Abertura, confirmação em massa em Ag. Triagem etc). A tabela só
// cuida da parte visual (linha vira verde uma por uma); quem chama
// decide o que "executar" de fato pra cada linha.
export type ItemProcessamentoLote = {
  id: string;
  valorExibicao?: string; // se informado, atualiza a coluna OS Reparadora antes de marcar sucesso
  executar: () => Promise<{ ok: boolean; erro?: string }>;
};

export type TabelaAgAberturaHandle = {
  processarLote: (itens: ItemProcessamentoLote[], opts?: { atrasoMs?: number }) => Promise<void>;
};

function esperar(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function BotaoCopiar({ texto, chave, copiado, onCopiar }: { texto: string; chave: string; copiado: string | null; onCopiar: (t: string, c: string) => void }) {
  if (!texto) return null;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onCopiar(texto, chave);
      }}
      title="Copiar"
      className="inline-flex items-center justify-center w-6 h-6 rounded hover:bg-black/10 shrink-0"
      style={{ color: "var(--muted)" }}
    >
      {copiado === chave ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
    </button>
  );
}

const TabelaAgAbertura = forwardRef<
  TabelaAgAberturaHandle,
  {
    aparelhos: AparelhoAgAbertura[];
    mensagemVazia?: string;
    selecionavel?: boolean;
    selecionados?: Set<string>;
    aoAlternarSelecao?: (id: string) => void;
    aoAlternarTodos?: () => void;
  }
>(function TabelaAgAbertura(
  { aparelhos, mensagemVazia = "Nenhum aparelho aguardando abertura no momento.", selecionavel, selecionados, aoAlternarSelecao, aoAlternarTodos },
  ref
) {
  const router = useRouter();

  const [expandido, setExpandido] = useState<string | null>(null);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState<Record<string, boolean>>({});
  const [erros, setErros] = useState<Record<string, string>>({});
  const [salvos, setSalvos] = useState<Record<string, boolean>>({});
  const [revertidos, setRevertidos] = useState<Record<string, boolean>>({});
  const [processandoId, setProcessandoId] = useState<string | null>(null);
  const [saindo, setSaindo] = useState<Record<string, boolean>>({});
  const [removidos, setRemovidos] = useState<Record<string, boolean>>({});
  const [copiado, setCopiado] = useState<string | null>(null);
  const [reprovando, setReprovando] = useState<AparelhoReprovavel | null>(null);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // se a lista que vem do servidor mudar (ex: depois do router.refresh()
  // no fim de um lote), os itens que já saíram de verdade não existem
  // mais nela — não precisa mais escondê-los "na mão".
  useEffect(() => {
    setRemovidos({});
    setSaindo({});
  }, [aparelhos]);

  useImperativeHandle(ref, () => ({
    async processarLote(itens, opts) {
      const atrasoMs = opts?.atrasoMs ?? 450;
      for (const item of itens) {
        setProcessandoId(item.id);
        setErros((e) => ({ ...e, [item.id]: "" }));
        const resultado = await item.executar();
        if (resultado.ok) {
          if (item.valorExibicao !== undefined) {
            setValores((v) => ({ ...v, [item.id]: item.valorExibicao! }));
          }
          setSalvos((s) => ({ ...s, [item.id]: true }));
        } else {
          setErros((e) => ({ ...e, [item.id]: resultado.erro || "Falha ao processar." }));
        }
        setProcessandoId(null);
        await esperar(atrasoMs);

        // já transferiu pra próxima etapa: some da lista aqui mesmo (com
        // uma leve transição), em vez de esperar todo o lote terminar —
        // assim a lista vai subindo item a item conforme processa.
        if (resultado.ok) {
          setSaindo((s) => ({ ...s, [item.id]: true }));
          await esperar(260);
          setRemovidos((r) => ({ ...r, [item.id]: true }));
        }
      }
      router.refresh();
    },
  }));

  function valorAtual(a: AparelhoAgAbertura) {
    return valores[a.id] ?? a.os_reparadora ?? "";
  }

  function atualizarValor(id: string, v: string) {
    const soNumeros = v.replace(/\D/g, "").slice(0, 10);
    setValores((prev) => ({ ...prev, [id]: soNumeros }));
    setErros((prev) => ({ ...prev, [id]: "" }));
  }

  async function salvar(id: string) {
    const valor = (valores[id] ?? "").trim();
    const limpando = valor === "";
    if (!limpando && !osReparadoraValida(valor)) {
      setErros((e) => ({ ...e, [id]: "Precisa ter exatamente 10 números." }));
      return;
    }
    setSalvando((s) => ({ ...s, [id]: true }));
    try {
      const res = await fetch(`/api/operacional/orcamentos/${id}/os-reparadora`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ os_reparadora: valor }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErros((e) => ({ ...e, [id]: data.error || "Não foi possível salvar." }));
      } else if (limpando) {
        setRevertidos((s) => ({ ...s, [id]: true }));
        setTimeout(() => router.refresh(), 900);
      } else {
        setSalvos((s) => ({ ...s, [id]: true }));
        setTimeout(() => router.refresh(), 900);
      }
    } catch {
      setErros((e) => ({ ...e, [id]: "Falha de conexão. Tente novamente." }));
    }
    setSalvando((s) => ({ ...s, [id]: false }));
  }

  async function copiar(texto: string, chave: string) {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(chave);
      setTimeout(() => setCopiado((c) => (c === chave ? null : c)), 1200);
    } catch {
      // clipboard indisponível — ignora silenciosamente
    }
  }

  // itens que já foram transferidos de status por um processamento em
  // lote somem da lista aqui mesmo (ver processarLote acima) — sem
  // esperar o router.refresh() no fim do lote pra sumir todos de uma vez.
  const aparelhosVisiveis = aparelhos.filter((a) => !removidos[a.id]);

  if (aparelhosVisiveis.length === 0) {
    return (
      <p className="text-sm py-10 text-center" style={{ color: "var(--muted)" }}>
        {mensagemVazia}
      </p>
    );
  }

  const todosSelecionados =
    selecionavel && aparelhosVisiveis.length > 0 && aparelhosVisiveis.every((a) => selecionados?.has(a.id));

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--line)" }}>
      {/* O scroll acontece AQUI dentro (não na página), então a barra de
          títulos gruda em top:0 desse contêiner — sem depender da altura
          do cabeçalho do app nem vazar pedaço de linha por trás. */}
      <div className="overflow-y-auto" style={{ maxHeight: "calc(100vh - 170px)" }}>
        <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr className="text-left">
              {selecionavel && (
                <th
                  className="sticky top-0 z-10 px-4 py-2.5 font-medium w-10"
                  style={{ background: "var(--surface2)", color: "var(--muted)" }}
                >
                  <input
                    type="checkbox"
                    checked={!!todosSelecionados}
                    onChange={() => aoAlternarTodos?.()}
                    aria-label="Selecionar todos"
                    className="w-4 h-4 cursor-pointer"
                  />
                </th>
              )}
              <th
                className="sticky top-0 z-10 px-4 py-2.5 font-medium w-64"
                style={{ background: "var(--surface2)", color: "var(--muted)" }}
              >
                OS Reparadora
              </th>
              <th
                className="sticky top-0 z-10 px-4 py-2.5 font-medium"
                style={{ background: "var(--surface2)", color: "var(--muted)" }}
              >
                Data Reconhecimento
              </th>
              <th
                className="sticky top-0 z-10 px-4 py-2.5 font-medium"
                style={{ background: "var(--surface2)", color: "var(--muted)" }}
              >
                OS Care Allied
              </th>
              <th
                className="sticky top-0 z-10 px-4 py-2.5 font-medium"
                style={{ background: "var(--surface2)", color: "var(--muted)" }}
              >
                Trade Allied
              </th>
              <th
                className="sticky top-0 z-10 px-4 py-2.5 font-medium"
                style={{ background: "var(--surface2)", color: "var(--muted)" }}
              >
                Imei Allied
              </th>
              <th
                className="sticky top-0 z-10 px-4 py-2.5 font-medium"
                style={{ background: "var(--surface2)", color: "var(--muted)" }}
              >
                Descrição Completa
              </th>
              <th
                className="sticky top-0 z-10 px-4 py-2.5 font-medium text-right"
                style={{ background: "var(--surface2)", color: "var(--muted)" }}
              >
                Ação
              </th>
            </tr>
          </thead>
          <tbody>
          {aparelhosVisiveis.map((a) => {
            const aberto = expandido === a.id;
            const salvo = !!salvos[a.id];
            const revertido = !!revertidos[a.id];
            const processandoLote = processandoId === a.id;
            const saindoAgora = !!saindo[a.id];
            const imeiAllied = deriveImeiReparadora(a.imei_allied) ?? "";
            const descricaoPrimeiraPalavra = (a.descricao_completa ?? "").split(" ")[0];

            const defeitos = Array.from({ length: 10 }, (_, i) => {
              const desc = a[`descricao_defeito_${i + 1}` as keyof AparelhoAgAbertura] as string | null;
              const peca = a[`peca_defeito_${i + 1}` as keyof AparelhoAgAbertura] as string | null;
              return { desc, peca };
            }).filter((d) => d.desc || d.peca);

            return (
              <Fragment key={a.id}>
                <tr
                  onClick={() => setExpandido(aberto ? null : a.id)}
                  className="border-t cursor-pointer transition-all duration-200 ease-in"
                  style={{
                    borderColor: "var(--line)",
                    background: processandoLote
                      ? "rgba(37,99,235,0.14)"
                      : salvo
                        ? "rgba(34,197,94,0.14)"
                        : revertido
                          ? "rgba(245,158,11,0.14)"
                          : "var(--surface)",
                    opacity: saindoAgora ? 0 : 1,
                    transform: saindoAgora ? "translateX(12px)" : "translateX(0)",
                  }}
                >
                  {selecionavel && (
                    <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={!!selecionados?.has(a.id)}
                        onChange={() => aoAlternarSelecao?.(a.id)}
                        aria-label={`Selecionar ${a.trade_allied}`}
                        className="w-4 h-4 cursor-pointer"
                      />
                    </td>
                  )}
                  <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                    {processandoLote ? (
                      <span className="inline-flex items-center gap-1.5" style={{ color: "var(--accent2)" }}>
                        <Loader2 size={14} className="animate-spin" /> Processando...
                      </span>
                    ) : salvo ? (
                      <span className="inline-flex items-center gap-1.5 text-emerald-500 font-medium">
                        <Check size={14} /> {valores[a.id] || a.os_reparadora}
                      </span>
                    ) : revertido ? (
                      <span className="inline-flex items-center gap-1.5 text-amber-500 font-medium">
                        <RotateCcw size={14} /> Voltou p/ Ag. Abertura
                      </span>
                    ) : (
                      <div>
                        <div className="flex items-center gap-1.5">
                          <input
                            ref={(el) => {
                              inputRefs.current[a.id] = el;
                            }}
                            value={valorAtual(a)}
                            onChange={(e) => atualizarValor(a.id, e.target.value)}
                            placeholder="41XXXXXXXX"
                            inputMode="numeric"
                            className="w-36 rounded-md border px-2.5 py-1.5 text-sm outline-none focus:border-[var(--accent2)] focus:ring-1 focus:ring-[var(--accent2)] transition font-mono bg-[var(--surface2)] border-[var(--line)] text-[var(--ink)]"
                          />
                          <button
                            type="button"
                            title="Editar"
                            onClick={() => {
                              inputRefs.current[a.id]?.focus();
                              inputRefs.current[a.id]?.select();
                            }}
                            className="w-7 h-7 flex items-center justify-center rounded hover:bg-black/10 shrink-0"
                            style={{ color: "var(--muted)" }}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            title={valorAtual(a).trim() === "" ? "Salvar em branco (volta p/ Ag. Abertura)" : "Salvar"}
                            disabled={salvando[a.id]}
                            onClick={() => salvar(a.id)}
                            className="w-7 h-7 flex items-center justify-center rounded hover:bg-black/10 shrink-0 disabled:opacity-50"
                            style={{ color: "var(--accent2)" }}
                          >
                            <Save size={14} />
                          </button>
                        </div>
                        {erros[a.id] && (
                          <p className="text-[11px] text-red-400 mt-1 inline-flex items-center gap-1">
                            <X size={11} /> {erros[a.id]}
                          </p>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2.5" style={{ color: a.data_reconhecimento ? "var(--ink)" : "var(--muted)" }}>
                    {a.data_reconhecimento
                      ? new Date(`${a.data_reconhecimento}T00:00:00`).toLocaleDateString("pt-BR")
                      : "—"}
                  </td>
                  <td className="px-4 py-2.5" style={{ color: "var(--ink)" }}>
                    <span className="inline-flex items-center gap-1.5">
                      {a.os_care_allied}
                      <BotaoCopiar texto={a.os_care_allied ?? ""} chave={`osc-${a.id}`} copiado={copiado} onCopiar={copiar} />
                    </span>
                  </td>
                  <td className="px-4 py-2.5" style={{ color: "var(--ink)" }}>
                    <span className="inline-flex items-center gap-1.5">
                      {a.trade_allied}
                      <BotaoCopiar texto={a.trade_allied} chave={`trade-${a.id}`} copiado={copiado} onCopiar={copiar} />
                    </span>
                  </td>
                  <td className="px-4 py-2.5" style={{ color: "var(--ink)" }}>
                    <span className="inline-flex items-center gap-1.5">
                      {imeiAllied}
                      <BotaoCopiar texto={imeiAllied} chave={`imei-${a.id}`} copiado={copiado} onCopiar={copiar} />
                    </span>
                  </td>
                  <td className="px-4 py-2.5" style={{ color: "var(--ink)" }} title={a.descricao_completa ?? ""}>
                    <span className="inline-flex items-center gap-1.5">
                      {descricaoPrimeiraPalavra}
                      <BotaoCopiar
                        texto={a.descricao_completa ?? ""}
                        chave={`desc-${a.id}`}
                        copiado={copiado}
                        onCopiar={copiar}
                      />
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => setReprovando({ id: a.id, trade_allied: a.trade_allied, os_reparadora: a.os_reparadora })}
                      title="Reprovar orçamento"
                      className="inline-flex items-center justify-center w-8 h-8 rounded-lg border transition hover:border-[#ef4444]"
                      style={{ borderColor: "var(--line)", color: "#ef4444" }}
                    >
                      <Ban size={15} />
                    </button>
                  </td>
                </tr>

                {aberto && (
                  <tr style={{ background: "var(--surface2)" }}>
                    <td colSpan={selecionavel ? 8 : 7} className="px-4 py-4">
                      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3 text-xs">
                        <div>
                          <p className="uppercase tracking-wide mb-0.5" style={{ color: "var(--muted)" }}>
                            Modelo comercial
                          </p>
                          <span className="inline-flex items-center gap-1.5" style={{ color: "var(--ink)" }}>
                            {a.modelo_comercial || "—"}
                            <BotaoCopiar
                              texto={a.modelo_comercial ?? ""}
                              chave={`modelo-${a.id}`}
                              copiado={copiado}
                              onCopiar={copiar}
                            />
                          </span>
                        </div>

                        {defeitos.length === 0 ? (
                          <div className="sm:col-span-2 lg:col-span-2">
                            <p style={{ color: "var(--muted)" }}>Nenhuma descrição de defeito/peça informada.</p>
                          </div>
                        ) : (
                          defeitos.map((d, i) => (
                            <div key={i}>
                              <p className="uppercase tracking-wide mb-0.5" style={{ color: "var(--muted)" }}>
                                Defeito {i + 1}
                              </p>
                              <div className="space-y-0.5">
                                {d.desc && (
                                  <span className="inline-flex items-center gap-1.5" style={{ color: "var(--ink)" }}>
                                    {d.desc}
                                    <BotaoCopiar texto={d.desc} chave={`defd-${a.id}-${i}`} copiado={copiado} onCopiar={copiar} />
                                  </span>
                                )}
                                {d.peca && (
                                  <div className="flex items-center gap-1.5" style={{ color: "var(--muted)" }}>
                                    peça: {d.peca}
                                    <BotaoCopiar texto={d.peca} chave={`defp-${a.id}-${i}`} copiado={copiado} onCopiar={copiar} />
                                  </div>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
        </table>
      </div>

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
    </div>
  );
});

export default TabelaAgAbertura;
