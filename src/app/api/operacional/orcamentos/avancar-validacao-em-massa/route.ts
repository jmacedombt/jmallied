import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import {
  calcularDetalheValidacao,
  podeConfirmarAnaliseEmLote,
  STATUS_ETAPAS_ANTERIORES_A_VALIDACAO,
  STATUS_OPERACIONAL,
  STATUS_VALIDACAO_ORCAMENTOS,
  type CamposPecasOrcamento,
  type ConfiguracaoMaoDeObra,
} from "@/lib/orcamentos";
import { type FaixaMarkup } from "@/lib/bid";
import { enviarEmailResend, montarPlanilhaOrcamentos, preencherModeloEmail, type LinhaPlanilhaOrcamento } from "@/lib/email";

export const maxDuration = 60;

const STATUS_AG_RESPOSTA_ORCAMENTO = STATUS_OPERACIONAL.find((s) => s.slug === "3-ag-resposta-orcamento")!.valor;

const COLUNAS_PECAS =
  "peca_1, peca_2, peca_3, peca_4, peca_5, peca_6, peca_7, peca_8, peca_9, peca_10, peca_add_1, peca_add_2, peca_add_3, peca_add_4, peca_add_5";

const COLUNAS_IDENTIFICACAO = "os_reparadora, os_care_allied, trade_allied, modelo_comercial, sku";

const TAMANHO_LOTE_CODIGOS = 400;
const TAMANHO_LOTE_UPDATE_PARALELO = 20;

type LinhaOrcamentoLote = CamposPecasOrcamento & {
  id: string;
  validacao_confirmado_sem_peca: boolean;
  os_reparadora: string | null;
  os_care_allied: string | null;
  trade_allied: string;
  modelo_comercial: string | null;
  sku: string | null;
};

