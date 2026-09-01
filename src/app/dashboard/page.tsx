import Link from "next/link";
import {
  CalendarCheck2,
  Database,
  FileText,
  LayoutGrid,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";

// Um card por menu/submenu já existente no sistema — cada um com sua
// própria identidade de cor (mesmo estilo dos cards de Operacional:
// barra em degradê em cima, ícone colorido solto, sombreado 3D).
const CARDS_PAINEL = [
  {
    href: "/operacional",
    label: "Operacional",
    descricao: "Painel com todas as etapas da ordem de serviço, do recebimento à entrega.",
    icone: LayoutGrid,
    cor: "#2563eb",
    corClara: "#60a5fa",
  },
  {
    href: "/operacional/reconhecimento-lote",
    label: "Reconhecimento Lote",
    descricao: "Registrar a data em que os aparelhos de um lote chegaram na loja.",
    icone: CalendarCheck2,
    cor: "#0891b2",
    corClara: "#22d3ee",
  },
  {
    href: "/bases/pecas",
    label: "Base Peças",
    descricao: "Importar e consultar a base de peças recebidas.",
    icone: Database,
    cor: "#7c3aed",
    corClara: "#a78bfa",
  },
  {
    href: "/bases/orcamentos",
    label: "Orçamentos",
    descricao: "Importar e consultar a base de aparelhos recebidos da Allied.",
    icone: FileText,
    cor: "#d97706",
    corClara: "#fbbf24",
  },
  {
    href: "/configuracoes/mao-de-obra",
    label: "Mão de obra",
    descricao: "Configurar os valores de mão de obra usados no cálculo do reparo.",
    icone: SlidersHorizontal,
    cor: "#ea580c",
    corClara: "#fb923c",
  },
  {
    href: "/usuarios",
    label: "Usuários",
    descricao: "Consultar e cadastrar usuários com acesso ao sistema.",
    icone: Users,
    cor: "#059669",
    corClara: "#34d399",
  },
];

export default async function DashboardPage() {
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
    <AppShell titulo="Início" perfil={perfil}>
      <h1 className="text-xl font-semibold mb-2" style={{ color: "var(--ink)" }}>
        Painel inicial
      </h1>
      <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>
        Este é o ponto de partida do sistema Allied. As demais telas e regras
        vão sendo adicionadas conforme forem definidas.
      </p>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {CARDS_PAINEL.map((card) => {
          const Icone = card.icone;
          return (
            <Link
              key={card.href}
              href={card.href}
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
                style={{ background: `linear-gradient(90deg, ${card.cor}, ${card.corClara})` }}
              />

              <div className="flex items-center gap-3 mb-2">
                <Icone size={26} strokeWidth={2} style={{ color: card.cor }} />
                <h2 className="font-medium" style={{ color: "var(--ink)" }}>
                  {card.label}
                </h2>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
                {card.descricao}
              </p>
            </Link>
          );
        })}
      </div>
    </AppShell>
  );
}
