import { COR_MAO_DE_OBRA, COR_VENDA_PECAS } from "@/lib/metricas";

function formatarReal(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * Pill do topo das telas "5 - Ag. Peças", "6 - Ag. Reparo" e
 * "7 - Reparo Finalizado" (ao lado do botão voltar) — soma de Mão de
 * Obra e de Peças (venda) só dos aparelhos daquela etapa, já aprovados
 * pela Allied (é o que vamos receber). Mesmo estilo/tamanho dos outros
 * badges dessas telas (badgeContador/badgeRTat em
 * operacional/[slug]/page.tsx), mesmas cores do gráfico de Métricas >
 * Previsão de Recebimento, pra ficar reconhecível como a mesma métrica.
 */
export default function CardValorPrevisao({
  maoDeObra,
  vendaPecas,
  indisponivel = false,
}: {
  maoDeObra: number;
  vendaPecas: number;
  /** true quando a busca no banco falhou (ex: a migration 0040 ainda não
   * rodou no Supabase) — mostra "—" em vez de "R$ 0,00", que enganaria
   * fazendo parecer que não tem nada a receber quando na verdade é só
   * indisponível no momento. */
  indisponivel?: boolean;
}) {
  return (
    <span
      className="inline-flex items-center gap-3 rounded-full border px-3 py-1 text-xs font-medium mb-3 ml-2"
      style={{ borderColor: "var(--line)", background: "var(--surface2)" }}
      title={
        indisponivel
          ? "Não foi possível calcular agora — confira se a migration 0040_previsao_recebimento.sql já rodou no Supabase."
          : "Mão de Obra + Peças (venda) previstas a receber, só dos aparelhos parados nessa etapa agora"
      }
    >
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
