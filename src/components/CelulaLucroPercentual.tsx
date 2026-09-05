"use client";

function formatarPercentual(valor: number): string {
  return `${valor.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

// Faixas de cor do % Lucro Total, conforme definido pelo Rafael: abaixo
// de 20% é alerta (vermelho), 20–30% atenção (laranja), 30–40% saudável
// (verde), acima de 40% ótimo (azul).
export function corPercentualLucro(percentual: number): string {
  if (percentual < 20) return "#ef4444";
  if (percentual < 30) return "#f97316";
  if (percentual < 40) return "#22c55e";
  return "#3b82f6";
}

// Célula da coluna "Lucro Total %": só mostra o percentual colorido pela
// faixa — sem balão, sem clique, sem pop-up nenhum. O detalhamento
// completo do cálculo (custo, imposto, venda, mão de obra, lucro) fica a
// cargo do clique na LINHA do orçamento (abre PopupPecasValidacao, que já
// mostra tudo isso ordenado).
export default function CelulaLucroPercentual({ percLucroTotal }: { percLucroTotal: number }) {
  const cor = corPercentualLucro(percLucroTotal);

  return (
    <span
      className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold"
      style={{ color: cor, background: `${cor}1a`, border: `1px solid ${cor}55` }}
    >
      {formatarPercentual(percLucroTotal)}
    </span>
  );
}
