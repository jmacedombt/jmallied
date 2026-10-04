import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { podeMovimentarOrcamentos, STATUS_DESTINO_MOVIMENTAR, STATUS_PRODUTO_ENTREGUE } from "@/lib/orcamentos";

export const maxDuration = 60;

// Campos de NF (Mão de Obra/Peças/Retorno) + data de exportação — sempre
// apagados quando o orçamento está SAINDO de "Produto Entregue" (mesmo
// princípio de [id]/retroceder-status/route.ts: evita deixar NF
// "fantasma" gravada num orçamento que já não está mais entregue).
const CAMPOS_NF_PARA_LIMPAR = {
  nf_mao_de_obra_numero: null,
  nf_mao_de_obra_valor: null,
  nf_pecas_numero: null,
  nf_pecas_valor: null,
  nf_retorno_numero: null,
  nf_retorno_valor: null,
  nf_exportado_em: null,
};

type ItemPedido = { orcamentoId: string; statusNovo: string };

type OrcamentoAtual = {
  id: string;
  trade_allied: string;
  os_care_allied: string | null;
  os_reparadora: string | null;
  status_operacional: string;
};

// "Movimentar" (menu Operacional, pedido explícito, 03/10/2026) — grava
// de fato a troca de status_operacional em lote, já escolhida na tela
// (um status pra todos, ou um por item — tanto faz, chega aqui como uma
// lista de pares orçamento/status novo). Pula todas as regras normais
// de cada etapa (não preenche nenhum campo de aprovação/detalhe que as
// telas normais preenchem) — é uma ferramenta de correção manual. Por
// isso cada mudança fica registrada em orcamento_movimentacao_lote
// (migration 0073), consultável em Sistema > Auditoria (só
// Administrador). Nunca confia no status_operacional atual que vier do
// cliente — busca de novo aqui pra montar o "status_anterior" certo e
// decidir se precisa limpar os campos de NF.
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

  const body = await request.json().catch(() => null);
  const pedidosBrutos = Array.isArray(body?.itens) ? body.itens : [];

  const porOrcamento = new Map<string, string>();
  for (const p of pedidosBrutos as unknown[]) {
    const orcamentoId = typeof (p as ItemPedido)?.orcamentoId === "string" ? (p as ItemPedido).orcamentoId : null;
    const statusNovo = typeof (p as ItemPedido)?.statusNovo === "string" ? (p as ItemPedido).statusNovo : null;
    if (!orcamentoId || !statusNovo) {
      return NextResponse.json({ error: "Lista de itens inválida." }, { status: 400 });
    }
    if (!STATUS_DESTINO_MOVIMENTAR.some((s) => s.valor === statusNovo)) {
      return NextResponse.json({ error: `Status de destino inválido: "${statusNovo}".` }, { status: 400 });
    }
    porOrcamento.set(orcamentoId, statusNovo); // último pedido pro mesmo id ganha
  }

  if (porOrcamento.size === 0) {
    return NextResponse.json({ error: "Nenhum item pra movimentar." }, { status: 400 });
  }

  const ids = Array.from(porOrcamento.keys());
  const { data: atuais, error: erroAtuais } = await admin
    .from("orcamentos")
    .select("id, trade_allied, os_care_allied, os_reparadora, status_operacional")
    .in("id", ids);

  if (erroAtuais) {
    return NextResponse.json({ error: erroAtuais.message }, { status: 400 });
  }

  // Só entram quem realmente muda de status (evita gravar auditoria e
  // fazer update à toa quando o destino escolhido já é o status atual).
  const mudancas = ((atuais ?? []) as OrcamentoAtual[])
    .map((o) => ({ ...o, statusNovo: porOrcamento.get(o.id)! }))
    .filter((o) => o.statusNovo !== o.status_operacional);

  if (mudancas.length === 0) {
    return NextResponse.json({ ok: true, quantidade: 0 });
  }

  // Agrupa por (status novo + precisa limpar NF ou não) pra fazer um
  // UPDATE só por grupo, em vez de um update por item.
  type Grupo = { statusNovo: string; limparNf: boolean; ids: string[] };
  const grupos = new Map<string, Grupo>();
  for (const m of mudancas) {
    const limparNf = m.status_operacional === STATUS_PRODUTO_ENTREGUE;
    const chave = `${m.statusNovo}::${limparNf}`;
    const grupo: Grupo = grupos.get(chave) ?? { statusNovo: m.statusNovo, limparNf, ids: [] };
    grupo.ids.push(m.id);
    grupos.set(chave, grupo);
  }

  for (const grupo of grupos.values()) {
    const atualizacao: Record<string, unknown> = { status_operacional: grupo.statusNovo };
    if (grupo.limparNf) Object.assign(atualizacao, CAMPOS_NF_PARA_LIMPAR);

    const { error } = await admin.from("orcamentos").update(atualizacao).in("id", grupo.ids);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
  }

  const loteId = randomUUID();
  const { error: erroAuditoria } = await admin.from("orcamento_movimentacao_lote").insert(
    mudancas.map((m) => ({
      lote_id: loteId,
      orcamento_id: m.id,
      trade_allied: m.trade_allied,
      os_care_allied: m.os_care_allied,
      os_reparadora: m.os_reparadora,
      status_anterior: m.status_operacional,
      status_novo: m.statusNovo,
      movimentado_por: user.id,
    }))
  );

  if (erroAuditoria) {
    // o status já foi trocado com sucesso — só a auditoria falhou. Não
    // desfaz a troca (seria pior esconder que mudou), só avisa.
    return NextResponse.json(
      { ok: true, quantidade: mudancas.length, avisoAuditoria: "Status alterado, mas não consegui registrar na Auditoria." },
      { status: 200 }
    );
  }

  return NextResponse.json({ ok: true, quantidade: mudancas.length });
}
