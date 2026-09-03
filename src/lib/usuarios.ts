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
