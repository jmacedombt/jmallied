"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";
import PopupConfirmar from "@/components/PopupConfirmar";
import PopupNovoUsuario from "@/components/PopupNovoUsuario";
import { formatarDataHoraBrasilia } from "@/lib/tempo";

export type SolicitacaoResetSenhaLinha = {
  id: string;
  usuario_id: string;
  nome: string;
  sobrenome: string;
  usuario: string;
  criado_em: string;
};

/**
 * Pedidos de "esqueci minha senha" pendentes (feitos na tela de login,
 * sem autenticação) — só aparece pra quem pode gerenciar usuários
 * (ver usuarios/page.tsx). "Resetar senha" aqui é o mesmo endpoint que
 * TabelaUsuarios já usa — ao confirmar, o pedido é marcado atendida
 * automaticamente do lado do servidor.
 */
export default function PainelSolicitacoesResetSenha({ solicitacoes }: { solicitacoes: SolicitacaoResetSenhaLinha[] }) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState<SolicitacaoResetSenhaLinha | null>(null);
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [credenciaisResetadas, setCredenciaisResetadas] = useState<{ usuario: string; senha: string } | null>(null);

  if (solicitacoes.length === 0) return null;

  async function resetarSenha() {
    if (!confirmando) return;
    setProcessando(true);
    setErro(null);

    try {
      const res = await fetch(`/api/usuarios/${confirmando.usuario_id}/resetar-senha`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error || "Não foi possível resetar a senha.");
        setProcessando(false);
        return;
      }
      setConfirmando(null);
      setCredenciaisResetadas({ usuario: data.usuario, senha: data.senhaTemporaria });
      router.refresh();
    } catch {
      setErro("Falha de conexão. Tente novamente.");
    }
    setProcessando(false);
  }

  return (
    <>
      <div
        className="rounded-xl border overflow-hidden mb-6"
        style={{ borderColor: "#f59e0b", background: "rgba(245, 158, 11, 0.08)" }}
      >
        <div className="px-4 py-3 border-b" style={{ borderColor: "rgba(245, 158, 11, 0.3)" }}>
          <p className="text-sm font-semibold flex items-center gap-2" style={{ color: "var(--ink)" }}>
            <KeyRound size={15} style={{ color: "#f59e0b" }} />
            {solicitacoes.length} pedido(s) de reset de senha pendente(s)
          </p>
        </div>
        <div className="divide-y" style={{ borderColor: "rgba(245, 158, 11, 0.2)" }}>
          {solicitacoes.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <div>
                <span className="text-sm font-medium" style={{ color: "var(--ink)" }}>
                  {s.nome} {s.sobrenome}
                </span>
                <span className="text-xs ml-1.5" style={{ color: "var(--muted)" }}>
                  ({s.usuario}) · pedido em {formatarDataHoraBrasilia(s.criado_em)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setConfirmando(s)}
                className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition hover:border-[var(--accent2)] shrink-0"
                style={{ borderColor: "var(--line)", color: "var(--ink)" }}
              >
                <KeyRound size={13} />
                Resetar senha
              </button>
            </div>
          ))}
        </div>
      </div>

      {confirmando && (
        <PopupConfirmar
          titulo="Resetar senha"
          mensagem={
            <>
              A senha de{" "}
              <strong style={{ color: "var(--ink)" }}>
                {confirmando.nome} {confirmando.sobrenome}
              </strong>{" "}
              volta para a senha padrão, e a troca vai ser obrigatória no próximo acesso. O pedido some dessa lista.
            </>
          }
          rotuloConfirmar="Resetar"
          carregando={processando}
          erro={erro}
          onConfirmar={resetarSenha}
          onFechar={() => {
            if (processando) return;
            setConfirmando(null);
            setErro(null);
          }}
        />
      )}

      {credenciaisResetadas && (
        <PopupNovoUsuario
          usuario={credenciaisResetadas.usuario}
          senha={credenciaisResetadas.senha}
          aoFechar={() => setCredenciaisResetadas(null)}
        />
      )}
    </>
  );
}
