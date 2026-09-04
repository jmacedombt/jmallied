"use client";

import { Lock } from "lucide-react";
import { faixaMarkupPara, type FaixaMarkup } from "@/lib/bid";

export type PecaParaTooltip = {
  custo_peca_samsung: number | null;
  valor_com_margem: number | null;
  custo_peca_allied: number | null;
  valor_imposto: number | null;
  travado: boolean;
};

function formatarMoeda(valor: number | null) {
  if (valor == null) return "—";
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Balão com o passo a passo do cálculo do Custo Peça (Allied) — usado
// tanto na Consulta BID quanto na Base BID/Pendências BID (mesmo
// componente, pra não ter duas versões divergindo com o tempo).
export default function TooltipCalculoBid({
  peca,
  faixas,
  icmsPercentual,
}: {
  peca: PecaParaTooltip;
  faixas: FaixaMarkup[];
  icmsPercentual: number;
}) {
  if (peca.travado) {
    return (
      <div className="text-xs space-y-1.5 min-w-[220px]">
        <p className="font-medium flex items-center gap-1.5" style={{ color: "var(--accent2)" }}>
          <Lock size={12} /> Valor travado manualmente
        </p>
        <p style={{ color: "var(--muted)" }}>
          Esse preço foi definido na mão e não é recalculado por importação do BID nem por "Recalcular" — destrave
          pra voltar ao cálculo automático.
        </p>
        <div className="border-t pt-1.5 mt-1.5" style={{ borderColor: "var(--line)" }}>
          <p className="flex justify-between gap-4">
            <span style={{ color: "var(--muted)" }}>Custo Peça (Allied)</span>
            <strong style={{ color: "var(--accent2)" }}>{formatarMoeda(peca.custo_peca_allied)}</strong>
          </p>
        </div>
      </div>
    );
  }

  if (peca.custo_peca_samsung == null) {
    return (
      <div className="text-xs space-y-1">
        <p className="font-medium text-amber-400">Ainda sem custo calculado</p>
        <p style={{ color: "var(--muted)" }}>
          Esse Part Number ainda não foi encontrado na Base Peças — assim que for importado lá, o custo aparece aqui
          (ou clique em "Recalcular" na tela BID).
        </p>
      </div>
    );
  }

  const faixa = faixaMarkupPara(peca.custo_peca_samsung, faixas);

  return (
    <div className="text-xs space-y-1.5 min-w-[220px]">
      <p className="flex justify-between gap-4">
        <span style={{ color: "var(--muted)" }}>Custo Peça (Base Peças)</span>
        <strong>{formatarMoeda(peca.custo_peca_samsung)}</strong>
      </p>
      <p className="flex justify-between gap-4">
        <span style={{ color: "var(--muted)" }}>Faixa aplicada</span>
        <strong>
          {faixa ? `${formatarMoeda(faixa.valor_min)} ${faixa.valor_max == null ? "acima" : `– ${formatarMoeda(faixa.valor_max)}`}` : "—"}
        </strong>
      </p>
      <p className="flex justify-between gap-4">
        <span style={{ color: "var(--muted)" }}>Markup usado</span>
        <strong>{faixa ? `× ${faixa.multiplicador}` : "—"}</strong>
      </p>
      <div className="border-t pt-1.5 mt-1.5" style={{ borderColor: "var(--line)" }}>
        <p className="flex justify-between gap-4">
          <span style={{ color: "var(--muted)" }}>Cálculo</span>
          <span>
            {formatarMoeda(peca.custo_peca_samsung)} {faixa ? `× ${faixa.multiplicador}` : ""}
          </span>
        </p>
        <p className="flex justify-between gap-4">
          <span style={{ color: "var(--muted)" }}>= Valor com margem</span>
          <strong>{formatarMoeda(peca.valor_com_margem)}</strong>
        </p>
      </div>
      <div className="border-t pt-1.5 mt-1.5" style={{ borderColor: "var(--line)" }}>
        <p className="flex justify-between gap-4">
          <span style={{ color: "var(--muted)" }}>Imposto (ICMS {icmsPercentual}%)</span>
          <strong>+ {formatarMoeda(peca.valor_imposto)}</strong>
        </p>
        <p className="flex justify-between gap-4">
          <span style={{ color: "var(--muted)" }}>= Custo Peça (Allied)</span>
          <strong style={{ color: "var(--accent2)" }}>{formatarMoeda(peca.custo_peca_allied)}</strong>
        </p>
      </div>
      <p style={{ color: "var(--muted)" }}>(arredondado pra cima, sempre número inteiro)</p>
    </div>
  );
}
