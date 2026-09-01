/**
 * Regras da impressão de etiqueta (popup de bipagem na Ag. Triagem e
 * menu Impressão > Impressão Avulsa).
 *
 * A impressão de fato não acontece no servidor: o navegador manda os
 * dados pro "Allied Print Agent", um programinha local (instalado no PC
 * que tem a Zebra ZD220 plugada) que fica escutando em localhost e fala
 * com a impressora — igual ao Samsung Tools que deu origem a essa
 * rotina, só que acionado pela tela web em vez de ler planilha.
 */

// endereço local do Allied Print Agent (ver pasta AlliedPrintAgent,
// entregue separado do sistema web — roda no PC da impressora)
export const ENDERECO_PRINT_AGENT = "http://127.0.0.1:47811";

export type TipoBipagem = "triagem" | "avulsa";

export type OrcamentoParaEtiqueta = {
  id: string;
  os_reparadora: string | null;
  nf_remessa_allied: string;
  os_care_allied: string | null;
  trade_allied: string;
  imei_allied: string | null;
  modelo_comercial: string | null;
  sku: string | null;
  descricao_completa: string | null;
  status_operacional: string;
};

export type RespostaLocalizar = {
  logId: string;
  encontrado: boolean;
  orcamento: OrcamentoParaEtiqueta | null;
  error?: string;
};

export class ErroImpressaoAgente extends Error {}

/** Manda os dados da etiqueta pro Allied Print Agent (localhost) imprimir
 * na Zebra. Lança ErroImpressaoAgente com mensagem amigável se o agente
 * não estiver rodando nesse computador ou a impressão falhar. */
export async function imprimirViaAgente(dados: {
  os_reparadora: string;
  nf_remessa_allied: string;
  modelo_comercial: string | null;
}): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${ENDERECO_PRINT_AGENT}/imprimir`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dados),
    });
  } catch {
    throw new ErroImpressaoAgente(
      "Não consegui falar com o Allied Print Agent nesse computador. Confirme se ele está aberto (ícone/console do programa deve estar ativo)."
    );
  }

  let corpo: { ok?: boolean; erro?: string } = {};
  try {
    corpo = await res.json();
  } catch {
    // resposta sem corpo/JSON — segue só com o status HTTP
  }

  if (!res.ok || !corpo.ok) {
    throw new ErroImpressaoAgente(corpo.erro || `O Allied Print Agent recusou a impressão (HTTP ${res.status}).`);
  }
}
