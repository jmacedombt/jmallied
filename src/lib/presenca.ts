import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * "Usuários Online" (pedido explícito) + base do logout automático por
 * inatividade — ver migration 0058_usuarios_online_e_atividade.sql.
 *
 * As 3 funções abaixo só chamam RPCs (security definer): as duas de
 * escrita (marcarLogin/marcarAtividade) sempre mexem só na PRÓPRIA
 * linha de quem está chamando (auth.uid(), resolvido dentro da função
 * no banco — não dá pra marcar atividade de outra pessoa por aqui); a
 * de leitura (buscarUsuariosOnline) já devolve lista vazia sozinha pra
 * quem chama com cargo ALLIED, sem depender de nenhuma checagem daqui.
 */

export async function marcarLogin(supabase: SupabaseClient): Promise<void> {
  const { error } = await supabase.rpc("usuarios_marcar_login");
  if (error) throw error;
}

export async function marcarAtividade(supabase: SupabaseClient): Promise<void> {
  const { error } = await supabase.rpc("usuarios_marcar_atividade");
  if (error) throw error;
}

export type UsuarioOnline = {
  id: string;
  nome: string;
  sobrenome: string;
  cargo: string;
  ultimoLoginEm: string | null;
  ultimaAtividadeEm: string | null;
};

/** Quem está "online agora" (heartbeat nos últimos 5 minutos, ver a
 * própria RPC) — pra cargo ALLIED, a RPC sempre devolve lista vazia. */
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
    }[]
  ).map((l) => ({
    id: l.id,
    nome: l.nome,
    sobrenome: l.sobrenome,
    cargo: l.cargo,
    ultimoLoginEm: l.ultimo_login_em,
    ultimaAtividadeEm: l.ultima_atividade_em,
  }));
}
