import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { podeConfirmarAnaliseEmLote, STATUS_OPERACIONAL, STATUS_VALIDACAO_ORCAMENTOS } from "@/lib/orcamentos";
import { type LinhaPlanilhaOrcamento } from "@/lib/email";
import { prepararEnvioLote } from "@/lib/validacaoEnvioAllied";
import { persistirEEnviarLote } from "@/lib/orcamentoEnvio";

export const maxDuration = 60;

const STATUS_AG_RESPOSTA_ORCAMENTO = STATUS_OPERACIONAL.find((s) => s.slug === "3-ag-resposta-orcamento")!.valor;

const TAMANHO_LOTE_UPDATE_PARALELO = 20;

// Avança TODOS os aparelhos de um lote (NF Remessa) de "Validação de
// Orçamentos" pra "3 - Ag. Resposta de Orçamento" de uma vez (botão
// "Confirmar Envio" > "Confirmar" no pop-up de resumo) — sempre por
// lote, nunca lotes misturados. Toda a validação de travas + o cálculo
// congelado de cada aparelho + a montagem do arquivo de envio moram em
// prepararEnvioLote (lib/validacaoEnvioAllied.ts), compartilhado com a
// rota de preview — garante que o que a pessoa viu no preview é
// exatamente o que é gravado/enviado aqui.
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

  if (!podeConfirmarAnaliseEmLote(perfil)) {
    return NextResponse.json(
      { error: "Seu cargo não tem permissão para confirmar o envio de um lote." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  const nfRemessa = String(body?.nf_remessa_allied ?? "").trim();

  if (!nfRemessa) {
    return NextResponse.json({ error: "Selecione um lote (NF Remessa)." }, { status: 400 });
  }

  const preparo = await prepararEnvioLote(admin, nfRemessa);
  if (!preparo.ok) {
    return NextResponse.json({ error: preparo.erro, pecasDesatualizadas: preparo.pecasDesatualizadas }, { status: preparo.status });
  }

  const agora = new Date().toISOString();

  // trava + retrato do cálculo (validacao_snapshot) — congela peça a
  // peça o custo/imposto/venda desse orçamento no momento da confirmação,
  // pra mudanças futuras na Base Peças/markup/ICMS não alterarem
  // retroativamente o valor que já foi informado ao cliente. Roda em
  // paralelo, em grupos pequenos, pra não estourar o tempo de execução.
  let quantidade = 0;
  const linhasConfirmadas: LinhaPlanilhaOrcamento[] = [];
  for (let i = 0; i < preparo.itensConfirmaveis.length; i += TAMANHO_LOTE_UPDATE_PARALELO) {
    const grupo = preparo.itensConfirmaveis.slice(i, i + TAMANHO_LOTE_UPDATE_PARALELO);
    const resultados = await Promise.all(
      grupo.map(async (item) => {
        const { error } = await admin
          .from("orcamentos")
          .update({
            status_operacional: STATUS_AG_RESPOSTA_ORCAMENTO,
            validacao_concluida_por: user.id,
            validacao_concluida_em: agora,
            validacao_travado: true,
            validacao_travado_em: agora,
            validacao_travado_por: user.id,
            validacao_snapshot: item.detalhe,
          })
          .eq("id", item.id)
          .eq("status_operacional", STATUS_VALIDACAO_ORCAMENTOS);
        if (!error) linhasConfirmadas.push(item.linha);
        return !error;
      })
    );
    quantidade += resultados.filter(Boolean).length;
  }

  const linhasPlanilha = [...linhasConfirmadas, ...preparo.linhasReprovados];

  // persiste o Excel (bucket envios-orcamentos, pro botão Histórico) e
  // manda por e-mail — uma falha em qualquer uma dessas duas partes
  // NUNCA desfaz nem impede o avanço de etapa que já aconteceu acima; só
  // fica registrada em orcamento_envios/envios_email pra dar pra
  // conferir depois.
  let email: { enviado: boolean; erro?: string } = { enviado: false };
  if (quantidade > 0) {
    email = await persistirEEnviarLote({
      admin,
      tipo: "orcamento",
      nfRemessa,
      quantidade,
      linhasPlanilha,
      userId: user.id,
      nomeArquivoPrefixo: "orcamentos",
    });
  }

  return NextResponse.json({ ok: true, quantidade, email });
}
