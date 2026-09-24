import { createAdminClient } from "@/lib/supabase/server";

/**
 * Chat interno (pedido explícito, 23/09/2026) — mensagem direta entre 2
 * usuários (online ou não) e "chamar atenção" (nudge estilo MSN). Ver
 * migration 0069_chat_interno.sql (tabela chat_mensagens, sem policy —
 * só a service role, usada aqui via createAdminClient(), acessa).
 * Visível/usável por QUALQUER login, inclusive ALLIED.
 */

type AdminClient = ReturnType<typeof createAdminClient>;

export const RETENCAO_DIAS_CHAT = 60;

export const FRASE_PADRAO_CHAMAR_ATENCAO = "🔔 está chamando sua atenção — responde aí!";

export type TipoMensagemChat = "mensagem" | "chamar_atencao";

export type UsuarioChat = {
  id: string;
  nome: string;
  sobrenome: string;
  cargo: string;
};

export type MensagemChat = {
  id: string;
  remetenteId: string;
  destinatarioId: string;
  tipo: TipoMensagemChat;
  texto: string | null;
  enviadoEm: string;
  lidaEm: string | null;
};

export type ConversaResumo = {
  usuario: UsuarioChat;
  ultimaMensagem: MensagemChat;
  naoLidas: number;
};

type LinhaMensagemBruta = {
  id: string;
  remetente_id: string;
  destinatario_id: string;
  tipo: string;
  texto: string | null;
  enviado_em: string;
  lida_em: string | null;
};

function converterLinha(l: LinhaMensagemBruta): MensagemChat {
  return {
    id: l.id,
    remetenteId: l.remetente_id,
    destinatarioId: l.destinatario_id,
    tipo: l.tipo === "chamar_atencao" ? "chamar_atencao" : "mensagem",
    texto: l.texto,
    enviadoEm: l.enviado_em,
    lidaEm: l.lida_em,
  };
}

/** Best-effort — apaga mensagens com mais de 60 dias (pedido explícito).
 * Chamada a cada envio (sem cron: o chat é usado o dia inteiro, então já
 * dá conta sozinho); uma falha aqui nunca pode impedir o envio da
 * mensagem atual. */
export async function limparMensagensAntigas(admin: AdminClient): Promise<void> {
  try {
    const limite = new Date(Date.now() - RETENCAO_DIAS_CHAT * 24 * 60 * 60 * 1000).toISOString();
    await admin.from("chat_mensagens").delete().lt("enviado_em", limite);
  } catch (erro) {
    console.error("Falha ao limpar mensagens antigas do chat:", erro);
  }
}

/** Todos os usuários com login ativo (sem bloqueado_em), pra escolher
 * com quem começar uma conversa — inclui ALLIED e qualquer outro cargo
 * (pedido explícito: chat é visível/usável por todo mundo). */
export async function buscarUsuariosParaChat(admin: AdminClient, idAtual: string): Promise<UsuarioChat[]> {
  const { data, error } = await admin
    .from("usuarios")
    .select("id, nome, sobrenome, cargo")
    .is("bloqueado_em", null)
    .neq("id", idAtual)
    .order("nome", { ascending: true });
  if (error) throw error;
  return (data ?? []) as UsuarioChat[];
}

export async function enviarMensagem(
  admin: AdminClient,
  remetenteId: string,
  destinatarioId: string,
  texto: string
): Promise<MensagemChat> {
  const { data, error } = await admin
    .from("chat_mensagens")
    .insert({ remetente_id: remetenteId, destinatario_id: destinatarioId, tipo: "mensagem", texto })
    .select("id, remetente_id, destinatario_id, tipo, texto, enviado_em, lida_em")
    .single();
  if (error) throw error;
  await limparMensagensAntigas(admin);
  return converterLinha(data as LinhaMensagemBruta);
}

export async function enviarChamarAtencao(
  admin: AdminClient,
  remetenteId: string,
  destinatarioId: string,
  texto?: string | null
): Promise<MensagemChat> {
  const { data, error } = await admin
    .from("chat_mensagens")
    .insert({
      remetente_id: remetenteId,
      destinatario_id: destinatarioId,
      tipo: "chamar_atencao",
      texto: texto?.trim() || FRASE_PADRAO_CHAMAR_ATENCAO,
    })
    .select("id, remetente_id, destinatario_id, tipo, texto, enviado_em, lida_em")
    .single();
  if (error) throw error;
  await limparMensagensAntigas(admin);
  return converterLinha(data as LinhaMensagemBruta);
}

/** Histórico de uma conversa entre 2 pessoas (as últimas `limite`,
 * devolvidas já em ordem cronológica — mais antiga primeiro). */
