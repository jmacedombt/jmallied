"use client";

import GraficoLinhaGradiente, { type PontoGrafico } from "@/components/GraficoLinhaGradiente";
import { formatarIcms } from "@/lib/impostos";

/**
 * Envolve o GraficoLinhaGradiente (Client Component) já com o
 * formatador de ICMS por dentro — configuracoes/impostos/page.tsx (um
 * Server Component) só passa os pontos (dado puro, serializável), nunca
 * a função de formatação em si. Passar uma função como prop de Server
 * pra Client Component quebra em produção ("Functions cannot be passed
 * directly to Client Components"), mesmo funcionando local em dev.
 */
export default function GraficoEvolucaoIcms({ pontos }: { pontos: PontoGrafico[] }) {
  return (
    <GraficoLinhaGradiente
      titulo="Evolução do ICMS por mês"
      pontos={pontos}
      formatarValor={formatarIcms}
      mensagemVazia="Nenhum histórico de ICMS registrado ainda — salve um valor acima pra começar."
    />
  );
}
