import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { dataDeHojeSaoPaulo } from "@/lib/tempo";

/**
 * Exporta o backlog em Excel — mesmas 5 colunas de sempre (Trade Allied
 * / IMEI Allied / SKU Allied / Status Reparo / Reparadora), sem nenhuma
 * coluna de custo, por isso pode usar o service role direto (rota já é
 * server-side/confiável) sem precisar passar pela RPC "segura" usada
 * nas telas de consulta do ALLIED.
 *
 * 2 abas (pedido explícito):
 *   1) mesmo layout que a Allied já usa hoje (arquivo modelo enviado em
 *      2026-08-31) — só os status com numeração (1 a 8), condição
 *      inalterada;
 *   2) TODAS as pendências — qualquer status_operacional, numerado ou
 *      não (Ag. Abertura, Validação de Orçamentos, Ag. Contra Proposta
 *      etc.), mesmas 5 colunas.
 *
 * Disponível tanto pra equipe interna quanto pro cargo ALLIED (é o
 * botão da própria tela Backlog, que os dois enxergam) — liberado à
 * parte no middleware, já que ALLIED não pode chamar nenhuma outra API.
 */
export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: orcamentos, error } = await admin
    .from("orcamentos")
    .select("trade_allied, imei_allied, sku, status_operacional, reparador_terceiro")
    .order("status_operacional", { ascending: true })
    .order("trade_allied", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "Não consegui buscar os dados do backlog." }, { status: 500 });
  }

  type LinhaBacklogExport = {
    trade_allied: string;
    imei_allied: string | null;
    sku: string | null;
    status_operacional: string;
    reparador_terceiro: string | null;
  };

  const todasLinhas = (orcamentos ?? []) as LinhaBacklogExport[];
  const linhasNumeradas = todasLinhas.filter((o) => /^[0-9]/.test(o.status_operacional ?? ""));

  const cabecalho = ["Trade Allied", "IMEI Allied", "SKU Allied", "Status Reparo", "Reparadora"];
  const linhaPlanilha = (o: LinhaBacklogExport) => [
    o.trade_allied,
    o.imei_allied,
    o.sku,
    o.status_operacional,
    o.reparador_terceiro || "J Macedo",
  ];
  const largurasColunas = [{ wch: 12 }, { wch: 22 }, { wch: 16 }, { wch: 28 }, { wch: 12 }];

  const planilhaNumerados = XLSX.utils.aoa_to_sheet([cabecalho, ...linhasNumeradas.map(linhaPlanilha)]);
  planilhaNumerados["!cols"] = largurasColunas;

  // 2ª aba (pedido explícito): TODAS as pendências, numeradas ou não.
  const planilhaTodos = XLSX.utils.aoa_to_sheet([cabecalho, ...todasLinhas.map(linhaPlanilha)]);
  planilhaTodos["!cols"] = largurasColunas;

  // mesmo padrão de nome do arquivo modelo que a Allied mandou:
  // backlog_allied_trocafy_AAAAMMDD — aba com o mesmo nome (cortado em
  // 31 caracteres, limite do Excel).
  const dataHoje = dataDeHojeSaoPaulo().replace(/-/g, "");
  const nomeBase = `backlog_allied_trocafy_${dataHoje}`;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, planilhaNumerados, nomeBase.slice(0, 31));
  XLSX.utils.book_append_sheet(workbook, planilhaTodos, "Todos os status");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nomeBase}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
