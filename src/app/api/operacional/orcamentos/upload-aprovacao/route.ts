import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { podeConfirmarAprovacaoOrcamento, STATUS_AG_RESPOSTA_ORCAMENTO } from "@/lib/orcamentos";
import { lerLinhaAprovacao } from "@/lib/aprovacaoOrcamentos";

export const maxDuration = 60;
const TAMANHO_LOTE = 300;

// Upload (aprovação de orçamentos) em "3 - Ag. Resposta de Orçamento" —
// lê o arquivo que a Allied manda de volta (Aprovado/Contra Proposta/
// Reprovado por OS Reparadora) e casa cada linha com o aparelho
// correspondente que estiver ESPERANDO nessa etapa. Só marca o
// resultado (resultado_aprovacao_allied) — não move de etapa ainda, isso
// só acontece quando a pessoa clica em "Confirmar" na tela (ver rota
// confirmar-resultado-aprovacao).
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

  if (!podeConfirmarAprovacaoOrcamento(perfil)) {
    return NextResponse.json(
      { error: "Seu cargo não tem permissão para subir o arquivo de aprovação de orçamentos." },
      { status: 403 }
    );
  }

  const formData = await request.formData();
  const arquivo = formData.get("arquivo");

  if (!(arquivo instanceof File)) {
    return NextResponse.json({ error: "Envie o arquivo .xlsx com o resultado da Allied." }, { status: 400 });
  }

  let linhasBrutas: unknown[][];
  try {
    const bytes = Buffer.from(await arquivo.arrayBuffer());
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

  // última ocorrência de cada OS Reparadora vence (se a Allied mandar a
  // mesma linha duas vezes, ou uma correção mais abaixo no arquivo).
  const resultadoPorOs = new Map<string, "Aprovado" | "Contra Proposta" | "Reprovado">();
  let linhasNaoReconhecidas = 0;
  for (const linha of linhasDados) {
    const lida = lerLinhaAprovacao(linha);
    if (!lida) {
      linhasNaoReconhecidas += 1;
      continue;
    }
    resultadoPorOs.set(lida.osReparadora, lida.resultado);
  }

  const osReparadoras = Array.from(resultadoPorOs.keys());
  if (osReparadoras.length === 0) {
    return NextResponse.json(
      {
        error:
          "Não encontrei nenhuma linha reconhecível nesse arquivo (OS Reparadora válida + status Aprovado/Contra Proposta/Reprovado).",
      },
      { status: 400 }
    );
  }

  // só casa com aparelho que estiver DE FATO esperando em "3 - Ag.
  // Resposta de Orçamento" agora — OS Reparadora de outra etapa (ou que
  // nunca existiu) não é alterada.
  const aparelhosEncontrados = new Map<string, string>(); // os_reparadora -> id
  for (let i = 0; i < osReparadoras.length; i += TAMANHO_LOTE) {
    const lote = osReparadoras.slice(i, i + TAMANHO_LOTE);
    const { data } = await admin
      .from("orcamentos")
      .select("id, os_reparadora")
      .eq("status_operacional", STATUS_AG_RESPOSTA_ORCAMENTO)
      .in("os_reparadora", lote);
    for (const row of data ?? []) {
      if (row.os_reparadora) aparelhosEncontrados.set(row.os_reparadora, row.id);
    }
  }

  const agora = new Date().toISOString();
  const contagem = { Aprovado: 0, "Contra Proposta": 0, Reprovado: 0 };

  for (const [osReparadora, resultado] of resultadoPorOs.entries()) {
    const id = aparelhosEncontrados.get(osReparadora);
    if (!id) continue;
    const { error } = await admin
      .from("orcamentos")
      .update({ resultado_aprovacao_allied: resultado, resultado_aprovacao_definido_em: agora })
      .eq("id", id);
    if (!error) contagem[resultado] += 1;
  }

  const casadas = contagem.Aprovado + contagem["Contra Proposta"] + contagem.Reprovado;
  const naoEncontradas = osReparadoras.length - casadas;

  return NextResponse.json({
    linhasNoArquivo: linhasDados.length,
    linhasNaoReconhecidas,
    casadas,
    naoEncontradas,
    aprovados: contagem.Aprovado,
    contraProposta: contagem["Contra Proposta"],
    reprovados: contagem.Reprovado,
  });
}
