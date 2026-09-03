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

async function confirmarImpressao(logId: string, sucesso: boolean, mensagemErro?: string) {
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

/**
 * Fluxo completo de uma bipagem (código -> localizar -> imprimir ->
 * confirmar), usado tanto no popup de bipar/imprimir individual (Ag.
 * Triagem e Impressão Avulsa) quanto na confirmação em massa (seleção
 * de várias linhas de uma vez em Ag. Triagem) — pra não ter duas cópias
 * dessa lógica podendo divergir.
 */
export async function processarBipagem(codigo: string, modo: TipoBipagem): Promise<ResultadoBipagem> {
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

  try {
    await imprimirViaAgente({
      os_reparadora: orc.os_reparadora,
      nf_remessa_allied: orc.nf_remessa_allied,
      modelo_comercial: orc.modelo_comercial,
    });
  } catch (erro) {
    const mensagem = erro instanceof ErroImpressaoAgente ? erro.message : "Erro inesperado ao imprimir.";
    await confirmarImpressao(data.logId, false, mensagem);
    return { ok: false, mensagem: `OS ${orc.os_reparadora} encontrada, mas falhou ao imprimir: ${mensagem}` };
  }

  await confirmarImpressao(data.logId, true);
  return {
    ok: true,
    mensagem:
      `OS ${orc.os_reparadora} | NF ${orc.nf_remessa_allied} | ${orc.modelo_comercial ?? "—"} — etiqueta enviada.` +
      (modo === "triagem" ? " Avançou para 2 - Ag. Análise." : ""),
  };
}
