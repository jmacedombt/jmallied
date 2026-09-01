import Link from "next/link";
import {
  Inbox,
  ListFilter,
  Search,
  FileText,
  RefreshCw,
  Package,
  Wrench,
  CheckCircle2,
  XCircle,
  Truck,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import { STATUS_OPERACIONAL } from "@/lib/orcamentos";

const ICONES: Record<string, typeof Inbox> = {
  "ag-abertura": Inbox,
  "1-ag-triagem": ListFilter,
  "2-ag-analise": Search,
  "3-ag-resposta-orcamento": FileText,
  "4-ag-resposta-reorcamento": RefreshCw,
  "5-ag-pecas": Package,
  "6-ag-reparo": Wrench,
  "7-reparo-finalizado": CheckCircle2,
  "8-orcamento-reprovado": XCircle,
  "produto-entregue": Truck,
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

  return (
    <AppShell titulo="Operacional" perfil={perfil}>
      <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>
        Etapas da ordem de serviço, do recebimento até a entrega. Clique num card para ver os aparelhos daquela etapa.
      </p>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
        {STATUS_OPERACIONAL.map((status) => {
          const Icone = ICONES[status.slug];
          const quantidade = mapaContagens.get(status.valor) ?? 0;
          return (
            <Link
              key={status.slug}
              href={`/operacional/${status.slug}`}
              className="group relative rounded-2xl p-5 transition-transform hover:-translate-y-1"
              style={{
                background: "linear-gradient(155deg, var(--surface2), var(--surface))",
                boxShadow:
                  "0 1px 0 rgba(255,255,255,0.06) inset, 0 14px 28px rgba(0,0,0,0.28), 0 4px 10px rgba(0,0,0,0.22)",
                border: "1px solid var(--line)",
              }}
            >
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
                style={{
                  background: "var(--accent)",
                  boxShadow: "0 6px 14px var(--accent-glow), 0 1px 0 rgba(255,255,255,0.25) inset",
                }}
              >
                <Icone size={20} className="text-white" />
              </div>
              <p className="text-3xl font-semibold mb-1" style={{ color: "var(--ink)" }}>
                {quantidade}
              </p>
              <p className="text-sm font-medium leading-snug" style={{ color: "var(--muted)" }}>
                {status.label}
              </p>
            </Link>
          );
        })}
      </div>
    </AppShell>
  );
}
