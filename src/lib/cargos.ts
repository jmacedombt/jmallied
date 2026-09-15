/**
 * Registro de referência dos cargos do sistema — usado pela tela SISTEMA
 * > Cargos (menu Sistema). Descreve, em texto, os módulos/telas que cada
 * cargo hoje FIXO no código (ver CARGOS em lib/auth.ts) consegue acessar
 * e as permissões extras que ele tem dentro desses módulos — reflete
 * exatamente as checagens já implementadas (isAllied, operacionalRestrito
 * /temFuncaoCompletaNaEtapa, podeConfirmarAnaliseEmLote e seus apelidos,
 * CARGOS_GESTAO_USUARIOS, CARGOS_IMPORTACAO_BASE_PECAS — ver
 * lib/usuarios.ts, lib/orcamentos.ts e lib/pecas.ts).
 *
 * Isso é só DOCUMENTAÇÃO pra tela — mudar esse array não muda nenhuma
 * permissão de verdade do sistema (isso é feito nas funções acima).
 */

export type ResumoAcessoCargo = {
  cargo: string;
  /** Módulos/menus que esse cargo consegue abrir. */
  modulos: string[];
  /** Permissões nomeadas que esse cargo tem, além de só abrir a tela. */
  extras: string[];
  /** Observação livre, quando o acesso tem alguma condição especial. */
  observacao?: string;
};

export const RESUMO_ACESSO_CARGOS: ResumoAcessoCargo[] = [
  {
    cargo: "Diretor",
    modulos: [
      "Operacional (Painel, Backlog, Reconhecimento de Lote)",
      "Bases (GSPN, Peças, Orçamentos, BID)",
      "Impressão Avulsa",
      "Configurações",
      "Sistema (Usuários, Manutenção do Banco, Cargos)",
    ],
    extras: ["Gerenciar usuários"],
    observacao:
      "Ações em lote no Operacional, importar Base Peças e o menu Métricas dependem de também ser Administrador (is_master) — o cargo \"Diretor\" sozinho não entra nessas 3 listas específicas.",
  },
  {
    cargo: "Gerente",
    modulos: [
      "Operacional (Painel, Backlog, Reconhecimento de Lote)",
      "Bases (GSPN, Peças, Orçamentos, BID)",
      "Impressão Avulsa",
      "Configurações",
      "Sistema (Usuários, Manutenção do Banco, Cargos)",
      "Métricas (Volumetria, R-TAT, Orçamentos, OQC, Previsão de Recebimento)",
    ],
    extras: ["Gerenciar usuários", "Ações em lote no Operacional", "Importar Base Peças", "Ver Métricas"],
  },
  {
    cargo: "Supervisor",
    modulos: [
      "Operacional (Painel, Backlog, Reconhecimento de Lote)",
      "Bases (GSPN, Peças, Orçamentos, BID)",
      "Impressão Avulsa",
      "Configurações",
      "Sistema (Usuários — só consulta, Manutenção do Banco, Cargos)",
      "Métricas (Volumetria, R-TAT, Orçamentos, OQC, Previsão de Recebimento)",
    ],
    extras: ["Ações em lote no Operacional", "Importar Base Peças", "Ver Métricas"],
    observacao: "Não gerencia usuários (só consulta a lista) — isso fica com Gerente/Diretor/Administrador.",
  },
  {
    cargo: "Técnico",
    modulos: [
      "Operacional (Painel, Backlog, Reconhecimento de Lote)",
      "Bases (GSPN, Peças, Orçamentos, BID)",
      "Impressão Avulsa",
      "Configurações",
      "Sistema (Usuários e Cargos — só consulta)",
    ],
    extras: [],
    observacao: "Ação individual liberada em qualquer etapa; sem ação em lote, sem Métricas e sem importar Base Peças.",
  },
  {
    cargo: "Estoque",
    modulos: [
      "Operacional (Painel, Backlog, Reconhecimento de Lote)",
      "Bases (GSPN, Peças, Orçamentos, BID)",
      "Impressão Avulsa",
      "Configurações",
      "Sistema (Usuários e Cargos — só consulta)",
    ],
    extras: ["Importar Base Peças"],
    observacao: "Ação individual liberada em qualquer etapa; sem ação em lote e sem Métricas.",
  },
  {
    cargo: "Operacional",
    modulos: ["Operacional (só Painel)", "Impressão Avulsa"],
    extras: [],
    observacao:
      "Função completa só em Ag. Abertura (digitar OS Reparadora); nas demais etapas do Painel, só consulta. Sem Bases, Configurações, Sistema, Métricas, Backlog nem Reconhecimento de Lote — mesmo digitando a URL direto.",
  },
  {
    cargo: "Triagem/OQC",
    modulos: ["Operacional (só Painel)", "Impressão Avulsa"],
    extras: ["Ações em lote em 1 - Ag. Triagem e OQC"],
    observacao:
      "Função completa só em \"1 - Ag. Triagem\" e \"OQC - Controle de Qualidade\" (incluindo ação em lote). Nas demais etapas — inclusive Ag. Abertura — só consulta. Mesmo menu restrito do cargo Operacional.",
  },
  {
    cargo: "ALLIED",
    modulos: ["Operacional (Painel — só consulta — e Backlog)", "Métricas (Volumetria e Orçamentos)"],
    extras: [],
    observacao:
      "Login externo do parceiro Allied: nenhuma ação, e nunca vê custo de peça nem BID — só o valor de venda cobrado e a mão de obra (garantido também por regra no banco, não só na tela).",
  },
];
