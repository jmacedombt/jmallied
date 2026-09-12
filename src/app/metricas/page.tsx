import Link from "next/link";
import { BarChart3, Gauge, PackageCheck, ShieldCheck, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import { podeConfirmarAnaliseEmLote } from "@/lib/orcamentos";

const TILES = [
  {
    href: "/metricas/volumetria",
    titulo: "Volumetria",
    descricao: "Quantos aparelhos foram reconhecidos, entraram em cada status, foram finalizados, ou estão parados agora.",
    icone: BarChart3,
    cor: "#2563eb",
    clara: "#60a5fa",
  },
  {
    href: "/metricas/rtat",
    titulo: "R-TAT",
    descricao: "Tempo médio (em dias) do reconhecimento até o fechamento — total e por status, com a evolução ao longo do tempo.",
    icone: Gauge,
    cor: "#7c3aed",
    clara: "#a78bfa",
  },
  {
    href: "/metricas/orcamentos",
    titulo: "Orçamentos",
    descricao: "Aprovado x reprovado x contra proposta por lote, modelo e Part Number — e o valor médio de cada resultado.",
    icone: PackageCheck,
    cor: "#059669",
    clara: "#34d399",
  },
  {
    href: "/metricas/oqc",
    titulo: "OQC",
    descricao: "PASS x FAIL do controle de qualidade por lote, reincidência de falha por aparelho, e a evolução por semana/mês.",
    icone: ShieldCheck,
    cor: "#dc2626",
    clara: "#f87171",
  },
  {
    href: "/metricas/previsao-recebimento",
    titulo: "Previsão de Recebimento",
    descricao: "Mão de Obra e Peças já aprovadas pela Allied em 5 - Ag. Peças, 6 - Ag. Reparo e 7 - Reparo Finalizado — o que vamos receber.",
    icone: Wallet,
    cor: "#d97706",
    clara: "#fbbf24",
  },
];

export default async function MetricasPage() {
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

  if (!podeConfirmarAnaliseEmLote(perfil)) {
    return (
      <AppShell titulo="Métricas" perfil={perfil}>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Seu cargo não tem permissão para acessar o menu Métricas.
        </p>
      </AppShell>
    );
  }

  return (
    <AppShell
      titulo="Métricas"
      tituloInfo="Volumetria e R-TAT calculados a partir da Data Reconhecimento de cada aparelho e do histórico de mudança de status registrado automaticamente pelo sistema."
      perfil={perfil}
    >
      <p className="text-sm mb-5" style={{ color: "var(--muted)" }}>
        Escolha um submenu pra ver os gráficos.
      </p>

      <div className="grid sm:grid-cols-2 gap-4 max-w-3xl">
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
