"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Plus, Save, Trash2, ToggleLeft, ToggleRight } from "lucide-react";

export type ConfiguracaoEmailInicial = {
  remetente_nome: string;
  remetente_email: string | null;
  assunto_padrao: string;
  corpo_padrao: string;
};

export type DestinatarioLinha = {
  id: string;
  email: string;
  nome: string | null;
  ativo: boolean;
};

const CAMPO_CLASSES =
  "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--accent2)] focus:ring-1 focus:ring-[var(--accent2)] transition";
const CAMPO_ESTILO = { borderColor: "var(--line)", background: "var(--surface2)", color: "var(--ink)" };

export default function ConfiguracoesEmailForm({
  configInicial,
  destinatariosIniciais,
  contaGmailAtual,
}: {
  configInicial: ConfiguracaoEmailInicial;
  destinatariosIniciais: DestinatarioLinha[];
  /** conta do Gmail configurada via GMAIL_USER na Vercel — é ela que
   * efetivamente envia (o Gmail não aceita um "de" diferente da conta
   * autenticada); null quando a variável ainda não foi configurada. */
  contaGmailAtual: string | null;
}) {
  const router = useRouter();

  const [remetenteNome, setRemetenteNome] = useState(configInicial.remetente_nome);
  const [remetenteEmail, setRemetenteEmail] = useState(configInicial.remetente_email ?? "");
  const [assuntoPadrao, setAssuntoPadrao] = useState(configInicial.assunto_padrao);
  const [corpoPadrao, setCorpoPadrao] = useState(configInicial.corpo_padrao);
  const [salvandoConfig, setSalvandoConfig] = useState(false);
  const [erroConfig, setErroConfig] = useState<string | null>(null);
  const [salvoConfig, setSalvoConfig] = useState(false);

  const [destinatarios, setDestinatarios] = useState(destinatariosIniciais);
  const [novoEmail, setNovoEmail] = useState("");
  const [novoNome, setNovoNome] = useState("");
  const [adicionando, setAdicionando] = useState(false);
  const [alterandoId, setAlterandoId] = useState<string | null>(null);
  const [erroDestinatario, setErroDestinatario] = useState<string | null>(null);

  async function salvarConfig() {
    setSalvandoConfig(true);
    setErroConfig(null);
    setSalvoConfig(false);
    try {
      const res = await fetch("/api/configuracoes/email", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          remetente_nome: remetenteNome,
          remetente_email: remetenteEmail,
          assunto_padrao: assuntoPadrao,
          corpo_padrao: corpoPadrao,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErroConfig(data.error || "Não foi possível salvar.");
      } else {
        setSalvoConfig(true);
        setTimeout(() => setSalvoConfig(false), 2500);
        router.refresh();
      }
    } catch {
      setErroConfig("Falha de conexão. Tente novamente.");
    }
    setSalvandoConfig(false);
  }

  async function adicionarDestinatario() {
    setAdicionando(true);
    setErroDestinatario(null);
    try {
      const res = await fetch("/api/configuracoes/email/destinatarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: novoEmail.trim(), nome: novoNome.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErroDestinatario(data.error || "Não foi possível adicionar.");
      } else {
        setDestinatarios((d) => [...d, data]);
        setNovoEmail("");
        setNovoNome("");
        router.refresh();
      }
    } catch {
      setErroDestinatario("Falha de conexão. Tente novamente.");
    }
    setAdicionando(false);
  }

  async function alternarAtivo(id: string, ativoAtual: boolean) {
    setAlterandoId(id);
    setErroDestinatario(null);
    try {
      const res = await fetch(`/api/configuracoes/email/destinatarios/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ativo: !ativoAtual }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErroDestinatario(data.error || "Não foi possível atualizar.");
      } else {
        setDestinatarios((d) => d.map((x) => (x.id === id ? data : x)));
        router.refresh();
      }
    } catch {
      setErroDestinatario("Falha de conexão. Tente novamente.");
    }
    setAlterandoId(null);
  }

  async function excluirDestinatario(id: string) {
    setAlterandoId(id);
    setErroDestinatario(null);
    try {
      const res = await fetch(`/api/configuracoes/email/destinatarios/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setErroDestinatario(data.error || "Não foi possível excluir.");
      } else {
        setDestinatarios((d) => d.filter((x) => x.id !== id));
        router.refresh();
      }
    } catch {
      setErroDestinatario("Falha de conexão. Tente novamente.");
    }
    setAlterandoId(null);
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <div className="rounded-xl border p-5" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
        <h2 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: "var(--ink)" }}>
          <Mail size={16} style={{ color: "var(--accent2)" }} />
          Remetente e texto padrão
        </h2>

        <div
          className="rounded-lg px-3.5 py-2.5 text-xs mb-3.5"
          style={
            contaGmailAtual
              ? { background: "rgba(34, 197, 94, 0.1)", color: "#16a34a" }
              : { background: "rgba(249, 168, 37, 0.15)", color: "#b45309" }
          }
        >
          {contaGmailAtual ? (
            <>
              O envio está saindo pela conta <strong>{contaGmailAtual}</strong> (Gmail — configurada na Vercel via
              GMAIL_USER). O campo "E-mail do remetente" abaixo é só um registro, não muda de onde o e-mail sai —
              pra trocar a conta que envia, é preciso alterar GMAIL_USER/GMAIL_APP_PASSWORD na Vercel.
            </>
          ) : (
            <>
              Nenhuma conta de envio configurada ainda — falta definir GMAIL_USER e GMAIL_APP_PASSWORD nas variáveis
              de ambiente da Vercel. Até lá, o lote avança normalmente, mas o e-mail não é enviado.
            </>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3.5 mb-3.5">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--ink)" }}>
              Nome do remetente
            </label>
            <input value={remetenteNome} onChange={(e) => setRemetenteNome(e.target.value)} className={CAMPO_CLASSES} style={CAMPO_ESTILO} />
            <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
              Como o nome aparece pro destinatário (ex: "Sistema Allied - Grupo J.Macedo").
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--ink)" }}>
              E-mail do remetente (registro)
            </label>
            <input
              value={remetenteEmail}
              onChange={(e) => setRemetenteEmail(e.target.value)}
              placeholder="naoresponda@jmacedo.com.br"
              className={CAMPO_CLASSES}
              style={CAMPO_ESTILO}
            />
            <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
              Não usado no envio pelo Gmail — fica só de referência pra quando trocar pro domínio próprio.
            </p>
          </div>
        </div>

        <div className="mb-3.5">
          <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--ink)" }}>
            Assunto padrão
          </label>
          <input value={assuntoPadrao} onChange={(e) => setAssuntoPadrao(e.target.value)} className={CAMPO_CLASSES} style={CAMPO_ESTILO} />
        </div>

        <div className="mb-1">
          <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--ink)" }}>
            Corpo padrão
          </label>
          <textarea
            value={corpoPadrao}
            onChange={(e) => setCorpoPadrao(e.target.value)}
            rows={4}
            className={CAMPO_CLASSES}
            style={CAMPO_ESTILO}
          />
        </div>
        <p className="text-xs mb-4" style={{ color: "var(--muted)" }}>
          Pode usar <code>{"{{nf_remessa}}"}</code> e <code>{"{{quantidade}}"}</code> no assunto/corpo — são
          substituídos pelos dados do lote na hora do envio.
        </p>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={salvarConfig}
            disabled={salvandoConfig}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition disabled:opacity-60"
            style={{ background: "var(--accent)" }}
          >
            <Save size={14} />
            {salvandoConfig ? "Salvando..." : "Salvar"}
          </button>
          {salvoConfig && (
            <span className="text-xs font-medium" style={{ color: "#16a34a" }}>
              Salvo!
            </span>
          )}
        </div>
        {erroConfig && (
          <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mt-3">{erroConfig}</p>
        )}
      </div>

      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--line)" }}>
        <div className="px-5 py-4 border-b" style={{ borderColor: "var(--line)" }}>
          <h2 className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
            Destinatários
          </h2>
          <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
            Toda vez que "Confirmar Envio" for concluído em Validação de Orçamentos, o e-mail vai pra todos os
            destinatários marcados como ativos abaixo.
          </p>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="text-left" style={{ background: "var(--surface2)", color: "var(--muted)" }}>
              <th className="px-4 py-2.5 font-medium">E-mail</th>
              <th className="px-4 py-2.5 font-medium">Nome</th>
              <th className="px-4 py-2.5 font-medium w-20">Ativo</th>
              <th className="px-4 py-2.5 font-medium w-14"></th>
            </tr>
          </thead>
          <tbody>
            {destinatarios.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-sm" style={{ color: "var(--muted)" }}>
                  Nenhum destinatário cadastrado ainda.
                </td>
              </tr>
            )}
            {destinatarios.map((d) => (
              <tr key={d.id} className="border-t" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
                <td className="px-4 py-2.5" style={{ color: "var(--ink)" }}>
                  {d.email}
                </td>
                <td className="px-4 py-2.5" style={{ color: "var(--muted)" }}>
                  {d.nome ?? "—"}
                </td>
                <td className="px-4 py-2.5">
                  <button
                    type="button"
                    onClick={() => alternarAtivo(d.id, d.ativo)}
                    disabled={alterandoId === d.id}
                    title={d.ativo ? "Ativo — clique pra pausar" : "Pausado — clique pra ativar"}
                    className="disabled:opacity-50"
                    style={{ color: d.ativo ? "#16a34a" : "var(--muted)" }}
                  >
                    {d.ativo ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                  </button>
                </td>
                <td className="px-4 py-2.5">
                  <button
                    type="button"
                    title="Excluir"
                    disabled={alterandoId === d.id}
                    onClick={() => excluirDestinatario(d.id)}
                    className="w-7 h-7 flex items-center justify-center rounded hover:bg-red-500/10 shrink-0 disabled:opacity-50 text-red-400"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="p-4 border-t flex items-end gap-3 flex-wrap" style={{ borderColor: "var(--line)" }}>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--ink)" }}>
              E-mail
            </label>
            <input
              value={novoEmail}
              onChange={(e) => setNovoEmail(e.target.value)}
              placeholder="cliente@dominio.com.br"
              className="w-56 rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--accent2)] transition"
              style={CAMPO_ESTILO}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--ink)" }}>
              Nome (opcional)
            </label>
            <input
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              placeholder="Ex: Financeiro"
              className="w-48 rounded-lg border px-3 py-2 text-sm outline-none focus:border-[var(--accent2)] transition"
              style={CAMPO_ESTILO}
            />
          </div>
          <button
            type="button"
            onClick={adicionarDestinatario}
            disabled={adicionando || !novoEmail.trim()}
            className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm transition hover:border-[var(--accent2)] disabled:opacity-50"
            style={{ borderColor: "var(--line)", color: "var(--ink)" }}
          >
            <Plus size={15} />
            {adicionando ? "Adicionando..." : "Adicionar"}
          </button>
        </div>
        {erroDestinatario && (
          <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mx-4 mb-4">
            {erroDestinatario}
          </p>
        )}
      </div>
    </div>
  );
}
