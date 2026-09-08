import Link from "next/link";
import {
  Inbox,
  ClipboardList,
  SearchCheck,
  ClipboardCheck,
  FileSpreadsheet,
  RefreshCcw,
  PackageSearch,
  Hammer,
  BadgeCheck,
  CircleX,
  PackageCheck,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import ContadorAoVivo from "@/components/ContadorAoVivo";
import { STATUS_OPERACIONAL } from "@/lib/orcamentos";

const ICONES: Record<string, typeof Inbox> = {
  "ag-abertura": Inbox,
  "1-ag-triagem": ClipboardList,
  "2-ag-analise": SearchCheck,
  "validacao-orcamentos": ClipboardCheck,
  "3-ag-resposta-orcamento": FileSpreadsheet,
  "4-ag-resposta-reorcamento": RefreshCcw,
  "5-ag-pecas": PackageSearch,
  "6-ag-reparo": Hammer,
  "7-reparo-finalizado": BadgeCheck,
  "8-orcamento-reprovado": CircleX,
  "produto-entregue": PackageCheck,
};

// Cada etapa tem sua própria identidade de cor (independente da "Cor do
// sistema" escolhida pelo usuário) — ajuda a diferenciar rapidamente os
// cards num painel com 10 etapas.
const CORES: Record<string, { cor: string; clara: string }> = {
  "ag-abertura": { cor: "#64748b", clara: "#cbd5e1" },
  "1-ag-triagem": { cor: "#2563eb", clara: "#60a5fa" },
  "2-ag-analise": { cor: "#7c3aed", clara: "#a78bfa" },
  "validacao-orcamentos": { cor: "#14b8a6", clara: "#5eead4" },
  "3-ag-resposta-orcamento": { cor: "#d97706", clara: "#fbbf24" },
  "4-ag-resposta-reorcamento": { cor: "#ea580c", clara: "#fb923c" },
  "5-ag-pecas": { cor: "#0891b2", clara: "#22d3ee" },
  "6-ag-reparo": { cor: "#9333ea", clara: "#c084fc" },
  "7-reparo-finalizado": { cor: "#059669", clara: "#34d399" },
  "8-orcamento-reprovado": { cor: "#dc2626", clara: "#f87171" },
  "produto-entregue": { cor: "#0d9488", clara: "#2dd4bf" },
};

type ContagemStatus = { status_operacional: string; quantidade: number | string };

export default async function OperacionalPage() {
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

  const { data: contagens } = (await supabase.rpc("orcamentos_metricas_status")) as {
    data: ContagemStatus[] | null;
  };

  const mapaContagens = new Map<string, number>();
  for (const c of contagens ?? []) {
    mapaContagens.set(c.status_operacional, Number(c.quantidade));
  }

  // total usado como base do percentual de cada card — sem "Produto
  // Entregue", que só acumula pra sempre e, com o tempo, dominaria a
  // conta e esconderia como o volume ATUAL está distribuído nas etapas
  // ainda em andamento.
  const totalPipelineAtivo = STATUS_OPERACIONAL.filter((s) => s.slug !== "produto-entregue").reduce(
    (soma, s) => soma + (mapaContagens.get(s.valor) ?? 0),
    0
  );

  return (
    <AppShell titulo="Operacional" perfil={perfil}>
      <p className="text-sm mb-5" style={{ color: "var(--muted)" }}>
        Clique em um Card para ver os aparelhos de cada etapa.
      </p>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {STATUS_OPERACIONAL.map((status) => {
          const Icone = ICONES[status.slug];
          const cores = CORES[status.slug];
          const quantidade = mapaContagens.get(status.valor) ?? 0;
          const percentual =
            status.slug === "produto-entregue" || totalPipelineAtivo === 0 ? null : (quantidade / totalPipelineAtivo) * 100;
          return (
            <Link
              key={status.slug}
              href={`/operacional/${status.slug}`}
              className="group relative rounded-xl pt-5 px-4 pb-4 overflow-hidden transition-transform hover:-translate-y-1"
              style={{
                background: "linear-gradient(155deg, var(--surface2), var(--surface))",
                boxShadow:
                  "0 1px 0 rgba(255,255,255,0.06) inset, 0 10px 22px rgba(0,0,0,0.26), 0 3px 8px rgba(0,0,0,0.2)",
                border: "1px solid var(--line)",
              }}
            >
              <span
                className="absolute inset-x-0 top-0 h-1.5"
                style={{ background: `linear-gradient(90deg, ${cores.cor}, ${cores.clara})` }}
              />

              <div className="flex items-center gap-3 mb-2">
                <Icone size={26} strokeWidth={2} style={{ color: cores.cor }} />
                <span className="text-2xl font-bold leading-none" style={{ color: "var(--ink)" }}>
                  <ContadorAoVivo status={status.valor} contagemInicial={quantidade} />
                </span>
              </div>
              <p className="text-[13px] font-medium leading-snug" style={{ color: "var(--muted)" }}>
                {status.label}
              </p>
              {percentual != null && (
                <div
                  className="mt-2 flex items-center gap-1.5"
                  title={`${percentual.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}% do pipeline ativo (todas as etapas, exceto Produto Entregue)`}
                >
                  <div className="h-[3px] flex-1 rounded-full overflow-hidden" style={{ background: "var(--surface)" }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, Math.max(quantidade > 0 ? 2 : 0, percentual))}%`,
                        background: `linear-gradient(90deg, ${cores.cor}, ${cores.clara})`,
                      }}
                    />
                  </div>
                  <span className="text-[10px] font-semibold shrink-0" style={{ color: cores.cor }}>
                    {Math.round(percentual)}%
                  </span>
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </AppShell>
  );
}
