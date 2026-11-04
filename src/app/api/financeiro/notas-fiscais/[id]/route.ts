import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { podeAcessarFinanceiro, hojeIso, type StatusFinanceiro, type TipoNotaFinanceiro } from "@/lib/financeiro";

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
// vier no corpo, ou hoje se não vier nenhuma) na NF indicada em `nf`; voltar pra "Em Aberto"
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

  // status é POR NOTA FISCAL (migration 0075, pedido explícito
  // 07/10/2026): quem muda o status precisa dizer de qual NF do
  // lançamento é — `nf: "mao_de_obra" | "pecas"`.
  if ("status" in body) {
    const status = body.status as StatusFinanceiro;
    if (!STATUS_VALIDOS.includes(status)) {
      return NextResponse.json({ error: "Status inválido." }, { status: 400 });
    }
    const nf = body.nf as TipoNotaFinanceiro;
    if (nf !== "mao_de_obra" && nf !== "pecas") {
      return NextResponse.json({ error: "Informe de qual nota fiscal é o status (Mão de Obra ou Peças)." }, { status: 400 });
    }
    atualizacoes[`nf_${nf}_status`] = status;
    atualizacoes[`nf_${nf}_data_recebimento`] =
      status === "Vlr. Recebido" ? textoOuNull(body.data_recebimento) || hojeIso() : null;
  }

  // valores ANTES da edição — pra levar a correção de número/valor da NF
  // pros aparelhos (ver abaixo).
  const { data: antes } = await admin
    .from("financeiro_notas_fiscais")
    .select("nf_mao_de_obra_numero, nf_mao_de_obra_valor, nf_pecas_numero, nf_pecas_valor")
    .eq("id", params.id)
    .single();

  const { error } = await admin.from("financeiro_notas_fiscais").update(atualizacoes).eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Correção no Financeiro vale pro sistema TODO (pedido explícito,
  // 04/11/2026): o número/valor da NF também fica gravado em cada
  // aparelho (orcamentos.nf_mao_de_obra_* / nf_pecas_*), que é de onde
  // leem Operacional > Notas Fiscais, Ag. Emissão de NF, Produto
  // Entregue, Modelo de Retorno etc. Antes o lápis do Financeiro só
  // mudava a tabela dele. Agora todo aparelho que tinha o número ANTIGO
  // dessa NF passa pro número/valor novos.
  let aparelhosAtualizados = 0;
  if (antes) {
    for (const tipo of ["mao_de_obra", "pecas"] as const) {
      const campoNumero = `nf_${tipo}_numero` as const;
      const campoValor = `nf_${tipo}_valor` as const;
      const numeroAntigo = (antes as Record<string, unknown>)[campoNumero] as string | null;
      if (!numeroAntigo) continue;
      const mudouNumero = campoNumero in atualizacoes && atualizacoes[campoNumero] && atualizacoes[campoNumero] !== numeroAntigo;
      const valorAntigo = (antes as Record<string, unknown>)[campoValor] as number | null;
      const mudouValor =
        campoValor in atualizacoes &&
        atualizacoes[campoValor] != null &&
        Number(atualizacoes[campoValor]) !== Number(valorAntigo ?? NaN);
      if (!mudouNumero && !mudouValor) continue;

      const novos: Record<string, unknown> = {};
      if (mudouNumero) novos[campoNumero] = atualizacoes[campoNumero];
      if (mudouValor) novos[campoValor] = atualizacoes[campoValor];
      const { data: alterados, error: erroAparelhos } = await admin
        .from("orcamentos")
        .update(novos)
        .eq(campoNumero, numeroAntigo)
        .select("id");
      if (erroAparelhos) {
        return NextResponse.json(
          { error: `O Financeiro foi atualizado, mas não consegui atualizar os aparelhos: ${erroAparelhos.message}` },
          { status: 400 }
        );
      }
      aparelhosAtualizados += alterados?.length ?? 0;
    }
  }

  return NextResponse.json({ ok: true, aparelhosAtualizados });
}
