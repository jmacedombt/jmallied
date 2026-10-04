import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { podeMovimentarOrcamentos } from "@/lib/orcamentos";
import { lerListaIdentificadores } from "@/lib/movimentarLote";

export const maxDuration = 60;

type ItemBusca =
  | {
      valorBuscado: string;
      encontrado: true;
      id: string;
      trade_allied: string;
      os_care_allied: string | null;
      os_reparadora: string | null;
      modelo_comercial: string | null;
      status_operacional: string;
    }
  | { valorBuscado: string; encontrado: false };

// "Movimentar" (menu Operacional, pedido explícito, 03/10/2026) — lê o
// arquivo subido (lista de Trade Allied ou OS Reparadora) e devolve, pra
// cada valor, o orçamento encontrado (com a Etapa atual) ou "não
// encontrado". Um valor pode bater com mais de um orçamento (ex: OS
// Reparadora reincidente) — cada um vira uma linha própria na resposta,
// com o mesmo valorBuscado. Só prepara a lista pra tela — não altera
// nada ainda (ver /api/operacional/movimentar/confirmar).
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

  if (!podeMovimentarOrcamentos(perfil)) {
    return NextResponse.json({ error: "Só Administrador ou Gerente podem acessar Movimentar." }, { status: 403 });
  }

  const formData = await request.formData();
  const arquivo = formData.get("arquivo");
  const tipo = formData.get("tipo");

  if (!(arquivo instanceof File)) {
    return NextResponse.json({ error: "Envie o arquivo (.xlsx ou .txt) com a lista." }, { status: 400 });
  }
  if (tipo !== "trade_allied" && tipo !== "os_reparadora") {
    return NextResponse.json({ error: "Escolha se a lista é de Trade Allied ou OS Reparadora." }, { status: 400 });
  }

  let valores: string[];
  try {
    const bytes = Buffer.from(await arquivo.arrayBuffer());
    valores = lerListaIdentificadores(bytes, arquivo.name);
  } catch {
    return NextResponse.json({ error: "Não consegui ler esse arquivo. Confirme que é um .xlsx ou .txt válido." }, { status: 400 });
  }

  if (valores.length === 0) {
    return NextResponse.json({ error: "O arquivo não tem nenhum valor." }, { status: 400 });
  }

  const coluna = tipo === "trade_allied" ? "trade_allied" : "os_reparadora";

  const { data: encontrados, error } = await admin
    .from("orcamentos")
    .select("id, trade_allied, os_care_allied, os_reparadora, modelo_comercial, status_operacional")
    .in(coluna, valores);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const porValor = new Map<string, typeof encontrados>();
  for (const o of encontrados ?? []) {
    const chave = String(o[coluna as "trade_allied" | "os_reparadora"]);
    const lista = porValor.get(chave) ?? [];
    lista.push(o);
    porValor.set(chave, lista);
  }

  const itens: ItemBusca[] = [];
  for (const valor of valores) {
    const lista = porValor.get(valor);
    if (!lista || lista.length === 0) {
      itens.push({ valorBuscado: valor, encontrado: false });
      continue;
    }
    for (const o of lista) {
      itens.push({
        valorBuscado: valor,
        encontrado: true,
        id: o.id,
        trade_allied: o.trade_allied,
        os_care_allied: o.os_care_allied,
        os_reparadora: o.os_reparadora,
        modelo_comercial: o.modelo_comercial,
        status_operacional: o.status_operacional,
      });
    }
  }

  return NextResponse.json({ itens });
}
