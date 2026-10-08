"use client";

import GraficoLinhaGradiente, { type PontoGrafico } from "@/components/GraficoLinhaGradiente";

function formatarReal(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

/**
 * Gráficos do Financeiro (Notas emitidas x Valores recebidos) — pedido
 * explícito, 07/10/2026: trocar as barras pelo mesmo gráfico de linha
 * com sombreamento já usado em Métricas (GraficoLinhaGradiente), os dois
 * iguais, mudando só a cor. Mantém o "Total do período" no cabeçalho,
 * como era no gráfico de barras.
 *
 * Wrapper Client Component pelo mesmo motivo de GraficoEvolucaoIcms.tsx:
 * financeiro/page.tsx é Server Component e não pode passar a função de
 * formatação de moeda como prop — só os pontos (dado puro) cruzam essa
 * fronteira.
 */
export default function GraficoFinanceiroMensal({
  titulo,
  pontos,
  cor,
  mensagemVazia,
}: {
  titulo: string;
  pontos: PontoGrafico[];
  cor: string;
  mensagemVazia?: string;
}) {
  const totalPeriodo = pontos.reduce((soma, p) => soma + p.valor, 0);
  return (
    <GraficoLinhaGradiente
      titulo={titulo}
      acoes={
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          Total do período: <span style={{ color: "var(--ink)", fontWeight: 600 }}>{formatarReal(totalPeriodo)}</span>
        </p>
      }
      pontos={pontos}
      formatarValor={formatarReal}
      corLinha={cor}
      mensagemVazia={mensagemVazia}
    />
  );
}
