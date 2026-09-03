import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { osReparadoraValida, STATUS_OPERACIONAL } from "@/lib/orcamentos";
import { CABECALHO_OS_CARE_ALLIED, CABECALHO_OS_REPARADORA } from "@/lib/planilhaAgAbertura";

const STATUS_AG_ABERTURA = STATUS_OPERACIONAL[0].valor; // "Ag. Abertura"

function valorColuna(linha: Record<string, unknown>, alvo: string): string {
  const chave = Object.keys(linha).find((k) => k.trim().toUpperCase() === alvo.toUpperCase());
  return chave ? String(linha[chave] ?? "").trim() : "";
}

// Analisa (sem gravar nada ainda) a planilha de OS Care Allied -> OS
// Reparadora enviada em Ag. Abertura, cruzando com as pendências atuais
// (aparelhos sem OS Reparadora ainda) — devolve o que vai ser
// atualizado, pra mostrar num popup de confirmação antes de aplicar.
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const formData = await request.formData();
  const arquivo = formData.get("arquivo");

  if (!(arquivo instanceof File)) {
    return NextResponse.json({ error: "Envie um arquivo .xlsx." }, { status: 400 });
  }

  const bytes = Buffer.from(await arquivo.arrayBuffer());

  let linhas: Record<string, unknown>[];
  try {
    const workbook = XLSX.read(bytes, { type: "buffer" });
    const planilha = workbook.Sheets[workbook.SheetNames[0]];
    linhas = XLSX.utils.sheet_to_json(planilha, { defval: "" }) as Record<string, unknown>[];
  } catch {
    return NextResponse.json(
      { error: "Não consegui ler esse arquivo. Confirme que é uma planilha .xlsx válida." },
      { status: 400 }
    );
  }

  const linhasLidas = linhas
    .map((l) => ({
      osCare: valorColuna(l, CABECALHO_OS_CARE_ALLIED),
      osReparadora: valorColuna(l, CABECALHO_OS_REPARADORA).replace(/\D/g, ""),
    }))
    .filter((l) => l.osCare);

  if (linhasLidas.length === 0) {
    return NextResponse.json(
      {
        error: `Não encontrei a coluna "${CABECALHO_OS_CARE_ALLIED}" preenchida nesse arquivo. Baixe o modelo e confira os cabeçalhos.`,
      },
      { status: 400 }
    );
  }

  // dedup dentro do próprio arquivo (mantém a última ocorrência de cada OS Care)
  const mapaArquivo = new Map<string, string>();
  let duplicadasNoArquivo = 0;
  for (const l of linhasLidas) {
    if (mapaArquivo.has(l.osCare)) duplicadasNoArquivo += 1;
    mapaArquivo.set(l.osCare, l.osReparadora);
  }

  const admin = createAdminClient();
  const { data: pendentes } = await admin
    .from("orcamentos")
    .select("id, os_care_allied, trade_allied, modelo_comercial")
    .eq("status_operacional", STATUS_AG_ABERTURA)
    .not("os_care_allied", "is", null);

  const encontrados: {
    id: string;
    os_care_allied: string;
    trade_allied: string;
    modelo_comercial: string | null;
    os_reparadora_nova: string;
  }[] = [];
  let osReparadoraInvalida = 0;
  const osCareCasadasNoSistema = new Set<string>();

  for (const p of pendentes ?? []) {
    if (!p.os_care_allied) continue;
    const novaOs = mapaArquivo.get(p.os_care_allied);
    if (novaOs === undefined) continue;
    osCareCasadasNoSistema.add(p.os_care_allied);
    if (!osReparadoraValida(novaOs)) {
      osReparadoraInvalida += 1;
      continue;
    }
    encontrados.push({
      id: p.id,
      os_care_allied: p.os_care_allied,
      trade_allied: p.trade_allied,
      modelo_comercial: p.modelo_comercial,
      os_reparadora_nova: novaOs,
    });
  }

  const naoEncontradosNoSistema = Array.from(mapaArquivo.keys()).filter(
    (k) => !osCareCasadasNoSistema.has(k)
  ).length;

  return NextResponse.json({
    totalLinhasArquivo: linhasLidas.length,
    duplicadasNoArquivo,
    encontrados,
    naoEncontradosNoSistema,
    osReparadoraInvalida,
  });
}
