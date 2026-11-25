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

/**
 * Etiqueta de CAIXA (Ag. Emissão de Nota Fiscal e Impressão Avulsa NF
 * Retorno) — colada nas caixas de aparelhos que voltam pra Allied. Mesma
 * etiqueta 60x40mm e mesmo Allied Print Agent do `imprimirViaAgente`
 * acima; layout no padrão da Allied desde 25/11/2026 (ver
 * AlliedPrintAgent/etiqueta.py, `gerar_zpl_caixa_allied`).
 */
export type TipoRetornoCaixa = "REPARO" | "REINCIDÊNCIA";
export type StatusCaixa = "APROVADO" | "REPROVADO";

/** Etiqueta de caixa no padrão da Allied (pedido explícito, 25/11/2026 —
 * e-mail "Modelo de Etiqueta para os Próximos Lotes"). Os 9 campos do
 * modelo: reparadora, tipo de retorno, status, NF Retorno, NF Peça, NF
 * Serviço, quantidade na caixa, NF de envio e Caixa X de Y. NF Peça /
 * Serviço vazias saem com linha em branco pra preencher à mão. */
export type DadosEtiquetaCaixa = {
  reparadora: string;
  tipo: TipoRetornoCaixa;
  status: StatusCaixa;
  nfRetorno: string;
  nfPeca: string;
  nfServico: string;
  qtde: number | string;
  nfEnvio: string;
  caixaAtual: number | string;
  caixaTotal: number | string;
};

export const REPARADORA_PADRAO = "J MACEDO";
export const APARELHOS_POR_CAIXA = 21;

export async function imprimirCaixaViaAgente(dados: DadosEtiquetaCaixa): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${ENDERECO_PRINT_AGENT}/imprimir-caixa`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        modelo: "allied",
        reparadora: dados.reparadora,
        tipo: dados.tipo,
        status: dados.status,
        nf_retorno: dados.nfRetorno,
        nf_peca: dados.nfPeca,
        nf_servico: dados.nfServico,
        qtde: dados.qtde,
        nf_envio: dados.nfEnvio,
        caixa_atual: dados.caixaAtual,
        caixa_total: dados.caixaTotal,
        // campos do layout antigo — se o Print Agent desse PC ainda não
        // foi atualizado, ele ignora "modelo" e imprime no formato antigo
        // em vez de dar erro.
        lote: dados.caixaAtual,
        volume_atual: dados.caixaAtual,
        volume_total: dados.caixaTotal,
        observacao: dados.status,
        nf_entrada: dados.nfEnvio,
      }),
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

/** Quantas caixas a sugestão automática usa — 21 aparelhos por caixa,
 * sempre pelo menos 1. */
export function quantidadeCaixas(quantidadeAparelhos: number): number {
  return Math.max(1, Math.ceil(quantidadeAparelhos / APARELHOS_POR_CAIXA));
}

/** Sugestão de divisão em caixas: 21 por caixa e a última com o resto
 * (ex.: 47 → [21, 21, 5]). O operador ajusta antes de imprimir. */
export function sugerirDivisaoCaixas(quantidadeAparelhos: number): number[] {
  if (quantidadeAparelhos <= 0) return [0];
  const caixas: number[] = [];
  let resto = quantidadeAparelhos;
  while (resto > 0) {
    caixas.push(Math.min(APARELHOS_POR_CAIXA, resto));
    resto -= APARELHOS_POR_CAIXA;
  }
  return caixas;
}

/**
 * Imprime, em sequência, uma etiqueta por caixa de um grupo (mesmo lote,
 * mesmo status, mesmo tipo de retorno) — "Caixa 1 de N" ... "N de N",
 * cada uma com a quantidade que o operador informou na montagem
 * (pedido explícito, 25/11/2026: imprimir no fim, depois de montar as
 * caixas). Para no primeiro erro e avisa quantas já saíram, pra não
 * duplicar impressão ao tentar de novo.
 */
export async function imprimirCaixasDoGrupo(
  base: Omit<DadosEtiquetaCaixa, "qtde" | "caixaAtual" | "caixaTotal">,
  quantidadesPorCaixa: number[],
  aoImprimir?: (impressas: number) => void
): Promise<void> {
  const total = quantidadesPorCaixa.length;
  for (let i = 0; i < total; i++) {
    try {
      await imprimirCaixaViaAgente({ ...base, qtde: quantidadesPorCaixa[i], caixaAtual: i + 1, caixaTotal: total });
      aoImprimir?.(i + 1);
    } catch (erro) {
      const mensagem = erro instanceof ErroImpressaoAgente ? erro.message : "Erro inesperado ao imprimir.";
      throw new ErroImpressaoAgente(
        i === 0
          ? `Falhou ao imprimir a 1ª etiqueta (${base.tipo} - ${base.status}): ${mensagem}`
          : `Imprimiu ${i} de ${total} etiqueta(s) de ${base.tipo} - ${base.status} e falhou na próxima: ${mensagem}`
      );
    }
  }
}

/** Grava o resultado real de uma impressão (ou o cancelamento dela) no
 * log criado por `localizarParaEtiqueta` — exportada porque, no fluxo
 * com prévia (Impressão Avulsa, ver PainelBipagem), quem decide quando
 * confirmar é a tela (depois do operador clicar "Confirmar e
 * Imprimir"), não mais essa lib sozinha. */
export async function confirmarImpressao(logId: string, sucesso: boolean, mensagemErro?: string) {
  try {
    await fetch(`/api/operacional/etiquetas/${logId}/confirmar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sucesso, mensagem_erro: mensagemErro }),
    });
  } catch {
    // a impressão/pedido já foi resolvido de um jeito ou de outro — só
    // o registro do histórico no banco que pode não ter sido salvo
  }
}

