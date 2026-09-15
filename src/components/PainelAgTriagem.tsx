"use client";

import { useRef, useState } from "react";
import { ArrowRightCircle } from "lucide-react";
import TabelaAgAbertura, { type AparelhoAgAbertura, type TabelaAgAberturaHandle } from "@/components/TabelaAgAbertura";
import PopupBipagemTriagem from "@/components/PopupBipagemTriagem";
import PopupConfirmar from "@/components/PopupConfirmar";
import { temFuncaoCompletaNaEtapa } from "@/lib/usuarios";
import { STATUS_AG_TRIAGEM } from "@/lib/orcamentos";

type Perfil = { cargo: string; is_master: boolean } | null;

// Tela de Ag. Triagem: o popup de bipar um por um (que já existia) é o
// único lugar que imprime etiqueta. A seleção em massa na tabela (com
// "selecionar todos") NÃO imprime nada — só avança de uma vez os
// aparelhos marcados pra 2 - Ag. Análise, pra liberar o lote sem
// disparar dezenas de impressões de uma vez.
//
// Cargo Operacional (sem is_master) só tem função em Ag. Abertura — aqui
// (e em qualquer outra etapa do Painel) fica só consulta: sem popup de
// bipagem/impressão, sem seleção em massa, e a tabela reaproveitada
// (TabelaAgAbertura) entra em modo somenteLeitura (sem editar OS
// Reparadora nem Reprovar). Cargo Triagem/OQC é o oposto: função
// completa É AQUI (junto com OQC), então tem tudo isso liberado mesmo
// sem is_master — ver ETAPAS_LIBERADAS_POR_CARGO_RESTRITO em
// lib/usuarios.ts.
export default function PainelAgTriagem({
  aparelhos,
  mensagemVazia,
  perfil = null,
}: {
  aparelhos: AparelhoAgAbertura[];
  mensagemVazia?: string;
  perfil?: Perfil;
}) {
  const apenasVisualizacao = !temFuncaoCompletaNaEtapa(perfil, STATUS_AG_TRIAGEM);
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
      {!apenasVisualizacao && <PopupBipagemTriagem />}

      {!apenasVisualizacao && selecionados.size > 0 && (
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
        selecionavel={!apenasVisualizacao}
        selecionados={selecionados}
        aoAlternarSelecao={alternarSelecao}
        aoAlternarTodos={alternarTodos}
        somenteLeitura={apenasVisualizacao}
      />

      {!apenasVisualizacao && confirmando && (
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
