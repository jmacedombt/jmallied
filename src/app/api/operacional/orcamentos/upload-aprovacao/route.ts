import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import {
  podeConfirmarAprovacaoOrcamento,
  STATUS_AG_RESPOSTA_ORCAMENTO,
  STATUS_AG_CONTRA_PROPOSTA,
} from "@/lib/orcamentos";
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
//
// Também casa com aparelho que JÁ ESTÁ em "Ag. Contra Proposta" (não só
// os que ainda estão esperando) — só pra poder reescrever o valor
// recebido da Allied (coluna BS) quando o mesmo arquivo/um arquivo
// corrigido é subido de novo depois que o item já avançou de etapa; sem
// isso, um aparelho que já tinha sido movido pra Ag. Contra Proposta
// antes desse campo existir nunca teria como receber o valor.
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
  const resultadoPorOs = new Map<
    string,
    { resultado: "Aprovado" | "Contra Proposta" | "Reprovado"; valorContraProposta: number | null }
  >();
  let linhasNaoReconhecidas = 0;
  for (const linha of linhasDados) {
    const lida = lerLinhaAprovacao(linha);
    if (!lida) {
      linhasNaoReconhecidas += 1;
      continue;
    }
    resultadoPorOs.set(lida.osReparadora, { resultado: lida.resultado, valorContraProposta: lida.valorContraPropostaAllied });
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

  // casa com aparelho que estiver esperando em "3 - Ag. Resposta de
  // Orçamento" OU que já esteja em "Ag. Contra Proposta" (ver comentário
  // acima) — OS Reparadora de qualquer outra etapa (ou que nunca
  // existiu) não é alterada. Guarda também o nf_remessa_allied de cada
  // um (pedido explícito) pro resumo por NF do histórico desse upload —
  // um único arquivo normalmente mistura vários lotes.
  const aparelhosEncontrados = new Map<string, { id: string; nfRemessaAllied: string }>(); // os_reparadora -> {id, nf}
  for (let i = 0; i < osReparadoras.length; i += TAMANHO_LOTE) {
    const lote = osReparadoras.slice(i, i + TAMANHO_LOTE);
    const { data } = await admin
      .from("orcamentos")
      .select("id, os_reparadora, nf_remessa_allied")
      .in("status_operacional", [STATUS_AG_RESPOSTA_ORCAMENTO, STATUS_AG_CONTRA_PROPOSTA])
      .in("os_reparadora", lote);
    for (const row of data ?? []) {
      if (row.os_reparadora) aparelhosEncontrados.set(row.os_reparadora, { id: row.id, nfRemessaAllied: row.nf_remessa_allied });
    }
  }

  const agora = new Date().toISOString();
  const contagem = { Aprovado: 0, "Contra Proposta": 0, Reprovado: 0 };
  const contagemPorNf = new Map<string, { total: number; Aprovado: number; "Contra Proposta": number; Reprovado: number }>();

  for (const [osReparadora, { resultado, valorContraProposta }] of resultadoPorOs.entries()) {
    const encontrado = aparelhosEncontrados.get(osReparadora);
    if (!encontrado) continue;
    const { id, nfRemessaAllied } = encontrado;
    const { error } = await admin
      .from("orcamentos")
      .update({
        resultado_aprovacao_allied: resultado,
        resultado_aprovacao_definido_em: agora,
        // valor que a Allied contra-propôs (coluna BS, pedido
        // explícito) — grava null quando o resultado não é "Contra
        // Proposta", pra limpar um valor antigo se a linha mudar de
        // status num reenvio do arquivo.
        contra_proposta_valor_recebido_allied: valorContraProposta,
      })
      .eq("id", id);
    if (!error) {
      contagem[resultado] += 1;
      const atual = contagemPorNf.get(nfRemessaAllied) ?? { total: 0, Aprovado: 0, "Contra Proposta": 0, Reprovado: 0 };
      atual.total += 1;
      atual[resultado] += 1;
      contagemPorNf.set(nfRemessaAllied, atual);
    }
  }

  const casadas = contagem.Aprovado + contagem["Contra Proposta"] + contagem.Reprovado;
  const naoEncontradas = osReparadoras.length - casadas;

  // (pedido explícito) guarda o histórico desse upload — o arquivo em si
  // (storage) + o resumo já calculado, com detalhamento por NF Remessa —
  // uma falha aqui não pode impedir o resultado de já ter sido gravado
  // nos orçamentos acima, só fica sem registro no histórico dessa vez.
  try {
    const timestamp = agora.replace(/[^0-9]/g, "");
    const arquivoPath = `${timestamp}-${arquivo.name.replace(/[^a-zA-Z0-9.\-_]+/g, "_")}`;
    const bytesArquivo = Buffer.from(await arquivo.arrayBuffer());
    const { error: erroUpload } = await admin.storage
      .from("aprovacoes-orcamentos")
      .upload(arquivoPath, bytesArquivo, {
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        upsert: false,
      });

    const resumoPorNf = Array.from(contagemPorNf.entries())
      .map(([nfRemessaAllied, c]) => ({
        nf_remessa_allied: nfRemessaAllied,
        total: c.total,
        aprovados: c.Aprovado,
        contra_proposta: c["Contra Proposta"],
        reprovados: c.Reprovado,
      }))
      .sort((a, b) => a.nf_remessa_allied.localeCompare(b.nf_remessa_allied));

    await admin.from("orcamento_aprovacoes_uploads").insert({
      arquivo_path: erroUpload ? null : arquivoPath,
      nome_arquivo: arquivo.name,
      enviado_por: user.id,
      enviado_em: agora,
      linhas_no_arquivo: linhasDados.length,
      linhas_nao_reconhecidas: linhasNaoReconhecidas,
      casadas,
      nao_encontradas: naoEncontradas,
      aprovados: contagem.Aprovado,
      contra_proposta: contagem["Contra Proposta"],
      reprovados: contagem.Reprovado,
      resumo_por_nf: resumoPorNf,
    });
  } catch (erroHistorico) {
    console.error("Falha ao registrar histórico de upload de aprovação:", erroHistorico);
  }

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
