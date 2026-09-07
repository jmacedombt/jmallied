import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { podeConfirmarAnaliseEmLote, STATUS_OPERACIONAL, STATUS_VALIDACAO_ORCAMENTOS } from "@/lib/orcamentos";
import { enviarEmailGmail, montarPlanilhaOrcamentos, preencherModeloEmail, type LinhaPlanilhaOrcamento } from "@/lib/email";
import { prepararEnvioLote } from "@/lib/validacaoEnvioAllied";

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
  // envio via conta do Gmail da empresa (GMAIL_USER + GMAIL_APP_PASSWORD
  // na Vercel) enquanto o domínio próprio não está verificado no Resend —
  // ver enviarEmailResend em lib/email.ts, que fica pronta pra retomar
  // assim que o domínio verificar (só troca a chamada abaixo de volta).
  const gmailUser = process.env.GMAIL_USER;
  const gmailSenhaApp = process.env.GMAIL_APP_PASSWORD;

  const [{ data: config }, { data: destinatariosBrutos }] = await Promise.all([
    admin.from("configuracoes_email").select("remetente_nome, remetente_email, assunto_padrao, corpo_padrao").eq("id", 1).single(),
    admin.from("configuracoes_email_destinatarios").select("email").eq("ativo", true),
  ]);

  const destinatarios = (destinatariosBrutos ?? []).map((d: { email: string }) => d.email);

  // sem conta do Gmail configurada, ou sem nenhum destinatário ativo: o
  // lote avança de etapa normalmente, mas a pessoa precisa ficar sabendo
  // que ninguém recebeu o arquivo por e-mail — não fica só em silêncio.
  if (!gmailUser || !gmailSenhaApp || destinatarios.length === 0) {
    return {
      enviado: false,
      erro: "o envio automático de e-mail ainda não está configurado (Configurações > E-mail).",
    };
  }

  const dadosModelo = { nf_remessa: nfRemessa, quantidade };
  const assunto = preencherModeloEmail(config?.assunto_padrao ?? "Orçamento(s) - NF Remessa {{nf_remessa}}", dadosModelo);
  const corpoTexto = preencherModeloEmail(
    config?.corpo_padrao ?? "Segue em anexo a planilha com o(s) orçamento(s) referente(s) à NF Remessa {{nf_remessa}}.",
    dadosModelo
  );
  const corpoHtml = corpoTexto
    .split("\n")
    .map((linha) => `<p>${linha}</p>`)
    .join("");

  try {
    const planilha = montarPlanilhaOrcamentos(linhasPlanilha);
    const resultado = await enviarEmailGmail({
      gmailUser,
      gmailSenhaApp,
      remetenteNome: config?.remetente_nome ?? "Sistema Allied - Grupo J.Macedo",
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
      // coluna criada pensando no Resend — guarda o messageId do Gmail
      // por enquanto, mesma ideia (id pra rastrear esse envio específico).
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
