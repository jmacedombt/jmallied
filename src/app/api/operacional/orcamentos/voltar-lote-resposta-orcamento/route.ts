import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { podeVoltarLoteAgRespostaOrcamento, STATUS_AG_RESPOSTA_ORCAMENTO, STATUS_VALIDACAO_ORCAMENTOS } from "@/lib/orcamentos";

// Volta em lote os aparelhos selecionados de "3 - Ag. Resposta de
// Orçamento" pra "Validação de Orçamentos" (pedido explícito,
// 25/09/2026) — só quem ainda está "Aguardando" resposta da Allied
// (resultado_aprovacao_allied): reverter um já resolvido (Aprovado/
// Contra Proposta/Reprovado) desfaria uma resposta já registrada, fora
// do escopo pedido. Sempre um único lote (NF Remessa) por vez — mesma
// regra de "nunca mistura lotes" já usada em "Confirmar Envio"
// (avancar-validacao-em-massa). Desfaz também a trava/conclusão da
// Validação de Orçamentos (validacao_travado/concluida) — o aparelho
// está voltando pra uma etapa que volta a ser editável, então esses
// campos não podem continuar marcados como "já concluído". Opcionalmente
// (excluirRegistroEnvio) também apaga o(s) registro(s) de "Orçamentos
// Enviados" (orcamento_envios, tipo "orcamento") daquela NF — linha do
// histórico E o arquivo no Storage (bucket envios-orcamentos); pedido
// explícito. Só Administrador (is_master) — ver
// podeVoltarLoteAgRespostaOrcamento.
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: perfil } = await admin.from("usuarios").select("cargo, is_master").eq("id", user.id).single();

  if (!podeVoltarLoteAgRespostaOrcamento(perfil)) {
    return NextResponse.json({ error: "Só o Administrador pode voltar um lote de etapa." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const ids: string[] = Array.isArray(body?.ids) ? body.ids.filter((id: unknown): id is string => typeof id === "string") : [];
  const excluirRegistroEnvio = body?.excluirRegistroEnvio === true;

  if (ids.length === 0) {
    return NextResponse.json({ error: "Selecione ao menos um aparelho." }, { status: 400 });
  }

  type AparelhoSelecionado = {
    id: string;
    status_operacional: string;
    resultado_aprovacao_allied: string;
    nf_remessa_allied: string;
  };

  const { data: selecionadosBrutos, error: erroSelecionados } = await admin
    .from("orcamentos")
    .select("id, status_operacional, resultado_aprovacao_allied, nf_remessa_allied")
    .in("id", ids);

  if (erroSelecionados) {
    return NextResponse.json({ error: erroSelecionados.message }, { status: 400 });
  }

  if (!selecionadosBrutos || selecionadosBrutos.length !== ids.length) {
    return NextResponse.json({ error: "Algum aparelho selecionado não foi encontrado." }, { status: 404 });
  }

  const selecionados = selecionadosBrutos as unknown as AparelhoSelecionado[];

  if (selecionados.some((a: AparelhoSelecionado) => a.status_operacional !== STATUS_AG_RESPOSTA_ORCAMENTO)) {
    return NextResponse.json(
      { error: "Algum aparelho selecionado não está mais em 3 - Ag. Resposta de Orçamento." },
      { status: 409 }
    );
  }

  if (selecionados.some((a: AparelhoSelecionado) => a.resultado_aprovacao_allied !== "Aguardando")) {
    return NextResponse.json(
      { error: 'Só é possível voltar aparelhos que ainda estão "Aguardando" — algum selecionado já tem resultado definido.' },
      { status: 409 }
    );
  }

  const nfsDistintas = new Set(selecionados.map((a: AparelhoSelecionado) => a.nf_remessa_allied));
  if (nfsDistintas.size > 1) {
    return NextResponse.json({ error: "Selecione aparelhos de um único lote (NF Remessa) por vez." }, { status: 409 });
  }
  const nfRemessa = selecionados[0].nf_remessa_allied;

  const { data: atualizados, error: erroUpdate } = await admin
    .from("orcamentos")
    .update({
      status_operacional: STATUS_VALIDACAO_ORCAMENTOS,
      validacao_travado: false,
      validacao_travado_em: null,
      validacao_travado_por: null,
      validacao_concluida_por: null,
      validacao_concluida_em: null,
    })
    .in("id", ids)
    .eq("status_operacional", STATUS_AG_RESPOSTA_ORCAMENTO)
    .select("id");

  if (erroUpdate) {
    return NextResponse.json({ error: erroUpdate.message }, { status: 400 });
  }

  // exclusão do registro de "Orçamentos Enviados" é best-effort: o
  // retrocesso de etapa acima já aconteceu e é o efeito principal
  // pedido — uma falha aqui (storage ou banco) não desfaz nem impede
  // isso, só fica reportada na resposta.
  let envioExcluido = false;
  let erroExclusaoEnvio: string | null = null;

  if (excluirRegistroEnvio) {
    const { data: envios, error: erroEnvios } = await admin
      .from("orcamento_envios")
      .select("id, arquivo_path")
      .eq("nf_remessa_allied", nfRemessa)
      .eq("tipo", "orcamento");

    if (erroEnvios) {
      erroExclusaoEnvio = erroEnvios.message;
    } else if (envios && envios.length > 0) {
      const caminhos = (envios as unknown as { id: string; arquivo_path: string | null }[])
        .map((e) => e.arquivo_path)
        .filter((p): p is string => !!p);
      if (caminhos.length > 0) {
        const { error: erroStorage } = await admin.storage.from("envios-orcamentos").remove(caminhos);
        if (erroStorage) erroExclusaoEnvio = erroStorage.message;
      }

      const { error: erroDelete } = await admin
        .from("orcamento_envios")
        .delete()
        .eq("nf_remessa_allied", nfRemessa)
        .eq("tipo", "orcamento");

      if (erroDelete) {
        erroExclusaoEnvio = erroDelete.message;
      } else {
        envioExcluido = true;
      }
    }
  }

  return NextResponse.json({
    ok: true,
    quantidade: atualizados?.length ?? 0,
    nf_remessa_allied: nfRemessa,
    envioExcluido,
    erroExclusaoEnvio,
  });
}
