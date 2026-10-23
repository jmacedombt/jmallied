// Sistema Allied | Grupo J.Macedo
// Atualização diária da Base de Peças (pedido explícito, 23/10/2026).
//
// Em vez de subir a planilha na mão em Bases > Base Peças, este robô lê
// o arquivo base_pecas.xlsx que o "Robo GSPN - Pecas" atualiza 1x por dia
// na pasta do OneDrive:
//   OneDrive\AUTOMAÇÃO\ROBÔ - 3197760 - ESC SANTOS\PEÇAS\base_pecas.xlsx
// e grava no banco com as MESMAS regras da importação manual
// (api/bases/pecas/importar/route.ts): mesmas colunas, mesma validação,
// e a mesma trava contra duplicar compra (código + data + entrega + qtd +
// valor). O arquivo é acumulado (desde 02/01/2026), então todo dia só
// entram as linhas novas.
//
// Roda 1x por dia (agendado por agendar-sincronizacao-pecas.bat, 12:00).
// Mesmo rodando mais vezes, só importa se:
//   - ainda não houve atualização automática HOJE, e
//   - o arquivo mudou (campo "versao" do ULTIMA_ATUALIZACAO.json).
// Use "--forcar" pra ignorar essas duas travas.
//
// Lê a URL/chave do .env.local do projeto na hora de rodar (mesmo padrão
// de backup-storage.mjs) — nunca recebe credencial por outro caminho.
// Caminho do arquivo pode ser trocado com PECAS_ARQUIVO=... no .env.local.

import { createClient } from "@supabase/supabase-js";
import XLSX from "xlsx";
import { readFileSync, existsSync } from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const raizProjeto = path.join(__dirname, "..");
const forcar = process.argv.includes("--forcar");

function lerEnvLocal() {
  const arquivo = path.join(raizProjeto, ".env.local");
  const env = {};
  if (!existsSync(arquivo)) return env;
  for (const linhaBruta of readFileSync(arquivo, "utf8").split("\n")) {
    const linha = linhaBruta.replace(/^﻿/, "").trim();
    if (!linha || linha.startsWith("#")) continue;
    const idx = linha.indexOf("=");
    if (idx === -1) continue;
    let valor = linha.slice(idx + 1).trim();
    if ((valor.startsWith('"') && valor.endsWith('"')) || (valor.startsWith("'") && valor.endsWith("'"))) {
      valor = valor.slice(1, -1);
    }
    env[linha.slice(0, idx).trim()] = valor;
  }
  return env;
}

// ---- mesmas regras de lib/pecas.ts (cópia — o .ts não roda direto no Node) ----
const COLUNA_DATA_COMPRA = 5; // F - Data NF
const COLUNA_CODIGO = 7; // H - Peças enviadas
const COLUNA_QUANTIDADE = 8; // I - Qtd
const COLUNA_VALOR_TOTAL = 9; // J - Valor
const COLUNA_DELIVERY = 13; // N - No. da Entrega
const COLUNA_DESCRICAO = 16; // Q - Descrição Peça

function converterDataBr(valor) {
  if (valor instanceof Date && !isNaN(valor.getTime())) return valor.toISOString().slice(0, 10);
  const texto = String(valor ?? "").trim();
  const m = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, dia, mes, ano] = m;
  const d = Number(dia);
  const mo = Number(mes);
  if (d < 1 || d > 31 || mo < 1 || mo > 12) return null;
  return `${ano}-${mo.toString().padStart(2, "0")}-${d.toString().padStart(2, "0")}`;
}

function converterNumeroPlanilha(valor) {
  if (typeof valor === "number") return valor;
  let texto = String(valor ?? "").trim();
  if (!texto) return NaN;
  texto = texto.replace(/[^\d,.\-]/g, "");
  if (!texto) return NaN;
  const temVirgula = texto.includes(",");
  const temPonto = texto.includes(".");
  if (temVirgula && temPonto) {
    if (texto.lastIndexOf(",") > texto.lastIndexOf(".")) texto = texto.replace(/\./g, "").replace(",", ".");
    else texto = texto.replace(/,/g, "");
  } else if (temVirgula) {
    const partes = texto.split(",");
    const casasFinais = partes[partes.length - 1].length;
    texto = partes.length === 2 && casasFinais <= 2 ? texto.replace(",", ".") : texto.replace(/,/g, "");
  } else if (temPonto) {
    const partes = texto.split(".");
    const casasFinais = partes[partes.length - 1].length;
    if (partes.length > 2 || casasFinais > 2) texto = texto.replace(/\./g, "");
  }
  return Number(texto);
}
// -------------------------------------------------------------------------------

function hojeBrasilia() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function log(msg) {
  const agora = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  console.log(`[${agora}] ${msg}`);
}

