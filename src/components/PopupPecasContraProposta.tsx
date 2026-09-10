"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, PackageSearch, Save, X } from "lucide-react";
import { calcularResumoContraProposta, type PecaContraProposta } from "@/lib/orcamentos";
import { corPercentualLucro } from "@/components/CelulaLucroPercentual";
import PopupConfirmar from "@/components/PopupConfirmar";

function formatarReal(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function formatarPercentual(valor: number): string {
  return `${valor.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}
// mesmo parser tolerante a vírgula (padrão BR) usado em PopupPecasValidacao.
function paraNumero(texto: string): number {
  const limpo = texto.replace(/\./g, "").replace(",", ".").trim();
  const n = Number(limpo);
  return Number.isFinite(n) ? n : 0;
}
function formatarInputNumero(valor: number): string {
  return valor.toFixed(2).replace(".", ",");
}

export type AparelhoContraProposta = {
  id: string;
  nf_remessa_allied: string;
  os_reparadora: string | null;
  trade_allied: string;
  pecasIniciais: PecaContraProposta[];
  maoDeObraInicial: number;
  jaAjustado: boolean;
};

// Pop-up de edição peça a peça da Contra Proposta (Ag. Contra Proposta)
// — diferente do ajuste manual de Validação de Orçamentos (que só edita
// os 4 totais agregados), aqui cada peça tem seu próprio campo de "novo
// valor de venda", e a mão de obra também é livre. Tudo recalcula ao
// digitar; "Confirmar alteração" grava e marca esse aparelho como
// ajustado (flag azul na lista).
export default function PopupPecasContraProposta({
  aparelho,
  onAtualizado,
  onFechar,
}: {
  aparelho: AparelhoContraProposta;
  onAtualizado: () => void;
  onFechar: () => void;
}) {
  const [pecas, setPecas] = useState<PecaContraProposta[]>(aparelho.pecasIniciais);
  const [textosVenda, setTextosVenda] = useState<string[]>(aparelho.pecasIniciais.map((p) => formatarInputNumero(p.vendaNova)));
  const [maoDeObra, setMaoDeObra] = useState(aparelho.maoDeObraInicial);
  const [textoMaoDeObra, setTextoMaoDeObra] = useState(formatarInputNumero(aparelho.maoDeObraInicial));
  const [confirmando, setConfirmando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const resumo = calcularResumoContraProposta(pecas, maoDeObra);

  function aoEditarPeca(indice: number, texto: string) {
    setTextosVenda((atual) => atual.map((t, i) => (i === indice ? texto : t)));
    const valor = paraNumero(texto);
    setPecas((atual) => atual.map((p, i) => (i === indice ? { ...p, vendaNova: valor } : p)));
  }

  function aoEditarMaoDeObra(texto: string) {
    setTextoMaoDeObra(texto);
    setMaoDeObra(paraNumero(texto));
  }

  async function salvar() {
    setSalvando(true);
    setErro(null);
    try {
      const res = await fetch(`/api/operacional/orcamentos/${aparelho.id}/ajustar-contra-proposta`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pecas, mao_de_obra: maoDeObra }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setErro(data?.error || "Não foi possível salvar o ajuste.");
        setSalvando(false);
        return;
      }
      setConfirmando(false);
      setSalvando(false);
      onAtualizado();
    } catch {
      setErro("Falha de conexão. Tente novamente.");
      setSalvando(false);
    }
  }

  const estiloInput: React.CSSProperties = {
    background: "var(--surface)",
    borderColor: "var(--accent2)",
    color: "var(--ink)",
    width: "8rem",
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
            Ajuste da Contra Proposta
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
          {aparelho.trade_allied} · OS Reparadora {aparelho.os_reparadora || "—"} · NF Remessa {aparelho.nf_remessa_allied}
        </p>

        {aparelho.jaAjustado && (
          <div
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 mb-3 text-[11px]"
            style={{ background: "rgba(59, 130, 246, 0.1)", color: "#2563eb" }}
          >
            <CheckCircle2 size={12} />
            Esse aparelho já foi ajustado — editar e salvar de novo atualiza os valores.
          </div>
        )}

        {pecas.length === 0 ? (
          <p className="text-sm mb-4" style={{ color: "var(--muted)" }}>
            Esse orçamento não tem nenhuma peça lançada — só a mão de obra abaixo entra na Contra Proposta.
          </p>
        ) : (
          <div className="rounded-xl border overflow-hidden mb-4" style={{ borderColor: "var(--line)" }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left" style={{ background: "var(--surface2)", color: "var(--muted)" }}>
                  <th className="px-3 py-2 font-medium">#</th>
                  <th className="px-3 py-2 font-medium">Código da peça</th>
                  <th className="px-3 py-2 font-medium text-right">Valor original</th>
                  <th className="px-3 py-2 font-medium text-right">Novo valor</th>
                </tr>
              </thead>
              <tbody>
                {pecas.map((p, i) => (
                  <tr key={p.posicao} className="border-t" style={{ borderColor: "var(--line)" }}>
                    <td className="px-3 py-2" style={{ color: "var(--muted)" }}>
                      {p.posicao}
                    </td>
                    <td className="px-3 py-2 font-mono" style={{ color: "var(--ink)" }}>
                      {p.codigo}
                    </td>
                    <td className="px-3 py-2 text-right" style={{ color: "var(--muted)" }}>
                      {formatarReal(p.vendaOriginal)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={textosVenda[i]}
                        onChange={(e) => aoEditarPeca(i, e.target.value)}
                        className="rounded-md border px-2 py-1 text-right text-sm outline-none"
                        style={estiloInput}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="rounded-xl border p-4 space-y-1.5 text-sm" style={{ borderColor: "var(--line)", background: "var(--surface2)" }}>
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>
            Resumo
          </span>
          <div className="flex items-center justify-between">
            <span style={{ color: "var(--muted)" }}>Custo das peças</span>
            <strong style={{ color: "var(--ink)" }}>{formatarReal(resumo.custoTotalPecas)}</strong>
          </div>
          <div className="flex items-center justify-between">
            <span style={{ color: "var(--muted)" }}>Imposto (ICMS)</span>
            <strong style={{ color: "var(--ink)" }}>{formatarReal(resumo.impostoTotalPecas)}</strong>
          </div>
          <div className="flex items-center justify-between pt-1.5 border-t" style={{ borderColor: "var(--line)" }}>
            <span style={{ color: "var(--ink)" }}>Venda de peças (novo total)</span>
            <strong style={{ color: "var(--ink)" }}>{formatarReal(resumo.vendaTotalPecas)}</strong>
          </div>
          <div className="flex items-center justify-between">
            <span style={{ color: "var(--muted)" }}>Mão de obra</span>
            <input
              type="text"
              inputMode="decimal"
              value={textoMaoDeObra}
              onChange={(e) => aoEditarMaoDeObra(e.target.value)}
              className="rounded-md border px-2 py-1 text-right text-sm outline-none"
              style={estiloInput}
            />
          </div>
          <div className="flex items-center justify-between pt-1.5 border-t" style={{ borderColor: "var(--line)" }}>
            <span style={{ color: "var(--ink)" }}>Lucro Total</span>
            <strong style={{ color: "var(--accent2)" }}>{formatarReal(resumo.lucroTotal)}</strong>
          </div>
          <div className="flex items-center justify-between">
            <span style={{ color: "var(--ink)" }}>% Lucro Total</span>
            <strong style={{ color: corPercentualLucro(resumo.percLucroTotal) }}>{formatarPercentual(resumo.percLucroTotal)}</strong>
          </div>

          {erro && !confirmando && <p className="text-xs text-red-500 pt-1">{erro}</p>}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setConfirmando(true)}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-medium text-white transition"
              style={{ background: "var(--accent)", boxShadow: "0 0 30px var(--accent-glow)" }}
            >
              <Save size={13} />
              Confirmar alteração
            </button>
          </div>
        </div>
      </div>

      {confirmando && (
        <PopupConfirmar
          titulo="Confirmar alteração da Contra Proposta"
          mensagem={
            <>
              Esse aparelho vai passar a usar Venda de Peças {formatarReal(resumo.vendaTotalPecas)} e Mão de obra{" "}
              {formatarReal(maoDeObra)} (Lucro Total {formatarReal(resumo.lucroTotal)}) na Contra Proposta. Confirma?
            </>
          }
          rotuloConfirmar="Confirmar alteração"
          carregando={salvando}
          erro={erro}
          onConfirmar={salvar}
          onFechar={() => !salvando && setConfirmando(false)}
        />
      )}
    </div>
  );
}
