"use client";

import { useState } from "react";
import { Calculator, Info, Loader2, Save, X } from "lucide-react";
import { calcularCustoPecaAllied, type FaixaMarkup, type InfoBidPeca, type ResultadoCalculoBid } from "@/lib/bid";

function formatarMoeda(valor: number | null) {
  if (valor == null) return "—";
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function CampoComDica({ rotulo, dica }: { rotulo: string; dica: string }) {
  return (
    <span className="group relative inline-flex items-center gap-1">
      {rotulo}
      <Info size={11} style={{ color: "var(--muted)" }} className="cursor-help" />
      <span
        className="pointer-events-none absolute left-0 bottom-full z-20 mb-1.5 hidden w-56 rounded-lg border p-2.5 text-xs font-normal normal-case shadow-2xl group-hover:block"
        style={{ background: "var(--surface2)", borderColor: "var(--line)", color: "var(--muted)" }}
      >
        {dica}
      </span>
    </span>
  );
}

// Popup de cadastro manual de uma peça do BID que ainda não tem valor —
// aberto a partir de Ag. Análise quando uma peça do orçamento não é
// encontrada no BID (ou está lá sem custo calculado). Segue os mesmos
// campos e a mesma fórmula usados na importação/recalculo do BID, então
// o valor calculado aqui bate com o que a base traria se essa peça
// tivesse vindo de um arquivo importado.
export default function PopupCadastrarPecaBid({
  partNumber,
  modeloInicial,
  pecaSolucaoInicial,
  maoDeObraInicial,
  faixas,
  icmsPercentual,
  onSalvo,
  onFechar,
}: {
  partNumber: string;
  modeloInicial?: string | null;
  pecaSolucaoInicial?: string | null;
  maoDeObraInicial?: number | null;
  faixas: FaixaMarkup[];
  icmsPercentual: number;
  onSalvo: (info: InfoBidPeca) => void;
  onFechar: () => void;
}) {
  const [modelo, setModelo] = useState(modeloInicial ?? "");
  const [pecaSolucao, setPecaSolucao] = useState(pecaSolucaoInicial ?? "");
  const [custoSamsung, setCustoSamsung] = useState("");
  const [maoDeObra, setMaoDeObra] = useState(String(maoDeObraInicial ?? 80));
  const [calculado, setCalculado] = useState<ResultadoCalculoBid | null>(null);
  const [erroCalculo, setErroCalculo] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);

  function calcular() {
    setErroCalculo(null);
    const valor = Number(custoSamsung.replace(",", "."));
    if (!Number.isFinite(valor) || valor <= 0) {
      setErroCalculo("Informe o Custo Peça Samsung antes de calcular.");
      setCalculado(null);
      return;
    }
    const resultado = calcularCustoPecaAllied(valor, faixas, icmsPercentual);
    if (!resultado) {
      setErroCalculo("Nenhuma faixa de markup configurada cobre esse valor. Confira Configurações > Faixas de Markup.");
      setCalculado(null);
      return;
    }
    setCalculado(resultado);
  }

  async function salvar() {
    if (!modelo.trim() || !pecaSolucao.trim()) {
      setErroSalvar("Preencha Modelo e Peça Solução.");
      return;
    }
    const valor = Number(custoSamsung.replace(",", "."));
    if (!Number.isFinite(valor) || valor <= 0) {
      setErroSalvar("Informe um Custo Peça Samsung válido.");
      return;
    }

    setSalvando(true);
    setErroSalvar(null);

    try {
      const res = await fetch("/api/bases/bid/pecas/cadastro-manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelo: modelo.trim(),
          part_number: partNumber,
          peca_solucao: pecaSolucao.trim(),
          custo_peca_samsung: valor,
          mao_de_obra: Number(maoDeObra),
        }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setErroSalvar(data?.error || "Não foi possível salvar essa peça.");
        setSalvando(false);
        return;
      }

      onSalvo(data as InfoBidPeca);
    } catch {
      setErroSalvar("Falha de conexão. Tente novamente.");
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }}>
      <div
        className="w-full max-w-md rounded-2xl border shadow-2xl p-6"
        style={{ background: "var(--surface)", borderColor: "var(--line)" }}
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-semibold" style={{ color: "var(--ink)" }}>
            Cadastrar peça no BID
          </h2>
          <button
            type="button"
            onClick={onFechar}
            disabled={salvando}
            aria-label="Fechar"
            className="w-7 h-7 flex items-center justify-center rounded-md transition hover:bg-[var(--surface2)] disabled:opacity-60"
            style={{ color: "var(--muted)" }}
          >
            <X size={16} />
          </button>
        </div>
        <p className="text-xs mb-5" style={{ color: "var(--muted)" }}>
          Essa peça não tem custo calculado no BID ainda. Preencha os dados abaixo pra cadastrar — assim que salvar, o
          valor passa a valer em qualquer orçamento que use esse Part Number.
        </p>

        <div className="space-y-3.5">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--ink)" }}>
              <CampoComDica rotulo="Modelo" dica="Modelo do aparelho, do mesmo jeito que aparece na base do BID (ex: GALAXY A06)." />
            </label>
            <input
              type="text"
              value={modelo}
              onChange={(e) => setModelo(e.target.value)}
              placeholder="Ex: GALAXY A06"
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--accent2)] transition"
              style={{ borderColor: "var(--line)", background: "var(--surface2)", color: "var(--ink)" }}
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--ink)" }}>
              <CampoComDica rotulo="Part Number" dica="Código da peça — vem preenchido a partir do orçamento, não dá pra editar aqui." />
            </label>
            <input
              type="text"
              value={partNumber}
              disabled
              className="w-full rounded-lg border px-3 py-2 text-sm font-mono opacity-70"
              style={{ borderColor: "var(--line)", background: "var(--surface2)", color: "var(--ink)" }}
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--ink)" }}>
              <CampoComDica rotulo="Peça Solução" dica="Nome/descrição da solução aplicada com essa peça (ex: TROCA DE TELA)." />
            </label>
            <input
              type="text"
              value={pecaSolucao}
              onChange={(e) => setPecaSolucao(e.target.value)}
              placeholder="Ex: TROCA DE TELA"
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--accent2)] transition"
              style={{ borderColor: "var(--line)", background: "var(--surface2)", color: "var(--ink)" }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--ink)" }}>
                <CampoComDica rotulo="Custo Peça Samsung" dica="Valor da peça do GSPN/Base Peças pra esse Part Number." />
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={custoSamsung}
                onChange={(e) => {
                  setCustoSamsung(e.target.value);
                  setCalculado(null);
                }}
                placeholder="0,00"
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--accent2)] transition"
                style={{ borderColor: "var(--line)", background: "var(--surface2)", color: "var(--ink)" }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--ink)" }}>
                <CampoComDica rotulo="Mão de Obra" dica="Valor de mão de obra pra essa peça — escolha 80 ou 150." />
              </label>
              <select
                value={maoDeObra}
                onChange={(e) => setMaoDeObra(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--accent2)] transition"
                style={{ borderColor: "var(--line)", background: "var(--surface2)", color: "var(--ink)" }}
              >
                <option value="80">R$ 80,00</option>
                <option value="150">R$ 150,00</option>
              </select>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={calcular}
          className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition hover:border-[var(--accent2)]"
          style={{ borderColor: "var(--line)", color: "var(--ink)" }}
        >
          <Calculator size={15} />
          Calcular Custo de Peça Allied
        </button>

        {erroCalculo && <p className="text-xs mt-2 text-red-400">{erroCalculo}</p>}

        {calculado && (
          <div className="mt-3 rounded-lg border p-3 text-xs space-y-1.5" style={{ borderColor: "var(--line)", background: "var(--surface2)" }}>
            <p className="flex justify-between gap-4">
              <span style={{ color: "var(--muted)" }}>Valor com margem</span>
              <strong>{formatarMoeda(calculado.valorComMargem)}</strong>
            </p>
            <p className="flex justify-between gap-4">
              <span style={{ color: "var(--muted)" }}>Imposto (ICMS {icmsPercentual}%)</span>
              <strong>+ {formatarMoeda(calculado.valorImposto)}</strong>
            </p>
            <div className="border-t pt-1.5 mt-1.5" style={{ borderColor: "var(--line)" }}>
              <p className="flex justify-between gap-4">
                <span style={{ color: "var(--muted)" }}>= Custo Peça (Allied)</span>
                <strong style={{ color: "var(--accent2)" }}>{formatarMoeda(calculado.custoPecaAllied)}</strong>
              </p>
            </div>
          </div>
        )}

        {erroSalvar && (
          <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mt-4">
            {erroSalvar}
          </p>
        )}

        <div className="flex items-center justify-end gap-2 mt-5">
          <button
            type="button"
            onClick={onFechar}
            disabled={salvando}
            className="rounded-lg px-4 py-2.5 text-sm font-medium transition hover:bg-[var(--surface2)] disabled:opacity-60"
            style={{ color: "var(--muted)" }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={salvar}
            disabled={salvando}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition disabled:opacity-60"
            style={{ background: "var(--accent)", boxShadow: "0 0 30px var(--accent-glow)" }}
          >
            {salvando ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
