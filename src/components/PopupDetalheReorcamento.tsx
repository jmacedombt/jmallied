"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock, PackageSearch, Save, X } from "lucide-react";
import {
  calcularDetalheReorcamento,
  type ConfiguracaoMaoDeObra,
  type DetalheValidacaoOrcamento,
  type PecaAddEntrada,
} from "@/lib/orcamentos";
import { type FaixaMarkup } from "@/lib/bid";
import { corPercentualLucro } from "@/components/CelulaLucroPercentual";
import PopupConfirmar from "@/components/PopupConfirmar";
import { formatarDataHoraBrasilia } from "@/lib/tempo";

function formatarReal(valor: number | null): string {
  return (valor ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function formatarPercentual(valor: number): string {
  return `${valor.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}
// mesmo parser tolerante a vírgula (padrão BR) usado em PopupReorcamento/PopupPecasContraProposta.
function paraNumero(texto: string): number {
  const limpo = texto.replace(/\./g, "").replace(",", ".").trim();
  const n = Number(limpo);
  return Number.isFinite(n) ? n : 0;
}
function formatarInputNumero(valor: number | null): string {
  return valor == null ? "" : valor.toFixed(2).replace(".", ",");
}

const POSICOES = ["Extra 1", "Extra 2", "Extra 3", "Extra 4", "Extra 5"] as const;

export type AparelhoDetalheReorcamento = {
  id: string;
  trade_allied: string;
  os_reparadora: string | null;
  os_care_allied: string | null;
  modelo_comercial: string | null;
  sku: string | null;
  descricao_completa: string | null;
  validacao_snapshot: DetalheValidacaoOrcamento | null;
  reorcamento_detalhe: DetalheValidacaoOrcamento;
  reorcamento_motivo: string | null;
  reorcamento_enviado_em: string | null;
  pecasAddIniciais: { posicao: string; codigo: string | null; custo: number | null }[];
};

type LinhaForm = { posicao: string; codigo: string; custoTexto: string };

// Pop-up de detalhe do Reorçamento em "4 - Ag. Resposta de Reorçamento"
// — mostra as peças originais (congeladas na Validação) + as peças
// adicionais pedidas pelo técnico em "6 - Ag. Reparo", com o cálculo
// completo. Enquanto o reorçamento ainda não foi enviado pra Allied
// (reorcamento_enviado_em vazio), as peças adicionais ficam editáveis —
// recalcula tudo ao digitar (sem precisar de botão "Calcular"), e
// "Salvar alterações" pede confirmação antes de gravar. Depois de
// enviado, fica só consulta (o Excel já saiu com esses valores).
export default function PopupDetalheReorcamento({
  aparelho,
  faixasMarkup,
  icmsPercentual,
  configMaoDeObra,
  onFechar,
  onAtualizado,
}: {
  aparelho: AparelhoDetalheReorcamento;
  faixasMarkup: FaixaMarkup[];
  icmsPercentual: number;
  configMaoDeObra: Pick<ConfiguracaoMaoDeObra, "valor_uma_peca" | "valor_mais_de_uma_peca">;
  onFechar: () => void;
  onAtualizado: () => void;
}) {
  const editavel = !aparelho.reorcamento_enviado_em && aparelho.validacao_snapshot != null;

  const [linhas, setLinhas] = useState<LinhaForm[]>(
    POSICOES.map((posicao) => {
      const inicial = aparelho.pecasAddIniciais.find((p) => p.posicao === posicao);
      return { posicao, codigo: inicial?.codigo ?? "", custoTexto: formatarInputNumero(inicial?.custo ?? null) };
    })
  );
  const [confirmando, setConfirmando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pecaSolucaoMap, setPecaSolucaoMap] = useState<Record<string, string | null>>({});

  function editarLinha(indice: number, campo: "codigo" | "custoTexto", valor: string) {
    setLinhas((atual) => atual.map((l, i) => (i === indice ? { ...l, [campo]: valor } : l)));
  }

  // Peça Solução (BID) de cada código digitado — mesmo lookup ao vivo do
  // PopupReorcamento (tela original em 6 - Ag. Reparo): 400ms depois de
  // parar de digitar, consulta o BID e mostra a Peça Solução — a mesma
  // que vai sair na planilha Complementar (reorcamentoEnvio.ts faz essa
  // busca de novo no momento do envio; isso aqui é só auxílio visual).
  const codigosPreenchidos = editavel ? linhas.map((l) => l.codigo.trim()).filter(Boolean) : [];
  useEffect(() => {
    if (codigosPreenchidos.length === 0) {
      setPecaSolucaoMap({});
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/bases/bid/consultar-solucao", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ codigos: codigosPreenchidos }),
        });
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        if (data?.solucoes) setPecaSolucaoMap(data.solucoes);
      } catch {
        // silencioso — só um auxílio visual, não trava o preenchimento
      }
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codigosPreenchidos.join("|")]);

  const pecasAddValidas: PecaAddEntrada[] = linhas
    .filter((l) => l.codigo.trim() !== "" && l.custoTexto.trim() !== "")
    .map((l) => ({ posicao: l.posicao, codigo: l.codigo.trim(), custo: paraNumero(l.custoTexto) }));

  // recalcula ao vivo enquanto edita (sem botão "Calcular" — pop-up de
  // revisão, não o lançamento original) — cai pro valor já gravado
  // (reorcamento_detalhe) quando não editável ou sem nenhuma peça add
  // preenchida.
  const detalheExibido = useMemo(() => {
    if (!editavel || pecasAddValidas.length === 0 || !aparelho.validacao_snapshot) {
      return aparelho.reorcamento_detalhe;
    }
    return calcularDetalheReorcamento(pecasAddValidas, aparelho.validacao_snapshot, icmsPercentual, configMaoDeObra, faixasMarkup);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editavel, JSON.stringify(pecasAddValidas), aparelho.validacao_snapshot, aparelho.reorcamento_detalhe, icmsPercentual, configMaoDeObra, faixasMarkup]);

  async function salvar() {
    setSalvando(true);
    setErro(null);
    try {
      const res = await fetch(`/api/operacional/orcamentos/${aparelho.id}/ajustar-reorcamento`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pecas: pecasAddValidas }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setErro(data?.error || "Não foi possível salvar as alterações.");
        setSalvando(false);
        setConfirmando(false);
        return;
      }
      onAtualizado();
    } catch {
      setErro("Falha de conexão. Tente novamente.");
      setSalvando(false);
      setConfirmando(false);
    }
  }

  const estiloInput: React.CSSProperties = {
    background: "var(--surface)",
    borderColor: "var(--accent2)",
    color: "var(--ink)",
  };

  const pecasOriginais = detalheExibido.pecas.filter((p) => !p.posicao.startsWith("Extra "));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.55)" }}>
      <div
        className="w-full max-w-3xl max-h-[94vh] overflow-y-auto rounded-2xl border shadow-2xl p-5"
        style={{ background: "var(--surface)", borderColor: "var(--line)" }}
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-semibold flex items-center gap-2" style={{ color: "var(--ink)" }}>
            <PackageSearch size={18} style={{ color: "var(--accent2)" }} />
            Reorçamento — {aparelho.trade_allied}
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

        <p className="text-xs mb-2" style={{ color: "var(--muted)" }}>
          {aparelho.os_reparadora && <>OS Reparadora {aparelho.os_reparadora} · </>}
          {aparelho.os_care_allied && <>OS Care Allied {aparelho.os_care_allied} · </>}
          {aparelho.modelo_comercial}
          {aparelho.reorcamento_motivo && (
            <>
              {" "}
              · <span style={{ color: "var(--ink)" }}>Justificativa:</span> {aparelho.reorcamento_motivo}
            </>
          )}
        </p>

        <div
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 mb-2.5 text-[11px]"
          style={editavel ? { background: "rgba(217, 119, 6, 0.12)", color: "#b45309" } : { background: "rgba(37, 99, 235, 0.1)", color: "#2563eb" }}
        >
          {editavel ? <Clock size={12} /> : <CheckCircle2 size={12} />}
          {editavel
            ? "Ainda não foi enviado pra Allied — as peças adicionais abaixo podem ser ajustadas."
            : aparelho.reorcamento_enviado_em
              ? `Enviado pra Allied em ${formatarDataHoraBrasilia(aparelho.reorcamento_enviado_em)}.`
              : "Já enviado pra Allied — só consulta."}
        </div>

        {pecasOriginais.length > 0 && (
          <>
            <p className="text-xs font-medium mb-1" style={{ color: "var(--muted)" }}>
              Peças do orçamento original
            </p>
            <div className="rounded-xl border overflow-hidden mb-2.5" style={{ borderColor: "var(--line)" }}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left" style={{ background: "var(--surface2)", color: "var(--muted)" }}>
                    <th className="px-3 py-1.5 font-medium">Posição</th>
                    <th className="px-3 py-1.5 font-medium">Código</th>
                    <th className="px-3 py-1.5 font-medium text-right">Custo</th>
                    <th className="px-3 py-1.5 font-medium text-right">Venda de Peça</th>
                  </tr>
                </thead>
                <tbody>
                  {pecasOriginais.map((p) => (
                    <tr key={p.posicao} className="border-t" style={{ borderColor: "var(--line)" }}>
                      <td className="px-3 py-1.5" style={{ color: "var(--muted)" }}>
                        {p.posicao}
                      </td>
                      <td className="px-3 py-1.5 font-mono" style={{ color: "var(--ink)" }}>
                        {p.codigo}
                      </td>
                      <td className="px-3 py-1.5 text-right" style={{ color: "var(--muted)" }}>
                        {formatarReal(p.custo)}
                      </td>
                      <td className="px-3 py-1.5 text-right font-medium" style={{ color: "var(--ink)" }}>
                        {formatarReal(p.vendaPeca)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <p className="text-xs font-medium mb-1" style={{ color: "var(--muted)" }}>
          Peças adicionais (Reorçamento)
        </p>
        <div className="rounded-xl border overflow-hidden mb-2.5" style={{ borderColor: "var(--line)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left" style={{ background: "var(--surface2)", color: "var(--muted)" }}>
                <th className="px-3 py-1.5 font-medium">Posição</th>
                <th className="px-3 py-1.5 font-medium">Peça Add (código)</th>
                {editavel && <th className="px-3 py-1.5 font-medium">Peça Solução (BID)</th>}
                <th className="px-3 py-1.5 font-medium text-right">{editavel ? "Custo Add (GSPN)" : "Custo"}</th>
                <th className="px-3 py-1.5 font-medium text-right">Venda de Peça</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l, i) => {
                const calculada = detalheExibido.pecas.find((p) => p.posicao === l.posicao);
                const codigo = l.codigo.trim();
                const pecaSolucao = codigo ? pecaSolucaoMap[codigo] : undefined;
                return (
                  <tr key={l.posicao} className="border-t" style={{ borderColor: "var(--line)" }}>
                    <td className="px-3 py-1.5" style={{ color: "var(--muted)" }}>
                      {l.posicao}
                    </td>
                    {editavel ? (
                      <>
                        <td className="px-3 py-1">
                          <input
                            type="text"
                            value={l.codigo}
                            onChange={(e) => editarLinha(i, "codigo", e.target.value)}
                            placeholder="Part Number"
                            className="w-full rounded-md border px-2 py-1 text-sm outline-none font-mono"
                            style={estiloInput}
                          />
                        </td>
                        <td className="px-3 py-1.5 text-xs" style={{ color: !codigo ? "var(--muted)" : pecaSolucao ? "var(--ink)" : "#ea580c" }}>
                          {!codigo ? "—" : pecaSolucao === undefined ? "buscando..." : pecaSolucao ?? "não cadastrada no BID"}
                        </td>
                        <td className="px-3 py-1 text-right">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={l.custoTexto}
                            onChange={(e) => editarLinha(i, "custoTexto", e.target.value)}
                            placeholder="0,00"
                            className="w-24 rounded-md border px-2 py-1 text-right text-sm outline-none"
                            style={estiloInput}
                          />
                        </td>
                        <td className="px-3 py-1.5 text-right font-medium" style={{ color: calculada ? "var(--ink)" : "var(--muted)" }}>
                          {calculada ? formatarReal(calculada.vendaPeca) : "—"}
                        </td>
                      </>
                    ) : calculada ? (
                      <>
                        <td className="px-3 py-1.5 font-mono" style={{ color: "var(--ink)" }}>
                          {calculada.codigo}
                        </td>
                        <td className="px-3 py-1.5 text-right" style={{ color: "var(--muted)" }}>
                          {formatarReal(calculada.custo)}
                        </td>
                        <td className="px-3 py-1.5 text-right font-medium" style={{ color: "var(--ink)" }}>
                          {formatarReal(calculada.vendaPeca)}
                        </td>
                      </>
                    ) : (
                      <td className="px-3 py-1.5 text-center" colSpan={3} style={{ color: "var(--muted)" }}>
                        —
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="rounded-xl border px-4 py-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm mb-2" style={{ borderColor: "var(--line)", background: "var(--surface2)" }}>
          <div className="flex items-center justify-between">
            <span style={{ color: "var(--muted)" }}>Venda de peças (total)</span>
            <strong style={{ color: "var(--ink)" }}>{formatarReal(detalheExibido.vendaTotalPecas)}</strong>
          </div>
          <div className="flex items-center justify-between">
            <span style={{ color: "var(--muted)" }}>Mão de obra ({detalheExibido.quantidadePecas} peça(s))</span>
            <strong style={{ color: "var(--ink)" }}>{formatarReal(detalheExibido.maoDeObra)}</strong>
          </div>
          <div className="flex items-center justify-between">
            <span style={{ color: "var(--ink)" }}>Valor total do reparo</span>
            <strong style={{ color: "var(--accent2)" }}>{formatarReal(detalheExibido.vendaTotalPecas + detalheExibido.maoDeObra)}</strong>
          </div>
          <div className="flex items-center justify-between">
            <span style={{ color: "var(--ink)" }}>% Lucro Total</span>
            <strong style={{ color: corPercentualLucro(detalheExibido.percLucroTotal) }}>{formatarPercentual(detalheExibido.percLucroTotal)}</strong>
          </div>
        </div>

        {erro && !confirmando && <p className="text-xs text-red-500 mb-2">{erro}</p>}

        {editavel && (
          <div className="flex items-center justify-end pt-1">
            <button
              type="button"
              onClick={() => setConfirmando(true)}
              disabled={pecasAddValidas.length === 0}
              title={pecasAddValidas.length === 0 ? "Preencha código e custo de pelo menos uma peça adicional." : undefined}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-medium text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: "#f97316" }}
            >
              <Save size={13} />
              Salvar alterações
            </button>
          </div>
        )}
      </div>

      {confirmando && (
        <PopupConfirmar
          titulo="Confirmar alterações"
          mensagem={
            <>
              Vai salvar as peças adicionais desse reorçamento, com o novo valor total do reparo de{" "}
              <strong>{formatarReal(detalheExibido.vendaTotalPecas + detalheExibido.maoDeObra)}</strong>. Confirma as
              alterações?
            </>
          }
          rotuloConfirmar="Confirmar"
          carregando={salvando}
          erro={erro}
          onConfirmar={salvar}
          onFechar={() => {
            if (salvando) return;
            setConfirmando(false);
          }}
        />
      )}
    </div>
  );
}
