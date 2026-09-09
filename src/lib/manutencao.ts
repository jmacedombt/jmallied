/**
 * Regras da tela Sistema > Manutenção do Banco: tamanho das tabelas,
 * zerar dados de implantação (Peças/BID, GSPN, Orçamentos) e compactar
 * histórico antigo. Ver migration 0030_manutencao_banco.sql pras
 * funções SQL correspondentes.
 *
 * É a ação mais sensível do sistema inteiro — por isso a permissão aqui
 * é só is_master (Administrador), sem lista de cargos como as demais
 * telas (ver podeImportarBasePecas, podeGerenciarUsuarios etc).
 */
export function podeManutencaoBanco(perfil: { is_master: boolean } | null): boolean {
  return !!perfil?.is_master;
}

export type GrupoZerar = "pecas" | "gspn" | "orcamentos";

export const GRUPOS_ZERAR: {
  chave: GrupoZerar;
  label: string;
  descricao: string;
  tabelas: string[];
}[] = [
  {
    chave: "pecas",
    label: "Peças (BID + Base Peças)",
    descricao:
      "Todo o cadastro do BID (peças, soluções, histórico de valores, reconciliações, recálculos, importações) e toda a Base Peças (compras acumuladas e importações).",
    tabelas: [
      "bid_pecas",
      "bid_solucoes",
      "bid_historico_valores",
      "bid_reconciliacoes",
      "bid_recalculos",
      "bid_importacoes",
      "pecas_compras",
      "pecas_importacoes",
    ],
  },
  {
    chave: "gspn",
    label: "Base GSPN",
    descricao: "Todos os chamados importados do GSPN e o histórico de importações.",
    tabelas: ["gspn_chamados", "gspn_importacoes"],
  },
  {
    chave: "orcamentos",
    label: "Orçamentos",
    descricao: "Todos os aparelhos/orçamentos importados, os lotes (NF Remessa), o histórico de status e as etiquetas impressas.",
    tabelas: ["orcamentos", "orcamentos_lotes", "orcamento_status_historico", "etiquetas_impressoes"],
  },
];

/** Palavra que precisa ser digitada certinha pra liberar o botão de
 * zerar um grupo — a trava forte pedida (nada de "tem certeza? sim/não",
 * que dá pra clicar sem prestar atenção). */
export const PALAVRA_CONFIRMACAO_ZERAR = "APAGAR";

export type TamanhoTabela = {
  tabela: string;
  linhas: number;
  tamanho_dados: string;
  tamanho_indices: string;
  tamanho_total: string;
  tamanho_total_bytes: number;
};

export type LinhaCompactacao = { tabela: string; linhas_removidas: number };

export const MESES_COMPACTACAO_PADRAO = 12;

/** Formata bytes pro mesmo estilo do pg_size_pretty (KB/MB/GB), usado só
 * pro total geral somado no cliente — cada linha já vem formatada pelo
 * Postgres (tamanho_total), aqui é só o agregado. */
export function formatarBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  const unidades = ["KB", "MB", "GB", "TB"];
  let valor = bytes;
  let i = -1;
  do {
    valor /= 1024;
    i++;
  } while (valor >= 1024 && i < unidades.length - 1);
  return `${valor.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ${unidades[i]}`;
}