// Avança TODOS os aparelhos de um lote (NF Remessa) de "Validação de
// Orçamentos" pra "3 - Ag. Resposta de Orçamento" de uma vez (botão
// "Confirmar Envio") — sempre por lote, nunca lotes misturados, porque a
// validação é sempre feita por NF Remessa. Revalida as travas no servidor
// (nunca confia só na checagem que a tela já fez):
//   0) nenhum aparelho do MESMO lote (mesma NF Remessa) pode ainda estar
//      parado numa etapa anterior à análise (Ag. Abertura, 1 - Ag.
//      Triagem ou 2 - Ag. Análise) — um lote pode chegar em partes, e só
//      dá pra confirmar o envio depois que TODO aparelho dele já tiver
//      sido analisado (estando em Validação de Orçamentos ou já
//      reprovado em "8 - Orçamento Reprovado");
//   1) nenhum aparelho do lote pode ter peça lançada sem custo na Base
//      Peças (peça "prioridade", destaque vermelho);
//   2) todo aparelho sem nenhuma peça lançada (destaque amarelo) precisa
//      já ter sido confirmado individualmente (validacao_confirmado_sem_peca).
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

  const { data: aparelhos, error: erroBusca } = await admin
    .from("orcamentos")
    .select(`id, validacao_confirmado_sem_peca, ${COLUNAS_IDENTIFICACAO}, ${COLUNAS_PECAS}`)
    .eq("status_operacional", STATUS_VALIDACAO_ORCAMENTOS)
    .eq("nf_remessa_allied", nfRemessa);

  if (erroBusca) {
    return NextResponse.json({ error: erroBusca.message }, { status: 400 });
  }

  const lista = (aparelhos ?? []) as LinhaOrcamentoLote[];
  if (lista.length === 0) {
    return NextResponse.json(
      { error: "Não há aparelhos desse lote em Validação de Orçamentos no momento." },
      { status: 409 }
    );
  }

  // 0ª trava: mesmo lote (NF Remessa) não pode ter aparelho ainda parado
  // numa etapa anterior à análise — senão a resposta de orçamento sairia
  // sem esperar todo mundo do lote ser analisado.
  const { data: pendentesEtapaAnterior, error: erroPendencia } = await admin
    .from("orcamentos")
    .select("id")
    .eq("nf_remessa_allied", nfRemessa)
    .in("status_operacional", STATUS_ETAPAS_ANTERIORES_A_VALIDACAO as unknown as string[])
    .limit(1);

  if (erroPendencia) {
    return NextResponse.json({ error: erroPendencia.message }, { status: 400 });
  }
  if ((pendentesEtapaAnterior ?? []).length > 0) {
    return NextResponse.json(
      {
        error:
          "Esse lote ainda tem orçamento(s) pendente(s) em etapa anterior à análise (Ag. Abertura, 1 - Ag. Triagem ou 2 - Ag. Análise). Só é possível confirmar o envio depois que TODOS os aparelhos desse lote já tiverem sido analisados.",
      },
      { status: 409 }
    );
  }

  const codigosUnicos = Array.from(
    new Set(
      lista
        .flatMap((a) => [
          a.peca_1, a.peca_2, a.peca_3, a.peca_4, a.peca_5, a.peca_6, a.peca_7, a.peca_8, a.peca_9, a.peca_10,
          a.peca_add_1, a.peca_add_2, a.peca_add_3, a.peca_add_4, a.peca_add_5,
        ])
        .map((c) => (typeof c === "string" ? c.trim() : c))
        .filter((c): c is string => !!c)
    )
  );

  const custosPorCodigo = new Map<string, number>();
  for (let i = 0; i < codigosUnicos.length; i += TAMANHO_LOTE_CODIGOS) {
    const lote = codigosUnicos.slice(i, i + TAMANHO_LOTE_CODIGOS);
    const { data } = await admin.from("pecas_vigentes").select("codigo, valor_unitario").in("codigo", lote);
    for (const linha of data ?? []) custosPorCodigo.set(linha.codigo, Number(linha.valor_unitario));
  }

  let temPecaSemCusto = false;
  let temAparelhoNaoConfirmado = false;

  for (const a of lista) {
    const codigos = [
      a.peca_1, a.peca_2, a.peca_3, a.peca_4, a.peca_5, a.peca_6, a.peca_7, a.peca_8, a.peca_9, a.peca_10,
      a.peca_add_1, a.peca_add_2, a.peca_add_3, a.peca_add_4, a.peca_add_5,
    ]
      .map((c) => (typeof c === "string" ? c.trim() : c))
      .filter((c): c is string => !!c);

    if (codigos.length === 0) {
      if (!a.validacao_confirmado_sem_peca) temAparelhoNaoConfirmado = true;
    } else if (codigos.some((c) => !custosPorCodigo.has(c))) {
      temPecaSemCusto = true;
    }
  }

  if (temPecaSemCusto) {
    return NextResponse.json(
      {
        error:
          "Existem peças sem custo na Base Peças nesse lote (destaque em vermelho / Prioridade). Cadastre o valor delas antes de confirmar o envio.",
      },
      { status: 409 }
    );
  }
  if (temAparelhoNaoConfirmado) {
    return NextResponse.json(
      {
        error:
          "Existem aparelhos sem nenhuma peça lançada (destaque em amarelo) que ainda não foram confirmados. Abra cada um e confirme antes de enviar o lote.",
      },
      { status: 409 }
    );
  }

  // 3ª trava: o BID (custo_peca_samsung persistido) precisa refletir o
  // mesmo valor que a Base Peças tem agora pra cada código usado nesse
  // lote — senão o valor que vai ser informado ao cliente no BID pode já
  // estar desatualizado em relação ao que a Validação está calculando
  // aqui. Ignora peça travada no BID (preço fixado na mão, não segue a
  // Base Peças de propósito).
  const pecasDesatualizadas = new Set<string>();
  for (let i = 0; i < codigosUnicos.length; i += TAMANHO_LOTE_CODIGOS) {
    const lote = codigosUnicos.slice(i, i + TAMANHO_LOTE_CODIGOS);
    const { data } = await admin
      .from("bid_pecas")
      .select("part_number, custo_peca_samsung, travado")
      .in("part_number", lote);
    for (const linha of (data ?? []) as { part_number: string; custo_peca_samsung: number | null; travado: boolean }[]) {
      if (linha.travado) continue;
      const valorVivo = custosPorCodigo.get(linha.part_number) ?? null;
      const diferente =
        (linha.custo_peca_samsung == null) !== (valorVivo == null) ||
        (linha.custo_peca_samsung != null && valorVivo != null && Math.abs(linha.custo_peca_samsung - valorVivo) > 0.001);
      if (diferente) pecasDesatualizadas.add(linha.part_number);
    }
  }

  if (pecasDesatualizadas.size > 0) {
    return NextResponse.json(
      {
        error:
          "A Base Peças mudou desde o último Recalcular BID pra alguma peça desse lote — recalcule o BID (Bases > BID) antes de confirmar o envio, pra garantir que o valor informado ao cliente seja o mesmo que será cobrado.",
        pecasDesatualizadas: Array.from(pecasDesatualizadas),
      },
      { status: 409 }
    );
  }

  const [{ data: configImposto }, { data: configMaoObraBruta }, { data: faixasMarkupBrutas }] = await Promise.all([
    admin.from("configuracoes_impostos").select("icms_percentual").eq("id", 1).single(),
    admin.from("configuracoes_mao_de_obra").select("valor_uma_peca, valor_mais_de_uma_peca").eq("id", 1).single(),
    admin.from("configuracoes_bid_markup").select("valor_min, valor_max, multiplicador").order("ordem", { ascending: true }),
  ]);

  const icmsPercentual = Number(configImposto?.icms_percentual ?? 0);
  const configMaoDeObra: Pick<ConfiguracaoMaoDeObra, "valor_uma_peca" | "valor_mais_de_uma_peca"> = {
    valor_uma_peca: Number(configMaoObraBruta?.valor_uma_peca ?? 0),
    valor_mais_de_uma_peca: Number(configMaoObraBruta?.valor_mais_de_uma_peca ?? 0),
  };
  const faixasMarkup: FaixaMarkup[] = (
    (faixasMarkupBrutas ?? []) as { valor_min: number; valor_max: number | null; multiplicador: number }[]
  ).map((f) => ({
    valor_min: Number(f.valor_min),
    valor_max: f.valor_max == null ? null : Number(f.valor_max),
    multiplicador: Number(f.multiplicador),
  }));

  const agora = new Date().toISOString();

  // trava + retrato do cálculo (validacao_snapshot) — congela peça a
  // peça o custo/imposto/venda desse orçamento no momento da confirmação,
  // pra mudanças futuras na Base Peças/markup/ICMS não alterarem
  // retroativamente o valor que já foi informado ao cliente. O snapshot
  // difere por orçamento, então precisa de um update por linha (em vez
  // do update em lote usado antes) — roda em paralelo, em grupos
  // pequenos, pra não estourar o tempo de execução da função.
  let quantidade = 0;
  const linhasPlanilha: LinhaPlanilhaOrcamento[] = [];
  for (let i = 0; i < lista.length; i += TAMANHO_LOTE_UPDATE_PARALELO) {
    const grupo = lista.slice(i, i + TAMANHO_LOTE_UPDATE_PARALELO);
    const resultados = await Promise.all(
      grupo.map(async (a) => {
        const detalhe = calcularDetalheValidacao(a, custosPorCodigo, icmsPercentual, configMaoDeObra, faixasMarkup);
        const { error } = await admin
          .from("orcamentos")
          .update({
            status_operacional: STATUS_AG_RESPOSTA_ORCAMENTO,
            validacao_concluida_por: user.id,
            validacao_concluida_em: agora,
            validacao_travado: true,
            validacao_travado_em: agora,
            validacao_travado_por: user.id,
            validacao_snapshot: detalhe,
          })
          .eq("id", a.id)
          .eq("status_operacional", STATUS_VALIDACAO_ORCAMENTOS);
        if (!error) {
          linhasPlanilha.push({
            nfRemessa,
            osReparadora: a.os_reparadora,
            osCareAllied: a.os_care_allied,
            tradeAllied: a.trade_allied,
            modeloComercial: a.modelo_comercial,
            sku: a.sku,
            quantidadePecas: detalhe.quantidadePecas,
            custoTotalPecas: detalhe.custoTotalPecas,
            impostoTotalPecas: detalhe.impostoTotalPecas,
            vendaTotalPecas: detalhe.vendaTotalPecas,
            maoDeObra: detalhe.maoDeObra,
            lucroTotal: detalhe.lucroTotal,
          });
        }
        return !error;
      })
    );
    quantidade += resultados.filter(Boolean).length;
  }

  // envio automático de e-mail (planilha do lote em anexo) — uma falha
  // aqui NUNCA desfaz nem impede o avanço de etapa que já aconteceu
  // acima; só fica registrada em envios_email pra dar pra conferir depois.
  let email: { enviado: boolean; erro?: string } = { enviado: false };
  if (quantidade > 0) {
    email = await enviarEmailDoLote({ admin, nfRemessa, quantidade, linhasPlanilha, userId: user.id });
  }

  return NextResponse.json({ ok: true, quantidade, email });
}

