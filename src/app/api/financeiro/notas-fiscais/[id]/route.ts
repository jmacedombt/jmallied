import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { podeAcessarFinanceiro, hojeIso, type StatusFinanceiro } from "@/lib/financeiro";

function numeroOuNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function textoOuNull(v: unknown): string | null {
  const t = String(v ?? "").trim();
  return t === "" ? null : t;
}

const STATUS_VALIDOS: StatusFinanceiro[] = ["Em Aberto", "Vlr. Recebido"];

// Atualiza um lançamento do Financeiro — edição manual de qualquer
// campo (corrigir Nº/valor de NF, data de emissão) e/ou mudança de
// status. Só os campos enviados no corpo são alterados (permite tanto
// "só mudar o status" quanto "só corrigir um número"), exceto a regra
// de negócio abaixo, que é sempre aplicada quando `status` vem no
// corpo: "Vlr. Recebido" sempre grava uma Data de Recebimento (a que
// vier no corpo, ou hoje se não vier nenhuma); voltar pra "Em Aberto"
// sempre limpa a Data de Recebimento (pedido explícito: "ao lado ao
// mudar para o Status de valor recebido tem que colocar a data de
// recebimento do valor").
export async function PUT(request: Request, { params }: { params: { id: string } }) {
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
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  const atualizacoes: Record<string, unknown> = { atualizado_por: user.id, atualizado_em: new Date().toISOString() };

  if ("data_emissao" in body) {
    const v = textoOuNull(body.data_emissao);
    if (!v) return NextResponse.json({ error: "Informe uma data de emissão válida." }, { status: 400 });
    atualizacoes.data_emissao = v;
  }
  if ("nf_mao_de_obra_numero" in body) atualizacoes.nf_mao_de_obra_numero = textoOuNull(body.nf_mao_de_obra_numero);
  if ("nf_mao_de_obra_valor" in body) atualizacoes.nf_mao_de_obra_valor = numeroOuNull(body.nf_mao_de_obra_valor);
  if ("nf_pecas_numero" in body) atualizacoes.nf_pecas_numero = textoOuNull(body.nf_pecas_numero);
  if ("nf_pecas_valor" in body) atualizacoes.nf_pecas_valor = numeroOuNull(body.nf_pecas_valor);

  if ("status" in body) {
    const status = body.status as StatusFinanceiro;
    if (!STATUS_VALIDOS.includes(status)) {
      return NextResponse.json({ error: "Status inválido." }, { status: 400 });
    }
    atualizacoes.status = status;
    if (status === "Vlr. Recebido") {
      atualizacoes.data_recebimento = textoOuNull(body.data_recebimento) || hojeIso();
    } else {
      atualizacoes.data_recebimento = null;
    }
  }

  const { error } = await admin.from("financeiro_notas_fiscais").update(atualizacoes).eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
