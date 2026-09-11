import Link from "next/link";
import { AlertTriangle, Database, FileSpreadsheet, FileText, Search, Tags, Wrench } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";

const TILES = [
  {
    href: "/bases/gspn",
    titulo: "Base GSPN",
    descricao: "Importe a exportação do sistema Samsung GSPN — casa cada chamado pela OS Reparadora e atualiza as peças do orçamento automaticamente.",
    icone: Wrench,
    cor: "#2563eb",
    clara: "#60a5fa",
  },
  {
    href: "/bases/pecas",
    titulo: "Base Peças",
    descricao: "Custo mais recente de cada peça (Part Number), atualizado pela importação — base de custo usada em todo o sistema (BID, Validação, Reorçamento).",
    icone: Database,
    cor: "#059669",
    clara: "#34d399",
  },
  {
    href: "/bases/orcamentos",
    titulo: "Base Orçamentos",
    descricao: "Resumo dos aparelhos e orçamentos importados — total recebido, modelos comerciais únicos e outros indicadores gerais.",
    icone: FileText,
    cor: "#7c3aed",
    clara: "#a78bfa",
  },
  {
    href: "/bases/bid",
    titulo: "Base BID",
    descricao: "Tabela de preços de peças enviada pra Allied — o Custo Peça (Allied) é sempre recalculado a partir da Base Peças e das faixas de markup.",
    icone: Tags,
    cor: "#dc2626",
    clara: "#f87171",
  },
  {
    href: "/bases/bid/consulta",
    titulo: "Consulta BID",
    descricao: "Busca instantânea na base completa do BID, com filtros de Part Number, Modelo e Peça Solução, e o detalhamento do cálculo de cada preço.",
    icone: Search,
    cor: "#0891b2",
    clara: "#22d3ee",
  },
  {
    href: "/bases/bid/pendencias",
    titulo: "Pendências BID",
    descricao: "Peças que já apareceram em algum orçamento mas ainda não têm preço cadastrado no BID, priorizadas por quem tem pedido em aberto.",
    icone: AlertTriangle,
    cor: "#d97706",
    clara: "#fbbf24",
  },
  {
    href: "/bases/bid/relatorio",
    titulo: "Relatório BID",
    descricao: "Histórico de recálculos e exportações da tabela BID.",
    icone: FileSpreadsheet,
    cor: "#4f46e5",
    clara: "#818cf8",
  },
];

export default async function BasesPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let perfil: { nome: string; sobrenome: string; cargo: string; is_master: boolean } | null = null;
  if (user) {
    const { data } = await supabase
      .from("usuarios")
      .select("nome, sobrenome, cargo, is_master")
      .eq("id", user.id)
      .single();
    perfil = data;
  }

  return (
    <AppShell titulo="Bases" perfil={perfil}>
      <p className="text-sm mb-5" style={{ color: "var(--muted)" }}>
        Escolha uma base pra ver ou importar os dados.
      </p>

      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4 max-w-5xl">
        {TILES.map((tile) => {
          const Icone = tile.icone;
          return (
            <Link
              key={tile.href}
              href={tile.href}
              className="group relative rounded-xl pt-5 px-5 pb-5 overflow-hidden transition-transform hover:-translate-y-1"
              style={{
                background: "linear-gradient(155deg, var(--surface2), var(--surface))",
                boxShadow:
                  "0 1px 0 rgba(255,255,255,0.06) inset, 0 10px 22px rgba(0,0,0,0.26), 0 3px 8px rgba(0,0,0,0.2)",
                border: "1px solid var(--line)",
              }}
            >
              <span
                className="absolute inset-x-0 top-0 h-1.5"
                style={{ background: `linear-gradient(90deg, ${tile.cor}, ${tile.clara})` }}
              />
              <div className="flex items-center gap-3 mb-2">
                <Icone size={26} strokeWidth={2} style={{ color: tile.cor }} />
                <span className="text-lg font-bold" style={{ color: "var(--ink)" }}>
                  {tile.titulo}
                </span>
              </div>
              <p className="text-[13px] leading-snug" style={{ color: "var(--muted)" }}>
                {tile.descricao}
              </p>
            </Link>
          );
        })}
      </div>
    </AppShell>
  );
}
