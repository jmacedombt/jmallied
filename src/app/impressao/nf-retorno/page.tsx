import { Tag } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import { FormEtiquetaNfRetorno } from "@/components/PopupEtiquetaCaixaAvulsa";

// Impressão > Impressão Avulsa NF Retorno (pedido explícito, 23/11/2026):
// mesmo formulário do botão "Etiqueta Avulsa" de Ag. Emissão de Nota
// Fiscal, só com NF de Retorno já emitida (lista suspensa).
export default async function ImpressaoAvulsaNfRetornoPage() {
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
    <AppShell titulo="Impressão Avulsa NF Retorno" perfil={perfil}>
      <p className="text-sm mb-5" style={{ color: "var(--muted)" }}>
        Etiqueta de caixa (60x40mm, Zebra) para uma NF de Retorno já emitida. Escolha a NF na lista, confira os campos,
        visualize a prévia e confirme a impressão.
      </p>
      <div className="max-w-md rounded-2xl border p-5" style={{ background: "var(--surface)", borderColor: "var(--line)" }}>
        <h2 className="text-base font-semibold flex items-center gap-2 mb-4" style={{ color: "var(--ink)" }}>
          <Tag size={18} style={{ color: "var(--accent2)" }} />
          Etiqueta Avulsa NF Retorno
        </h2>
        <FormEtiquetaNfRetorno />
      </div>
    </AppShell>
  );
}
