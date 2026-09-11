import * as XLSX from "xlsx";
import nodemailer from "nodemailer";

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

/**
 * Uma linha do arquivo de envio de orçamentos pra Allied — formato FIXO,
 * definido junto com o usuário a partir de um arquivo real que a empresa
 * já manda pra Allied hoje (mesmas 71 colunas da Base Orçamentos, na
 * mesma ordem). A equipe da Allied usa exatamente essas colunas, nessa
 * ordem, pra dar entrada no sistema interno deles — NUNCA mudar nome,
 * ordem ou quantidade de colunas aqui sem confirmar com o usuário antes.
 *
 * Cada aparelho vira uma dessas — tanto os que estão avançando agora
 * (status "AGUARDANDO") quanto os que já foram reprovados antes, no
 * mesmo lote (status "RECUSADO") — ver montagem em
 * avancar-validacao-em-massa/route.ts.
 */
export type LinhaPlanilhaOrcamento = {
  reparadorTerceiro: string | null;
  nfRemessaAllied: string;
  /** já formatada "DD/MM/AAAA" — data do "Confirmar Envio", igual em
   * toda linha do arquivo (é a data do envio do lote, não do aparelho). */
  dataRespostaOrcamento: string;
  osReparadora: string | null;
  imeiReparadora: string | null;
  atendimento: string | null;
  osCareAllied: string | null;
  tradeAllied: string;
  imeiAllied: string | null;
  classificacaoAllied: string | null;
  sku: string | null;
  descricaoCompleta: string | null;
  modeloComercial: string | null;
  /** 10 posições, mesma ordem do orçamento. */
  descricaoDefeito: (string | null)[];
  /** 10 posições, mesma ordem do orçamento. */
  pecaDefeito: (string | null)[];
  /** vem da Base GSPN ("Descrição Reparação", propagada por OS
   * Reparadora pra orcamentos.observacao_tecnica_reparadora) — a mesma
   * informação vai também na coluna OBS, sem alteração. */
  observacaoTecnicaReparadora: string | null;
  /** 10 posições — Peça Solução (BID) do Part Number gravado em
   * orcamentos.peca_N; cai pro próprio Part Number quando a peça tem
   * custo cadastrado mas nenhuma Peça Solução registrada no BID. */
  peca: (string | null)[];
  /** 5 posições — Peça Solução (BID) das peças adicionais (Reorçamento,
   * posições "Extra 1".."Extra 5"); em branco pra quem não é envio de
   * planilha Complementar. */
  pecaAdd: (string | null)[];
  /** 10 posições — Venda de Peça (custo com markup da faixa BID +
   * ICMS) de cada posição, calculada no momento do Confirmar Envio.
   * null nas posições sem peça, ou no aparelho RECUSADO. */
  custoPeca: (number | null)[];
  /** 5 posições — Venda de Peça das peças adicionais (Reorçamento),
   * mesma conta de custoPeca; em branco pra quem não é envio de
   * planilha Complementar. */
  custoPecaAdd: (number | null)[];
  /** soma da Venda de Peça de todas as posições — 0 no RECUSADO. */
  valorTotalPeca: number;
  /** 0 no RECUSADO. */
  maoDeObra: number;
  /** valorTotalPeca + maoDeObra — 0 no RECUSADO. */
  valorTotalReparo: number;
  /** "CONTRA PROPOSTA" só é usado no envio de Contra Proposta (Ag. Contra
   * Proposta > Enviar Contra Proposta) — mesmo arquivo/formato, valor
   * novo na coluna STATUS ORÇAMENTO. "COMPLEMENTAR" é o mesmo esquema,
   * usado no envio da planilha Complementar (4 - Ag. Resposta de
   * Reorçamento > Enviar planilha Complementar). */
  statusOrcamento: "AGUARDANDO" | "RECUSADO" | "CONTRA PROPOSTA" | "COMPLEMENTAR";
  /** só preenchido no RECUSADO. */
  motivoReprova: string | null;
  /** sempre igual a observacaoTecnicaReparadora. */
  obs: string | null;
};

const CABECALHO_PLANILHA_ORCAMENTOS = [
  "Reparador Terceiro",
  "NF Remessa Allied",
  "Data Resposta Orçamento",
  "OS Reparadora",
  "IMEI Reparadora",
  "Atendimento",
  "OS Care Allied",
  "Trade Allied",
  "IMEI Allied",
  "Classificação Allied",
  "SKU",
  "DESCRIÇÃO COMPLETA",
  "MODELO COMERCIAL",
  ...Array.from({ length: 10 }, (_, i) => `DESCRIÇÃO DEFEITO ${i + 1}`),
  ...Array.from({ length: 10 }, (_, i) => `PEÇA DEFEITO ${i + 1}`),
  "Observação Técnica Reparadora",
  ...Array.from({ length: 10 }, (_, i) => `PEÇA ${i + 1}`),
  ...Array.from({ length: 5 }, (_, i) => `PEÇA ADD ${i + 1}`),
  ...Array.from({ length: 10 }, (_, i) => `CUSTO PEÇA ${i + 1}`),
  ...Array.from({ length: 5 }, (_, i) => `CUSTO PEÇA ADD ${i + 1}`),
  "VALOR TOTAL PEÇA",
  "MÃO DE OBRA",
  "VALOR TOTAL DE REPARO",
  "TIPO ORÇAMENTO",
  "STATUS ORÇAMENTO",
  "MOTIVO REPROVA",
  "OBS",
] as const;

