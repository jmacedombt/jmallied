"use client";

import { useRef, useState } from "react";
import { ArrowRightCircle } from "lucide-react";
import TabelaAgAbertura, { type AparelhoAgAbertura, type TabelaAgAberturaHandle } from "@/components/TabelaAgAbertura";
import PopupBipagemTriagem from "@/components/PopupBipagemTriagem";
import PopupConfirmar from "@/components/PopupConfirmar";

// Tela de Ag. Triagem: o popup de bipar um por um (que já existia) é o
// único lugar que imprime etiqueta. A seleção em massa na tabela (com
// "selecionar todos") NÃO imprime nada — só avança de uma vez os
// aparelhos marcados pra 2 - Ag. Análise, pra liberar o lote sem
// disparar dezenas de impressões de uma vez.
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

    const idsSelecionados = Array.from(selecionados);
    const itens = idsSelecionados.map((id) => ({
      id,
      executar: async () => {
        try {
          const res = await fetch(`/api/operacional/orcamentos/${id}/avancar-triagem`, { method: "POST" });
          const data = await res.json();
          if (!res.ok) return { ok: false, erro: data.error || "Não foi possível avançar esse aparelho." };
          return { ok: true };
        } catch {
          return { ok: false, erro: "Falha de conexão." };
        }
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
          <ArrowRightCircle size={15} />
          Avançar para Ag. Análise ({selecionados.size})
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
          titulo="Avançar para Ag. Análise"
          carregando={processando}
          rotuloConfirmar={`Avançar ${selecionados.size}`}
          mensagem={
            <>
              Vou avançar <strong style={{ color: "var(--ink)" }}>{selecionados.size}</strong> aparelho(s)
              selecionado(s) direto para <strong style={{ color: "var(--ink)" }}>2 - Ag. Análise</strong>, um por
              um — <strong style={{ color: "var(--ink)" }}>sem imprimir etiqueta</strong> (a impressão continua sendo
              feita bipando no popup acima).
            </>
          }
          onConfirmar={confirmarLote}
          onFechar={() => setConfirmando(false)}
        />
      )}
    </div>
  );
}
