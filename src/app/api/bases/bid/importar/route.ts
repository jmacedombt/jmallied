import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import {
  COL_BID_MODELO,
  COL_BID_PART_NUMBER,
  COL_BID_PECA_SOLUCAO,
  calcularCustoPecaAllied,
  direcaoValor,
  podeImportarBid,
  prefixoPartNumber,
  type FaixaMarkup,
} from "@/lib/bid";

// arquivo grande (milhares de linhas) — evita timeout curto
export const maxDuration = 60;

const TAMANHO_LOTE = 400;

type LinhaBrutaBid = {
  modelo: string;
  part_number: string;
  peca_solucao: string;
  mao_de_obra: number | null;
};

type PecaExistente = {
  id: string;
  modelo: string;
  part_number: string;
  custo_peca_samsung: number | null;
  valor_com_margem: number | null;
  custo_peca_allied: number | null;
  valor_imposto: number | null;
  valor_atualizado_em: string;
  valor_direcao: "+" | "-" | null;
  mao_de_obra: number | null;
  travado: boolean;
};

function valoresDiferentes(a: number | null, b: number | null): boolean {
  if (a == null && b == null) return false;
  if (a == null || b == null) return true;
  return Math.abs(a - b) > 0.001;
}

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: perfil } = await admin.from("usuarios").select("cargo, is_master").eq("id", user.id).single();

  if (!podeImportarBid(perfil)) {
    return NextResponse.json({ error: "Seu cargo não tem permissão para importar o BID." }, { status: 403 });
  }

  const formData = await request.formData();
  const arquivo = formData.get("arquivo");

  if (!(arquivo instanceof File)) {
    return NextResponse.json({ error: "Envie um arquivo .xlsx." }, { status: 400 });
  }

  const bytes = Buffer.from(await arquivo.arrayBuffer());

  let linhasBrutas: unknown[][];
  try {
    const workbook = XLSX.read(bytes, { type: "buffer", cellDates: true });
    const planilha = workbook.Sheets[workbook.SheetNames[0]];
    linhasBrutas = XLSX.utils.sheet_to_json(planilha, { header: 1, blankrows: false }) as unknown[][];
  } catch {
    return NextResponse.json(
      { error: "Não consegui ler esse arquivo. Confirme que é uma planilha .xlsx válida." },
      { status: 400 }
    );
  }

  const linhasDados = linhasBrutas.slice(1);

  // Modelo (coluna A) às vezes vem em branco em linhas que são, na
  // prática, do mesmo modelo da linha anterior — preenche "pra baixo".
  let ultimoModelo = "";
  let semPartNumber = 0;
  let semSolucao = 0;
  let vazias = 0;

  const linhasValidas: LinhaBrutaBid[] = [];

  for (const linha of linhasDados) {
    const modeloCelula = String(linha[COL_BID_MODELO] ?? "").trim();
    if (modeloCelula) ultimoModelo = modeloCelula;

    const partNumber = String(linha[COL_BID_PART_NUMBER] ?? "").trim();
    const pecaSolucao = String(linha[COL_BID_PECA_SOLUCAO] ?? "").trim();
    const maoDeObraCelula = linha[4];
    const maoDeObraNum = typeof maoDeObraCelula === "number" ? maoDeObraCelula : Number(maoDeObraCelula);

    const linhaTotalmenteVazia = !modeloCelula && !partNumber && !pecaSolucao && linha[3] == null && linha[4] == null;
    if (linhaTotalmenteVazia) {
      vazias += 1;
      continue;
    }

    if (!partNumber) {
      semPartNumber += 1;
      continue;
    }

    if (!pecaSolucao) {
      semSolucao += 1;
      continue;
    }

    linhasValidas.push({
      modelo: ultimoModelo || "—",
      part_number: partNumber,
      peca_solucao: pecaSolucao,
      mao_de_obra: Number.isFinite(maoDeObraNum) ? maoDeObraNum : null,
    });
  }

  if (linhasValidas.length === 0) {
    return NextResponse.json(
      { error: "Não encontrei nenhuma linha válida nesse arquivo (com Part Number e Peça Solução)." },
      { status: 400 }
    );
  }

  // dedupe exato (modelo, part_number, peça solução) — mantém a
  // primeira ocorrência, que também define a solução "principal"
  const vistos = new Set<string>();
  const linhasDeduplicadas: LinhaBrutaBid[] = [];
  let duplicadas = 0;
  for (const linha of linhasValidas) {
    const chave = `${linha.modelo} ${linha.part_number} ${linha.peca_solucao}`;
    if (vistos.has(chave)) {
      duplicadas += 1;
      continue;
    }
    vistos.add(chave);
    linhasDeduplicadas.push(linha);
  }

  // registra a importação (linha "em andamento", atualizada no final)
  const { data: importacao, error: importacaoError } = await admin
    .from("bid_importacoes")
    .insert({
      arquivo_nome: arquivo.name,
      importado_por: user.id,
      linhas_no_arquivo: linhasDados.length,
      linhas_sem_part_number_descartadas: semPartNumber,
      linhas_sem_peca_solucao_descartadas: semSolucao,
      linhas_vazias_descartadas: vazias,
      linhas_duplicadas_ignoradas: duplicadas,
    })
    .select("id")
    .single();

  if (importacaoError || !importacao) {
    return NextResponse.json(
      { error: importacaoError?.message || "Não consegui registrar a importação." },
      { status: 400 }
    );
  }

  const caminhoArquivo = `${importacao.id}/${arquivo.name}`;
  await admin.storage
    .from("bases-bid")
    .upload(caminhoArquivo, bytes, {
      contentType: arquivo.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      upsert: true,
    })
    .catch(() => null);

  // agrupa por (modelo, part_number) — cada grupo vira uma peça do BID
  type Grupo = { modelo: string; part_number: string; solucoes: string[]; maoDeObraVotos: (number | null)[] };
  const grupos = new Map<string, Grupo>();
  for (const linha of linhasDeduplicadas) {
    const chave = `${linha.modelo} ${linha.part_number}`;
    let grupo = grupos.get(chave);
    if (!grupo) {
      grupo = { modelo: linha.modelo, part_number: linha.part_number, solucoes: [], maoDeObraVotos: [] };
      grupos.set(chave, grupo);
    }
    grupo.solucoes.push(linha.peca_solucao);
    grupo.maoDeObraVotos.push(linha.mao_de_obra);
  }

  // busca TODAS as peças já existentes, paginando — sem isso o Supabase
  // corta silenciosamente em 1000 linhas por consulta (limite padrão do
  // PostgREST), e o restante da base "some" da checagem de travado/mão
  // de obra/histórico dessa importação (mesmo assim o upsert em si não
  // perde nada, porque resolve por modelo+part_number no banco — mas o
  // que depende desse mapa em memória, como respeitar travado, ficava
  // errado pra quem passasse dessa marca de 1000).
  const LOTE_BUSCA_EXISTENTES = 1000;
  const pecasExistentes: PecaExistente[] = [];
  for (let inicio = 0; ; inicio += LOTE_BUSCA_EXISTENTES) {
    const { data } = (await admin
      .from("bid_pecas")
      .select(
        "id, modelo, part_number, custo_peca_samsung, valor_com_margem, custo_peca_allied, valor_imposto, valor_atualizado_em, valor_direcao, mao_de_obra, travado"
      )
      .range(inicio, inicio + LOTE_BUSCA_EXISTENTES - 1)) as unknown as { data: PecaExistente[] | null };
    if (!data || data.length === 0) break;
    pecasExistentes.push(...data);
    if (data.length < LOTE_BUSCA_EXISTENTES) break;
  }

  const [{ data: faixasMarkupBrutas }, { data: configMaoDeObra }, { data: configImposto }] = await Promise.all([
    admin.from("configuracoes_bid_markup").select("valor_min, valor_max, multiplicador").order("ordem", { ascending: true }),
    admin.from("configuracoes_mao_de_obra").select("valor_uma_peca").eq("id", 1).single(),
    admin.from("configuracoes_impostos").select("icms_percentual").eq("id", 1).single(),
  ]);

  const valorPadraoMaoDeObra = Number(configMaoDeObra?.valor_uma_peca ?? 80);
  const icmsPercentual = Number(configImposto?.icms_percentual ?? 0);
  const faixas: FaixaMarkup[] = (
    (faixasMarkupBrutas ?? []) as { valor_min: number; valor_max: number | null; multiplicador: number }[]
  ).map((f) => ({
    valor_min: Number(f.valor_min),
    valor_max: f.valor_max == null ? null : Number(f.valor_max),
    multiplicador: Number(f.multiplicador),
  }));

  // "voto" de mão de obra por família (4 primeiros caracteres do Part
  // Number): junta o que já existe no banco com o que veio no arquivo
  // e decide por maioria; empate favorece o valor maior (mais de uma
  // peça), por segurança.
  const votosPorPrefixo = new Map<string, Map<number, number>>();
  function registrarVoto(partNumber: string, valor: number | null) {
    if (valor == null || !Number.isFinite(valor)) return;
    const prefixo = prefixoPartNumber(partNumber);
    let mapaValores = votosPorPrefixo.get(prefixo);
    if (!mapaValores) {
      mapaValores = new Map();
      votosPorPrefixo.set(prefixo, mapaValores);
    }
    mapaValores.set(valor, (mapaValores.get(valor) ?? 0) + 1);
  }
  for (const p of pecasExistentes ?? []) registrarVoto(p.part_number, p.mao_de_obra);
  for (const grupo of grupos.values()) for (const voto of grupo.maoDeObraVotos) registrarVoto(grupo.part_number, voto);

  function maoDeObraPorMaioria(partNumber: string): number {
    const prefixo = prefixoPartNumber(partNumber);
    const mapaValores = votosPorPrefixo.get(prefixo);
    if (!mapaValores || mapaValores.size === 0) return valorPadraoMaoDeObra;
    let melhorValor = valorPadraoMaoDeObra;
    let melhorContagem = -1;
    for (const [valor, contagem] of mapaValores) {
      if (contagem > melhorContagem || (contagem === melhorContagem && valor > melhorValor)) {
        melhorValor = valor;
        melhorContagem = contagem;
      }
    }
    return melhorValor;
  }

  // custo mais recente da Base Peças pra cada Part Number envolvido
  const partNumbersUnicos = Array.from(new Set(Array.from(grupos.values()).map((g) => g.part_number)));
  const custosPorPartNumber = new Map<string, number>();
  for (let i = 0; i < partNumbersUnicos.length; i += TAMANHO_LOTE) {
    const lote = partNumbersUnicos.slice(i, i + TAMANHO_LOTE);
    const { data } = await admin.from("pecas_vigentes").select("codigo, valor_unitario").in("codigo", lote);
    for (const linha of data ?? []) custosPorPartNumber.set(linha.codigo, Number(linha.valor_unitario));
  }

  const existentesPorChave = new Map((pecasExistentes ?? []).map((p) => [`${p.modelo} ${p.part_number}`, p]));

  let pecasNovas = 0;
  let pecasAtualizadas = 0;

  const linhasUpsertPecas: Record<string, unknown>[] = [];
  const linhasHistorico: Record<string, unknown>[] = [];
  const gruposArray = Array.from(grupos.values());

  for (const grupo of gruposArray) {
    const chave = `${grupo.modelo} ${grupo.part_number}`;
    const existente = existentesPorChave.get(chave);
    const travado = existente?.travado ?? false;
    const maoDeObra = maoDeObraPorMaioria(grupo.part_number);

    // peça travada na Consulta BID: mantém o preço definido manualmente,
    // não recalcula a partir da Base Peças nessa importação
    const custoSamsungCalculado = custosPorPartNumber.get(grupo.part_number) ?? null;
    const resultadoCalculado =
      custoSamsungCalculado != null ? calcularCustoPecaAllied(custoSamsungCalculado, faixas, icmsPercentual) : null;
    const custoSamsung = travado ? existente!.custo_peca_samsung : custoSamsungCalculado;
    const valorComMargem = travado ? existente!.valor_com_margem : resultadoCalculado?.valorComMargem ?? null;
    const valorImposto = travado ? existente!.valor_imposto : resultadoCalculado?.valorImposto ?? null;
    const custoPecaAllied = travado ? existente!.custo_peca_allied : resultadoCalculado?.custoPecaAllied ?? null;

    // só mexe em "última alteração" quando o preço final realmente muda
    // (peça travada nunca muda aqui, então nunca entra nesse ramo)
    const mudouValor = existente ? valoresDiferentes(existente.custo_peca_allied, custoPecaAllied) : false;
    const valorAtualizadoEm = !existente
      ? new Date().toISOString() // peça nova: essa importação é a primeira carga dela
      : mudouValor
        ? new Date().toISOString()
        : existente.valor_atualizado_em;
    const valorDirecao = !existente ? null : mudouValor ? direcaoValor(existente.custo_peca_allied, custoPecaAllied) : existente.valor_direcao;

    linhasUpsertPecas.push({
      modelo: grupo.modelo,
      part_number: grupo.part_number,
      custo_peca_samsung: custoSamsung,
      valor_com_margem: valorComMargem,
      custo_peca_allied: custoPecaAllied,
      valor_imposto: valorImposto,
      valor_atualizado_em: valorAtualizadoEm,
      valor_direcao: valorDirecao,
      mao_de_obra: maoDeObra,
      bid_importacao_id: importacao.id,
    });

    if (!existente) {
      pecasNovas += 1;
    } else {
      const mudou =
        valoresDiferentes(existente.custo_peca_samsung, custoSamsung) ||
        valoresDiferentes(existente.valor_com_margem, valorComMargem) ||
        valoresDiferentes(existente.custo_peca_allied, custoPecaAllied);
      if (mudou) {
        pecasAtualizadas += 1;
        linhasHistorico.push({
          bid_peca_id: existente.id,
          custo_peca_samsung_anterior: existente.custo_peca_samsung,
          custo_peca_samsung_novo: custoSamsung,
          valor_com_margem_anterior: existente.valor_com_margem,
          valor_com_margem_novo: valorComMargem,
          custo_peca_allied_anterior: existente.custo_peca_allied,
          custo_peca_allied_novo: custoPecaAllied,
          valor_imposto_anterior: existente.valor_imposto,
          valor_imposto_novo: valorImposto,
          origem: "importacao_bid",
          alterado_por: user.id,
        });
      }
    }
  }

  // upsert em lotes — grava/atualiza todas as peças de uma vez, e o
  // "select" devolve o id de cada uma (inclusive as recém-criadas),
  // necessário pra gravar as soluções na sequência
  const idsPorChave = new Map<string, string>();
  for (let i = 0; i < linhasUpsertPecas.length; i += TAMANHO_LOTE) {
    const lote = linhasUpsertPecas.slice(i, i + TAMANHO_LOTE);
    const { data, error } = await admin
      .from("bid_pecas")
      .upsert(lote, { onConflict: "modelo,part_number" })
      .select("id, modelo, part_number");
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    for (const linha of data ?? []) {
      idsPorChave.set(`${linha.modelo} ${linha.part_number}`, linha.id);
    }
  }

  for (let i = 0; i < linhasHistorico.length; i += TAMANHO_LOTE) {
    await admin.from("bid_historico_valores").insert(linhasHistorico.slice(i, i + TAMANHO_LOTE));
  }

  // soluções já conhecidas das peças que já existiam antes desse import
  // (pra não mexer na principal já escolhida e só somar as novas)
  const idsExistentes = (pecasExistentes ?? []).map((p) => p.id);
  const solucoesExistentesPorPeca = new Map<string, Set<string>>();
  for (let i = 0; i < idsExistentes.length; i += TAMANHO_LOTE) {
    const lote = idsExistentes.slice(i, i + TAMANHO_LOTE);
    const { data } = await admin.from("bid_solucoes").select("bid_peca_id, peca_solucao").in("bid_peca_id", lote);
    for (const linha of data ?? []) {
      let conjunto = solucoesExistentesPorPeca.get(linha.bid_peca_id);
      if (!conjunto) {
        conjunto = new Set();
        solucoesExistentesPorPeca.set(linha.bid_peca_id, conjunto);
      }
      conjunto.add(linha.peca_solucao);
    }
  }

  const linhasSolucoes: Record<string, unknown>[] = [];
  for (const grupo of gruposArray) {
    const chave = `${grupo.modelo} ${grupo.part_number}`;
    const bidPecaId = idsPorChave.get(chave);
    if (!bidPecaId) continue;

    const solucoesUnicas = Array.from(new Set(grupo.solucoes));
    const jaConhecidas = solucoesExistentesPorPeca.get(bidPecaId) ?? new Set<string>();
    const novas = solucoesUnicas.filter((s) => !jaConhecidas.has(s));

    novas.forEach((solucao, idx) => {
      linhasSolucoes.push({
        bid_peca_id: bidPecaId,
        peca_solucao: solucao,
        principal: jaConhecidas.size === 0 && idx === 0,
      });
    });
  }

  let solucoesNovas = 0;
  for (let i = 0; i < linhasSolucoes.length; i += TAMANHO_LOTE) {
    const { data, error } = await admin
      .from("bid_solucoes")
      .insert(linhasSolucoes.slice(i, i + TAMANHO_LOTE))
      .select("id");
    if (!error) solucoesNovas += data?.length ?? 0;
  }

  await admin
    .from("bid_importacoes")
    .update({
      arquivo_path: caminhoArquivo,
      pecas_novas_inseridas: pecasNovas,
      pecas_atualizadas: pecasAtualizadas,
      solucoes_novas_inseridas: solucoesNovas,
    })
    .eq("id", importacao.id);

  const pendentes = linhasUpsertPecas.filter((l) => l.custo_peca_samsung == null).length;

  return NextResponse.json({
    linhasNoArquivo: linhasDados.length,
    linhasSemPartNumber: semPartNumber,
    linhasSemSolucao: semSolucao,
    linhasVazias: vazias,
    linhasDuplicadas: duplicadas,
    pecasNovas,
    pecasAtualizadas,
    solucoesNovas,
    pecasPendentes: pendentes,
  });
}
