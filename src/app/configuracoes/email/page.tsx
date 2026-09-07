import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import ConfiguracoesEmailForm, { type ConfiguracaoEmailInicial, type DestinatarioLinha } from "@/components/ConfiguracoesEmailForm";

export default async function ConfiguracoesEmailPage() {
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

  const [{ data: config }, { data: destinatarios }] = await Promise.all([
    supabase.from("configuracoes_email").select("remetente_nome, remetente_email, assunto_padrao, corpo_padrao").eq("id", 1).single(),
    supabase
      .from("configuracoes_email_destinatarios")
      .select("id, email, nome, ativo")
      .order("criado_em", { ascending: true })
      .returns<DestinatarioLinha[]>(),
  ]);

  const configInicial: ConfiguracaoEmailInicial = {
    remetente_nome: config?.remetente_nome ?? "Sistema Allied - Grupo J.Macedo",
    remetente_email: config?.remetente_email ?? null,
    assunto_padrao: config?.assunto_padrao ?? "Orçamento(s) - NF Remessa {{nf_remessa}}",
    corpo_padrao:
      config?.corpo_padrao ??
      "Segue em anexo a planilha com o(s) orçamento(s) referente(s) à NF Remessa {{nf_remessa}} ({{quantidade}} aparelho(s)).",
  };

  return (
    <AppShell
      titulo="E-mail"
      tituloInfo="Configura o envio automático de e-mail (com planilha em anexo) disparado ao confirmar o envio de um lote em Validação de Orçamentos."
      perfil={perfil}
    >
      <h1 className="text-xl font-semibold mb-1" style={{ color: "var(--ink)" }}>
        Envio automático de e-mail
      </h1>
      <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>
        Disparado ao confirmar o envio de um lote em Validação de Orçamentos — manda a planilha do lote em anexo pros
        destinatários abaixo.
      </p>
      <ConfiguracoesEmailForm
        configInicial={configInicial}
        destinatariosIniciais={destinatarios ?? []}
        contaGmailAtual={process.env.GMAIL_USER ?? null}
      />
    </AppShell>
  );
}
