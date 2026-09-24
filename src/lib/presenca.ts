import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * "Usuários Online" (pedido explícito) + status manual (Disponível/
 * Ausente/Ocupado, pedido explícito do chat interno — migration 0069) +
 * base do logout automático por inatividade — ver
 * migration 0058_usuarios_online_e_atividade.sql e
 * migration 0069_chat_interno.sql.
 *
 * As funções abaixo só chamam RPCs (security definer): as de escrita
 * (marcarLogin/marcarAtividade/definirStatus) sempre mexem só na
 * PRÓPRIA linha de quem está chamando (auth.uid(), resolvido dentro da
 * função no banco); a de leitura (buscarUsuariosOnline) é visível pra
 * QUALQUER login, inclusive ALLIED, desde a migration 0068.
 */

export async function marcarLogin(supabase: SupabaseClient): Promise<void> {
  const { error } = await supabase.rpc("usuarios_marcar_login");
  if (error) throw error;
}

export async function marcarAtividade(supabase: SupabaseClient): Promise<void> {
  const { error } = await supabase.rpc("usuarios_marcar_atividade");
  if (error) throw error;
}

export type StatusPresenca = "Disponivel" | "Ausente" | "Ocupado";

/** Status manual do chat interno (pedido explícito) — só vale enquanto
 * a pessoa está online; offline sempre aparece como "Ausente" (decidido
 * no front-end, ver statusExibido em ChatWidget.tsx). */
export async function definirStatus(supabase: SupabaseClient, status: StatusPresenca): Promise<void> {
  const { error } = await supabase.rpc("usuarios_definir_status", { p_status: status });
  if (error) throw error;
}

export type UsuarioOnline = {
  id: string;
  nome: string;
  sobrenome: string;
  cargo: string;
  ultimoLoginEm: string | null;
  ultimaAtividadeEm: string | null;
  statusManual: StatusPresenca;
};

/** Quem está "online agora" (heartbeat nos últimos 5 minutos, ver a
 * própria RPC) — visível pra todo login, inclusive ALLIED. */
export async function buscarUsuariosOnline(supabase: SupabaseClient): Promise<UsuarioOnline[]> {
  const { data, error } = await supabase.rpc("usuarios_online_listar");
  if (error) throw error;
  return (
    (data ?? []) as {
      id: string;
      nome: string;
      sobrenome: string;
      cargo: string;
      ultimo_login_em: string | null;
      ultima_atividade_em: string | null;
      status_manual: string;
    }[]
  ).map((l) => ({
    id: l.id,
    nome: l.nome,
    sobrenome: l.sobrenome,
    cargo: l.cargo,
    ultimoLoginEm: l.ultimo_login_em,
    ultimaAtividadeEm: l.ultima_atividade_em,
    statusManual: (["Disponivel", "Ausente", "Ocupado"].includes(l.status_manual) ? l.status_manual : "Disponivel") as StatusPresenca,
  }));
}