export async function buscarMensagensConversa(
  admin: AdminClient,
  usuarioId: string,
  outroId: string,
  limite = 200
): Promise<MensagemChat[]> {
  const { data, error } = await admin
    .from("chat_mensagens")
    .select("id, remetente_id, destinatario_id, tipo, texto, enviado_em, lida_em")
    .or(
      `and(remetente_id.eq.${usuarioId},destinatario_id.eq.${outroId}),and(remetente_id.eq.${outroId},destinatario_id.eq.${usuarioId})`
    )
    .order("enviado_em", { ascending: false })
    .limit(limite);
  if (error) throw error;
  return ((data ?? []) as LinhaMensagemBruta[]).map(converterLinha).reverse();
}

/** Marca como lidas todas as mensagens que `outroId` mandou pra
 * `usuarioId` (chamado quando a conversa é aberta na tela). */
export async function marcarConversaComoLida(admin: AdminClient, usuarioId: string, outroId: string): Promise<void> {
  const { error } = await admin
    .from("chat_mensagens")
    .update({ lida_em: new Date().toISOString() })
    .eq("destinatario_id", usuarioId)
    .eq("remetente_id", outroId)
    .is("lida_em", null);
  if (error) throw error;
}

/** Lista de conversas de `usuarioId` — quem já trocou mensagem com ele,
 * com a última mensagem e quantas ele ainda não leu, mais recente
 * primeiro. Sem RPC dedicada (tabela pequena, uso interno) — busca as
 * últimas mensagens envolvendo essa pessoa e agrupa em memória. */
export async function buscarConversas(admin: AdminClient, usuarioId: string): Promise<ConversaResumo[]> {
  const { data, error } = await admin
    .from("chat_mensagens")
    .select("id, remetente_id, destinatario_id, tipo, texto, enviado_em, lida_em")
    .or(`remetente_id.eq.${usuarioId},destinatario_id.eq.${usuarioId}`)
    .order("enviado_em", { ascending: false })
    .limit(1000);
  if (error) throw error;

  const mensagens = ((data ?? []) as LinhaMensagemBruta[]).map(converterLinha);
  if (mensagens.length === 0) return [];

  const ultimaPorOutro = new Map<string, MensagemChat>();
  const naoLidasPorOutro = new Map<string, number>();
  for (const m of mensagens) {
    const outroId = m.remetenteId === usuarioId ? m.destinatarioId : m.remetenteId;
    if (!ultimaPorOutro.has(outroId)) ultimaPorOutro.set(outroId, m);
    if (m.destinatarioId === usuarioId && m.lidaEm == null) {
      naoLidasPorOutro.set(outroId, (naoLidasPorOutro.get(outroId) ?? 0) + 1);
    }
  }

  const idsOutros = Array.from(ultimaPorOutro.keys());
  const { data: usuariosBrutos, error: erroUsuarios } = await admin
    .from("usuarios")
    .select("id, nome, sobrenome, cargo")
    .in("id", idsOutros);
  if (erroUsuarios) throw erroUsuarios;
  const usuarioPorId = new Map(((usuariosBrutos ?? []) as UsuarioChat[]).map((u) => [u.id, u]));

  return idsOutros
    .map((outroId) => {
      const usuario = usuarioPorId.get(outroId);
      const ultimaMensagem = ultimaPorOutro.get(outroId);
      if (!usuario || !ultimaMensagem) return null;
      return { usuario, ultimaMensagem, naoLidas: naoLidasPorOutro.get(outroId) ?? 0 } satisfies ConversaResumo;
    })
    .filter((c): c is ConversaResumo => c !== null)
    .sort((a, b) => new Date(b.ultimaMensagem.enviadoEm).getTime() - new Date(a.ultimaMensagem.enviadoEm).getTime());
}

export type AtualizacoesChat = {
  recebidas: MensagemChat[];
  totalNaoLidas: number;
  agora: string;
};

/** Usado pelo polling do ChatWidget — mensagens recebidas por
 * `usuarioId` depois de `desde` (pra disparar balão/som/piscar aba) +
 * total de não lidas (pro badge do ícone). */
export async function buscarAtualizacoesChat(admin: AdminClient, usuarioId: string, desde: string): Promise<AtualizacoesChat> {
  const agora = new Date().toISOString();

  const { data: recebidasBrutas, error: erroRecebidas } = await admin
    .from("chat_mensagens")
    .select("id, remetente_id, destinatario_id, tipo, texto, enviado_em, lida_em")
    .eq("destinatario_id", usuarioId)
    .gt("enviado_em", desde)
    .order("enviado_em", { ascending: true });
  if (erroRecebidas) throw erroRecebidas;

  const { count, error: erroContagem } = await admin
    .from("chat_mensagens")
    .select("id", { count: "exact", head: true })
    .eq("destinatario_id", usuarioId)
    .is("lida_em", null);
  if (erroContagem) throw erroContagem;

  return {
    recebidas: ((recebidasBrutas ?? []) as LinhaMensagemBruta[]).map(converterLinha),
    totalNaoLidas: count ?? 0,
    agora,
  };
}
