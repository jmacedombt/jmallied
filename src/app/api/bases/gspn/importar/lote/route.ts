import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { podeImportarGspn, type LinhaGspnImportada } from "@/lib/gspn";

// A importação inteira do arquivo passou a ser dividida em lotes menores,
// cada um numa requisição separada (ver ImportarGspnForm.tsx) — porque no
// plano gratuito da Vercel toda função tem um limite rígido de 10s de
// execução, não importa o que configuramos em "maxDuration" aqui. Cada
// requisição processa só UM lote (uma chamada só ao banco), então mesmo
// arquivos com milhares de linhas nunca chegam perto desse limite.
export const maxDuration = 30;

const OS_REPARADORA_REGEX = /^\d{10}$/;

function pecasComoObjeto(pecas: (string | null)[]) {
  const obj: Record<string, string | null> = {};
  for (let i = 0; i < 10; i++) obj[`peca_${i + 1}`] = pecas?.[i] ?? null;
  return obj;
}

function linhaValida(l: unknown): l is LinhaGspnImportada {
  if (!l || typeof l !== "object") return false;
  const linha = l as Partial<LinhaGspnImportada>;
  return typeof linha.os_reparadora === "string" && OS_REPARADORA_REGEX.test(linha.os_reparadora);
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

  let corpo: { linhas?: unknown };
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  const linhas = Array.isArray(corpo.linhas) ? corpo.linhas.filter(linhaValida) : [];

  if (linhas.length === 0) {
    return NextResponse.json({ error: "Nenhuma linha válida enviada nesse lote." }, { status: 400 });
  }

  const { data: resultadoLote, error: erroLote } = await admin.rpc("gspn_importar_lote", {
    p_linhas: linhas.map((l) => ({
      os_reparadora: l.os_reparadora,
      asc_job_no: l.asc_job_no,
      status: l.status,
      motivo: l.motivo,
      ...pecasComoObjeto(l.pecas),
    })),
  });

  if (erroLote) {
    return NextResponse.json({ error: erroLote.message }, { status: 400 });
  }

  const linha = Array.isArray(resultadoLote) ? resultadoLote[0] : resultadoLote;

  return NextResponse.json({
    chamadosNovos: Number(linha?.chamados_novos ?? 0),
    chamadosAtualizados: Number(linha?.chamados_atualizados ?? 0),
    pecasCasadasOrcamento: Number(linha?.pecas_casadas_orcamento ?? 0),
  });
}
