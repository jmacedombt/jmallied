"use client";

import { useState } from "react";
import { AlertTriangle, Loader2, Undo2, X } from "lucide-react";
import { type AparelhoAgEmissaoNf } from "@/components/PainelAgEmissaoNf";
import PopupConfirmar from "@/components/PopupConfirmar";
import {
  podeVoltarEtapaAgEmissaoNf,
  podeVoltarEtapaSemNfLancada,
  statusAnteriorAgEmissaoNf,
  type CamposNotaFiscal,
} from "@/lib/orcamentos";

type Perfil = { cargo: string; is_master: boolean } | null;

function formatarReal(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// cor de fundo de cada coluna de NF — só pra diferenciar visualmente uma
// da outra na tabela (pedido explícito), sem nenhum outro significado.
const FUNDO_NF_MAO_DE_OBRA = "rgba(59, 130, 246, 0.12)"; // azul
const FUNDO_NF_PECAS = "rgba(168, 85, 247, 0.12)"; // roxo
const FUNDO_NF_RETORNO = "rgba(249, 115, 22, 0.14)"; // laranja

function CelulaNf({ numero, valor, fundo }: { numero: string | null; valor: number | null; fundo: string }) {
  return (
    <td className="px-2.5 py-2 whitespace-nowrap" style={{ background: fundo }}>
      {numero ? (
        <>
          <p className="font-semibold leading-tight" style={{ color: "var(--ink)" }}>
            {numero}
          </p>
          <p className="text-[10px] leading-tight" style={{ color: "var(--muted)" }}>
            {formatarReal(valor ?? 0)}
          </p>
        </>
      ) : (
        <span style={{ color: "var(--muted)" }}>—</span>
      )}
    </td>
  );
}

/** Detalhe de uma NF Remessa dentro de "Ag. Emissão de Nota Fiscal" —
 * abre ao clicar na NF Remessa ou na Quantidade do resumo (ver
 * PainelAgEmissaoNf.tsx): lista os orçamentos daquele lote com os
 * dados principais, Pré Ordem em destaque, o valor individual de Mão
 * de Obra/Peças de cada um, e os números de NF já lançados (Mão de
 * Obra + Peças, só no bloco Aprovados, e Retorno nos dois blocos) —
 * cada um com uma cor de fundo diferente pra ressaltar.
 *
 * Coluna "Ação" (só pra quem tem permissão, ver podeVoltarEtapaAgEmissaoNf)
 * permite voltar UM orçamento pra etapa anterior (Reprovado ->
 * "8 - Orçamento Reprovado", Aprovado -> "7 - Reparo Finalizado") — só
 * enquanto nenhuma NF daquele orçamento já tiver sido lançada/exportada
 * (ver podeVoltarEtapaSemNfLancada). */
export default function PopupDetalheGrupoNf({
  nfRemessa,
  itens,
  mostrarNfMaoDeObraEPecas = false,
  perfil = null,
  onVoltarEtapaConcluida,
  onFechar,
}: {
  nfRemessa: string;
  itens: AparelhoAgEmissaoNf[];
  /** true só quando o grupo é do bloco Aprovados — Recusados não tem NF
   * de Mão de Obra/Peças, só Retorno. */
  mostrarNfMaoDeObraEPecas?: boolean;
  perfil?: Perfil;
  /** chamado depois de voltar um orçamento de etapa com sucesso — o pai
   * fecha esse pop-up e atualiza a lista (ver PainelAgEmissaoNf.tsx). */
  onVoltarEtapaConcluida?: () => void;
  onFechar: () => void;
}) {
  const [confirmando, setConfirmando] = useState<AparelhoAgEmissaoNf | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const podeVoltarEtapa = podeVoltarEtapaAgEmissaoNf(perfil);

  async function confirmarVoltarEtapa() {
    if (!confirmando) return;
    setEnviando(true);
    setErro(null);
    try {
      const res = await fetch(`/api/operacional/orcamentos/${confirmando.id}/voltar-etapa`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "Não foi possível voltar esse orçamento de etapa.");
      }
      setConfirmando(null);
      onVoltarEtapaConcluida?.();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível voltar esse orçamento de etapa.");
    }
    setEnviando(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3" style={{ background: "rgba(0,0,0,0.55)" }}>
      <div
        className="w-full max-w-[1700px] max-h-[92vh] rounded-2xl border shadow-2xl p-5 overflow-hidden flex flex-col"
        style={{ background: "var(--surface)", borderColor: "var(--line)" }}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold" style={{ color: "var(--ink)" }}>
            NF Remessa <span style={{ color: "var(--accent2)" }}>{nfRemessa}</span> — {itens.length} aparelho(s)
          </h2>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="w-7 h-7 flex items-center justify-center rounded-md transition hover:bg-[var(--surface2)]"
            style={{ color: "var(--muted)" }}
          >
            <X size={16} />
          </button>
        </div>

        <div className="rounded-xl border overflow-auto" style={{ borderColor: "var(--line)" }}>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left" style={{ background: "var(--surface2)", color: "var(--muted)" }}>
                <th className="px-2.5 py-2 font-medium">OS Reparadora</th>
                <th className="px-2.5 py-2 font-medium">Trade Allied</th>
                <th className="px-2.5 py-2 font-medium">OS Care Allied</th>
                <th className="px-2.5 py-2 font-medium">Modelo comercial</th>
                <th className="px-2.5 py-2 font-medium">SKU</th>
                <th className="px-2.5 py-2 font-medium" style={{ background: "rgba(250, 204, 21, 0.14)" }}>
                  Pré Ordem
                </th>
                <th className="px-2.5 py-2 font-medium text-right">Mão de Obra</th>
                <th className="px-2.5 py-2 font-medium text-right">Venda Peças</th>
                {mostrarNfMaoDeObraEPecas && (
                  <th className="px-2.5 py-2 font-medium" style={{ background: FUNDO_NF_MAO_DE_OBRA }}>
                    NF Mão de Obra
                  </th>
                )}
                {mostrarNfMaoDeObraEPecas && (
                  <th className="px-2.5 py-2 font-medium" style={{ background: FUNDO_NF_PECAS }}>
                    NF Peças
                  </th>
                )}
                <th className="px-2.5 py-2 font-medium" style={{ background: FUNDO_NF_RETORNO }}>
                  NF Retorno
                </th>
                {podeVoltarEtapa && <th className="px-2.5 py-2 font-medium">Ação</th>}
              </tr>
            </thead>
            <tbody>
              {itens.map((a) => {
                const statusAnterior = statusAnteriorAgEmissaoNf(a.status_operacional);
                const semNfLancada = podeVoltarEtapaSemNfLancada(a as CamposNotaFiscal);
                return (
                  <tr key={a.id} className="border-t" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
                    <td className="px-2.5 py-2 font-medium whitespace-nowrap" style={{ color: "var(--ink)" }}>
                      {a.os_reparadora || "—"}
                    </td>
                    <td className="px-2.5 py-2 whitespace-nowrap" style={{ color: "var(--ink)" }}>
                      {a.trade_allied}
                    </td>
                    <td className="px-2.5 py-2 whitespace-nowrap" style={{ color: "var(--muted)" }}>
                      {a.os_care_allied}
                    </td>
                    <td
                      className="px-2.5 py-2 max-w-[160px] truncate"
                      style={{ color: "var(--muted)" }}
                      title={a.modelo_comercial ?? ""}
                    >
                      {a.modelo_comercial}
                    </td>
                    <td className="px-2.5 py-2 whitespace-nowrap" style={{ color: "var(--muted)" }}>
                      {a.sku}
                    </td>
                    <td className="px-2.5 py-2 font-semibold whitespace-nowrap" style={{ background: "rgba(250, 204, 21, 0.14)", color: "var(--ink)" }}>
                      {a.pre_ordem || "—"}
                    </td>
                    <td className="px-2.5 py-2 text-right whitespace-nowrap" style={{ color: "var(--ink)" }}>
                      {formatarReal(a.maoDeObra)}
                    </td>
                    <td className="px-2.5 py-2 text-right whitespace-nowrap" style={{ color: "var(--ink)" }}>
                      {formatarReal(a.vendaPecas)}
                    </td>
                    {mostrarNfMaoDeObraEPecas && (
                      <CelulaNf numero={a.nf_mao_de_obra_numero} valor={a.nf_mao_de_obra_valor} fundo={FUNDO_NF_MAO_DE_OBRA} />
                    )}
                    {mostrarNfMaoDeObraEPecas && (
                      <CelulaNf numero={a.nf_pecas_numero} valor={a.nf_pecas_valor} fundo={FUNDO_NF_PECAS} />
                    )}
                    <CelulaNf numero={a.nf_retorno_numero} valor={a.nf_retorno_valor} fundo={FUNDO_NF_RETORNO} />
                    {podeVoltarEtapa && (
                      <td className="px-2.5 py-2 whitespace-nowrap">
                        {statusAnterior && semNfLancada ? (
                          <button
                            type="button"
                            onClick={() => setConfirmando(a)}
                            title={`Voltar pra ${statusAnterior}`}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition hover:bg-[var(--surface2)]"
                            style={{ borderColor: "var(--line)", color: "var(--ink)" }}
                          >
                            <Undo2 size={13} />
                            Voltar Etapa
                          </button>
                        ) : (
                          <span
                            className="text-[10px]"
                            style={{ color: "var(--muted)" }}
                            title={!statusAnterior ? undefined : "Já tem NF lançada/exportada — não é mais possível voltar de etapa."}
                          >
                            —
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {confirmando && (
        <PopupConfirmar
          titulo="Voltar Etapa"
          mensagem={
            <>
              Voltar o orçamento <strong style={{ color: "var(--ink)" }}>{confirmando.trade_allied}</strong> (OS Reparadora{" "}
              {confirmando.os_reparadora || "—"}) pra{" "}
              <strong style={{ color: "var(--ink)" }}>{statusAnteriorAgEmissaoNf(confirmando.status_operacional)}</strong>?
              <br />
              Ele sai de Ag. Emissão de Nota Fiscal e volta pra etapa anterior.
            </>
          }
          rotuloConfirmar="Voltar Etapa"
          perigo
          carregando={enviando}
          erro={erro}
          onConfirmar={confirmarVoltarEtapa}
          onFechar={() => {
            setConfirmando(null);
            setErro(null);
          }}
        />
      )}
    </div>
  );
}
