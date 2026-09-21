import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { podeImportarBid, gerarBufferRelatorioBid, partesDataHoraSaoPauloBid } from "@/lib/bid";

type LinhaBidBruta = {
  modelo: string;
  part_number: string;
  custo_peca_allied: number | null;
  mao_de_obra: number | null;
  bid_solucoes: { peca_solucao: string; principal: boolean }[] | null;
};

// Gera o Relatório BID em Excel (Bases > Relatório BID): só entram
// peças com Modelo, Part Number, Peça Solução, Custo Peça (Allied) e
// Mão de Obra todos preenchidos. Cada geração fica registrada em
// bid_relatorio_log (quem, quando, quantas peças saíram) — a partir da
// migration 0056, também grava uma CÓPIA das linhas (coluna `dados`) e
// o nome da aba usados, pra dar pra baixar de novo depois byte a byte
// igual (ver /api/bases/bid/relatorio/[id]/download), e pode ser
// marcada como "enviada" por linha (ver .../marcar-enviado), o que a
// deixa visível pro login ALLIED.
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

  const { dia, mes, ano, anoCurto, hora, minuto } = partesDataHoraSaoPauloBid();
  const nomeAba = `BID SANTOS ${dia}${mes}${anoCurto}`;
  const nomeArquivo = `BID SANTOS ${dia}${mes}${ano}_${hora}${minuto}.xlsx`;

  const buffer = await gerarBufferRelatorioBid(linhasCompletas, nomeAba);

  await admin.from("bid_relatorio_log").insert({
    gerado_por: user.id,
    quantidade_part_numbers: linhasCompletas.length,
    nome_arquivo: nomeArquivo,
    nome_aba: nomeAba,
    dados: linhasCompletas,
  });

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nomeArquivo}"`,
    },
  });
}
