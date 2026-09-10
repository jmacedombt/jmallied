import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { dataDeHojeSaoPaulo } from "@/lib/tempo";

/**
 * Exporta o backlog (aparelhos parados em qualquer etapa numerada, 1 a
 * 8) no layout que a Allied já usa hoje (arquivo modelo enviado em
 * 2026-08-31): Trade Allied / IMEI Allied / SKU Allied / Status Reparo /
 * Reparadora. Sem nenhuma coluna de custo — por isso pode usar o
 * service role direto (rota já é server-side/confiável) sem precisar
 * passar pela RPC "segura" usada nas telas de consulta do ALLIED.
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

  const linhas = ((orcamentos ?? []) as LinhaBacklogExport[]).filter((o) => /^[0-9]/.test(o.status_operacional ?? ""));

  const planilha = XLSX.utils.aoa_to_sheet([
    ["Trade Allied", "IMEI Allied", "SKU Allied", "Status Reparo", "Reparadora"],
    ...linhas.map((o) => [
      o.trade_allied,
      o.imei_allied,
      o.sku,
      o.status_operacional,
      o.reparador_terceiro || "J Macedo",
    ]),
  ]);
  planilha["!cols"] = [{ wch: 12 }, { wch: 22 }, { wch: 16 }, { wch: 28 }, { wch: 12 }];

  // mesmo padrão de nome do arquivo modelo que a Allied mandou:
  // backlog_allied_trocafy_AAAAMMDD — aba com o mesmo nome (cortado em
  // 31 caracteres, limite do Excel).
  const dataHoje = dataDeHojeSaoPaulo().replace(/-/g, "");
  const nomeBase = `backlog_allied_trocafy_${dataHoje}`;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, planilha, nomeBase.slice(0, 31));
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
