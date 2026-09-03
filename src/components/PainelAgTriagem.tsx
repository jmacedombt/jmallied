"use client";

import { useRef, useState } from "react";
import { Printer } from "lucide-react";
import TabelaAgAbertura, { type AparelhoAgAbertura, type TabelaAgAberturaHandle } from "@/components/TabelaAgAbertura";
import PopupBipagemTriagem from "@/components/PopupBipagemTriagem";
import PopupConfirmar from "@/components/PopupConfirmar";
import { processarBipagem } from "@/lib/etiquetas";

// Tela de Ag. Triagem: além do popup de bipar um por um (que já existia),
// dá pra selecionar várias linhas na tabela e mandar imprimir + avançar
// tudo de uma vez — reaproveitando exatamente o mesmo fluxo de
// localizar/imprimir/confirmar do popup, só que disparado em sequência
// pra cada linha marcada.
export default function PainelAgTriagem({
  aparelhos,
  mensagemVazia,
}: {
  aparelhos: AparelhoAgAbertura[];
  mensagemVazia?: string;
}) {
  const tabelaRef = useRef<TabelaAgAberturaHandle>(null);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [confirmando, setConfirmando] = useState(false);
  const [processando, setProcessando] = useState(false);

  function alternarSelecao(id: string) {
    setSelecionados((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  function alternarTodos() {
    setSelecionados((atual) => {
      const todosMarcados = aparelhos.length > 0 && aparelhos.every((a) => atual.has(a.id));
      return todosMarcados ? new Set() : new Set(aparelhos.map((a) => a.id));
    });
  }

  async function confirmarLote() {
    setProcessando(true);

    const mapaPorId = new Map(aparelhos.map((a) => [a.id, a]));
    const itens = Array.from(selecionados)
      .map((id) => mapaPorId.get(id))
      .filter((a): a is AparelhoAgAbertura => !!a)
      .map((a) => ({
        id: a.id,
        executar: async () => {
          const resultado = await processarBipagem(a.trade_allied, "triagem");
          return { ok: resultado.ok, erro: resultado.ok ? undefined : resultado.mensagem };
        },
      }));

    setConfirmando(false);
    setSelecionados(new Set());
    await tabelaRef.current?.processarLote(itens);
    setProcessando(false);
  }

  return (
    <div className="space-y-3">
      <PopupBipagemTriagem />

      {selecionados.size > 0 && (
        <button
          type="button"
          onClick={() => setConfirmando(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent2)] text-white text-sm font-medium px-4 py-2.5 transition"
          style={{ boxShadow: "0 0 30px var(--accent-glow)" }}
        >
          <Printer size={15} />
          Confirmar triagem/impressão ({selecionados.size})
        </button>
      )}

      <TabelaAgAbertura
        ref={tabelaRef}
        aparelhos={aparelhos}
        mensagemVazia={mensagemVazia}
        selecionavel
        selecionados={selecionados}
        aoAlternarSelecao={alternarSelecao}
        aoAlternarTodos={alternarTodos}
      />

      {confirmando && (
        <PopupConfirmar
          titulo="Confirmar triagem/impressão"
          carregando={processando}
          rotuloConfirmar={`Confirmar ${selecionados.size}`}
          mensagem={
            <>
              Vou imprimir a etiqueta e avançar <strong style={{ color: "var(--ink)" }}>{selecionados.size}</strong>{" "}
              aparelho(s) selecionado(s) para <strong style={{ color: "var(--ink)" }}>2 - Ag. Análise</strong>, um
              por um.
            </>
          }
          onConfirmar={confirmarLote}
          onFechar={() => setConfirmando(false)}
        />
      )}
    </div>
  );
}
