"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  ChevronDown,
  Database,
  Home,
  LogOut,
  Menu,
  Settings,
  Users,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Avatar from "@/components/Avatar";
import BotaoTema from "@/components/BotaoTema";

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
    id: "bases",
    label: "Bases",
    icone: Database,
    itens: [{ href: "/bases/pecas", label: "Base Peças", icone: Database }],
  },
  {
    id: "sistema",
    label: "Sistema",
    icone: Settings,
    itens: [{ href: "/usuarios", label: "Usuários", icone: Users }],
  },
];

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
        className={`fixed inset-y-0 left-0 z-40 w-64 flex flex-col border-r border-allied-border transition-transform duration-200 md:translate-x-0 ${
          sidebarAberta ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{
          background: "linear-gradient(180deg, #132a52, #0a1830)",
        }}
      >
        <div className="flex items-center justify-between px-5 py-5">
          <Link href="/dashboard" className="flex items-center gap-2.5" onClick={() => setSidebarAberta(false)}>
            <div className="relative h-8 w-8 shrink-0">
              <Image src="/logo-allied.png" alt="Allied" fill sizes="32px" className="object-contain" />
            </div>
            <span className="text-sm font-semibold text-white">Allied</span>
          </Link>
          <button
            type="button"
            onClick={() => setSidebarAberta(false)}
            className="text-allied-silver/60 hover:text-white md:hidden"
            aria-label="Fechar menu"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 space-y-1">
          <Link
            href="/dashboard"
            onClick={() => setSidebarAberta(false)}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition ${
              pathname === "/dashboard"
                ? "bg-white/10 text-white font-medium"
                : "text-allied-silver/75 hover:bg-white/5 hover:text-white"
            }`}
          >
            <Home size={17} />
            Início
          </Link>

          {GRUPOS_MENU.map((grupo) => {
            const IconeGrupo = grupo.icone;
            const aberto = gruposAbertos[grupo.id];
            return (
              <div key={grupo.id} className="pt-1">
                <button
                  type="button"
                  onClick={() => alternarGrupo(grupo.id)}
                  className="w-full flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-lg text-sm text-allied-silver/75 hover:bg-white/5 hover:text-white transition"
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
                  <div className="mt-1 ml-4 pl-3 border-l border-white/10 space-y-1">
                    {grupo.itens.map((item) => {
                      const IconeItem = item.icone;
                      const ativo = pathname?.startsWith(item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setSidebarAberta(false)}
                          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition ${
                            ativo
                              ? "bg-white/10 text-white font-medium"
                              : "text-allied-silver/70 hover:bg-white/5 hover:text-white"
                          }`}
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

        <div className="p-3 border-t border-white/10">
          <button
            type="button"
            onClick={sair}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-allied-silver/75 hover:bg-white/5 hover:text-white transition"
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
