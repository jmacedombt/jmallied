/**
 * Regras da rotina de gestão de usuários (menu SISTEMA > Usuários):
 * editar cadastro, resetar senha e bloquear/desbloquear login.
 */

import { podeConfirmarAnaliseEmLote, STATUS_AG_ABERTURA, STATUS_AG_TRIAGEM, STATUS_OQC } from "@/lib/orcamentos";

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
 * ALLIED também tem acesso a 2 submenus de Métricas — Volumetria e
 * Orçamentos (pedido explícito) — além de quem já podia ver Métricas
 * (mesmo cargo que confirma envio de lote, ver podeConfirmarAnaliseEmLote).
 * Nenhuma das duas telas mostra custo/BID (só contagens, venda de peça e
 * mão de obra — o mesmo nível de detalhe que orcamentos_allied_listar já
 * expõe), então não fere a regra de nunca mostrar custo pro ALLIED. As
 * outras 3 telas de Métricas (R-TAT, OQC, Previsão de Recebimento)
 * continuam fora do alcance do ALLIED.
 */
export function podeVerVolumetriaOuOrcamentos(perfil: { cargo: string; is_master: boolean } | null): boolean {
  return isAllied(perfil) || podeConfirmarAnaliseEmLote(perfil);
}

/**
 * Cargos cujo acesso ao Operacional é restrito a um SUBCONJUNTO de
 * etapas — em qualquer outra etapa do Painel, só consulta (sem nenhuma
 * ação). is_master sempre passa por cima disso (Administrador nunca fica
 * restrito, seja qual for o cargo).
 *
 * - "Operacional" (quem digita a OS Reparadora): função completa só em
 *   Ag. Abertura — ver PainelAgAbertura.tsx, a única tela que nunca
 *   restringe ninguém, justamente por causa dessa exceção.
 * - "Triagem/OQC" (novo cargo — pedido explícito): função completa só em
 *   "1 - Ag. Triagem" e "OQC - Controle de Qualidade" (incluindo ações
 *   em lote nas 2), inclusive Ag. Abertura fica só consulta pra esse
 *   cargo — o espelho de Operacional.
 *
 * Os dois cargos enxergam o mesmo menu restrito (só Painel Operacional +
 * Impressão Avulsa — ver GRUPOS_MENU_OPERACIONAL em AppShell.tsx) e
 * ficam de fora de Bases/Configurações/Sistema/Métricas/Backlog/
 * Reconhecimento de Lote mesmo digitando a URL direto (ver
 * rotaBloqueadaParaOperacional abaixo).
 */
export const ETAPAS_LIBERADAS_POR_CARGO_RESTRITO: Record<string, readonly string[]> = {
  Operacional: [STATUS_AG_ABERTURA],
  "Triagem/OQC": [STATUS_AG_TRIAGEM, STATUS_OQC],
};

/** true = esse cargo é um dos restritos por etapa acima (Operacional ou
 * Triagem/OQC, sem is_master) — usado pra decidir o menu (AppShell.tsx)
 * e travar rota (middleware.ts). Pra saber se tem função completa numa
 * etapa ESPECÍFICA, use temFuncaoCompletaNaEtapa abaixo. */
export function operacionalRestrito(perfil: { cargo: string; is_master: boolean } | null): boolean {
  if (!perfil || perfil.is_master) return false;
  return perfil.cargo in ETAPAS_LIBERADAS_POR_CARGO_RESTRITO;
}

/**
 * Dentro de uma etapa específica do Operacional (Ag. Abertura, 1 - Ag.
 * Triagem ou OQC - Controle de Qualidade — as 3 telas onde a resposta
 * pode variar por cargo), esse usuário tem função completa (true) ou só
 * consulta (false)? Quem não é um cargo restrito por etapa (Supervisor,
 * Gerente, Diretor, Técnico, Estoque, is_master) sempre tem função
 * completa onde quer que chegue — por isso não precisa ser chamada fora
 * dessas 3 telas: nas demais, `operacionalRestrito` sozinho já responde
 * igual pros 2 cargos hoje (sempre só consulta).
 */
