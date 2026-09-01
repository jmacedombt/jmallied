"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  AlertTriangle,
  Bell,
  CalendarCheck2,
  ChevronDown,
  Database,
  FileText,
  Home,
  LayoutGrid,
  LogOut,
  Menu,
  Percent,
  Printer,
  Search,
  Settings,
  SlidersHorizontal,
  Tags,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Avatar from "@/components/Avatar";
import BotaoTema from "@/components/BotaoTema";
import ColorPickerSistema from "@/components/ColorPickerSistema";

type Perfil = {
  nome: string;
  sobrenome: string;
  cargo: string;
  is_master: boolean;
} | null;

type ItemMenu = {
  href: string;
  label: string;
  icone: typeof Users;
};

type GrupoMenu = {
  id: string;
  label: string;
  icone: typeof Settings;
  itens: ItemMenu[];
};

// Estrutura do menu lateral. Por enquanto o grupo "Sistema" só tem
// "Usuários" — as demais funcionalidades entram aqui conforme forem
// solicitadas.
const GRUPOS_MENU: GrupoMenu[] = [
  {
    id: "operacional",
    label: "Operacional",
    icone: LayoutGrid,
    itens: [
      { href: "/operacional", label: "Painel", icone: LayoutGrid },
      { href: "/operacional/reconhecimento-lote", label: "Reconhecimento Lote", icone: CalendarCheck2 },
    ],
  },
  {
    id: "bases",
    label: "Bases",
    icone: Database,
    itens: [
      { href: "/bases/pecas", label: "Base Peças", icone: Database },
      { href: "/bases/orcamentos", label: "Orçamentos", icone: FileText },
      { href: "/bases/bid", label: "BID", icone: Tags },
      { href: "/bases/bid/consulta", label: "Consulta BID", icone: Search },
      { href: "/bases/bid/pendencias", label: "Pendências BID", icone: AlertTriangle },
    ],
  },
  {
    id: "impressao",
    label: "Impressão",
    icone: Printer,
    itens: [{ href: "/impressao/avulsa", label: "Impressão Avulsa", icone: Printer }],
  },
  {
    id: "configuracoes",
    label: "Configurações",
    icone: SlidersHorizontal,
    itens: [
      { href: "/configuracoes/mao-de-obra", label: "Mão de obra", icone: SlidersHorizontal },
      { href: "/configuracoes/bid-markup", label: "Faixas de Markup (BID)", icone: TrendingUp },
      { href: "/configuracoes/impostos", label: "Imposto (ICMS)", icone: Percent },
    ],
  },
  {
    id: "sistema",
    label: "Sistema",
    icone: Settings,
    itens: [{ href: "/usuarios", label: "Usuários", icone: Users }],
  },
];

// Item ativo do menu lateral: usa a cor do sistema (definida em "Cor do
// sistema") pra fundo, texto e a barrinha lateral, então ao arrastar a
// roda de cores o menu inteiro reage junto — não só os botões.
const ESTILO_ATIVO: React.CSSProperties = {
  background: "var(--accent-glow)",
  color: "var(--accent2)",
  fontWeight: 500,
  boxShadow: "inset 3px 0 0 var(--accent)",
};

// Dentro de um grupo, mais de um item pode "bater" com a rota atual (ex:
// "/operacional" e "/operacional/reconhecimento-lote" começam ambos com
// "/operacional") — pega sempre o href mais específico (mais longo) que
// combina, pra só um item ficar destacado por vez.
function hrefMaisEspecificoAtivo(itens: ItemMenu[], pathname: string | null): string | null {
  if (!pathname) return null;
  const candidatos = itens
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length);
  return candidatos[0]?.href ?? null;
}

