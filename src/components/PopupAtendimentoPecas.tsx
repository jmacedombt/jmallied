"use client";

import { useState } from "react";
import { Check, Copy, FileEdit, PackageSearch, Undo2, X } from "lucide-react";
import {
  type DetalheValidacaoOrcamento,
  type InfoNotaFiscal,
  STATUS_DESTINO_RETROCEDER_PRODUTO_ENTREGUE,
} from "@/lib/orcamentos";
import PopupNfEmissao from "@/components/PopupNfEmissao";
import PopupConfirmar from "@/components/PopupConfirmar";

export type AparelhoAtendimentoPecas = {
  os_reparadora: string | null;
  trade_allied: string;
  os_care_allied: string | null;
  modelo_comercial: string | null;
  sku: string | null;
  descricao_completa: string | null;
  validacao_snapshot: DetalheValidacaoOrcamento | null;
};

/** Notas fiscais já lançadas em "Ag. Emissão de Nota Fiscal" (ver
 * migration 0048 e PainelAgEmissaoNf.tsx) — só é passado quando o
 * aparelho já está em "Produto Entregue" (ver PainelEtapaSimples.tsx),
 * pra dar pra corrigir um número/valor digitado errado mesmo depois de
 * já ter saído daquela tela. */
export type NotasFiscaisAtendimento = {
  id: string;
  maoDeObra: InfoNotaFiscal | null;
  pecas: InfoNotaFiscal | null;
  retorno: InfoNotaFiscal | null;
};

const FUNDO_NF_MAO_DE_OBRA = "rgba(59, 130, 246, 0.12)";
const FUNDO_NF_PECAS = "rgba(168, 85, 247, 0.12)";
const FUNDO_NF_RETORNO = "rgba(249, 115, 22, 0.14)";

