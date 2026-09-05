import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { podeImportarBasePecas } from "@/lib/pecas";
import {
  COLUNA_CODIGO,
  COLUNA_DATA_COMPRA,
  COLUNA_DELIVERY,
  COLUNA_DESCRICAO,
  COLUNA_QUANTIDADE,
  COLUNA_VALOR_TOTAL,
  converterDataBr,
  converterNumeroPlanilha,
  type LinhaPecaImportada,
} from "@/lib/pecas";

// arquivos grandes (planilha com milhares de linhas) — evita timeout curto
export const maxDuration = 60;

// quantas linhas mandar por vez pro Supabase (payload/limite de request)
const TAMANHO_LOTE = 500;

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: perfil } = await admin
    .from("usuarios")
    .select("cargo, is_master")
    .eq("id", user.id)
    .single();

  if (!podeImportarBasePecas(perfil)) {
    return NextResponse.json(
      { error: "Seu cargo não tem permissão para importar a base de peças." },
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
    // raw:true é essencial aqui: vários relatórios de peça (ex: "Ship_*.xls" da
    // Samsung) na verdade são uma tabela HTML salva com extensão .xls, não um
    // binário Excel de verdade. Nesse formato, o leitor de HTML do SheetJS
    // tenta "adivinhar" datas tipo "01/09/2026" e, quando dia e mês são os
    // dois ≤ 12, interpreta errado como mês/dia (padrão americano) em vez de
    // dia/mês — trocando silenciosamente o dia com o mês (ex: 01/09/2026,
    // 1º de setembro, virava 9 de janeiro). Isso fazia uma compra mais
    // recente parecer mais antiga que outra, e a coluna F (Data NF) parar de
    // bater com a "peça mais recente" de verdade. Com raw:true o SheetJS não
    // faz esse palpite: entrega o texto original de cada célula (ex:
    // "01/09/2026") pra gente mesmo interpretar com converterDataBr (que já
    // assume dia/mês/ano, formato brasileiro). Arquivo .xlsx binário de
    // verdade não é afetado por essa opção — datas continuam vindo como
    // objeto Date normalmente.
    const workbook = XLSX.read(bytes, { type: "buffer", cellDates: true, raw: true });
    const primeiraAba = workbook.SheetNames[0];
    const planilha = workbook.Sheets[primeiraAba];
    linhasBrutas = XLSX.utils.sheet_to_json(planilha, { header: 1, blankrows: false }) as unknown[][];
  } catch {
    return NextResponse.json(
      { error: "Não consegui ler esse arquivo. Confirme que é uma planilha .xlsx válida." },
      { status: 400 }
    );
  }

  // primeira linha é o cabeçalho
  const linhasDados = linhasBrutas.slice(1);

  const linhasValidas: LinhaPecaImportada[] = [];
  let linhasInvalidas = 0;

  for (const linha of linhasDados) {
    const codigo = String(linha[COLUNA_CODIGO] ?? "").trim();
    const dataCompra = converterDataBr(linha[COLUNA_DATA_COMPRA]);
    const quantidade = converterNumeroPlanilha(linha[COLUNA_QUANTIDADE]);
    const valorTotal = converterNumeroPlanilha(linha[COLUNA_VALOR_TOTAL]);
    const delivery = String(linha[COLUNA_DELIVERY] ?? "").trim();
    const descricao = linha[COLUNA_DESCRICAO] != null ? String(linha[COLUNA_DESCRICAO]).trim() : null;

    if (!codigo || !dataCompra || !delivery || !Number.isFinite(quantidade) || quantidade <= 0 || !Number.isFinite(valorTotal) || valorTotal <= 0) {
      linhasInvalidas += 1;
      continue;
    }

    linhasValidas.push({
      codigo,
      descricao,
      data_compra: dataCompra,
      quantidade,
      valor_total: valorTotal,
      delivery,
    });
  }

  if (linhasValidas.length === 0) {
    return NextResponse.json(
      { error: "Não encontrei nenhuma linha válida nesse arquivo. Confira se é a planilha correta." },
      { status: 400 }
    );
  }

  // registra a importação primeiro (linha "em andamento"), atualiza no final
  const { data: importacao, error: importacaoError } = await admin
    .from("pecas_importacoes")
    .insert({
      arquivo_nome: arquivo.name,
      importado_por: user.id,
      linhas_no_arquivo: linhasDados.length,
    })
    .select("id")
    .single();

  if (importacaoError || !importacao) {
    return NextResponse.json(
      { error: importacaoError?.message || "Não consegui registrar a importação." },
      { status: 400 }
    );
  }

  // sobe o arquivo original pro storage, pra poder reprocessar se precisar
  const caminhoArquivo = `${importacao.id}/${arquivo.name}`;
  const { error: uploadError } = await admin.storage
    .from("bases-pecas")
    .upload(caminhoArquivo, bytes, {
      contentType: arquivo.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      upsert: true,
    });

  let linhasInseridas = 0;

  for (let i = 0; i < linhasValidas.length; i += TAMANHO_LOTE) {
    const lote = linhasValidas.slice(i, i + TAMANHO_LOTE).map((l) => ({ ...l, importacao_id: importacao.id }));

    // upsert com "ignora duplicadas" -> a constraint única (codigo, data_compra,
    // delivery, quantidade, valor_total) garante que nada é duplicado, seja
    // contra o próprio arquivo ou contra tudo que já foi importado antes.
    const { data: inseridas, error: insertError } = await admin
      .from("pecas_compras")
      .upsert(lote, {
        onConflict: "codigo,data_compra,delivery,quantidade,valor_total",
        ignoreDuplicates: true,
      })
      .select("id");

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 400 });
    }

    linhasInseridas += inseridas?.length ?? 0;
  }

  const linhasDuplicadas = linhasValidas.length - linhasInseridas;

  await admin
    .from("pecas_importacoes")
    .update({
      arquivo_path: uploadError ? null : caminhoArquivo,
      linhas_novas_inseridas: linhasInseridas,
      linhas_duplicadas_ignoradas: linhasDuplicadas,
    })
    .eq("id", importacao.id);

  const { data: resumo } = await admin.rpc("pecas_metricas_resumo").single();

  return NextResponse.json({
    linhasNoArquivo: linhasDados.length,
    linhasInvalidas,
    linhasInseridas,
    linhasDuplicadas,
    pecasUnicasBase: resumo?.pecas_unicas ?? null,
    pecasRegistradasBase: resumo?.pecas_registradas ?? null,
    dataMaisRecenteBase: resumo?.data_mais_recente ?? null,
  });
}
