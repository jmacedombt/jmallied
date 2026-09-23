import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { podeManutencaoBanco } from "@/lib/manutencao";
import { corrigirOrdemPlanilhasJaGeradas } from "@/lib/corrigirOrdemPlanilhas";

export const maxDuration = 60;

// Sistema > Manutenção do Banco > "Corrigir ordem das planilhas já
// geradas" (pedido explícito) — reordena, sem recalcular nada, as
// planilhas de "Confirmar Envio" (Histórico de Envios) e "Enviar Contra
// Proposta" já geradas ANTES da coluna orcamentos.ordem_planilha existir
// (migrations 0064/0065), pra ficarem na mesma ordem da planilha
// original de Base de Orçamentos. Ver lib/corrigirOrdemPlanilhas.ts.
export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: perfil } = await admin.from("usuarios").select("cargo, is_master").eq("id", user.id).single();

  if (!podeManutencaoBanco(perfil)) {
    return NextResponse.json({ error: "Só um Administrador pode rodar essa correção." }, { status: 403 });
  }

  const resultado = await corrigirOrdemPlanilhasJaGeradas(admin);

  return NextResponse.json({ ok: true, resultado });
}
