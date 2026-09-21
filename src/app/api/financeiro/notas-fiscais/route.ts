import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { podeAcessarFinanceiro } from "@/lib/financeiro";

function numeroOuNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function textoOuNull(v: unknown): string | null {
  const t = String(v ?? "").trim();
  return t === "" ? null : t;
}

// Cria um lançamento manual no Financeiro (pedido explícito — "aceito
// sugestões", este é o botão "+ Novo lançamento" pra cobrir o caso da
// NF de Mão de Obra e a de Peças terem saído em dias diferentes, ou
// qualquer correção que precise de uma linha própria em vez de
// completar uma já existente). Normalmente as linhas aparecem sozinhas
// (ver registrarLancamentoFinanceiro em lib/financeiro.ts, chamado a
// partir de Ag. Emissão de Nota Fiscal) — isso aqui é só o
// complemento manual.
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

  if (!podeAcessarFinanceiro(perfil)) {
    return NextResponse.json({ error: "Seu cargo não tem acesso ao Financeiro." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const dataEmissao = textoOuNull(body?.data_emissao);
  const nfMaoDeObraNumero = textoOuNull(body?.nf_mao_de_obra_numero);
  const nfMaoDeObraValor = numeroOuNull(body?.nf_mao_de_obra_valor);
  const nfPecasNumero = textoOuNull(body?.nf_pecas_numero);
  const nfPecasValor = numeroOuNull(body?.nf_pecas_valor);

  if (!dataEmissao) {
    return NextResponse.json({ error: "Informe a data de emissão." }, { status: 400 });
  }
  if (!nfMaoDeObraNumero && !nfPecasNumero) {
    return NextResponse.json({ error: "Informe pelo menos o Nº de uma das duas NFs." }, { status: 400 });
  }

  const { error } = await admin.from("financeiro_notas_fiscais").insert({
    data_emissao: dataEmissao,
    nf_mao_de_obra_numero: nfMaoDeObraNumero,
    nf_mao_de_obra_valor: nfMaoDeObraNumero ? nfMaoDeObraValor : null,
    nf_pecas_numero: nfPecasNumero,
    nf_pecas_valor: nfPecasNumero ? nfPecasValor : null,
    atualizado_por: user.id,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
