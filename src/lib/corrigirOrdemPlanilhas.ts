import * as XLSX from "xlsx";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * Corrige a ORDEM das linhas em planilhas que já foram geradas ANTES da
 * coluna orcamentos.ordem_planilha existir (migrations 0064/0065) —
 * pedido explícito: "Confirmar Envio" (Histórico de Envios,
 * orcamento_envios/tipo="orcamento") e "Enviar Contra Proposta"
 * (contra_proposta_geracoes) têm que sempre sair na mesma ordem da
 * planilha original de Base de Orçamentos, mesmo as que já foram
 * geradas/baixadas antes dessa correção existir.
 *
 * Não recalcula NADA (nem peça, nem valor, nem decisão) — só troca a
 * POSIÇÃO das linhas que já existiam, usando ordem_planilha (já
 * corrigido, migration 0065) como critério. Reordenação estável: quem
 * não tem ordem_planilha (aparelho de um lote que ainda não foi
 * corrigido) mantém a posição relativa que já tinha, só vai pro final.
 *
 * (pedido explícito) A planilha inteira sai intercalada na ordem
 * original — aprovado, reprovado, já reprovado, tanto faz — sem separar
 * em blocos por status/grupo; nunca perde/duplica linha.
 *
 * Rodado uma vez (manual, botão em Sistema > Manutenção do Banco) —
 * idempotente: rodar de novo não muda nada que já esteja corrigido.
 */

type AdminClient = ReturnType<typeof createAdminClient>;

const BUCKET_ENVIOS = "envios-orcamentos";
const SENTINELA_SEM_ORDEM = Number.MAX_SAFE_INTEGER;

function construirMapaOrdem(
  linhas: { trade_allied: string; ordem_planilha: number | null }[]
): Map<string, number> {
  const mapa = new Map<string, number>();
  for (const l of linhas) {
    if (l.ordem_planilha != null) mapa.set(l.trade_allied, l.ordem_planilha);
  }
  return mapa;
}

/** Reordenação estável — Array.prototype.sort do V8/Node é estável (spec desde ES2019). */
function ordenarPorMapa<T>(itens: T[], tradeDoItem: (item: T) => string, mapaOrdem: Map<string, number>): T[] {
  return [...itens].sort((a, b) => {
    const oa = mapaOrdem.get(tradeDoItem(a)) ?? SENTINELA_SEM_ORDEM;
    const ob = mapaOrdem.get(tradeDoItem(b)) ?? SENTINELA_SEM_ORDEM;
    return oa - ob;
  });
}

export type ResultadoCorrecaoOrdem = {
  enviosVerificados: number;
  enviosCorrigidos: number;
  enviosComFalha: { id: string; nf_remessa_allied: string; erro: string }[];
  geracoesVerificadas: number;
  geracoesCorrigidas: number;
  geracoesComFalha: { id: string; nf_remessa_allied: string; erro: string }[];
};

export async function corrigirOrdemPlanilhasJaGeradas(admin: AdminClient): Promise<ResultadoCorrecaoOrdem> {
  const resultado: ResultadoCorrecaoOrdem = {
    enviosVerificados: 0,
    enviosCorrigidos: 0,
    enviosComFalha: [],
    geracoesVerificadas: 0,
    geracoesCorrigidas: 0,
    geracoesComFalha: [],
  };

  await corrigirEnviosOrcamento(admin, resultado);
  await corrigirContraPropostaGeracoes(admin, resultado);

  return resultado;
}