export function temFuncaoCompletaNaEtapa(
  perfil: { cargo: string; is_master: boolean } | null,
  statusValor: string
): boolean {
  if (!operacionalRestrito(perfil)) return true;
  const etapasLiberadas = ETAPAS_LIBERADAS_POR_CARGO_RESTRITO[perfil!.cargo] ?? [];
  return etapasLiberadas.includes(statusValor);
}

// Prefixos de página fora do alcance dos cargos restritos por etapa
// (Operacional e Triagem/OQC) — usado tanto no middleware.ts (bloqueia a
// rota mesmo digitando a URL) quanto no Dashboard (esconde o card, pra
// não mostrar um atalho que só vai voltar pro Painel). Backlog e
// Reconhecimento Lote ficam fora do menu, mas continuam abertos pra quem
// já tem permissão (ex: cargo ALLIED tem seu próprio Backlog liberado,
// tratado à parte no middleware). "/sistema" cobre tanto a capa quanto
// qualquer submenu dela (Usuários e Manutenção do Banco vivem em rotas
// próprias fora de "/sistema/...", por isso continuam listados à parte).
export const PREFIXOS_BLOQUEADOS_OPERACIONAL = [
  "/operacional/backlog",
  "/operacional/reconhecimento-lote",
  // "Consulta/Alteração" (pedido explícito, 25/09/2026) fica de fora
  // desses 2 cargos — mesmo critério de Backlog/Reconhecimento Lote (ver
  // podeConsultarOrcamento logo abaixo, que também barra Financeiro
  // sem is_master).
  "/operacional/consulta-alteracao",
  "/bases",
  "/configuracoes",
  "/usuarios",
  "/manutencao",
  "/sistema",
] as const;

export function rotaBloqueadaParaOperacional(path: string): boolean {
  return PREFIXOS_BLOQUEADOS_OPERACIONAL.some((prefixo) => path === prefixo || path.startsWith(`${prefixo}/`));
}

/**
 * Cargo "Financeiro" (sem is_master, ver migration 0055): mesmo espírito
 * de restrição de Operacional/Triagem-OQC acima, só que sem NENHUMA
 * etapa do Painel Operacional — só enxerga o módulo Financeiro +
 * Impressão Avulsa (ver GRUPOS_MENU_FINANCEIRO em AppShell.tsx). Tudo
 * mais (Operacional, Bases, Configurações, Sistema, Métricas) fica
 * bloqueado mesmo digitando a URL direto — ver
 * rotaBloqueadaParaFinanceiro logo abaixo e o middleware.ts.
 */
export function financeiroRestrito(perfil: { cargo: string; is_master: boolean } | null): boolean {
  if (!perfil || perfil.is_master) return false;
  return perfil.cargo === "Financeiro";
}

export const PREFIXOS_BLOQUEADOS_FINANCEIRO = [
  "/operacional",
  "/bases",
  "/configuracoes",
  "/usuarios",
  "/manutencao",
  "/sistema",
  "/metricas",
] as const;

export function rotaBloqueadaParaFinanceiro(path: string): boolean {
  return PREFIXOS_BLOQUEADOS_FINANCEIRO.some((prefixo) => path === prefixo || path.startsWith(`${prefixo}/`));
}

/**
 * Quem pode abrir "Consulta/Alteração" (pedido explícito, 25/09/2026,
 * ver PainelConsultaAlteracao.tsx) — qualquer login com acesso "normal"
 * ao Operacional, incluindo ALLIED (nenhum dos dois é operacionalRestrito
 * nem financeiroRestrito, então já caem aqui sozinhos, sem precisar
 * listar cargo por cargo). Fica de fora só quem tem menu bem reduzido:
 * Operacional/Triagem-OQC sem is_master (só Painel) e Financeiro sem
 * is_master (só Financeiro + Impressão). A ALTERAÇÃO em si (só o campo
 * OS Reparadora) é mais restrita — ver podeConfirmarAnaliseEmLote em
 * lib/orcamentos.ts (Supervisor/Gerente/Administrador), que ALLIED nunca
 * atende.
 */
export function podeConsultarOrcamento(perfil: { cargo: string; is_master: boolean } | null): boolean {
  if (!perfil) return false;
  return !operacionalRestrito(perfil) && !financeiroRestrito(perfil);
}
