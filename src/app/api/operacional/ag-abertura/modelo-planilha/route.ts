import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/server";
import { CABECALHO_OS_CARE_ALLIED, CABECALHO_OS_REPARADORA } from "@/lib/planilhaAgAbertura";

// Gera o modelo de planilha (.xlsx) pra baixar, preencher e reenviar na
// rotina de preenchimento em massa da OS Reparadora em Ag. Abertura.
export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const planilha = XLSX.utils.aoa_to_sheet([
    [CABECALHO_OS_CARE_ALLIED, CABECALHO_OS_REPARADORA],
    ["Ex: 123456789012", "Ex: 4176101214"],
  ]);
  planilha["!cols"] = [{ wch: 24 }, { wch: 24 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, planilha, "Modelo");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="modelo-os-reparadora.xlsx"',
    },
  });
}