function formatarReal(valor: number | null): string {
  return (valor ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Pop-up com os dados do atendimento — abre ao clicar numa linha de
// "5 - Ag. Peças" (ver PainelAgPecas.tsx). Mostra as peças e os valores
// já apurados/travados na Validação de Orçamentos (validacao_snapshot,
// congelado no "Confirmar Envio" — o mesmo valor que foi enviado e
// aprovado pela Allied, não recalcula nada aqui). Cada código de peça
// tem um botão "copiar" ao lado pra ajudar a fazer o pedido em outro
// sistema (BID Samsung, por exemplo) sem digitar/errar o Part Number.
export default function PopupAtendimentoPecas({
  aparelho,
  onFechar,
  notasFiscais,
  podeEditarNf = false,
  onNfAtualizada,
  podeRetroceder = false,
  onRetrocedido,
}: {
  aparelho: AparelhoAtendimentoPecas;
  onFechar: () => void;
  /** só vem preenchido quando o aparelho já está em "Produto Entregue" —
   * mostra os números de NF lançados em Ag. Emissão de Nota Fiscal. */
  notasFiscais?: NotasFiscaisAtendimento;
  /** libera corrigir os números depois de entregue (mesmo cargo que já
   * lança as NFs na tela — ver podeLancarNfProdutoEntregue). */
  podeEditarNf?: boolean;
  onNfAtualizada?: () => void;
  /** libera "Retroceder Etapa" (pedido explícito) — só Administrador ou
   * Gerente, ver podeRetrocederProdutoEntregue. Só faz sentido junto de
   * `notasFiscais` (aparelho já em Produto Entregue). */
  podeRetroceder?: boolean;
  onRetrocedido?: () => void;
}) {
  const [copiado, setCopiado] = useState<string | null>(null);
  const [editandoNf, setEditandoNf] = useState<null | { tipo: "mao_de_obra" | "pecas" | "retorno"; titulo: string; valorInicial: InfoNotaFiscal | null }>(
    null
  );
  const [retrocedendo, setRetrocedendo] = useState(false);
  const [statusEscolhido, setStatusEscolhido] = useState<string>(STATUS_DESTINO_RETROCEDER_PRODUTO_ENTREGUE[0]?.valor ?? "");
  const [confirmandoRetrocesso, setConfirmandoRetrocesso] = useState(false);
  const [enviandoRetrocesso, setEnviandoRetrocesso] = useState(false);
  const [erroRetrocesso, setErroRetrocesso] = useState<string | null>(null);

  async function confirmarRetrocesso() {
    if (!notasFiscais) return;
    setEnviandoRetrocesso(true);
    setErroRetrocesso(null);
    try {
      const res = await fetch(`/api/operacional/orcamentos/${notasFiscais.id}/retroceder-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status_operacional: statusEscolhido }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "Não foi possível retroceder esse orçamento.");
      }
      setConfirmandoRetrocesso(false);
      setRetrocedendo(false);
      onRetrocedido?.();
    } catch (e) {
      setErroRetrocesso(e instanceof Error ? e.message : "Não foi possível retroceder esse orçamento.");
    }
    setEnviandoRetrocesso(false);
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

  const detalhe = aparelho.validacao_snapshot;
  const pecas = detalhe?.pecas ?? [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)" }}
      onClick={onFechar}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border shadow-2xl p-6 max-h-[85vh] overflow-y-auto"
        style={{ background: "var(--surface)", borderColor: "var(--line)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold flex items-center gap-2" style={{ color: "var(--ink)" }}>
            <PackageSearch size={18} style={{ color: "var(--accent2)" }} />
            Atendimento — {aparelho.trade_allied}
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

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5 text-xs">
          {[
            ["OS Reparadora", aparelho.os_reparadora || "—"],
            ["OS Care Allied", aparelho.os_care_allied || "—"],
            ["Modelo comercial", aparelho.modelo_comercial || "—"],
            ["SKU", aparelho.sku || "—"],
            ["Descrição", aparelho.descricao_completa || "—"],
          ].map(([rotulo, valor]) => (
            <div key={rotulo} className="rounded-lg border px-3 py-2" style={{ borderColor: "var(--line)", background: "var(--surface2)" }}>
              <p className="uppercase tracking-wide text-[10px] mb-0.5" style={{ color: "var(--muted)" }}>
                {rotulo}
              </p>
              <p className="font-medium" style={{ color: "var(--ink)" }} title={valor}>
                {valor}
              </p>
            </div>
          ))}
        </div>

        {!detalhe ? (
          <p className="text-sm text-center py-6" style={{ color: "var(--muted)" }}>
            Detalhe de peças não disponível pra esse orçamento.
          </p>
        ) : pecas.length === 0 ? (
          <p className="text-sm text-center py-6" style={{ color: "var(--muted)" }}>
            Esse orçamento não tem nenhuma peça lançada — só mão de obra ({formatarReal(detalhe.maoDeObra)}).
          </p>
        ) : (
          <div className="rounded-xl border overflow-hidden mb-4" style={{ borderColor: "var(--line)" }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left" style={{ background: "var(--surface2)", color: "var(--muted)" }}>
                  <th className="px-3 py-2 font-medium">Posição</th>
                  <th className="px-3 py-2 font-medium">Part Number</th>
                  <th className="px-3 py-2 font-medium text-right">Custo</th>
                  <th className="px-3 py-2 font-medium text-right">Venda de Peça</th>
                </tr>
              </thead>
              <tbody>
                {pecas.map((p) => (
                  <tr key={p.posicao} className="border-t" style={{ borderColor: "var(--line)" }}>
                    <td className="px-3 py-2" style={{ color: "var(--muted)" }}>
                      {p.posicao}
                    </td>
                    <td className="px-3 py-2 font-medium" style={{ color: "var(--ink)" }}>
                      <span className="inline-flex items-center gap-1.5">
                        {p.codigo}
                        <button
                          type="button"
                          onClick={() => copiar(p.codigo, p.posicao)}
                          title="Copiar Part Number"
                          className="inline-flex items-center justify-center w-6 h-6 rounded-md border transition hover:border-[var(--accent2)]"
                          style={{ borderColor: "var(--line)", color: "var(--muted)" }}
                        >
                          {copiado === p.posicao ? (
                            <Check size={12} className="text-emerald-500" />
                          ) : (
                            <Copy size={12} />
                          )}
                        </button>
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right" style={{ color: "var(--muted)" }}>
                      {formatarReal(p.custo)}
                    </td>
                    <td className="px-3 py-2 text-right font-medium" style={{ color: "var(--ink)" }}>
                      {formatarReal(p.vendaPeca)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {detalhe && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            {[
              ["Custo peças", formatarReal(detalhe.custoTotalPecas)],
              ["Imposto", formatarReal(detalhe.impostoTotalPecas)],
              ["Venda peças", formatarReal(detalhe.vendaTotalPecas)],
              ["Mão de obra", formatarReal(detalhe.maoDeObra)],
            ].map(([rotulo, valor]) => (
              <div key={rotulo} className="rounded-lg border px-3 py-2" style={{ borderColor: "var(--line)", background: "var(--surface2)" }}>
                <p className="uppercase tracking-wide text-[10px] mb-0.5" style={{ color: "var(--muted)" }}>
                  {rotulo}
                </p>
                <p className="font-semibold" style={{ color: "var(--ink)" }}>
                  {valor}
                </p>
              </div>
            ))}
          </div>
        )}

        {notasFiscais && (
          <div className="mt-4 pt-4 border-t" style={{ borderColor: "var(--line)" }}>
            <p className="text-xs font-semibold mb-2" style={{ color: "var(--ink)" }}>
              Notas Fiscais
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              {(
                [
                  ["mao_de_obra" as const, "NF Mão de Obra", notasFiscais.maoDeObra, FUNDO_NF_MAO_DE_OBRA],
                  ["pecas" as const, "NF Peças", notasFiscais.pecas, FUNDO_NF_PECAS],
                  ["retorno" as const, "NF Retorno", notasFiscais.retorno, FUNDO_NF_RETORNO],
                ] as const
              ).map(([tipo, rotulo, info, fundo]) => (
                <div key={tipo} className="rounded-lg border px-3 py-2 flex items-center justify-between gap-2" style={{ borderColor: "var(--line)", background: fundo }}>
                  <div>
                    <p className="uppercase tracking-wide text-[10px] mb-0.5" style={{ color: "var(--muted)" }}>
                      {rotulo}
                    </p>
                    {info ? (
                      <>
                        <p className="font-semibold" style={{ color: "var(--ink)" }}>
                          {info.numero}
                        </p>
                        <p className="text-[11px]" style={{ color: "var(--muted)" }}>
                          {formatarReal(info.valor)}
                        </p>
                      </>
                    ) : (
                      <p style={{ color: "var(--muted)" }}>—</p>
                    )}
                  </div>
                  {podeEditarNf && (
                    <button
                      type="button"
                      onClick={() => setEditandoNf({ tipo, titulo: rotulo, valorInicial: info })}
                      title={`Corrigir ${rotulo}`}
                      className="inline-flex items-center justify-center w-7 h-7 rounded-md border shrink-0 transition hover:border-[var(--accent2)]"
                      style={{ borderColor: "var(--line)", color: "var(--muted)", background: "var(--surface)" }}
                    >
                      <FileEdit size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {podeRetroceder && (
              <div className="mt-3 pt-3 border-t" style={{ borderColor: "var(--line)" }}>
                {!retrocedendo ? (
                  <button
                    type="button"
                    onClick={() => setRetrocedendo(true)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition hover:bg-[var(--surface2)]"
                    style={{ borderColor: "var(--line)", color: "#ef4444" }}
                  >
                    <Undo2 size={13} />
                    Retroceder Etapa
                  </button>
                ) : (
                  <div className="rounded-lg border px-3 py-3" style={{ borderColor: "var(--line)", background: "var(--surface2)" }}>
                    <p className="text-[11px] mb-2" style={{ color: "var(--muted)" }}>
                      Escolha pra qual etapa esse orçamento deve voltar. As 3 NFs (Mão de Obra, Peças e Retorno) e a
                      data de exportação são apagadas ao confirmar.
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <select
                        value={statusEscolhido}
                        onChange={(e) => setStatusEscolhido(e.target.value)}
                        className="rounded-lg border px-2.5 py-1.5 text-xs flex-1 min-w-[180px]"
                        style={{ borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink)" }}
                      >
                        {STATUS_DESTINO_RETROCEDER_PRODUTO_ENTREGUE.map((s) => (
                          <option key={s.slug} value={s.valor}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setConfirmandoRetrocesso(true)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition hover:bg-[var(--surface)]"
                        style={{ borderColor: "#ef4444", color: "#ef4444" }}
                      >
                        <Undo2 size={13} />
                        Retroceder
                      </button>
                      <button
                        type="button"
                        onClick={() => setRetrocedendo(false)}
                        className="px-2.5 py-1.5 text-xs font-medium transition hover:underline"
                        style={{ color: "var(--muted)" }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {confirmandoRetrocesso && notasFiscais && (
        <PopupConfirmar
          titulo="Retroceder Etapa"
          mensagem={
            <>
              Retroceder o orçamento <strong style={{ color: "var(--ink)" }}>{aparelho.trade_allied}</strong> (OS
              Reparadora {aparelho.os_reparadora || "—"}) de <strong style={{ color: "var(--ink)" }}>Produto Entregue</strong> pra{" "}
              <strong style={{ color: "var(--ink)" }}>{statusEscolhido}</strong>?
              <br />
              As NFs de Mão de Obra, Peças e Retorno já lançadas (e a data de exportação) vão ser apagadas. Essa ação
              não pode ser desfeita.
            </>
          }
          rotuloConfirmar="Retroceder Etapa"
          perigo
          carregando={enviandoRetrocesso}
          erro={erroRetrocesso}
          onConfirmar={confirmarRetrocesso}
          onFechar={() => {
            setConfirmandoRetrocesso(false);
            setErroRetrocesso(null);
          }}
        />
      )}

      {editandoNf && notasFiscais && (
        <PopupNfEmissao
          titulo={editandoNf.titulo}
          escopo={
            editandoNf.tipo === "retorno"
              ? "Corrige o Nº da NF já lançado — o aparelho continua em Produto Entregue."
              : "Corrige o Nº da NF já lançado — o valor (total automático) é mantido igual ao já gravado."
          }
          valorInicial={editandoNf.valorInicial}
          valorAutomatico={editandoNf.tipo !== "retorno" ? editandoNf.valorInicial?.valor ?? 0 : undefined}
          onFechar={() => setEditandoNf(null)}
          onSalvar={async (info) => {
            const res = await fetch("/api/operacional/orcamentos/salvar-nf", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ids: [notasFiscais.id], tipo: editandoNf.tipo, numero: info.numero, valor: info.valor }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) {
              throw new Error(data?.error || "Não foi possível salvar essa NF.");
            }
            setEditandoNf(null);
            onNfAtualizada?.();
          }}
        />
      )}
    </div>
  );
}
