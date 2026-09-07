import * as XLSX from "xlsx";

// mesmo grupo de cargos que já mexe nas outras telas de Configurações
// (Mão de obra, Faixas de Markup, Imposto) — Estoque, Supervisor,
// Gerente e Administrador.
export { podeImportarOrcamentos as podeConfigurarEmail } from "@/lib/orcamentos";

export type ConfiguracaoEmail = {
  remetente_nome: string;
  remetente_email: string | null;
  assunto_padrao: string;
  corpo_padrao: string;
};

export type DestinatarioEmail = {
  id: string;
  email: string;
  nome: string | null;
  ativo: boolean;
};

/**
 * Substitui os placeholders {{chave}} do texto (assunto/corpo) pelos
 * valores do lote — placeholder sem valor correspondente fica como
 * está (não vira vazio nem quebra o envio).
 */
export function preencherModeloEmail(texto: string, dados: Record<string, string | number>): string {
  return texto.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, chave: string) => {
    const valor = dados[chave];
    return valor !== undefined ? String(valor) : match;
  });
}

export type LinhaPlanilhaOrcamento = {
  nfRemessa: string;
  osReparadora: string | null;
  osCareAllied: string | null;
  tradeAllied: string;
  modeloComercial: string | null;
  sku: string | null;
  quantidadePecas: number;
  custoTotalPecas: number;
  impostoTotalPecas: number;
  vendaTotalPecas: number;
  maoDeObra: number;
  lucroTotal: number;
};

/**
 * Monta o Excel (uma linha por aparelho) enviado em anexo ao confirmar o
 * envio de um lote em Validação de Orçamentos. Formato PROVISÓRIO — só
 * pra já ter a rotina de ponta a ponta funcionando; os campos/colunas
 * finais ainda vão ser ajustados aqui quando definidos.
 */
export function montarPlanilhaOrcamentos(linhas: LinhaPlanilhaOrcamento[]): Buffer {
  const cabecalho = [
    "NF Remessa",
    "OS Reparadora",
    "OS Care Allied",
    "Trade Allied",
    "Modelo comercial",
    "SKU",
    "Quantidade de Peças",
    "Custo de Peças",
    "Imposto (ICMS)",
    "Venda de Peças",
    "Mão de obra",
    "Lucro Total",
  ];
  const corpo = linhas.map((l) => [
    l.nfRemessa,
    l.osReparadora ?? "",
    l.osCareAllied ?? "",
    l.tradeAllied,
    l.modeloComercial ?? "",
    l.sku ?? "",
    l.quantidadePecas,
    l.custoTotalPecas,
    l.impostoTotalPecas,
    l.vendaTotalPecas,
    l.maoDeObra,
    l.lucroTotal,
  ]);

  const planilha = XLSX.utils.aoa_to_sheet([cabecalho, ...corpo]);
  planilha["!cols"] = cabecalho.map(() => ({ wch: 18 }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, planilha, "Orçamentos");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

/**
 * Envia um e-mail com anexo via API do Resend (chamada HTTP direta, sem
 * SDK — evita mais uma dependência só pra uma chamada). Lança erro se a
 * chamada falhar; quem chama decide se isso deve impedir ou não o resto
 * da operação (ver uso em avancar-validacao-em-massa).
 */
export async function enviarEmailResend(params: {
  apiKey: string;
  remetente: string; // formato "Nome <email@dominio-verificado>"
  destinatarios: string[];
  assunto: string;
  corpoHtml: string;
  anexoNomeArquivo: string;
  anexoBuffer: Buffer;
}): Promise<{ id: string }> {
  const resposta = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: params.remetente,
      to: params.destinatarios,
      subject: params.assunto,
      html: params.corpoHtml,
      attachments: [
        {
          filename: params.anexoNomeArquivo,
          content: params.anexoBuffer.toString("base64"),
        },
      ],
    }),
  });

  const dados = await resposta.json().catch(() => null);
  if (!resposta.ok) {
    throw new Error(dados?.message || `Falha ao enviar e-mail (HTTP ${resposta.status}).`);
  }
  return { id: dados?.id ?? "" };
}
