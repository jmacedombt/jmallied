import { createAdminClient } from "@/lib/supabase/server";
import { enviarEmailGmail, montarPlanilhaOrcamentos, preencherModeloEmail, type LinhaPlanilhaOrcamento } from "@/lib/email";

/**
 * Persiste (storage + orcamento_envios) e manda por e-mail o Excel de um
 * lote confirmado — usado por "Confirmar Envio" (Validação de
 * Orçamentos), "Enviar Contra Proposta" (Ag. Contra Proposta) e "Enviar
 * planilha Complementar" (4 - Ag. Resposta de Reorçamento). Antes disso
 * o arquivo só era gerado na hora pro e-mail e descartado — agora fica
 * salvo (bucket envios-orcamentos) pra dar pra baixar de novo depois
 * pelo botão Histórico. Uma falha de e-mail NUNCA impede o envio de
 * ficar registrado/salvo — só fica marcada em orcamento_envios pra dar
 * pra conferir depois.
 */

type AdminClient = ReturnType<typeof createAdminClient>;

export async function persistirEEnviarLote({
  admin,
  tipo,
  nfRemessa,
  quantidade,
  linhasPlanilha,
  userId,
  nomeArquivoPrefixo,
}: {
  admin: AdminClient;
  tipo: "orcamento" | "contra_proposta" | "reorcamento";
  /** identificador do envio — normalmente uma NF Remessa só, mas a
   * planilha Complementar (Reorçamento) junta vários lotes de uma vez,
   * então aqui pode vir uma lista tipo "1867459, 1877204"; só entra
   * como texto (coluna nf_remessa_allied do histórico e placeholder do
   * e-mail) — o caminho do arquivo no storage é sempre sanitizado, pra
   * nunca quebrar por causa de vírgula/espaço. */
  nfRemessa: string;
  quantidade: number;
  linhasPlanilha: LinhaPlanilhaOrcamento[];
  userId: string;
  nomeArquivoPrefixo: string;
}): Promise<{ enviado: boolean; erro?: string }> {
  const planilha = montarPlanilhaOrcamentos(linhasPlanilha);
  const nfRemessaArquivo = nfRemessa.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const nomeArquivo = `${nomeArquivoPrefixo}-${nfRemessaArquivo}.xlsx`;
  const caminhoArquivo = `${tipo}/${nfRemessaArquivo}/${Date.now()}-${nomeArquivo}`;

  const { error: erroUpload } = await admin.storage.from("envios-orcamentos").upload(caminhoArquivo, planilha, {
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    upsert: true,
  });

  // envio automático de e-mail (planilha em anexo) — via conta do Gmail
  // da empresa (GMAIL_USER + GMAIL_APP_PASSWORD na Vercel), mesmo esquema
  // já usado em avancar-validacao-em-massa.
  const gmailUser = process.env.GMAIL_USER;
  const gmailSenhaApp = process.env.GMAIL_APP_PASSWORD;

  const [{ data: config }, { data: destinatariosBrutos }] = await Promise.all([
    admin.from("configuracoes_email").select("remetente_nome, remetente_email, assunto_padrao, corpo_padrao").eq("id", 1).single(),
    admin.from("configuracoes_email_destinatarios").select("email").eq("ativo", true),
  ]);
  const destinatarios = (destinatariosBrutos ?? []).map((d: { email: string }) => d.email);

  let resultado: { enviado: boolean; erro?: string };

  if (!gmailUser || !gmailSenhaApp || destinatarios.length === 0) {
    resultado = { enviado: false, erro: "o envio automático de e-mail ainda não está configurado (Configurações > E-mail)." };
  } else {
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
      const envio = await enviarEmailGmail({
        gmailUser,
        gmailSenhaApp,
        remetenteNome: config?.remetente_nome ?? "Sistema Allied - Grupo J.Macedo",
        destinatarios,
        assunto,
        corpoHtml,
        anexoNomeArquivo: nomeArquivo,
        anexoBuffer: planilha,
      });

      await admin.from("envios_email").insert({
        nf_remessa_allied: nfRemessa,
        destinatarios,
        assunto,
        status: "enviado",
        resend_id: envio.id,
        enviado_por: userId,
      });

      resultado = { enviado: true };
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
      resultado = { enviado: false, erro: mensagem };
    }
  }

  await admin.from("orcamento_envios").insert({
    tipo,
    nf_remessa_allied: nfRemessa,
    quantidade_aparelhos: quantidade,
    arquivo_path: erroUpload ? null : caminhoArquivo,
    enviado_por: userId,
    email_enviado: resultado.enviado,
    email_erro: resultado.erro ?? null,
  });

  return resultado;
}