type ClienteAdmin = ReturnType<typeof createAdminClient>;

async function enviarEmailDoLote({
  admin,
  nfRemessa,
  quantidade,
  linhasPlanilha,
  userId,
}: {
  admin: ClienteAdmin;
  nfRemessa: string;
  quantidade: number;
  linhasPlanilha: LinhaPlanilhaOrcamento[];
  userId: string;
}): Promise<{ enviado: boolean; erro?: string }> {
  const apiKey = process.env.RESEND_API_KEY;

  const [{ data: config }, { data: destinatariosBrutos }] = await Promise.all([
    admin.from("configuracoes_email").select("remetente_nome, remetente_email, assunto_padrao, corpo_padrao").eq("id", 1).single(),
    admin.from("configuracoes_email_destinatarios").select("email").eq("ativo", true),
  ]);

  const destinatarios = (destinatariosBrutos ?? []).map((d: { email: string }) => d.email);

  // sem chave de API, sem remetente configurado, ou sem nenhum
  // destinatário ativo: não é erro de verdade (a funcionalidade pode
  // simplesmente ainda não ter sido configurada) — só não envia, e nem
  // registra no log pra não poluir com "erro" todo avanço de lote de
  // quem ainda não configurou nada.
  if (!apiKey || !config?.remetente_email || destinatarios.length === 0) {
    return { enviado: false };
  }

  const dadosModelo = { nf_remessa: nfRemessa, quantidade };
  const assunto = preencherModeloEmail(config.assunto_padrao, dadosModelo);
  const corpoTexto = preencherModeloEmail(config.corpo_padrao, dadosModelo);
  const corpoHtml = corpoTexto
    .split("\n")
    .map((linha) => `<p>${linha}</p>`)
    .join("");

  try {
    const planilha = montarPlanilhaOrcamentos(linhasPlanilha);
    const resultado = await enviarEmailResend({
      apiKey,
      remetente: `${config.remetente_nome} <${config.remetente_email}>`,
      destinatarios,
      assunto,
      corpoHtml,
      anexoNomeArquivo: `orcamentos-${nfRemessa}.xlsx`,
      anexoBuffer: planilha,
    });

    await admin.from("envios_email").insert({
      nf_remessa_allied: nfRemessa,
      destinatarios,
      assunto,
      status: "enviado",
      resend_id: resultado.id,
      enviado_por: userId,
    });

    return { enviado: true };
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : "Falha desconhecida ao enviar e-mail.";
    await admin.from("envios_email").insert({
      nf_remessa_allied: nfRemessa,
      destinatarios,
      assunto,
      status: "erro",
      erro_mensagem: mensagem,
      enviado_por: userId,
    });
    return { enviado: false, erro: mensagem };
  }
}
