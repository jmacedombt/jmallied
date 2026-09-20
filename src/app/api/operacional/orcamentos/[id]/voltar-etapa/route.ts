import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import {
  podeVoltarEtapaAgEmissaoNf,
  podeVoltarEtapaSemNfLancada,
  statusAnteriorAgEmissaoNf,
  type CamposNotaFiscal,
} from "@/lib/orcamentos";

// Volta um único orçamento de "Ag. Emissão de Nota Fiscal" pra etapa
// anterior — usado quando o lote foi selecionado por engano ou precisa
// de correção antes da NF sair. Recuado só é permitido:
//  - se o orçamento estiver de fato num dos 2 status reais dessa etapa
//    (Ag. NF Retorno (Recusados) ou Ag. NF Serviço / Venda / Retorno);
//  - se NENHUMA NF (Mão de Obra/Peças/Retorno) já tiver sido lançada e a
//    exportação ainda não tiver ocorrido — uma vez que a NF já foi
//    emitida/registrada, não dá mais pra voltar por aqui.
// Restrito a Administrador (is_master) ou Gerente (ver PopupDetalheGrupoNf.tsx).
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: perfil } = await admin.from("usuarios").select("cargo, is_master").eq("id", user.id).single();

  if (!podeVoltarEtapaAgEmissaoNf(perfil)) {
    return NextResponse.json({ error: "Só Administrador ou Gerente podem voltar um orçamento de etapa." }, { status: 403 });
  }

  const { data: atual, error: erroAtual } = await admin
    .from("orcamentos")
    .select(
      "status_operacional, nf_mao_de_obra_numero, nf_mao_de_obra_valor, nf_pecas_numero, nf_pecas_valor, nf_retorno_numero, nf_retorno_valor, nf_exportado_em"
    )
    .eq("id", params.id)
    .single();

  if (erroAtual || !atual) {
    return NextResponse.json({ error: "Orçamento não encontrado." }, { status: 404 });
  }

  const statusAnterior = statusAnteriorAgEmissaoNf(atual.status_operacional);
  if (!statusAnterior) {
    return NextResponse.json(
      { error: "Esse orçamento não está em Ag. Emissão de Nota Fiscal — nada a voltar." },
      { status: 409 }
    );
  }

  if (!podeVoltarEtapaSemNfLancada(atual as CamposNotaFiscal)) {
    return NextResponse.json(
      { error: "Esse orçamento já tem NF lançada/exportada — não é mais possível voltar de etapa." },
      { status: 409 }
    );
  }

  const { error } = await admin
    .from("orcamentos")
    .update({ status_operacional: statusAnterior })
    .eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, status_operacional: statusAnterior });
}
