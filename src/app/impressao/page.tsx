import Link from "next/link";
import { Printer } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";

const TILES = [
  {
    href: "/impressao/avulsa",
    titulo: "Impressão Avulsa",
    descricao: "Gera a etiqueta/comprovante de um aparelho avulso, sem precisar passar pelo fluxo normal de orçamento.",
    icone: Printer,
    cor: "#0ea5e9",
    clara: "#7dd3fc",
  },
];

export default async function ImpressaoPage() {
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
    <AppShell titulo="Impressão" perfil={perfil}>
      <p className="text-sm mb-5" style={{ color: "var(--muted)" }}>
        Escolha uma opção de impressão.
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
