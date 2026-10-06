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
 * Etiqueta de CAIXA (Ag. Emissão de Nota Fiscal) — usada pra colar nas
 * caixas de aparelhos que voltam pra Allied. Mesma etiqueta 60x40mm e
 * mesmo Allied Print Agent do `imprimirViaAgente` acima, só que com um
 * layout de campos diferente (ver AlliedPrintAgent/etiqueta.py,
 * `gerar_zpl_caixa`): LOTE, VOLUME "X/Y", NF DE RETORNO (fonte maior e
 * em negrito), OBSERVAÇÃO (APROVADO/REPROVADO) e NF DE ENTRADA.
 *
 * Usada em 3 lugares da tela: o botão "Etiqueta de Caixa" de cada linha
 * (imprime uma etiqueta por caixa, calculado com base na quantidade de
 * aparelhos daquele lote — 21 por caixa), o "Teste de Impressão" (dados
 * fixos, só pra checar alinhamento na Zebra) e a "Etiqueta Avulsa"
 * (campos preenchidos manualmente no pop-up).
 */
export type DadosEtiquetaCaixa = {
  lote: number | string;
  volumeAtual: number | string;
  volumeTotal: number | string;
  nfRetorno: string;
  observacao: string;
  nfEntrada: string;
};

export async function imprimirCaixaViaAgente(dados: DadosEtiquetaCaixa): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${ENDERECO_PRINT_AGENT}/imprimir-caixa`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lote: dados.lote,
        volume_atual: dados.volumeAtual,
        volume_total: dados.volumeTotal,
        nf_retorno: dados.nfRetorno,
        observacao: dados.observacao,
        nf_entrada: dados.nfEntrada,
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

/** Quantas etiquetas de caixa uma NF Remessa gera — 21 aparelhos por
 * caixa (pedido explícito), sempre pelo menos 1 mesmo com 0 itens. */
export function quantidadeCaixas(quantidadeAparelhos: number): number {
  return Math.max(1, Math.ceil(quantidadeAparelhos / 21));
}

/**
 * Imprime, em sequência, todas as etiquetas de caixa de um lote (NF
 * Remessa) — LOTE e VOLUME reiniciam em 1 a cada chamada (pedido
 * explícito: reinicia a cada NF Remessa). Para no primeiro erro e avisa
 * quantas já saíram, pra não duplicar impressão ao tentar de novo.
 *
 * `totalCaixas` sobrescreve o cálculo automático (21 aparelhos por
 * caixa) — pedido explícito: dar a opção de ajustar a quantidade de
 * etiquetas na hora de confirmar a impressão (ver
 * PopupConfirmarEtiquetaCaixa), pra quando a separação física das
 * caixas não bater exatamente com a conta.
 */
export async function imprimirLoteDeCaixas(dados: {
  nfRetorno: string;
  observacao: string;
  nfEntrada: string;
  quantidadeAparelhos: number;
  totalCaixas?: number;
}): Promise<void> {
  const total = dados.totalCaixas ?? quantidadeCaixas(dados.quantidadeAparelhos);
  for (let atual = 1; atual <= total; atual++) {
    try {
      await imprimirCaixaViaAgente({
        lote: atual,
        volumeAtual: atual,
        volumeTotal: total,
        nfRetorno: dados.nfRetorno,
        observacao: dados.observacao,
        nfEntrada: dados.nfEntrada,
      });
    } catch (erro) {
      const mensagem = erro instanceof ErroImpressaoAgente ? erro.message : "Erro inesperado ao imprimir.";
      throw new ErroImpressaoAgente(
        atual === 1
          ? `Falhou ao imprimir a 1ª etiqueta de caixa: ${mensagem}`
          : `Imprimiu ${atual - 1} de ${total} etiqueta(s) e falhou na próxima: ${mensagem}`
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
