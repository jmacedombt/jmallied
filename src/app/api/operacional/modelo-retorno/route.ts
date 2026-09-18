import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { podeLancarNfProdutoEntregue } from "@/lib/orcamentos";
import { type ItemModeloRetorno } from "@/lib/modeloRetorno";

/** Retenção de 60 dias (pedido explícito) — só um filtro de data na
 * consulta, ver comentário na migration 0049 (esse projeto não tem
 * nenhum job/cron pra apagar linha nenhuma automaticamente). */
const RETENCAO_DIAS = 60;

function corteRetencaoIso(): string {
  return new Date(Date.now() - RETENCAO_DIAS * 24 * 60 * 60 * 1000).toISOString();
}

async function autenticarEAutorizar() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { erro: NextResponse.json({ error: "Não autenticado." }, { status: 401 }) } as const;
  }

  const admin = createAdminClient();
  const { data: perfil } = await admin.from("usuarios").select("cargo, is_master").eq("id", user.id).single();
  if (!podeLancarNfProdutoEntregue(perfil)) {
    return {
      erro: NextResponse.json(
        { error: "Seu cargo não tem permissão pra acessar o histórico de Modelo de Retorno." },
        { status: 403 }
      ),
    } as const;
  }

  return { admin, userId: user.id } as const;
}

// Lista o histórico de planilhas "Modelo de Retorno" já emitidas (menu
// Operacional > Modelo de Retorno) — só dos últimos 60 dias, mais
// recente primeiro. Não devolve a coluna `dados` (o snapshot completo
// pode ser grande) — só o resumo mostrado na tabela; o snapshot
// completo só é lido na hora do download (ver [id]/download/route.ts).
export async function GET() {
  const auth = await autenticarEAutorizar();
  if ("erro" in auth) return auth.erro;

  const { data, error } = await auth.admin
    .from("modelo_retorno_geracoes")
    .select(
      "id, gerado_em, quantidade_aprovados, quantidade_recusados, nfs_remessa, nome_arquivo, usuarios:gerado_por (nome, sobrenome)"
    )
    .gte("gerado_em", corteRetencaoIso())
    .order("gerado_em", { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ geracoes: data ?? [] });
}

// Registra uma emissão da planilha "Modelo de Retorno" — chamado logo
// depois do download no navegador (ver emitirPlanilhaRetorno em
// PainelAgEmissaoNf.tsx), com o mesmo snapshot de dados usado pra
// montar aquele Excel. Não duplica registro (pedido explícito): se os
// dados forem idênticos aos do ÚLTIMO registro gravado, só atualiza
// esse registro (gerado_em/gerado_por/nome_arquivo/data_referencia) em
// vez de inserir outro.
export async function POST(request: Request) {
  const auth = await autenticarEAutorizar();
  if ("erro" in auth) return auth.erro;
  const { admin, userId } = auth;

  const body = await request.json().catch(() => null);
  const aprovados: ItemModeloRetorno[] = Array.isArray(body?.aprovados) ? body.aprovados : null;
  const recusados: ItemModeloRetorno[] = Array.isArray(body?.recusados) ? body.recusados : null;
  const solucoesPorPartNumber =
    body?.solucoesPorPartNumber && typeof body.solucoesPorPartNumber === "object" ? body.solucoesPorPartNumber : {};
  const nomeArquivo = typeof body?.nomeArquivo === "string" ? body.nomeArquivo : null;
  const dataReferencia = typeof body?.dataReferencia === "string" ? body.dataReferencia : null;

  if (!aprovados || !recusados || !nomeArquivo || !dataReferencia) {
    return NextResponse.json({ error: "Dados incompletos pra registrar essa emissão." }, { status: 400 });
  }

  const nfsRemessa = Array.from(
    new Set([...aprovados, ...recusados].map((i) => i.nf_remessa_allied).filter((nf): nf is string => Boolean(nf)))
  ).sort();

  const assinatura = createHash("sha256")
    .update(JSON.stringify({ aprovados, recusados, solucoesPorPartNumber }))
    .digest("hex");

  const { data: ultimo } = await admin
    .from("modelo_retorno_geracoes")
    .select("id, assinatura")
    .order("gerado_em", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (ultimo && ultimo.assinatura === assinatura) {
    const { error } = await admin
      .from("modelo_retorno_geracoes")
      .update({
        gerado_em: new Date().toISOString(),
        gerado_por: userId,
        nome_arquivo: nomeArquivo,
        data_referencia: dataReferencia,
      })
      .eq("id", ultimo.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true, atualizado: true, id: ultimo.id });
  }

  const { data: inserido, error } = await admin
    .from("modelo_retorno_geracoes")
    .insert({
      gerado_por: userId,
      quantidade_aprovados: aprovados.length,
      quantidade_recusados: recusados.length,
      nfs_remessa: nfsRemessa,
      nome_arquivo: nomeArquivo,
      data_referencia: dataReferencia,
      assinatura,
      dados: { aprovados, recusados, solucoesPorPartNumber },
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, atualizado: false, id: inserido.id });
}