// ---- "Confirmar Envio" (orcamento_envios, tipo="orcamento") ----------
// arquivo já gerado fica salvo como .xlsx de verdade no Storage — pra
// corrigir, baixa, reordena TODAS as linhas juntas (sem separar
// AGUARDANDO/RECUSADO em blocos — pedido explícito) e sobrescreve o
// mesmo arquivo.
async function corrigirEnviosOrcamento(admin: AdminClient, resultado: ResultadoCorrecaoOrdem) {
  const { data: envios, error } = await admin
    .from("orcamento_envios")
    .select("id, nf_remessa_allied, arquivo_path")
    .eq("tipo", "orcamento")
    .not("arquivo_path", "is", null);

  if (error || !envios) return;

  for (const envio of envios) {
    resultado.enviosVerificados++;
    try {
      const { data: arquivo, error: erroDownload } = await admin.storage
        .from(BUCKET_ENVIOS)
        .download(envio.arquivo_path as string);
      if (erroDownload || !arquivo) throw new Error(erroDownload?.message ?? "arquivo não encontrado");

      const bytes = new Uint8Array(await arquivo.arrayBuffer());
      const workbook = XLSX.read(bytes, { type: "array", cellDates: true });
      const planilha = workbook.Sheets[workbook.SheetNames[0]];
      const linhasBrutas = XLSX.utils.sheet_to_json(planilha, { header: 1, blankrows: false }) as unknown[][];

      if (linhasBrutas.length < 2) continue; // sem dado nenhum pra reordenar

      const cabecalho = linhasBrutas[0] as string[];
      const idxTrade = cabecalho.indexOf("Trade Allied");
      if (idxTrade === -1) continue; // formato inesperado, não mexe

      const linhaTotais = linhasBrutas[linhasBrutas.length - 1];
      const linhasDados = linhasBrutas.slice(1, -1);

      // pega ordem_planilha de TODOS os aparelhos desse nf_remessa de uma vez
      const { data: ordens } = await admin
        .from("orcamentos")
        .select("trade_allied, ordem_planilha")
        .eq("nf_remessa_allied", envio.nf_remessa_allied);
      const mapaOrdem = construirMapaOrdem((ordens ?? []) as { trade_allied: string; ordem_planilha: number | null }[]);

      const tradeDaLinha = (l: unknown[]) => String(l[idxTrade] ?? "");
      const linhasOrdenadas = ordenarPorMapa(linhasDados, tradeDaLinha, mapaOrdem);

      const novasLinhas = [cabecalho, ...linhasOrdenadas, linhaTotais];

      const novaPlanilha = XLSX.utils.aoa_to_sheet(novasLinhas);
      novaPlanilha["!cols"] = cabecalho.map(() => ({ wch: 16 }));
      const novoWorkbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(novoWorkbook, novaPlanilha, "Orçamentos");
      const novoBuffer = XLSX.write(novoWorkbook, { type: "buffer", bookType: "xlsx" }) as Buffer;

      const { error: erroUpload } = await admin.storage
        .from(BUCKET_ENVIOS)
        .upload(envio.arquivo_path as string, novoBuffer, {
          contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          upsert: true,
        });
      if (erroUpload) throw new Error(erroUpload.message);

      resultado.enviosCorrigidos++;
    } catch (erro) {
      resultado.enviosComFalha.push({
        id: envio.id,
        nf_remessa_allied: envio.nf_remessa_allied,
        erro: erro instanceof Error ? erro.message : "falha desconhecida",
      });
    }
  }
}

// ---- "Enviar Contra Proposta" (contra_proposta_geracoes) --------------
// aqui não tem arquivo salvo, só o snapshot (dados.linhas) — reordena o
// próprio jsonb inteiro de uma vez, sem mexer em mais nada da geração.
// (pedido explícito) NÃO separa mais em grupos (aprovados iniciais /
// contra proposta / já reprovados) — reordena o array TODO junto, fica
// tudo intercalado pela ordem original da planilha.
type LinhaContraPropostaSnapshot = { tradeAllied?: string } & Record<string, unknown>;

async function corrigirContraPropostaGeracoes(admin: AdminClient, resultado: ResultadoCorrecaoOrdem) {
  const { data: geracoes, error } = await admin.from("contra_proposta_geracoes").select("id, nf_remessa_allied, dados");

  if (error || !geracoes) return;

  for (const geracao of geracoes) {
    resultado.geracoesVerificadas++;
    try {
      const dados = geracao.dados as { linhas?: LinhaContraPropostaSnapshot[] } | null;
      const linhas = dados?.linhas ?? [];
      if (linhas.length === 0) continue;

      const { data: ordens } = await admin
        .from("orcamentos")
        .select("trade_allied, ordem_planilha")
        .eq("nf_remessa_allied", geracao.nf_remessa_allied);
      const mapaOrdem = construirMapaOrdem((ordens ?? []) as { trade_allied: string; ordem_planilha: number | null }[]);

      const tradeDaLinha = (l: LinhaContraPropostaSnapshot) => String(l.tradeAllied ?? "");
      const novasLinhas = ordenarPorMapa(linhas, tradeDaLinha, mapaOrdem);

      const { error: erroUpdate } = await admin
        .from("contra_proposta_geracoes")
        .update({ dados: { ...dados, linhas: novasLinhas } })
        .eq("id", geracao.id);
      if (erroUpdate) throw new Error(erroUpdate.message);

      resultado.geracoesCorrigidas++;
    } catch (erro) {
      resultado.geracoesComFalha.push({
        id: geracao.id,
        nf_remessa_allied: geracao.nf_remessa_allied,
        erro: erro instanceof Error ? erro.message : "falha desconhecida",
      });
    }
  }
}
