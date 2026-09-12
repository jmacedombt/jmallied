import { Wallet } from "lucide-react";
import { COR_MAO_DE_OBRA, COR_VENDA_PECAS } from "@/lib/metricas";

function formatarReal(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const TITULO_POR_VARIANTE = {
  receber: "Mão de Obra + Peças (venda) previstas a receber, só dos aparelhos parados nessa etapa agora",
  reprovado: "Mão de Obra + Peças (venda) do orçamento reprovado pela Allied — valor que não será recebido",
} as const;

/**
 * Pill do topo das telas "5 - Ag. Peças", "6 - Ag. Reparo",
 * "OQC - Controle de Qualidade", "7 - Reparo Finalizado" e
 * "8 - Orçamento Reprovado" (ao lado do botão voltar) — soma de Mão de
 * Obra e de Peças (venda) só dos aparelhos daquela etapa. Nas 4
 * primeiras é valor já aprovado pela Allied (o que vamos receber); em
 * "8 - Orçamento Reprovado" é o valor que tinha sido calculado mas foi
 * recusado (variante="reprovado" troca só o texto do tooltip, o resto
 * do visual é o mesmo pra ficar reconhecível como a mesma métrica).
 * Mesmo estilo/tamanho dos outros badges dessas telas
 * (badgeContador/badgeRTat em operacional/[slug]/page.tsx), mesmas
 * cores do gráfico de Métricas > Previsão de Recebimento. Ícone de
 * carteira no início identifica a pill como "valor em dinheiro" à
 * primeira vista.
 */
export default function CardValorPrevisao({
  maoDeObra,
  vendaPecas,
  indisponivel = false,
  variante = "receber",
}: {
  maoDeObra: number;
  vendaPecas: number;
  /** true quando a busca no banco falhou (ex: a migration 0040 ainda não
   * rodou no Supabase) — mostra "—" em vez de "R$ 0,00", que enganaria
   * fazendo parecer que não tem nada a receber quando na verdade é só
   * indisponível no momento. */
  indisponivel?: boolean;
  /** "reprovado" só muda o texto do tooltip (a etapa "8 - Orçamento
   * Reprovado" não é dinheiro a receber, é o valor que foi recusado). */
  variante?: "receber" | "reprovado";
}) {
  return (
    <span
      className="inline-flex items-center gap-3 rounded-full border px-3 py-1 text-xs font-medium mb-3 ml-2"
      style={{ borderColor: "var(--line)", background: "var(--surface2)" }}
      title={
        indisponivel
          ? "Não foi possível calcular agora — confira se a migration 0040_previsao_recebimento.sql já rodou no Supabase."
          : TITULO_POR_VARIANTE[variante]
      }
    >
      <Wallet size={13} style={{ color: "var(--muted)" }} aria-hidden="true" />
      <span className="inline-flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: COR_MAO_DE_OBRA }} />
        <span style={{ color: "var(--muted)" }}>Mão de Obra</span>
        <strong style={{ color: "var(--ink)" }}>{indisponivel ? "—" : formatarReal(maoDeObra)}</strong>
      </span>
      <span style={{ color: "var(--line)" }}>|</span>
      <span className="inline-flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: COR_VENDA_PECAS }} />
        <span style={{ color: "var(--muted)" }}>Peças</span>
        <strong style={{ color: "var(--ink)" }}>{indisponivel ? "—" : formatarReal(vendaPecas)}</strong>
      </span>
    </span>
  );
}
