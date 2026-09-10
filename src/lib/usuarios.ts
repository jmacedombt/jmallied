/**
 * Regras da rotina de gestão de usuários (menu SISTEMA > Usuários):
 * editar cadastro, resetar senha e bloquear/desbloquear login.
 */

// cargos que podem gerenciar outros usuários (Administrador = is_master, tratado à parte)
export const CARGOS_GESTAO_USUARIOS = ["Gerente", "Diretor"] as const;

export function podeGerenciarUsuarios(perfil: { cargo: string; is_master: boolean } | null): boolean {
  if (!perfil) return false;
  if (perfil.is_master) return true;
  return (CARGOS_GESTAO_USUARIOS as readonly string[]).includes(perfil.cargo);
}

/**
 * ALLIED é o cargo de login externo (parceiro Allied): só consulta,
 * nenhuma ação, e nunca pode ver custo de peça / BID — só o valor de
 * venda e a mão de obra cobrada. Usado tanto pra decidir o que mostrar
 * na tela (menu, botões, colunas) quanto pra travar rota no middleware
 * e nos endpoints — a proteção "de verdade" (nível banco) fica na RLS
 * da tabela orcamentos (ver migration 0035_cargo_allied.sql).
 */
export function isAllied(perfil: { cargo: string } | null): boolean {
  return perfil?.cargo === "ALLIED";
}
