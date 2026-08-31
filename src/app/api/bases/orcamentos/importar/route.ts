import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import {
  calcularValoresOrcamento,
  lerLinhaOrcamento,
  podeImportarOrcamentos,
  type ConfiguracaoMaoDeObra,
  type LinhaOrcamentoImportada,
} from "@/lib/orcamentos";

export const maxDuration = 60;
const TAMANHO_LOTE = 200;

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

  if (!podeImportarOrcamentos(perfil)) {
    return NextResponse.json(
      { error: "Seu cargo não tem permissão para importar a base de orçamentos." },
      { status: 403 }
    );
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

  const linhasValidas: LinhaOrcamentoImportada[] = [];
  let linhasInvalidas = 0;

  for (const linha of linhasDados) {
    const lida = lerLinhaOrcamento(linha);
    if (!lida) {
      linhasInvalidas += 1;
      continue;
    }
    linhasValidas.push(lida);
  }

  if (linhasValidas.length === 0) {
    return NextResponse.json(
      { error: "Não encontrei nenhuma linha válida (com NF Remessa Allied e Trade Allied) nesse arquivo." },
      { status: 400 }
    );
  }

  // dedup dentro do próprio arquivo (mesma NF + mesmo Trade Allied duas vezes)
  const vistosNoArquivo = new Set<string>();
  const linhasParaInserir: LinhaOrcamentoImportada[] = [];
  let duplicadasNoArquivo = 0;
  for (const l of linhasValidas) {
    const chave = `${l.nf_remessa_allied}|${l.trade_allied}`;
    if (vistosNoArquivo.has(chave)) {
      duplicadasNoArquivo += 1;
      continue;
    }
    vistosNoArquivo.add(chave);
    linhasParaInserir.push(l);
  }

  const nfDoArquivo = linhasValidas[0].nf_remessa_allied;
  const tradesDoArquivo = Array.from(new Set(linhasParaInserir.map((l) => l.trade_allied)));
  const osCareDoArquivo = Array.from(
    new Set(linhasParaInserir.map((l) => l.os_care_allied).filter((v): v is string => !!v))
  );

  // busca, na base já acumulada, aparelhos com o mesmo Trade Allied ou
  // OS Care Allied vindos de OUTRA NF Remessa -> reincidência (RRR)
  const filtros: string[] = [];
  if (tradesDoArquivo.length > 0) filtros.push(`trade_allied.in.(${tradesDoArquivo.map((v) => `"${v}"`).join(",")})`);
  if (osCareDoArquivo.length > 0) filtros.push(`os_care_allied.in.(${osCareDoArquivo.map((v) => `"${v}"`).join(",")})`);

  const tradeParaNfs = new Map<string, Set<string>>();
  const osCareParaNfs = new Map<string, Set<string>>();

  if (filtros.length > 0) {
    const { data: existentes } = await admin
      .from("orcamentos")
      .select("trade_allied, os_care_allied, nf_remessa_allied")
      .or(filtros.join(","));

    for (const row of existentes ?? []) {
      if (row.trade_allied) {
        if (!tradeParaNfs.has(row.trade_allied)) tradeParaNfs.set(row.trade_allied, new Set());
        tradeParaNfs.get(row.trade_allied)!.add(row.nf_remessa_allied);
      }
      if (row.os_care_allied) {
        if (!osCareParaNfs.has(row.os_care_allied)) osCareParaNfs.set(row.os_care_allied, new Set());
        osCareParaNfs.get(row.os_care_allied)!.add(row.nf_remessa_allied);
      }
    }
  }

  function ehReincidente(l: LinhaOrcamentoImportada): boolean {
    const nfsPorTrade = tradeParaNfs.get(l.trade_allied);
    if (nfsPorTrade && Array.from(nfsPorTrade).some((nf) => nf !== l.nf_remessa_allied)) return true;
    if (l.os_care_allied) {
      const nfsPorOsCare = osCareParaNfs.get(l.os_care_allied);
      if (nfsPorOsCare && Array.from(nfsPorOsCare).some((nf) => nf !== l.nf_remessa_allied)) return true;
    }
    return false;
  }

  const { data: configRaw } = await admin.from("configuracoes_mao_de_obra").select("*").eq("id", 1).single();
  const config: ConfiguracaoMaoDeObra = {
    valor_sem_peca: configRaw?.valor_sem_peca ?? 0,
    valor_uma_peca: configRaw?.valor_uma_peca ?? 80,
    valor_mais_de_uma_peca: configRaw?.valor_mais_de_uma_peca ?? 150,
  };

  const { data: lote, error: loteError } = await admin
    .from("orcamentos_lotes")
    .insert({
      arquivo_nome: arquivo.name,
      nf_remessa_allied: nfDoArquivo,
      importado_por: user.id,
      aparelhos_no_arquivo: linhasDados.length,
    })
    .select("id")
    .single();

  if (loteError || !lote) {
    return NextResponse.json({ error: loteError?.message || "Não consegui registrar a importação." }, { status: 400 });
  }

  const caminhoArquivo = `${lote.id}/${arquivo.name}`;
  const { error: uploadError } = await admin.storage.from("bases-orcamentos").upload(caminhoArquivo, bytes, {
    contentType: arquivo.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    upsert: true,
  });

  const linhasComCalculo = linhasParaInserir.map((l) => {
    const { quantidadePecas: _q, valorTotalPeca, maoDeObra, valorTotalReparo } = calcularValoresOrcamento(
      l.peca,
      l.peca_add,
      l.custo_peca,
      l.custo_peca_add,
      config
    );

    return {
      reparador_terceiro: l.reparador_terceiro,
      nf_remessa_allied: l.nf_remessa_allied,
      os_care_allied: l.os_care_allied,
      trade_allied: l.trade_allied,
      imei_allied: l.imei_allied,
      imei_reparadora: l.imei_reparadora,
      classificacao_allied: l.classificacao_allied,
      sku: l.sku,
      descricao_completa: l.descricao_completa,
      modelo_comercial: l.modelo_comercial,
      atendimento: l.atendimento,
      descricao_defeito_1: l.descricao_defeito[0], descricao_defeito_2: l.descricao_defeito[1],
      descricao_defeito_3: l.descricao_defeito[2], descricao_defeito_4: l.descricao_defeito[3],
      descricao_defeito_5: l.descricao_defeito[4], descricao_defeito_6: l.descricao_defeito[5],
      descricao_defeito_7: l.descricao_defeito[6], descricao_defeito_8: l.descricao_defeito[7],
      descricao_defeito_9: l.descricao_defeito[8], descricao_defeito_10: l.descricao_defeito[9],
      peca_defeito_1: l.peca_defeito[0], peca_defeito_2: l.peca_defeito[1], peca_defeito_3: l.peca_defeito[2],
      peca_defeito_4: l.peca_defeito[3], peca_defeito_5: l.peca_defeito[4], peca_defeito_6: l.peca_defeito[5],
      peca_defeito_7: l.peca_defeito[6], peca_defeito_8: l.peca_defeito[7], peca_defeito_9: l.peca_defeito[8],
      peca_defeito_10: l.peca_defeito[9],
      observacao_tecnica_reparadora: l.observacao_tecnica_reparadora,
      peca_1: l.peca[0], peca_2: l.peca[1], peca_3: l.peca[2], peca_4: l.peca[3], peca_5: l.peca[4],
      peca_6: l.peca[5], peca_7: l.peca[6], peca_8: l.peca[7], peca_9: l.peca[8], peca_10: l.peca[9],
      peca_add_1: l.peca_add[0], peca_add_2: l.peca_add[1], peca_add_3: l.peca_add[2],
      peca_add_4: l.peca_add[3], peca_add_5: l.peca_add[4],
      custo_peca_1: l.custo_peca[0], custo_peca_2: l.custo_peca[1], custo_peca_3: l.custo_peca[2],
      custo_peca_4: l.custo_peca[3], custo_peca_5: l.custo_peca[4], custo_peca_6: l.custo_peca[5],
      custo_peca_7: l.custo_peca[6], custo_peca_8: l.custo_peca[7], custo_peca_9: l.custo_peca[8],
      custo_peca_10: l.custo_peca[9],
      custo_peca_add_1: l.custo_peca_add[0], custo_peca_add_2: l.custo_peca_add[1],
      custo_peca_add_3: l.custo_peca_add[2], custo_peca_add_4: l.custo_peca_add[3],
      custo_peca_add_5: l.custo_peca_add[4],
      valor_total_peca: valorTotalPeca,
      mao_de_obra: maoDeObra,
      valor_total_reparo: valorTotalReparo,
      tipo_orcamento: l.tipo_orcamento,
      status_orcamento: l.status_orcamento,
      motivo_reprova: l.motivo_reprova,
      obs: l.obs,
      reincidente: ehReincidente(l),
      lote_id: lote.id,
    };
  });

  let inseridos: { reincidente: boolean }[] = [];

  for (let i = 0; i < linhasComCalculo.length; i += TAMANHO_LOTE) {
    const pacote = linhasComCalculo.slice(i, i + TAMANHO_LOTE);
    const { data, error } = await admin
      .from("orcamentos")
      .upsert(pacote, { onConflict: "nf_remessa_allied,trade_allied", ignoreDuplicates: true })
      .select("reincidente");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    inseridos = inseridos.concat(data ?? []);
  }

  const aparelhosNovosInseridos = inseridos.length;
  const aparelhosReincidentes = inseridos.filter((r) => r.reincidente).length;
  const aparelhosDuplicadosIgnorados = linhasValidas.length - aparelhosNovosInseridos;
  const modelosComerciaisUnicos = new Set(linhasValidas.map((l) => l.modelo_comercial).filter(Boolean)).size;
  const skusUnicos = new Set(linhasValidas.map((l) => l.sku).filter(Boolean)).size;

  await admin
    .from("orcamentos_lotes")
    .update({
      arquivo_path: uploadError ? null : caminhoArquivo,
      aparelhos_novos_inseridos: aparelhosNovosInseridos,
      aparelhos_duplicados_ignorados: aparelhosDuplicadosIgnorados,
      aparelhos_reincidentes: aparelhosReincidentes,
      modelos_comerciais_unicos: modelosComerciaisUnicos,
      skus_unicos: skusUnicos,
    })
    .eq("id", lote.id);

  return NextResponse.json({
    aparelhosNoArquivo: linhasDados.length,
    linhasInvalidas,
    duplicadasNoArquivo,
    aparelhosNovosInseridos,
    aparelhosDuplicadosIgnorados,
    aparelhosReincidentes,
    modelosComerciaisUnicos,
    skusUnicos,
  });
}