export default function AppShell({
  titulo,
  perfil,
  children,
}: {
  titulo: string;
  perfil: Perfil;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const [sidebarAberta, setSidebarAberta] = useState(false);
  const [gruposAbertos, setGruposAbertos] = useState<Record<string, boolean>>(
    () =>
      Object.fromEntries(
        GRUPOS_MENU.map((g) => [
          g.id,
          g.itens.some((item) => pathname?.startsWith(item.href)),
        ])
      )
  );

  function alternarGrupo(id: string) {
    setGruposAbertos((atual) => ({ ...atual, [id]: !atual[id] }));
  }

  async function sair() {
    await supabase.auth.signOut();
    router.refresh();
    router.push("/login");
  }

  const nomeCompleto = perfil ? `${perfil.nome} ${perfil.sobrenome}` : "";
  const cargoExibido = perfil?.is_master ? "Administrador" : perfil?.cargo || "";

  return (
    <div className="min-h-screen" style={{ background: "var(--canvas)" }}>
      {/* backdrop mobile */}
      {sidebarAberta && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setSidebarAberta(false)}
        />
      )}

      {/* sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 flex flex-col border-r transition-transform duration-200 md:translate-x-0 ${
          sidebarAberta ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ background: "var(--surface)", borderColor: "var(--line)" }}
      >
        <div className="flex items-center justify-between px-5 py-5">
          <Link
            href="/dashboard"
            className="flex items-center justify-center flex-1 min-w-0"
            onClick={() => setSidebarAberta(false)}
          >
            <div className="relative w-full max-w-[160px]" style={{ aspectRatio: "640 / 309" }}>
              <Image
                src="/logo-parceria-menu.png?v=5"
                alt="J.Macedo + Allied"
                fill
                sizes="160px"
                className="object-contain"
                unoptimized
                priority
              />
            </div>
          </Link>
          <button
            type="button"
            onClick={() => setSidebarAberta(false)}
            className="md:hidden shrink-0 transition"
            style={{ color: "var(--muted)" }}
            aria-label="Fechar menu"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 space-y-1">
          <Link
            href="/dashboard"
            onClick={() => setSidebarAberta(false)}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition hover:bg-[var(--surface2)]"
            style={pathname === "/dashboard" ? ESTILO_ATIVO : { color: "var(--muted)" }}
          >
            <Home size={17} />
            Início
          </Link>

          {GRUPOS_MENU.map((grupo) => {
            const IconeGrupo = grupo.icone;
            const aberto = gruposAbertos[grupo.id];
            const hrefAtivo = hrefMaisEspecificoAtivo(grupo.itens, pathname);
            return (
              <div key={grupo.id} className="pt-1">
                <button
                  type="button"
                  onClick={() => alternarGrupo(grupo.id)}
                  className="w-full flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-lg text-sm transition hover:bg-[var(--surface2)]"
                  style={{ color: "var(--muted)" }}
                >
                  <span className="flex items-center gap-2.5">
                    <IconeGrupo size={17} />
                    {grupo.label}
                  </span>
                  <ChevronDown
                    size={15}
                    className={`transition-transform ${aberto ? "rotate-180" : ""}`}
                  />
                </button>
                {aberto && (
                  <div className="mt-1 ml-4 pl-3 border-l space-y-1" style={{ borderColor: "var(--line)" }}>
                    {grupo.itens.map((item) => {
                      const IconeItem = item.icone;
                      const ativo = item.href === hrefAtivo;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setSidebarAberta(false)}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition hover:bg-[var(--surface2)]"
                          style={ativo ? ESTILO_ATIVO : { color: "var(--muted)" }}
                        >
                          <IconeItem size={15} />
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="p-3 border-t" style={{ borderColor: "var(--line)" }}>
          <button
            type="button"
            onClick={sair}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition hover:bg-[var(--surface2)]"
            style={{ color: "var(--muted)" }}
          >
            <LogOut size={17} />
            Sair
          </button>
        </div>
      </aside>

      {/* área principal */}
      <div className="md:pl-64">
        <header
          className="h-16 flex items-center gap-3 px-4 md:px-6 border-b sticky top-0 z-20"
          style={{ background: "var(--surface)", borderColor: "var(--line)" }}
        >
          <button
            type="button"
            onClick={() => setSidebarAberta(true)}
            className="md:hidden text-[var(--muted)] hover:text-[var(--ink)]"
            aria-label="Abrir menu"
          >
            <Menu size={20} />
          </button>

          <SininhoNotificacoes />

          <h1 className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
            {titulo}
          </h1>

          <div className="flex-1" />

          <div className="hidden sm:flex items-center gap-2.5 pr-1">
            <Avatar nome={nomeCompleto} tamanho={32} />
            <div className="leading-tight">
              <p className="text-xs font-medium" style={{ color: "var(--ink)" }}>
                {nomeCompleto || "—"}
              </p>
              <p className="text-[11px]" style={{ color: "var(--muted)" }}>
                {cargoExibido}
              </p>
            </div>
          </div>

          <ColorPickerSistema />
          <BotaoTema />
        </header>

        <main className="px-4 md:px-6 py-6">{children}</main>
      </div>
    </div>
  );
}

function SininhoNotificacoes() {
  const [aberto, setAberto] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-label="Notificações"
        className="relative w-9 h-9 flex items-center justify-center rounded-full border transition"
        style={{ borderColor: "var(--line)", color: "var(--muted)" }}
      >
        <Bell size={16} />
      </button>

      {aberto && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setAberto(false)} />
          <div
            className="absolute left-0 top-11 z-40 w-72 rounded-xl border shadow-2xl overflow-hidden"
            style={{ background: "var(--surface)", borderColor: "var(--line)" }}
          >
            <div className="px-4 py-3 border-b" style={{ borderColor: "var(--line)" }}>
              <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
                Notificações
              </p>
            </div>
            <p className="text-sm p-4" style={{ color: "var(--muted)" }}>
              Nenhuma notificação por aqui.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
