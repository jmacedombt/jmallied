"use client";

import { useState } from "react";
import { X } from "lucide-react";

/**
 * Pop-up da tela de login pra "Esqueci minha senha" — a pessoa não está
 * autenticada, então não dá pra trocar a senha sozinha aqui: só registra
 * o pedido (POST /api/auth/solicitar-reset-senha) pra um administrador
 * ver na tela Usuários e resetar manualmente (mesmo fluxo que já existe
 * lá, "Resetar senha"/"Reenviar acesso").
 *
 * A resposta da API é sempre a mesma mensagem de sucesso, ache ou não o
 * usuário digitado — evita confirmar pra quem não está logado quais
 * logins existem no sistema.
 */
export default function PopupSolicitarResetSenha({ onFechar }: { onFechar: () => void }) {
  const [usuario, setUsuario] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!usuario.trim()) return;
    setEnviando(true);
    setErro(null);

    try {
      await fetch("/api/auth/solicitar-reset-senha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario: usuario.trim() }),
      });
      setEnviado(true);
    } catch {
      setErro("Falha de conexão. Tente novamente.");
    }
    setEnviando(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={onFechar}>
      <div
        className="w-full max-w-sm rounded-2xl border border-allied-border bg-allied-panel/95 backdrop-blur-sm shadow-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-1.5">
          <h2 className="text-base font-semibold text-white">Esqueci minha senha</h2>
          <button
            type="button"
            onClick={onFechar}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-allied-silver/60 hover:text-white transition"
            aria-label="Fechar"
          >
            <X size={16} />
          </button>
        </div>

        {enviado ? (
          <>
            <p className="text-sm text-allied-silver/70 mt-3 mb-6">
              Se esse login existir no sistema, avisamos o administrador agora — aguarde ele entrar em contato com
              uma nova senha.
            </p>
            <button
              type="button"
              onClick={onFechar}
              className="w-full rounded-lg bg-allied-accent hover:bg-allied-accent2 text-white font-medium text-sm py-3 transition"
            >
              Entendi
            </button>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <p className="text-sm text-allied-silver/60 mb-4">
              Informe seu login. Vamos avisar o administrador do sistema pra resetar sua senha.
            </p>

            <label htmlFor="usuarioReset" className="text-xs font-medium uppercase tracking-wide text-allied-silver/70">
              Login
            </label>
            <input
              id="usuarioReset"
              type="text"
              autoComplete="username"
              required
              placeholder="nome.sobrenome"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              className="w-full mt-1.5 rounded-lg bg-allied-panel2 border border-allied-border px-4 py-3 text-sm text-allied-silver placeholder:text-allied-silver/40 outline-none focus:border-allied-accent2 focus:ring-1 focus:ring-allied-accent2 transition"
            />

            {erro && (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mt-4">
                {erro}
              </p>
            )}

            <button
              type="submit"
              disabled={enviando}
              className="w-full mt-5 rounded-lg bg-allied-accent hover:bg-allied-accent2 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium text-sm py-3 transition"
            >
              {enviando ? "Enviando..." : "Solicitar reset"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
