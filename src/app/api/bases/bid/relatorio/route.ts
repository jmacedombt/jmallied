import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { podeImportarBid } from "@/lib/bid";

type LinhaBidBruta = {
  modelo: string;
  part_number: string;
  custo_peca_allied: number | null;
  mao_de_obra: number | null;
  bid_solucoes: { peca_solucao: string; principal: boolean }[] | null;
};

/** Data/hora "agora" no fuso de Brasília, independente do fuso do
 * servidor (a Vercel roda em UTC) — evita o nome do arquivo/aba saírem
 * com o dia errado perto da virada da meia-noite. */
function partesDataHoraSaoPaulo() {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const valor = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? "00";
  return {
    dia: valor("day"),
    mes: valor("month"),
    ano: valor("year"),
    anoCurto: valor("year").slice(-2),
    hora: valor("hour"),
    minuto: valor("minute"),
  };
}

// Gera o Relatório BID em Excel (Bases > Relatório BID): só entram
// peças com Modelo, Part Number, Peça Solução, Custo Peça (Allied) e
// Mão de Obra todos preenchidos. Cada geração fica registrada em
// bid_relatorio_log (quem, quando, quantas peças saíram).
export async function POST() {
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
    return NextResponse.json({ error: "Seu cargo não tem permissão para gerar o Relatório BID." }, { status: 403 });
  }

  // busca TODAS as peças, paginando — sem isso o Supabase corta
  // silenciosamente em 1000 linhas por consulta (limite padrão do
  // PostgREST), e o relatório sairia incompleto sem nenhum aviso.
  const LOTE_BUSCA = 1000;
  const linhas: LinhaBidBruta[] = [];
  for (let inicio = 0; ; inicio += LOTE_BUSCA) {
    const { data, error } = (await admin
      .from("bid_pecas")
      .select("modelo, part_number, custo_peca_allied, mao_de_obra, bid_solucoes(peca_solucao, principal)")
      .order("modelo", { ascending: true })
      .order("part_number", { ascending: true })
      .range(inicio, inicio + LOTE_BUSCA - 1)) as unknown as { data: LinhaBidBruta[] | null; error: { message: string } | null };
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (!data || data.length === 0) break;
    linhas.push(...data);
    if (data.length < LOTE_BUSCA) break;
  }

  const linhasCompletas = linhas
    .map((linha) => {
      const solucoes = linha.bid_solucoes ?? [];
      const principal = solucoes.find((s) => s.principal) ?? solucoes[0];
      const pecaSolucao = principal?.peca_solucao?.trim() || null;
      return {
        modelo: linha.modelo,
        part_number: linha.part_number,
        peca_solucao: pecaSolucao,
        custo_peca_allied: linha.custo_peca_allied,
        mao_de_obra: linha.mao_de_obra,
      };
    })
    // só entra no relatório quem tem TODOS os campos preenchidos
    .filter((l) => l.modelo && l.part_number && l.peca_solucao && l.custo_peca_allied != null && l.mao_de_obra != null);

  const { dia, mes, ano, anoCurto, hora, minuto } = partesDataHoraSaoPaulo();
  const nomeAba = `BID SANTOS ${dia}${mes}${anoCurto}`;
  const nomeArquivo = `BID SANTOS ${dia}${mes}${ano}_${hora}${minuto}.xlsx`;

  const cabecalho = ["Peças", "Part Number", "Peça Solução", "Custo Peça", "Mão de Obra"];
  const linhasPlanilha = linhasCompletas.map((l) => [
    l.modelo,
    l.part_number,
    l.peca_solucao,
    l.custo_peca_allied,
    l.mao_de_obra,
  ]);

  const planilha = XLSX.utils.aoa_to_sheet([cabecalho, ...linhasPlanilha]);
  planilha["!cols"] = [{ wch: 22 }, { wch: 20 }, { wch: 34 }, { wch: 14 }, { wch: 14 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, planilha, nomeAba);
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;

  await admin.from("bid_relatorio_log").insert({
    gerado_por: user.id,
    quantidade_part_numbers: linhasCompletas.length,
    nome_arquivo: nomeArquivo,
  });

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nomeArquivo}"`,
    },
  });
}
