import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { podeLancarNfProdutoEntregue } from "@/lib/orcamentos";

const COLUNAS_POR_TIPO = {
  mao_de_obra: { numero: "nf_mao_de_obra_numero", valor: "nf_mao_de_obra_valor" },
  pecas: { numero: "nf_pecas_numero", valor: "nf_pecas_valor" },
  retorno: { numero: "nf_retorno_numero", valor: "nf_retorno_valor" },
} as const;

type TipoNf = keyof typeof COLUNAS_POR_TIPO;

// Grava o Nº NF + Valor de "NF Mão de Obra" / "NF Peças" / "NF Retorno"
// em todos os aparelhos informados de uma vez — chamado tanto pra lançar
// pela primeira vez quanto pra corrigir depois (mesmo após o lote já ter
// ido pra "Produto Entregue", ver PopupAtendimentoPecas.tsx). NF Mão de
// Obra/Peças chegam com os ids de TODO o bloco Aprovados; NF Retorno
// chega só com os ids de uma NF Remessa (ver PainelAgEmissaoNf.tsx).
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

  if (!podeLancarNfProdutoEntregue(perfil)) {
    return NextResponse.json({ error: "Seu cargo não tem permissão pra lançar NF nessa tela." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const ids: string[] = Array.isArray(body?.ids) ? body.ids.filter((id: unknown) => typeof id === "string") : [];
  const tipo: TipoNf | undefined = COLUNAS_POR_TIPO[body?.tipo as TipoNf] ? (body.tipo as TipoNf) : undefined;
  const numero = typeof body?.numero === "string" ? body.numero.trim() : "";
  const valor = typeof body?.valor === "number" && Number.isFinite(body.valor) ? body.valor : NaN;

  if (ids.length === 0) {
    return NextResponse.json({ error: "Nenhum aparelho informado." }, { status: 400 });
  }
  if (!tipo) {
    return NextResponse.json({ error: "Tipo de NF inválido." }, { status: 400 });
  }
  if (!numero) {
    return NextResponse.json({ error: "Informe o Nº da NF." }, { status: 400 });
  }
  if (!Number.isFinite(valor) || valor < 0) {
    return NextResponse.json({ error: "Informe um valor válido." }, { status: 400 });
  }

  const colunas = COLUNAS_POR_TIPO[tipo];
  const { error } = await admin
    .from("orcamentos")
    .update({ [colunas.numero]: numero, [colunas.valor]: valor })
    .in("id", ids);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