const IDX_VALOR_TOTAL_PECA = CABECALHO_PLANILHA_ORCAMENTOS.indexOf("VALOR TOTAL PEÇA");
const IDX_MAO_DE_OBRA = CABECALHO_PLANILHA_ORCAMENTOS.indexOf("MÃO DE OBRA");
const IDX_VALOR_TOTAL_REPARO = CABECALHO_PLANILHA_ORCAMENTOS.indexOf("VALOR TOTAL DE REPARO");

function vazioOuTexto(v: string | null): string {
  return v ?? "";
}

function vazioOuNumero(v: number | null): number | "" {
  return v ?? "";
}

/**
 * Monta o Excel (uma linha por aparelho, mais uma linha final de totais)
 * enviado em anexo ao confirmar o envio de um lote em Validação de
 * Orçamentos — formato fixo definido com o usuário, ver
 * LinhaPlanilhaOrcamento acima.
 */
export function montarPlanilhaOrcamentos(linhas: LinhaPlanilhaOrcamento[]): Buffer {
  const corpo = linhas.map((l) => [
    vazioOuTexto(l.reparadorTerceiro),
    l.nfRemessaAllied,
    l.dataRespostaOrcamento,
    vazioOuTexto(l.osReparadora),
    vazioOuTexto(l.imeiReparadora),
    vazioOuTexto(l.atendimento),
    vazioOuTexto(l.osCareAllied),
    l.tradeAllied,
    vazioOuTexto(l.imeiAllied),
    vazioOuTexto(l.classificacaoAllied),
    vazioOuTexto(l.sku),
    vazioOuTexto(l.descricaoCompleta),
    vazioOuTexto(l.modeloComercial),
    ...l.descricaoDefeito.map(vazioOuTexto),
    ...l.pecaDefeito.map(vazioOuTexto),
    vazioOuTexto(l.observacaoTecnicaReparadora),
    ...l.peca.map(vazioOuTexto),
    ...l.pecaAdd.map(vazioOuTexto),
    ...l.custoPeca.map(vazioOuNumero),
    ...l.custoPecaAdd.map(vazioOuNumero),
    l.valorTotalPeca,
    l.maoDeObra,
    l.valorTotalReparo,
    "", // TIPO ORÇAMENTO — sempre vazio
    l.statusOrcamento,
    vazioOuTexto(l.motivoReprova),
    vazioOuTexto(l.obs),
  ]);

  // linha de totais no final, igual ao modelo real da Allied — soma só
  // Valor Total Peça / Mão de Obra / Valor Total de Reparo, resto vazio.
  const linhaTotais = CABECALHO_PLANILHA_ORCAMENTOS.map(() => "" as string | number);
  linhaTotais[IDX_VALOR_TOTAL_PECA] = linhas.reduce((soma, l) => soma + l.valorTotalPeca, 0);
  linhaTotais[IDX_MAO_DE_OBRA] = linhas.reduce((soma, l) => soma + l.maoDeObra, 0);
  linhaTotais[IDX_VALOR_TOTAL_REPARO] = linhas.reduce((soma, l) => soma + l.valorTotalReparo, 0);

  const planilha = XLSX.utils.aoa_to_sheet([[...CABECALHO_PLANILHA_ORCAMENTOS], ...corpo, linhaTotais]);
  planilha["!cols"] = CABECALHO_PLANILHA_ORCAMENTOS.map(() => ({ wch: 16 }));
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

/**
 * Envia um e-mail com anexo pela conta do Gmail da empresa, via SMTP
 * (smtp.gmail.com) — usado enquanto o domínio próprio não está
 * verificado no Resend (ver enviarEmailResend acima, que continua aqui
 * pronta pra voltar a ser usada assim que o domínio verificar, bastando
 * trocar a chamada em avancar-validacao-em-massa).
 *
 * Exige uma "senha de app" do Gmail (não é a senha normal da conta) —
 * só existe depois de ativar a verificação em duas etapas na conta
 * Google. O endereço que efetivamente envia é sempre o da conta
 * autenticada (gmailUser); o Gmail ignora/rejeita um "from" diferente
 * disso, então o nome de exibição configurável em Configurações > E-mail
 * entra como nome, nunca como endereço.
 */
export async function enviarEmailGmail(params: {
  gmailUser: string;
  gmailSenhaApp: string;
  remetenteNome: string;
  destinatarios: string[];
  assunto: string;
  corpoHtml: string;
  anexoNomeArquivo: string;
  anexoBuffer: Buffer;
}): Promise<{ id: string }> {
  const transportador = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: params.gmailUser,
      pass: params.gmailSenhaApp,
    },
  });

  const info = await transportador.sendMail({
    from: `"${params.remetenteNome}" <${params.gmailUser}>`,
    to: params.destinatarios,
    subject: params.assunto,
    html: params.corpoHtml,
    attachments: [
      {
        filename: params.anexoNomeArquivo,
        content: params.anexoBuffer,
      },
    ],
  });

  return { id: info.messageId ?? "" };
}
