import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { podeImportarGspn } from "@/lib/gspn";

// Chamado uma única vez, depois que todos os lotes de uma importação da
// Base GSPN já foram processados (ver ImportarGspnForm.tsx) — só grava a
// linha de resumo em gspn_importacoes com os totais somados no navegador.
export const maxDuration = 15;

type CorpoFinalizar = {
  arquivoNome?: unknown;
  linhasNoArquivo?: unknown;
  linhasInvalidas?: unknown;
  chamadosNovos?: unknown;
  chamadosAtualizados?: unknown;
  pecasCasadasOrcamento?: unknown;
  pecasNaoCasadasOrcamento?: unknown;
};

function numero(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
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

  let corpo: CorpoFinalizar;
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  const resultado = {
    linhasNoArquivo: numero(corpo.linhasNoArquivo),
    linhasInvalidas: numero(corpo.linhasInvalidas),
    chamadosNovos: numero(corpo.chamadosNovos),
    chamadosAtualizados: numero(corpo.chamadosAtualizados),
    pecasCasadasOrcamento: numero(corpo.pecasCasadasOrcamento),
    pecasNaoCasadasOrcamento: numero(corpo.pecasNaoCasadasOrcamento),
  };

  const { error: erroInsercao } = await admin.from("gspn_importacoes").insert({
    arquivo_nome: typeof corpo.arquivoNome === "string" ? corpo.arquivoNome : "arquivo.xlsx",
    importado_por: user.id,
    linhas_no_arquivo: resultado.linhasNoArquivo,
    linhas_invalidas: resultado.linhasInvalidas,
    chamados_novos: resultado.chamadosNovos,
    chamados_atualizados: resultado.chamadosAtualizados,
    pecas_casadas_orcamento: resultado.pecasCasadasOrcamento,
    pecas_nao_casadas_orcamento: resultado.pecasNaoCasadasOrcamento,
  });

  if (erroInsercao) {
    return NextResponse.json({ error: erroInsercao.message }, { status: 400 });
  }

  return NextResponse.json(resultado);
}
