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

/**
 * Operacional (quem digita a OS Reparadora em Ag. Abertura) só enxerga
 * o Painel Operacional (Ag. Abertura com função completa; as demais
 * etapas do painel só pra consulta — já garantido pelas próprias telas,
 * que só liberam ação em lote pra Supervisor/Gerente/Diretor/Master) e
 * Impressão Avulsa. is_master sempre passa por cima disso (Administrador
 * nunca fica restrito, mesmo com cargo "Operacional").
 */
export function operacionalRestrito(perfil: { cargo: string; is_master: boolean } | null): boolean {
  return perfil?.cargo === "Operacional" && !perfil.is_master;
}

// Prefixos de página fora do alcance do cargo Operacional — usado tanto
// no middleware.ts (bloqueia a rota mesmo digitando a URL) quanto no
// Dashboard (esconde o card, pra não mostrar um atalho que só vai voltar
// pro Painel). Backlog e Reconhecimento Lote ficam fora do menu, mas
// continuam abertos pra quem já tem permissão (ex: cargo ALLIED tem seu
// próprio Backlog liberado, tratado à parte no middleware).
export const PREFIXOS_BLOQUEADOS_OPERACIONAL = [
  "/operacional/backlog",
  "/operacional/reconhecimento-lote",
  "/bases",
  "/configuracoes",
  "/usuarios",
  "/manutencao",
] as const;

export function rotaBloqueadaParaOperacional(path: string): boolean {
  return PREFIXOS_BLOQUEADOS_OPERACIONAL.some((prefixo) => path === prefixo || path.startsWith(`${prefixo}/`));
}
