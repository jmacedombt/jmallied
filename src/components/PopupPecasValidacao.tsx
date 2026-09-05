"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Check,
  History,
  Loader2,
  Lock,
  PackageSearch,
  Pencil,
  PlusCircle,
  Save,
  Unlock,
  X,
} from "lucide-react";
import { type DetalheValidacaoOrcamento } from "@/lib/orcamentos";
import { type FaixaMarkup } from "@/lib/bid";
import PopupCadastrarPecaBase from "@/components/PopupCadastrarPecaBase";
import PopupConfirmar from "@/components/PopupConfirmar";
import TooltipCalculoBid, { type PecaParaTooltip } from "@/components/TooltipCalculoBid";
import { corPercentualLucro } from "@/components/CelulaLucroPercentual";
import { formatarDataHoraBrasilia } from "@/lib/tempo";

function formatarPercentual(valor: number): string {
  return `${valor.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

type Usuario = { nome: string; sobrenome: string } | { nome: string; sobrenome: string }[] | null;

function nomeUsuario(usuarios: Usuario): string | null {
  const u = Array.isArray(usuarios) ? usuarios[0] : usuarios;
  return u ? `${u.nome} ${u.sobrenome}` : null;
}

export type AparelhoValidacaoDetalhe = DetalheValidacaoOrcamento & {
  id: string;
  nf_remessa_allied: string;
  os_reparadora: string | null;
  trade_allied: string;
  validacaoConfirmadoSemPeca: boolean;
  /** true quando Venda de Peças/Lucro/Mão de obra foram ajustados à mão
   * (ver lápis no resumo abaixo) — nesse caso os totais vêm congelados do
   * banco, não recalculados pela Base Peças. */
  ajustadoManualmente: boolean;
  ajustadoEm: string | null;
  ajustadoPor: Usuario;
};

function formatarReal(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// valores do resumo enquanto o modo de edição manual está aberto —
// sempre os 4 "graus de liberdade" reais (Venda, Custo, Imposto e Mão de
// obra); Lucro Líquido da Peça e Lucro Total são sempre derivados deles
// na hora de exibir (nunca guardados soltos, pra nunca ficar
// inconsistente com a própria conta).
type RascunhoAjuste = {
  venda: number;
  custo: number;
  imposto: number;
  maoDeObra: number;
};

function lucroLiquidoPecaDe(r: RascunhoAjuste): number {
  return r.venda - r.custo - r.imposto;
}
function lucroTotalDe(r: RascunhoAjuste): number {
  return lucroLiquidoPecaDe(r) + r.maoDeObra;
}

// campo numérico de texto livre — deixa digitar "12,50" (vírgula, padrão
// brasileiro) e só converte pra número ao processar; nunca trava o
// usuário no meio da digitação (por isso não é <input type="number">).
function paraNumero(texto: string): number {
  const limpo = texto.replace(/\./g, "").replace(",", ".").trim();
  const n = Number(limpo);
  return Number.isFinite(n) ? n : 0;
}

// Pop-up com o detalhe de um orçamento em Validação de Orçamentos: valor
// da mão de obra, código de cada peça lançada e o custo/imposto/venda
// dela (sempre a partir do valor mais recente da Base Peças). Peça sem
// custo fica em vermelho com botão pra cadastrar na hora; aparelho sem
// nenhuma peça lançada mostra um botão pra confirmar que vai seguir
// assim mesmo (só mão de obra) — enquanto não confirmado, bloqueia o
// avanço do lote inteiro. A coluna "Venda de Peças" mostra, ao passar o
// mouse, o passo a passo completo do cálculo (mesmo balão usado no BID:
// faixa aplicada, markup usado, valor com margem, imposto e arredonda-
// mento) — pra não ter dois jeitos diferentes de explicar a mesma conta.
export default function PopupPecasValidacao({
  aparelho,
  faixas,
  icmsPercentual,
  podeCadastrarPeca,
  podeConfirmarSemPeca,
  podeAjustarValores,
  onAtualizado,
  onFechar,
}: {
  aparelho: AparelhoValidacaoDetalhe;
  faixas: FaixaMarkup[];
  icmsPercentual: number;
  podeCadastrarPeca: boolean;
  podeConfirmarSemPeca: boolean;
  /** libera o lápis que abre a edição manual de Venda de Peças, Lucro
   * Líquido da Peça, Mão de obra e Lucro Total no resumo — mesmo cargo
   * que já confirma o envio de um lote. */
  podeAjustarValores: boolean;
  onAtualizado: () => void;
  onFechar: () => void;
}) {
  const [cadastrando, setCadastrando] = useState<string | null>(null);
  const [confirmandoSemPeca, setConfirmandoSemPeca] = useState(false);
  const [erroConfirmar, setErroConfirmar] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ peca: PecaParaTooltip; x: number; y: number } | null>(null);

  // edição manual dos totais do resumo (ver RascunhoAjuste acima) —
  // `ajuste` é sempre a fonte da verdade enquanto `editando` está ativo;
  // os 4 textos são só o que aparece em cada input (permite digitar
  // vírgula/decimais sem o campo "pular" o valor a cada tecla).
  const [editando, setEditando] = useState(false);
  const [ajuste, setAjuste] = useState<RascunhoAjuste | null>(null);
  const [textoVenda, setTextoVenda] = useState("");
  const [textoLucroPeca, setTextoLucroPeca] = useState("");
  const [textoMaoDeObra, setTextoMaoDeObra] = useState("");
  const [textoLucroTotal, setTextoLucroTotal] = useState("");
  const [confirmandoSalvar, setConfirmandoSalvar] = useState(false);
  const [confirmandoReverter, setConfirmandoReverter] = useState(false);
  const [salvandoAjuste, setSalvandoAjuste] = useState(false);
  const [erroAjuste, setErroAjuste] = useState<string | null>(null);

  async function confirmarSemPeca() {
    setConfirmandoSemPeca(true);
    setErroConfirmar(null);
    try {
      const res = await fetch(`/api/operacional/orcamentos/${aparelho.id}/confirmar-sem-peca`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setErroConfirmar(data?.error || "Não foi possível confirmar.");
        setConfirmandoSemPeca(false);
        return;
      }
      onAtualizado();
    } catch {
      setErroConfirmar("Falha de conexão. Tente novamente.");
      setConfirmandoSemPeca(false);
    }
  }

  function mostrarTooltip(e: React.MouseEvent, peca: PecaParaTooltip) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setTooltip({ peca, x: Math.max(8, rect.left - 260), y: rect.top });
  }

  function formatarInputNumero(valor: number): string {
    return valor.toFixed(2).replace(".", ",");
  }

  function iniciarEdicao() {
    const inicial: RascunhoAjuste = {
      venda: aparelho.vendaTotalPecas,
      custo: aparelho.custoTotalPecas,
      imposto: aparelho.impostoTotalPecas,
      maoDeObra: aparelho.maoDeObra,
    };
    setAjuste(inicial);
    setTextoVenda(formatarInputNumero(inicial.venda));
    setTextoLucroPeca(formatarInputNumero(lucroLiquidoPecaDe(inicial)));
    setTextoMaoDeObra(formatarInputNumero(inicial.maoDeObra));
    setTextoLucroTotal(formatarInputNumero(lucroTotalDe(inicial)));
    setErroAjuste(null);
    setEditando(true);
  }

  function cancelarEdicao() {
    setEditando(false);
    setAjuste(null);
    setErroAjuste(null);
  }

  // editar a Venda recalcula o Lucro da Peça (Custo/Imposto ficam fixos
  // durante a edição) e, por tabela, o Lucro Total.
  function aoEditarVenda(texto: string) {
    setTextoVenda(texto);
    if (!ajuste) return;
    const novo: RascunhoAjuste = { ...ajuste, venda: paraNumero(texto) };
    setAjuste(novo);
    setTextoLucroPeca(formatarInputNumero(lucroLiquidoPecaDe(novo)));
    setTextoLucroTotal(formatarInputNumero(lucroTotalDe(novo)));
  }

  // editar o Lucro da Peça faz o caminho inverso: recalcula a Venda
  // (Lucro + Custo + Imposto) e, por tabela, o Lucro Total.
  function aoEditarLucroPeca(texto: string) {
    setTextoLucroPeca(texto);
    if (!ajuste) return;
    const lucroPeca = paraNumero(texto);
    const venda = lucroPeca + ajuste.custo + ajuste.imposto;
    const novo: RascunhoAjuste = { ...ajuste, venda };
    setAjuste(novo);
    setTextoVenda(formatarInputNumero(venda));
    setTextoLucroTotal(formatarInputNumero(lucroTotalDe(novo)));
  }

  // editar a Mão de obra só mexe no Lucro Total — Venda e Lucro da Peça
  // não mudam.
  function aoEditarMaoDeObra(texto: string) {
    setTextoMaoDeObra(texto);
    if (!ajuste) return;
    const novo: RascunhoAjuste = { ...ajuste, maoDeObra: paraNumero(texto) };
    setAjuste(novo);
    setTextoLucroTotal(formatarInputNumero(lucroTotalDe(novo)));
  }

  // editar o Lucro Total mantém a Mão de obra fixa e ajusta o Lucro da
  // Peça (e, por tabela, a Venda) — ver pergunta feita ao Rafael sobre
  // essa regra.
  function aoEditarLucroTotal(texto: string) {
    setTextoLucroTotal(texto);
    if (!ajuste) return;
    const lucroTotal = paraNumero(texto);
    const lucroPeca = lucroTotal - ajuste.maoDeObra;
    const venda = lucroPeca + ajuste.custo + ajuste.imposto;
    const novo: RascunhoAjuste = { ...ajuste, venda };
    setAjuste(novo);
    setTextoVenda(formatarInputNumero(venda));
    setTextoLucroPeca(formatarInputNumero(lucroPeca));
  }

  async function salvarAjuste() {
    if (!ajuste) return;
    setSalvandoAjuste(true);
    setErroAjuste(null);
    try {
      const res = await fetch(`/api/operacional/orcamentos/${aparelho.id}/ajustar-valores`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          venda_pecas: ajuste.venda,
          custo_pecas: ajuste.custo,
          imposto_pecas: ajuste.imposto,
          mao_de_obra: ajuste.maoDeObra,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setErroAjuste(data?.error || "Não foi possível salvar os valores ajustados.");
        setSalvandoAjuste(false);
        return;
      }
      setConfirmandoSalvar(false);
      setSalvandoAjuste(false);
      cancelarEdicao();
      onAtualizado();
    } catch {
      setErroAjuste("Falha de conexão. Tente novamente.");
      setSalvandoAjuste(false);
    }
  }

  async function reverterAjuste() {
    setSalvandoAjuste(true);
    setErroAjuste(null);
    try {
      const res = await fetch(`/api/operacional/orcamentos/${aparelho.id}/ajustar-valores`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reverter: true }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setErroAjuste(data?.error || "Não foi possível restaurar o cálculo automático.");
        setSalvandoAjuste(false);
        return;
      }
      setConfirmandoReverter(false);
      setSalvandoAjuste(false);
      onAtualizado();
    } catch {
      setErroAjuste("Falha de conexão. Tente novamente.");
      setSalvandoAjuste(false);
    }
  }

  // valores exibidos no resumo: enquanto editando, sempre os derivados do
  // rascunho (nunca os do aparelho, que só atualizam depois do refresh).
  const percLucroPecasExibido = editando && ajuste
    ? ajuste.venda > 0
      ? (lucroLiquidoPecaDe(ajuste) / ajuste.venda) * 100
      : 0
    : aparelho.percLucroPecas;
  const percLucroTotalExibido = editando && ajuste
    ? ajuste.venda + ajuste.maoDeObra > 0
      ? (lucroTotalDe(ajuste) / (ajuste.venda + ajuste.maoDeObra)) * 100
      : 0
    : aparelho.percLucroTotal;

  const estiloInput: React.CSSProperties = {
    background: "var(--surface)",
    borderColor: "var(--accent2)",
    color: "var(--ink)",
    width: "9rem",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.55)" }}>
      <div
        className="w-full max-w-2xl rounded-2xl border shadow-2xl p-6"
        style={{ background: "var(--surface)", borderColor: "var(--line)" }}
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-semibold flex items-center gap-2" style={{ color: "var(--ink)" }}>
            <PackageSearch size={18} style={{ color: "var(--accent2)" }} />
            Peças do orçamento
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

        <p className="text-xs mb-4" style={{ color: "var(--muted)" }}>
          {aparelho.trade_allied} · OS Reparadora {aparelho.os_reparadora || "—"} · NF Remessa{" "}
          {aparelho.nf_remessa_allied}
        </p>

        {aparelho.pecas.length === 0 ? (
          <div
            className="rounded-xl border p-4 mb-4 space-y-3"
            style={{ borderColor: "#eab308", background: "rgba(234, 179, 8, 0.08)" }}
          >
            <p className="text-sm flex items-center gap-1.5" style={{ color: "#a16207" }}>
              <AlertTriangle size={14} />
              Nenhuma peça lançada pra esse orçamento ainda.
            </p>
            {aparelho.validacaoConfirmadoSemPeca ? (
              <p className="text-xs flex items-center gap-1.5" style={{ color: "var(--muted)" }}>
                <Check size={13} className="text-emerald-500" />
                Já confirmado — esse aparelho vai seguir sem peça, só com mão de obra.
              </p>
            ) : (
              <>
                <p className="text-xs" style={{ color: "var(--muted)" }}>
                  Se realmente não tem peça nesse reparo, confirme abaixo pra liberar o avanço do lote.
                </p>
                <button
                  type="button"
                  onClick={confirmarSemPeca}
                  disabled={!podeConfirmarSemPeca || confirmandoSemPeca}
                  className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: "#eab308" }}
                  title={podeConfirmarSemPeca ? undefined : "Seu cargo não tem permissão pra confirmar isso."}
                >
                  {confirmandoSemPeca ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                  Confirmar que segue sem peça
                </button>
                {erroConfirmar && <p className="text-xs text-red-500">{erroConfirmar}</p>}
              </>
            )}
          </div>
        ) : (
          <div className="rounded-xl border overflow-hidden mb-4" style={{ borderColor: "var(--line)" }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left" style={{ background: "var(--surface2)", color: "var(--muted)" }}>
                  <th className="px-3 py-2 font-medium">#</th>
                  <th className="px-3 py-2 font-medium">Código da peça</th>
                  <th className="px-3 py-2 font-medium text-right">Custo (Base Peças)</th>
                  <th className="px-3 py-2 font-medium text-right">Imposto (ICMS)</th>
                  <th className="px-3 py-2 font-medium text-right">Venda de Peças</th>
                </tr>
              </thead>
              <tbody>
                {aparelho.pecas.map((p) => {
                  const pecaTooltip: PecaParaTooltip = {
                    custo_peca_samsung: p.custo,
                    valor_com_margem: p.valorComMargem,
                    custo_peca_allied: p.vendaPeca,
                    valor_imposto: p.imposto,
                    travado: false,
                  };
                  return (
                    <tr
                      key={p.posicao}
                      className="border-t"
                      style={{
                        borderColor: p.custo == null ? "#ef4444" : "var(--line)",
                        background: p.custo == null ? "rgba(239, 68, 68, 0.08)" : undefined,
                      }}
                    >
                      <td className="px-3 py-2" style={{ color: "var(--muted)" }}>
                        {p.posicao}
                      </td>
                      <td className="px-3 py-2 font-mono" style={{ color: "var(--ink)" }}>
                        {p.codigo}
                      </td>
                      <td className="px-3 py-2 text-right" style={{ color: p.custo == null ? "#ef4444" : "var(--ink)" }}>
                        {p.custo == null ? (
                          <span className="inline-flex items-center gap-1.5">
                            Sem custo
                            <button
                              type="button"
                              disabled={!podeCadastrarPeca}
                              onClick={() => setCadastrando(p.codigo)}
                              className="inline-flex items-center gap-1 text-xs font-medium rounded-md px-2 py-1 transition disabled:opacity-50 disabled:cursor-not-allowed"
                              style={{ color: "#ef4444", background: "rgba(239, 68, 68, 0.12)" }}
                              title={podeCadastrarPeca ? "Cadastrar valor dessa peça na Base Peças" : "Sem custo na Base Peças"}
                            >
                              <PlusCircle size={12} />
                              Cadastrar
                            </button>
                          </span>
                        ) : (
                          formatarReal(p.custo)
                        )}
                      </td>
                      <td className="px-3 py-2 text-right" style={{ color: "var(--muted)" }}>
                        {formatarReal(p.imposto)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {p.vendaPeca == null ? (
                          <span style={{ color: "var(--muted)" }}>—</span>
                        ) : (
                          <span
                            onMouseEnter={(e) => mostrarTooltip(e, pecaTooltip)}
                            onMouseLeave={() => setTooltip(null)}
                            className="inline-block cursor-help border-b border-dashed font-medium"
                            style={{ color: "var(--ink)", borderColor: "var(--muted)" }}
                          >
                            {formatarReal(p.vendaPeca)}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div
          className="rounded-xl border p-4 space-y-1.5 text-sm"
          style={{ borderColor: "var(--line)", background: "var(--surface2)" }}
        >
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>
              Resumo
            </span>
            {podeAjustarValores && !editando && (
              <button
                type="button"
                onClick={iniciarEdicao}
                title="Ajustar Venda, Lucro e Mão de obra manualmente"
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition hover:bg-[var(--surface)]"
                style={{ color: "var(--accent2)" }}
              >
                <Pencil size={12} />
                Ajustar valores
              </button>
            )}
          </div>

          {aparelho.ajustadoManualmente && !editando && (
            <div
              className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 mb-1 text-[11px]"
              style={{ background: "rgba(249, 168, 37, 0.1)", color: "#b45309" }}
            >
              <span className="inline-flex items-center gap-1.5">
                <Lock size={11} />
                Ajustado manualmente
                {nomeUsuario(aparelho.ajustadoPor) && <> por {nomeUsuario(aparelho.ajustadoPor)}</>}
                {aparelho.ajustadoEm && <> em {formatarDataHoraBrasilia(aparelho.ajustadoEm)}</>}
              </span>
              {podeAjustarValores && (
                <button
                  type="button"
                  onClick={() => setConfirmandoReverter(true)}
                  className="inline-flex items-center gap-1 font-medium underline decoration-dotted hover:opacity-80"
                >
                  <History size={11} />
                  Restaurar automático
                </button>
              )}
            </div>
          )}

          <div className="flex items-center justify-between">
            <span style={{ color: "var(--muted)" }}>Quantidade de peças</span>
            <strong style={{ color: "var(--ink)" }}>{aparelho.quantidadePecas}</strong>
          </div>
          <div className="flex items-center justify-between">
            <span style={{ color: "var(--muted)" }}>Custo das peças</span>
            <strong style={{ color: "var(--ink)" }}>{formatarReal(ajuste?.custo ?? aparelho.custoTotalPecas)}</strong>
          </div>
          <div className="flex items-center justify-between">
            <span style={{ color: "var(--muted)" }}>Imposto (ICMS)</span>
            <strong style={{ color: "var(--ink)" }}>{formatarReal(ajuste?.imposto ?? aparelho.impostoTotalPecas)}</strong>
          </div>
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5" style={{ color: "var(--muted)" }}>
              Venda de peças
              {editando && <Unlock size={11} style={{ color: "var(--accent2)" }} />}
            </span>
            {editando ? (
              <input
                type="text"
                inputMode="decimal"
                value={textoVenda}
                onChange={(e) => aoEditarVenda(e.target.value)}
                className="rounded-md border px-2 py-1 text-right text-sm outline-none"
                style={estiloInput}
              />
            ) : (
              <strong style={{ color: "var(--ink)" }}>{formatarReal(aparelho.vendaTotalPecas)}</strong>
            )}
          </div>
          <div className="flex items-center justify-between pt-1.5 border-t" style={{ borderColor: "var(--line)" }}>
            <span style={{ color: "var(--ink)" }}>Lucro Líquido da Peça</span>
            {editando ? (
              <input
                type="text"
                inputMode="decimal"
                value={textoLucroPeca}
                onChange={(e) => aoEditarLucroPeca(e.target.value)}
                className="rounded-md border px-2 py-1 text-right text-sm outline-none"
                style={estiloInput}
              />
            ) : (
              <strong style={{ color: "var(--ink)" }}>{formatarReal(aparelho.lucroLiquidoPeca)}</strong>
            )}
          </div>
          <p className="text-[11px]" style={{ color: "var(--muted)" }}>
            Venda de peças − Custo das peças − Imposto (sem mão de obra)
          </p>
          <div className="flex items-center justify-between">
            <span style={{ color: "var(--muted)" }}>Mão de obra</span>
            {editando ? (
              <input
                type="text"
                inputMode="decimal"
                value={textoMaoDeObra}
                onChange={(e) => aoEditarMaoDeObra(e.target.value)}
                className="rounded-md border px-2 py-1 text-right text-sm outline-none"
                style={estiloInput}
              />
            ) : (
              <strong style={{ color: "var(--ink)" }}>{formatarReal(aparelho.maoDeObra)}</strong>
            )}
          </div>
          <div className="flex items-center justify-between pt-1.5 border-t" style={{ borderColor: "var(--line)" }}>
            <span style={{ color: "var(--ink)" }}>Lucro Total</span>
            {editando ? (
              <input
                type="text"
                inputMode="decimal"
                value={textoLucroTotal}
                onChange={(e) => aoEditarLucroTotal(e.target.value)}
                className="rounded-md border px-2 py-1 text-right text-sm outline-none font-medium"
                style={estiloInput}
              />
            ) : (
              <strong style={{ color: "var(--accent2)" }}>{formatarReal(aparelho.lucroTotal)}</strong>
            )}
          </div>
          <p className="text-[11px]" style={{ color: "var(--muted)" }}>
            Lucro Líquido da Peça + Mão de obra
          </p>
          <div className="flex items-center justify-between pt-1.5 border-t" style={{ borderColor: "var(--line)" }}>
            <span style={{ color: "var(--ink)" }}>% Lucro Peças</span>
            <strong style={{ color: corPercentualLucro(percLucroPecasExibido) }}>
              {formatarPercentual(percLucroPecasExibido)}
            </strong>
          </div>
          <div className="flex items-center justify-between">
            <span style={{ color: "var(--ink)" }}>% Lucro Total</span>
            <strong style={{ color: corPercentualLucro(percLucroTotalExibido) }}>
              {formatarPercentual(percLucroTotalExibido)}
            </strong>
          </div>

          {erroAjuste && !confirmandoSalvar && !confirmandoReverter && (
            <p className="text-xs text-red-500 pt-1">{erroAjuste}</p>
          )}

          {editando && (
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={cancelarEdicao}
                disabled={salvandoAjuste}
                className="rounded-lg px-3 py-2 text-xs font-medium transition hover:bg-[var(--surface)] disabled:opacity-60"
                style={{ color: "var(--muted)" }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => setConfirmandoSalvar(true)}
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-medium text-white transition"
                style={{ background: "var(--accent)", boxShadow: "0 0 30px var(--accent-glow)" }}
              >
                <Save size={13} />
                Salvar
              </button>
            </div>
          )}
        </div>
      </div>

      {tooltip && (
        <div
          className="fixed z-[70] rounded-lg border shadow-2xl p-3"
          style={{ background: "var(--surface2)", borderColor: "var(--line)", left: tooltip.x, top: tooltip.y }}
        >
          <TooltipCalculoBid peca={tooltip.peca} faixas={faixas} icmsPercentual={icmsPercentual} />
        </div>
      )}

      {cadastrando && (
        <PopupCadastrarPecaBase
          codigo={cadastrando}
          onFechar={() => setCadastrando(null)}
          onSalvo={() => {
            setCadastrando(null);
            onAtualizado();
          }}
        />
      )}

      {confirmandoSalvar && ajuste && (
        <PopupConfirmar
          titulo="Confirmar alteração de valores"
          mensagem={
            <>
              Os valores desse orçamento vão passar a usar os números ajustados manualmente (Venda{" "}
              {formatarReal(ajuste.venda)}, Lucro da Peça {formatarReal(lucroLiquidoPecaDe(ajuste))}, Mão de obra{" "}
              {formatarReal(ajuste.maoDeObra)}, Lucro Total {formatarReal(lucroTotalDe(ajuste))}) em vez do cálculo
              automático pela Base Peças/BID, até alguém editar de novo ou restaurar o cálculo automático. Confirma?
            </>
          }
          rotuloConfirmar="Confirmar alteração"
          carregando={salvandoAjuste}
          erro={erroAjuste}
          onConfirmar={salvarAjuste}
          onFechar={() => !salvandoAjuste && setConfirmandoSalvar(false)}
        />
      )}

      {confirmandoReverter && (
        <PopupConfirmar
          titulo="Restaurar cálculo automático"
          mensagem="Os valores ajustados manualmente vão ser descartados e esse orçamento volta a calcular Venda, Lucro e Mão de obra automaticamente pela Base Peças/BID. Confirma?"
          rotuloConfirmar="Restaurar"
          carregando={salvandoAjuste}
          erro={erroAjuste}
          onConfirmar={reverterAjuste}
          onFechar={() => !salvandoAjuste && setConfirmandoReverter(false)}
        />
      )}
    </div>
  );
}