export type ResultadoBipagem = { ok: boolean; mensagem: string };

export type ResultadoLocalizar =
  | { ok: true; logId: string; orcamento: OrcamentoParaEtiqueta & { os_reparadora: string } }
  | { ok: false; mensagem: string };

/** Primeira metade de uma bipagem: acha o aparelho pelo código e já
 * grava o log (etiquetas_impressoes) — sem imprimir nada ainda. Usada
 * direto pelo fluxo com prévia (Impressão Avulsa, pedido explícito
 * 06/10/2026: "quando imprimir quero o preview na tela") e por dentro
 * de `processarBipagem` (fluxo direto, sem prévia, de Ag. Triagem). Já
 * resolve sozinha o caso "achou mas sem OS Reparadora" (não dá pra
 * imprimir etiqueta nenhuma, prévia ou não), fechando o log como
 * falha. */
export async function localizarParaEtiqueta(codigo: string, modo: TipoBipagem): Promise<ResultadoLocalizar> {
  const res = await fetch("/api/operacional/etiquetas/localizar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ codigo, tipo: modo }),
  });
  const data: RespostaLocalizar = await res.json();

  if (!res.ok) {
    return { ok: false, mensagem: data.error || "Erro ao buscar esse código." };
  }

  if (!data.encontrado || !data.orcamento) {
    return {
      ok: false,
      mensagem:
        modo === "triagem"
          ? `Código "${codigo}" não encontrado em Ag. Triagem.`
          : `Código "${codigo}" não encontrado na base de orçamentos.`,
    };
  }

  const orc = data.orcamento;

  if (!orc.os_reparadora) {
    await confirmarImpressao(data.logId, false, "Aparelho ainda sem OS Reparadora registrada.");
    return {
      ok: false,
      mensagem: `${orc.trade_allied} encontrado, mas ainda sem OS Reparadora — não dá pra imprimir a etiqueta.`,
    };
  }

  return { ok: true, logId: data.logId, orcamento: { ...orc, os_reparadora: orc.os_reparadora } };
}

/**
 * Fluxo completo de uma bipagem, direto (localizar -> imprimir ->
 * confirmar), sem prévia — usado em Ag. Triagem (bipagem rápida em
 * sequência, não dá pra parar em cada uma pra confirmar na tela) e na
 * confirmação em massa (seleção de várias linhas de uma vez). A
 * Impressão Avulsa NÃO usa mais essa função direto — ver
 * localizarParaEtiqueta + confirmarImpressao em PainelBipagem, que
 * intercalam a prévia antes de imprimir de fato.
 */
export async function processarBipagem(codigo: string, modo: TipoBipagem): Promise<ResultadoBipagem> {
  const localizado = await localizarParaEtiqueta(codigo, modo);
  if (!localizado.ok) {
    return { ok: false, mensagem: localizado.mensagem };
  }

  const orc = localizado.orcamento;

  try {
    await imprimirViaAgente({
      os_reparadora: orc.os_reparadora,
      nf_remessa_allied: orc.nf_remessa_allied,
      modelo_comercial: orc.modelo_comercial,
    });
  } catch (erro) {
    const mensagem = erro instanceof ErroImpressaoAgente ? erro.message : "Erro inesperado ao imprimir.";
    await confirmarImpressao(localizado.logId, false, mensagem);
    return { ok: false, mensagem: `OS ${orc.os_reparadora} encontrada, mas falhou ao imprimir: ${mensagem}` };
  }

  await confirmarImpressao(localizado.logId, true);
  return {
    ok: true,
    mensagem:
      `OS ${orc.os_reparadora} | NF ${orc.nf_remessa_allied} | ${orc.modelo_comercial ?? "—"} — etiqueta enviada.` +
      (modo === "triagem" ? " Avançou para 2 - Ag. Análise." : ""),
  };
}
