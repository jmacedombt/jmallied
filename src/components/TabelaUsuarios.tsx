"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Lock, Pencil, Unlock } from "lucide-react";
import PopupEditarUsuario, { type UsuarioEditavel } from "@/components/PopupEditarUsuario";
import PopupConfirmar from "@/components/PopupConfirmar";
import PopupNovoUsuario from "@/components/PopupNovoUsuario";

export type LinhaUsuario = {
  id: string;
  nome: string;
  sobrenome: string;
  usuario: string;
  email: string;
  telefone: string | null;
  cargo: string;
  is_master: boolean;
  must_change_password: boolean;
  bloqueado_em: string | null;
};

type Confirmacao =
  | { tipo: "bloquear"; alvo: LinhaUsuario }
  | { tipo: "desbloquear"; alvo: LinhaUsuario }
  | { tipo: "resetar-senha"; alvo: LinhaUsuario };

export default function TabelaUsuarios({
  usuarios,
  podeGerenciar,
  souMaster,
  meuId,
}: {
  usuarios: LinhaUsuario[];
  podeGerenciar: boolean;
  souMaster: boolean;
  meuId: string;
}) {
  const router = useRouter();

  const [editando, setEditando] = useState<LinhaUsuario | null>(null);
  const [confirmacao, setConfirmacao] = useState<Confirmacao | null>(null);
  const [erroConfirmacao, setErroConfirmacao] = useState<string | null>(null);
  const [processando, setProcessando] = useState(false);
  const [credenciaisResetadas, setCredenciaisResetadas] = useState<{ usuario: string; senha: string } | null>(null);

  function podeAgirSobre(alvo: LinhaUsuario) {
    if (!podeGerenciar) return false;
    if (alvo.is_master && !souMaster) return false;
    return true;
  }

  async function executarConfirmacao() {
    if (!confirmacao) return;
    setProcessando(true);
    setErroConfirmacao(null);

    try {
      if (confirmacao.tipo === "resetar-senha") {
        const res = await fetch(`/api/usuarios/${confirmacao.alvo.id}/resetar-senha`, { method: "POST" });
        const data = await res.json();
        if (!res.ok) {
          setErroConfirmacao(data.error || "Não foi possível resetar a senha.");
          setProcessando(false);
          return;
        }
        setConfirmacao(null);
        setCredenciaisResetadas({ usuario: data.usuario, senha: data.senhaTemporaria });
        router.refresh();
      } else {
        const bloquear = confirmacao.tipo === "bloquear";
        const res = await fetch(`/api/usuarios/${confirmacao.alvo.id}/bloquear`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bloquear }),
        });
        const data = await res.json();
        if (!res.ok) {
          setErroConfirmacao(data.error || "Não foi possível concluir.");
          setProcessando(false);
          return;
        }
        setConfirmacao(null);
        router.refresh();
      }
    } catch {
      setErroConfirmacao("Falha de conexão. Tente novamente.");
    }
    setProcessando(false);
  }

  return (
    <>
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--line)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left" style={{ background: "var(--surface2)", color: "var(--muted)" }}>
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium">Usuário</th>
              <th className="px-4 py-3 font-medium">Cargo</th>
              <th className="px-4 py-3 font-medium">E-mail</th>
              <th className="px-4 py-3 font-medium">Telefone</th>
              <th className="px-4 py-3 font-medium">Status</th>
              {podeGerenciar && <th className="px-4 py-3 font-medium">Ações</th>}
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id} className="border-t" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
                <td className="px-4 py-3" style={{ color: "var(--ink)" }}>
                  {u.nome} {u.sobrenome}
                  {u.id === meuId && (
                    <span className="ml-1.5 text-[11px]" style={{ color: "var(--muted)" }}>
                      (você)
                    </span>
                  )}
                </td>
                <td className="px-4 py-3" style={{ color: "var(--muted)" }}>
                  {u.usuario}
                </td>
                <td className="px-4 py-3" style={{ color: "var(--muted)" }}>
                  {u.is_master ? "Administrador" : u.cargo}
                </td>
                <td className="px-4 py-3" style={{ color: "var(--muted)" }}>
                  {u.email}
                </td>
                <td className="px-4 py-3" style={{ color: "var(--muted)" }}>
                  {u.telefone || "—"}
                </td>
                <td className="px-4 py-3">
                  {u.bloqueado_em ? (
                    <span className="text-red-400 text-xs">Bloqueado</span>
                  ) : u.must_change_password ? (
                    <span className="text-amber-500 text-xs">Aguardando 1º acesso</span>
                  ) : (
                    <span className="text-emerald-500 text-xs">Ativo</span>
                  )}
                </td>
                {podeGerenciar && (
                  <td className="px-4 py-3">
                    {podeAgirSobre(u) ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          title="Editar cadastro"
                          onClick={() => setEditando(u)}
                          className="w-7 h-7 flex items-center justify-center rounded hover:bg-black/10"
                          style={{ color: "var(--muted)" }}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          title="Resetar senha"
                          onClick={() => setConfirmacao({ tipo: "resetar-senha", alvo: u })}
                          className="w-7 h-7 flex items-center justify-center rounded hover:bg-black/10"
                          style={{ color: "var(--muted)" }}
                        >
                          <KeyRound size={14} />
                        </button>
                        {u.id !== meuId && (
                          <button
                            type="button"
                            title={u.bloqueado_em ? "Desbloquear" : "Bloquear"}
                            onClick={() =>
                              setConfirmacao({ tipo: u.bloqueado_em ? "desbloquear" : "bloquear", alvo: u })
                            }
                            className="w-7 h-7 flex items-center justify-center rounded hover:bg-black/10"
                            style={{ color: u.bloqueado_em ? "#22c55e" : "#ef4444" }}
                          >
                            {u.bloqueado_em ? <Unlock size={14} /> : <Lock size={14} />}
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="text-[11px]" style={{ color: "var(--muted)" }}>
                        —
                      </span>
                    )}
                  </td>
                )}
              </tr>
            ))}

            {usuarios.length === 0 && (
              <tr>
                <td
                  colSpan={podeGerenciar ? 7 : 6}
                  className="px-4 py-8 text-center"
                  style={{ color: "var(--muted)", background: "var(--surface)" }}
                >
                  Nenhum usuário cadastrado ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editando && (
        <PopupEditarUsuario
          usuario={editando as UsuarioEditavel}
          aoFechar={() => setEditando(null)}
          aoSalvar={() => {
            setEditando(null);
            router.refresh();
          }}
        />
      )}

      {confirmacao && (
        <PopupConfirmar
          titulo={
            confirmacao.tipo === "bloquear"
              ? "Bloquear usuário"
              : confirmacao.tipo === "desbloquear"
                ? "Desbloquear usuário"
                : "Resetar senha"
          }
          perigo={confirmacao.tipo === "bloquear"}
          carregando={processando}
          erro={erroConfirmacao}
          mensagem={
            confirmacao.tipo === "bloquear" ? (
              <>
                <strong style={{ color: "var(--ink)" }}>
                  {confirmacao.alvo.nome} {confirmacao.alvo.sobrenome}
                </strong>{" "}
                não vai mais conseguir entrar no sistema. O cadastro e o histórico continuam intactos, e dá pra
                desbloquear a qualquer momento.
              </>
            ) : confirmacao.tipo === "desbloquear" ? (
              <>
                <strong style={{ color: "var(--ink)" }}>
                  {confirmacao.alvo.nome} {confirmacao.alvo.sobrenome}
                </strong>{" "}
                vai poder entrar no sistema normalmente de novo.
              </>
            ) : (
              <>
                A senha de{" "}
                <strong style={{ color: "var(--ink)" }}>
                  {confirmacao.alvo.nome} {confirmacao.alvo.sobrenome}
                </strong>{" "}
                volta para a senha padrão, e a troca vai ser obrigatória no próximo acesso.
              </>
            )
          }
          rotuloConfirmar={
            confirmacao.tipo === "bloquear" ? "Bloquear" : confirmacao.tipo === "desbloquear" ? "Desbloquear" : "Resetar"
          }
          onConfirmar={executarConfirmacao}
          onFechar={() => {
            setConfirmacao(null);
            setErroConfirmacao(null);
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