async function main() {
  const env = lerEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave) {
    log("ERRO: não encontrei NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no .env.local do projeto.");
    process.exit(1);
  }

  const pastaOneDrive = process.env.OneDrive || path.join(os.homedir(), "OneDrive");
  const arquivo =
    env.PECAS_ARQUIVO || path.join(pastaOneDrive, "AUTOMAÇÃO", "ROBÔ - 3197760 - ESC SANTOS", "PEÇAS", "base_pecas.xlsx");
  const arquivoControle = path.join(path.dirname(arquivo), "ULTIMA_ATUALIZACAO.json");

  if (!existsSync(arquivo)) {
    log(`ERRO: arquivo não encontrado: ${arquivo}`);
    process.exit(1);
  }

  let versao = null;
  try {
    versao = JSON.parse(readFileSync(arquivoControle, "utf8")).versao ?? null;
  } catch {
    // sem arquivo de controle — segue sem a trava de versão
  }

  const admin = createClient(url, chave, { auth: { persistSession: false } });
  const nomeRegistro = `base_pecas.xlsx (automático${versao ? ` · versão ${versao}` : ""})`;

  if (!forcar) {
    const { data: ultimas } = await admin
      .from("pecas_importacoes")
      .select("arquivo_nome, importado_em")
      .like("arquivo_nome", "base_pecas.xlsx (automático%")
      .order("importado_em", { ascending: false })
      .limit(1);
    const ultima = ultimas?.[0];
    if (ultima) {
      const diaUltima = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ultima.importado_em));
      if (diaUltima === hojeBrasilia()) {
        log("Já houve atualização automática hoje — nada a fazer (use --forcar pra rodar mesmo assim).");
        return;
      }
      if (versao && ultima.arquivo_nome === nomeRegistro) {
        log(`O arquivo não mudou desde a última atualização (versão ${versao}) — nada a fazer.`);
        return;
      }
    }
  }

  log(`Lendo ${arquivo} ...`);
  const workbook = XLSX.read(readFileSync(arquivo), { type: "buffer", cellDates: true, raw: true });
  const planilha = workbook.Sheets[workbook.SheetNames[0]];
  const linhasDados = XLSX.utils.sheet_to_json(planilha, { header: 1, blankrows: false }).slice(1);

  const linhasValidas = [];
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
    linhasValidas.push({ codigo, descricao, data_compra: dataCompra, quantidade, valor_total: valorTotal, delivery });
  }
  log(`${linhasDados.length} linha(s) no arquivo — ${linhasValidas.length} válida(s), ${linhasInvalidas} inválida(s).`);

  if (linhasValidas.length === 0) {
    log("ERRO: nenhuma linha válida — confira se o arquivo é a planilha certa.");
    process.exit(1);
  }

  // registra no mesmo histórico da importação manual, em nome do
  // Administrador (o robô não tem usuário próprio)
  const { data: master } = await admin.from("usuarios").select("id").eq("is_master", true).limit(1).single();
  if (!master) {
    log("ERRO: não encontrei o usuário Administrador pra registrar a importação.");
    process.exit(1);
  }

  const { data: importacao, error: erroImportacao } = await admin
    .from("pecas_importacoes")
    .insert({ arquivo_nome: nomeRegistro, importado_por: master.id, linhas_no_arquivo: linhasDados.length })
    .select("id")
    .single();
  if (erroImportacao || !importacao) {
    log(`ERRO ao registrar a importação: ${erroImportacao?.message}`);
    process.exit(1);
  }

  let linhasInseridas = 0;
  const TAMANHO_LOTE = 500;
  for (let i = 0; i < linhasValidas.length; i += TAMANHO_LOTE) {
    const lote = linhasValidas.slice(i, i + TAMANHO_LOTE).map((l) => ({ ...l, importacao_id: importacao.id }));
    const { data: inseridas, error } = await admin
      .from("pecas_compras")
      .upsert(lote, { onConflict: "codigo,data_compra,delivery,quantidade,valor_total", ignoreDuplicates: true })
      .select("id");
    if (error) {
      log(`ERRO ao gravar (linhas ${i + 1}-${i + lote.length}): ${error.message}`);
      await admin
        .from("pecas_importacoes")
        .update({ linhas_novas_inseridas: linhasInseridas, linhas_duplicadas_ignoradas: 0 })
        .eq("id", importacao.id);
      process.exit(1);
    }
    linhasInseridas += inseridas?.length ?? 0;
  }

  const linhasDuplicadas = linhasValidas.length - linhasInseridas;
  await admin
    .from("pecas_importacoes")
    .update({ linhas_novas_inseridas: linhasInseridas, linhas_duplicadas_ignoradas: linhasDuplicadas })
    .eq("id", importacao.id);

  log(`Concluído: ${linhasInseridas} compra(s) nova(s) gravada(s), ${linhasDuplicadas} já existente(s) ignorada(s).`);
}

main().catch((e) => {
  log(`ERRO inesperado: ${e?.message ?? e}`);
  process.exit(1);
});
