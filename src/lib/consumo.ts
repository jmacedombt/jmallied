/**
 * Intervalos das consultas automáticas do sistema (pedido explícito,
 * 07/11/2026 — a Vercel pausou o projeto por estourar o "Active CPU" do
 * plano Hobby). Cada consulta automática é uma chamada de função na
 * Vercel, por aba aberta. Centralizado aqui pra o painel Configurações >
 * Monitoramento mostrar exatamente o que o sistema faz sozinho.
 *
 * `null` = não consulta enquanto a aba está escondida/minimizada.
 */
export const INTERVALOS_AUTOMATICOS = {
  chatMensagens: { visivelMs: 15_000, ocultaMs: 60_000, rotulo: "Chat — novas mensagens" },
  chatOnline: { visivelMs: 60_000, ocultaMs: null, rotulo: "Chat — quem está online" },
  indicadorOnline: { visivelMs: 60_000, ocultaMs: null, rotulo: "Bolinha de usuários online" },
  presenca: { visivelMs: 120_000, ocultaMs: 120_000, rotulo: "Sinal de \"estou conectado\"" },
  notificacoes: { visivelMs: 300_000, ocultaMs: null, rotulo: "Sininho de pendências" },
} as const;

/** Como era antes do ajuste de 07/11/2026 (por aba, sempre, visível ou não). */
export const INTERVALOS_ANTERIORES_MS: Record<keyof typeof INTERVALOS_AUTOMATICOS, number> = {
  chatMensagens: 4_000,
  chatOnline: 15_000,
  indicadorOnline: 30_000,
  presenca: 60_000,
  notificacoes: 300_000,
};

export function chamadasPorHora(ms: number | null): number {
  return ms ? Math.round(3_600_000 / ms) : 0;
}

/**
 * Limites dos planos gratuitos (conferidos em 07/11/2026 nas páginas
 * oficiais — vercel.com/docs/plans/hobby e supabase.com/pricing; GitHub
 * conforme docs.github.com). Se o plano mudar, ajustar aqui.
 */
export const LIMITES = {
  vercel: {
    plano: "Hobby (gratuito)",
    itens: [
      { chave: "cpu", rotulo: "Active CPU", limite: "4 horas de CPU / mês", cuidado: "Foi o que estourou em 07/11/2026. Cresce com consultas automáticas e telas pesadas." },
      { chave: "invocacoes", rotulo: "Chamadas de função", limite: "1.000.000 / mês", cuidado: "Cada tela aberta e cada consulta automática conta 1." },
      { chave: "memoria", rotulo: "Memória provisionada", limite: "360 GB-hora / mês", cuidado: "Sobe com importações grandes e telas lentas." },
      { chave: "transfer", rotulo: "Fast Data Transfer", limite: "100 GB / mês", cuidado: "Download de planilhas e páginas." },
      { chave: "origem", rotulo: "Fast Origin Transfer", limite: "10 GB / mês", cuidado: "Respostas geradas pelo servidor." },
      { chave: "cdn", rotulo: "Requisições CDN", limite: "1.000.000 / mês", cuidado: "Arquivos estáticos (imagens, scripts)." },
    ],
    regras: [
      "Passou de qualquer limite: o projeto fica PAUSADO até completar 30 dias.",
      "O plano Hobby é só para uso pessoal e não comercial — sistema da empresa deveria estar no Pro.",
    ],
  },
  supabase: {
    plano: "Free (gratuito)",
    bancoBytes: 500 * 1024 * 1024,
    storageBytes: 1024 * 1024 * 1024,
    mau: 50_000,
    itens: [
      { chave: "banco", rotulo: "Banco de dados", limite: "500 MB", cuidado: "Histórico de status, chat e importações crescem todo dia." },
      { chave: "storage", rotulo: "Arquivos (Storage)", limite: "1 GB", cuidado: "Planilhas importadas, enviadas e uploads de aprovação." },
      { chave: "egress", rotulo: "Tráfego de saída (egress)", limite: "5 GB / mês", cuidado: "Só visível no painel do Supabase." },
      { chave: "mau", rotulo: "Usuários ativos no mês", limite: "50.000", cuidado: "Muito acima do nosso uso." },
    ],
    regras: [
      "Projeto gratuito sem nenhum acesso por 1 semana é pausado (o uso diário evita isso).",
      "Acima de 500 MB o banco passa a aceitar só leitura.",
    ],
  },
  github: {
    plano: "Free (gratuito)",
    itens: [
      { chave: "repo", rotulo: "Tamanho do repositório", limite: "recomendado até 1 GB", cuidado: "Não versionar planilhas, backups nem node_modules." },
      { chave: "arquivo", rotulo: "Tamanho de cada arquivo", limite: "máximo 100 MB (aviso a partir de 50 MB)", cuidado: "Um arquivo grande bloqueia o publicar.bat." },
    ],
    regras: ["Repositório privado no plano gratuito não tem custo para o nosso uso."],
  },
} as const;
