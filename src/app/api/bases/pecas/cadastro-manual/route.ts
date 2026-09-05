import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { podeImportarBasePecas } from "@/lib/pecas";

function dataDeHojeSaoPaulo(): string {
  // "en-CA" formata como AAAA-MM-DD, exatamente o que a coluna date espera.
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

// Cadastro manual de uma peça que ainda não tem custo na Base Peças —
// aberto a partir do pop-up de peças em Validação de Orçamentos quando um
// código do orçamento não é encontrado em pecas_vigentes. Grava como se
// fosse uma linha de compra importada (mesma tabela pecas_compras), então
// o valor passa a valer daí pra frente em qualquer lugar que use esse
// código (BID, outros orçamentos, etc.) — não fica restrito a esse
// orçamento.
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

  if (!podeImportarBasePecas(perfil)) {
    return NextResponse.json({ error: "Seu cargo não tem permissão para cadastrar peças na Base Peças." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const codigo = String(body?.codigo ?? "").trim();
  const valorUnitario = Number(body?.valor_unitario);
  const descricao = body?.descricao ? String(body.descricao).trim() : null;

  if (!codigo) {
    return NextResponse.json({ error: "Código da peça não informado." }, { status: 400 });
  }
  if (!Number.isFinite(valorUnitario) || valorUnitario <= 0) {
    return NextResponse.json({ error: "Informe um valor de custo válido." }, { status: 400 });
  }

  const { error } = await admin.from("pecas_compras").insert({
    codigo,
    descricao,
    data_compra: dataDeHojeSaoPaulo(),
    quantidade: 1,
    valor_total: valorUnitario,
    delivery: "CADASTRO MANUAL",
  });

  // colisão com uma linha idêntica já cadastrada hoje (mesmo código +
  // data + entrega + qtd + valor) não é erro de verdade — o valor já
  // está vigente, só não precisa duplicar a linha.
  if (error && error.code !== "23505") {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, codigo, valor_unitario: valorUnitario });
}
