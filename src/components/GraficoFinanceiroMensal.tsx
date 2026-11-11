"use client";

import GraficoLinhaGradiente, { type PontoGrafico } from "@/components/GraficoLinhaGradiente";

function formatarReal(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

/**
 * Gráficos do Financeiro (Notas emitidas x Valores recebidos). Desde
 * 10/11/2026 (pedido explícito): um abaixo do outro, mais nítidos, eixo
 * horizontal em negrito, linha desenhada com animação e ícone animado no
 * título. O período (mês/semana) é escolhido em PainelFinanceiro.
 */
export default function GraficoFinanceiroMensal({
  titulo,
  pontos,
  cor,
  mensagemVazia,
  icone,
}: {
  titulo: string;
  pontos: PontoGrafico[];
  cor: string;
  mensagemVazia?: string;
  icone?: React.ReactNode;
}) {
  const totalPeriodo = pontos.reduce((soma, p) => soma + p.valor, 0);
  return (
    <GraficoLinhaGradiente
      titulo={titulo}
      icone={icone}
      acoes={
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          Total do período: <span style={{ color: "var(--ink)", fontWeight: 700 }}>{formatarReal(totalPeriodo)}</span>
        </p>
      }
      pontos={pontos}
      formatarValor={formatarReal}
      corLinha={cor}
      mensagemVazia={mensagemVazia}
      altura={280}
      eixoNegrito
      animar
    />
  );
}
