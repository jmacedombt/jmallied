"use client";

import { useState } from "react";
import { Pencil, X } from "lucide-react";
import { CARGOS } from "@/lib/auth";

export type UsuarioEditavel = {
  id: string;
  nome: string;
  sobrenome: string;
  usuario: string;
  email: string;
  telefone: string | null;
  cargo: string;
  is_master: boolean;
};

// Popup de edição do cadastro de um usuário já existente — mesmos
// campos do cadastro (UserForm), só que preenchidos e enviando PUT em
// vez de POST. Fica escondido no menu Usuários pra quem tem cargo
// Gerente, Diretor ou Administrador (checado antes de abrir).
export default function PopupEditarUsuario({
  usuario,
  aoSalvar,
  aoFechar,
}: {
  usuario: UsuarioEditavel;
  aoSalvar: (atualizado: UsuarioEditavel) => void;
  aoFechar: () => void;
}) {
  const [nome, setNome] = useState(usuario.nome);
  const [sobrenome, setSobrenome] = useState(usuario.sobrenome);
  const [login, setLogin] = useState(usuario.usuario);
  const [email, setEmail] = useState(usuario.email);
  const [telefone, setTelefone] = useState(usuario.telefone ?? "");
  const [cargo, setCargo] = useState(usuario.cargo);

  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSalvando(true);

    const res = await fetch(`/api/usuarios/${usuario.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, sobrenome, usuario: login, email, telefone, cargo }),
    });
    const data = await res.json();
    setSalvando(false);

    if (!res.ok) {
      setErro(data.error || "Não foi possível salvar as alterações.");
      return;
    }

    aoSalvar({ ...usuario, nome, sobrenome, usuario: login, email, telefone, cargo });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.55)" }}>
      <div
        className="w-full max-w-lg rounded-2xl border shadow-2xl p-6"
        style={{ background: "var(--surface)", borderColor: "var(--line)" }}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold flex items-center gap-2" style={{ color: "var(--ink)" }}>
            <Pencil size={17} style={{ color: "var(--accent2)" }} />
            Editar usuário
          </h2>
          <button
            type="button"
            onClick={aoFechar}
            aria-label="Fechar"
            className="w-7 h-7 flex items-center justify-center rounded-md transition hover:bg-[var(--surface2)]"
            style={{ color: "var(--muted)" }}
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={salvar} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <Campo label="Nome">
              <input required value={nome} onChange={(e) => setNome(e.target.value)} className={inputClass} />
            </Campo>
            <Campo label="Sobrenome">
              <input
                required
                value={sobrenome}
                onChange={(e) => setSobrenome(e.target.value)}
                className={inputClass}
              />
            </Campo>
          </div>

          <Campo label="Usuário (login)" hint="Muda também o acesso ao sistema — avise a pessoa se alterar.">
            <input required value={login} onChange={(e) => setLogin(e.target.value)} className={inputClass} />
          </Campo>

          <div className="grid sm:grid-cols-2 gap-4">
            <Campo label="E-mail">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />
            </Campo>
            <Campo label="Telefone">
              <input value={telefone} onChange={(e) => setTelefone(e.target.value)} className={inputClass} />
            </Campo>
          </div>

          <Campo label="Cargo">
            <select required value={cargo} onChange={(e) => setCargo(e.target.value)} className={inputClass}>
              {CARGOS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Campo>

          {erro && (
            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
              {erro}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={aoFechar}
              disabled={salvando}
              className="rounded-lg px-4 py-2.5 text-sm font-medium transition hover:bg-[var(--surface2)] disabled:opacity-60"
              style={{ color: "var(--muted)" }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando}
              className="rounded-lg bg-[var(--accent)] hover:bg-[var(--accent2)] disabled:opacity-60 text-white text-sm font-medium px-5 py-2.5 transition"
              style={{ boxShadow: "0 0 30px var(--accent-glow)" }}
            >
              {salvando ? "Salvando..." : "Salvar alterações"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border px-4 py-2.5 text-sm outline-none focus:border-[var(--accent2)] focus:ring-1 focus:ring-[var(--accent2)] transition bg-[var(--surface2)] border-[var(--line)] text-[var(--ink)] placeholder:text-[var(--muted)]";

function Campo({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--muted)" }}>
        {label}
      </label>
      {children}
      {hint && (
        <p className="text-[11px]" style={{ color: "var(--muted)" }}>
          {hint}
        </p>
      )}
    </div>
  );
}
