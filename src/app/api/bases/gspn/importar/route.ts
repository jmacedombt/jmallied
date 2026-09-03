import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { lerLinhaGspn, podeImportarGspn, type LinhaGspnImportada } from "@/lib/gspn";

export const maxDuration = 60;
const TAMANHO_LOTE = 500;

function pecasComoObjeto(pecas: (string | null)[]) {
  const obj: Record<string, string | null> = {};
  pecas.forEach((p, i) => {
    obj[`peca_${i + 1}`] = p;
  });
  return obj;
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

  if (!podeImportarGspn(perfil)) {
    return NextResponse.json(
      { error: "Seu cargo não tem permissão para importar a Base GSPN." },
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
    const workbook = XLSX.read(bytes, { type: "buffer" });
    const planilha = workbook.Sheets[workbook.SheetNames[0]];
    linhasBrutas = XLSX.utils.sheet_to_json(planilha, { header: 1, blankrows: false }) as unknown[][];
  } catch {
    return NextResponse.json(
      { error: "Não consegui ler esse arquivo. Confirme que é uma planilha .xlsx válida." },
      { status: 400 }
    );
  }

  const linhasDados = linhasBrutas.slice(1); // primeira linha é cabeçalho

  const linhasValidas: LinhaGspnImportada[] = [];
  let linhasInvalidas = 0;

  for (const linha of linhasDados) {
    const lida = lerLinhaGspn(linha);
    if (!lida) {
      linhasInvalidas += 1;
      continue;
    }
    linhasValidas.push(lida);
  }

  if (linhasValidas.length === 0) {
    return NextResponse.json(
      { error: "Não encontrei nenhuma linha com OS Reparadora válida (10 números) nesse arquivo." },
      { status: 400 }
    );
  }

  // dedup dentro do próprio arquivo — mantém a última ocorrência de cada
  // OS Reparadora, já que "sempre considera a última versão".
  const mapaArquivo = new Map<string, LinhaGspnImportada>();
  for (const l of linhasValidas) mapaArquivo.set(l.os_reparadora, l);
  const linhasUnicas = Array.from(mapaArquivo.values());

  // descobre quais OS Reparadora já existiam na Base GSPN, pra separar
  // "chamados novos" de "chamados atualizados" no resumo
  const existentesNaBase = new Set<string>();
  for (let i = 0; i < linhasUnicas.length; i += TAMANHO_LOTE) {
    const pacote = linhasUnicas.slice(i, i + TAMANHO_LOTE).map((l) => l.os_reparadora);
    const { data } = await admin.from("gspn_chamados").select("os_reparadora").in("os_reparadora", pacote);
    for (const row of data ?? []) existentesNaBase.add(row.os_reparadora);
  }

  const agora = new Date().toISOString();
  let pecasCasadasOrcamento = 0;

  for (let i = 0; i < linhasUnicas.length; i += TAMANHO_LOTE) {
    const pacote = linhasUnicas.slice(i, i + TAMANHO_LOTE);

    // atualiza (ou insere) a Base GSPN em si
    const { error: erroUpsert } = await admin.from("gspn_chamados").upsert(
      pacote.map((l) => ({
        os_reparadora: l.os_reparadora,
        asc_job_no: l.asc_job_no,
        status: l.status,
        motivo: l.motivo,
        ...pecasComoObjeto(l.pecas),
        atualizado_em: agora,
      })),
      { onConflict: "os_reparadora" }
    );

    if (erroUpsert) {
      return NextResponse.json({ error: erroUpsert.message }, { status: 400 });
    }

    // propaga as peças pra tabela de orçamentos (por OS Reparadora)
    const { data: atualizados, error: erroPropagar } = await admin.rpc("gspn_propagar_pecas", {
      p_linhas: pacote.map((l) => ({ os_reparadora: l.os_reparadora, ...pecasComoObjeto(l.pecas) })),
    });

    if (erroPropagar) {
      return NextResponse.json({ error: erroPropagar.message }, { status: 400 });
    }

    pecasCasadasOrcamento += Number(atualizados ?? 0);
  }

  const chamadosAtualizados = linhasUnicas.filter((l) => existentesNaBase.has(l.os_reparadora)).length;
  const chamadosNovos = linhasUnicas.length - chamadosAtualizados;
  const pecasNaoCasadasOrcamento = linhasUnicas.length - pecasCasadasOrcamento;

  await admin.from("gspn_importacoes").insert({
    arquivo_nome: arquivo.name,
    importado_por: user.id,
    linhas_no_arquivo: linhasDados.length,
    linhas_invalidas: linhasInvalidas,
    chamados_novos: chamadosNovos,
    chamados_atualizados: chamadosAtualizados,
    pecas_casadas_orcamento: pecasCasadasOrcamento,
    pecas_nao_casadas_orcamento: pecasNaoCasadasOrcamento,
  });

  return NextResponse.json({
    linhasNoArquivo: linhasDados.length,
    linhasInvalidas,
    chamadosNovos,
    chamadosAtualizados,
    pecasCasadasOrcamento,
    pecasNaoCasadasOrcamento,
  });
}
