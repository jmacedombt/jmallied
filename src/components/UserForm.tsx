"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CARGOS, gerarUsuario } from "@/lib/auth";
import PopupNovoUsuario from "@/components/PopupNovoUsuario";

export default function UserForm() {
  const router = useRouter();

  const [nome, setNome] = useState("");
  const [sobrenome, setSobrenome] = useState("");
  const [usuario, setUsuario] = useState("");
  const [usuarioEditadoManualmente, setUsuarioEditadoManualmente] = useState(false);
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cargo, setCargo] = useState("");

  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<{ usuario: string; senha: string } | null>(null);
  const [carregando, setCarregando] = useState(false);

  function atualizarNome(v: string) {
    setNome(v);
    if (!usuarioEditadoManualmente) setUsuario(gerarUsuario(v, sobrenome));
  }

  function atualizarSobrenome(v: string) {
    setSobrenome(v);
    if (!usuarioEditadoManualmente) setUsuario(gerarUsuario(nome, v));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setSucesso(null);
    setCarregando(true);

    const res = await fetch("/api/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, sobrenome, usuario, email, telefone, cargo }),
    });

    const data = await res.json();
    setCarregando(false);

    if (!res.ok) {
      setErro(data.error || "Não foi possível cadastrar o usuário.");
      return;
    }

    setSucesso({ usuario: data.usuario, senha: data.senhaTemporaria });
    setNome("");
    setSobrenome("");
    setUsuario("");
    setUsuarioEditadoManualmente(false);
    setEmail("");
    setTelefone("");
    setCargo("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-lg">
      <div className="grid sm:grid-cols-2 gap-4">
        <Campo label="Nome" htmlFor="nome">
          <input
            id="nome"
            required
            value={nome}
            onChange={(e) => atualizarNome(e.target.value)}
            className={inputClass}
          />
        </Campo>

        <Campo label="Sobrenome" htmlFor="sobrenome">
          <input
            id="sobrenome"
            required
            value={sobrenome}
            onChange={(e) => atualizarSobrenome(e.target.value)}
            className={inputClass}
          />
        </Campo>
      </div>

      <Campo label="Usuário (login)" htmlFor="usuario" hint="Gerado automaticamente, mas pode ajustar.">
        <input
          id="usuario"
          required
          value={usuario}
          onChange={(e) => {
            setUsuario(e.target.value);
            setUsuarioEditadoManualmente(true);
          }}
          className={inputClass}
        />
      </Campo>

      <div className="grid sm:grid-cols-2 gap-4">
        <Campo label="E-mail" htmlFor="email">
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </Campo>

        <Campo label="Telefone" htmlFor="telefone">
          <input
            id="telefone"
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            placeholder="(11) 90000-0000"
            className={inputClass}
          />
        </Campo>
      </div>

      <Campo label="Cargo" htmlFor="cargo">
        <select
          id="cargo"
          required
          value={cargo}
          onChange={(e) => setCargo(e.target.value)}
          className={inputClass}
        >
          <option value="" disabled>
            Selecione...
          </option>
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

      {sucesso && (
        <PopupNovoUsuario usuario={sucesso.usuario} senha={sucesso.senha} aoFechar={() => setSucesso(null)} />
      )}

      <button
        type="submit"
        disabled={carregando}
        className="rounded-lg bg-[var(--accent)] hover:bg-[var(--accent2)] disabled:opacity-60 text-white font-medium text-sm px-5 py-3 transition"
        style={{ boxShadow: "0 0 40px var(--accent-glow)" }}
      >
        {carregando ? "Cadastrando..." : "Cadastrar usuário"}
      </button>
    </form>
  );
}

const inputClass =
  "w-full rounded-lg border px-4 py-2.5 text-sm outline-none focus:border-[var(--accent2)] focus:ring-1 focus:ring-[var(--accent2)] transition bg-[var(--surface)] border-[var(--line)] text-[var(--ink)] placeholder:text-[var(--muted)]";

function Campo({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={htmlFor}
        className="text-xs font-medium uppercase tracking-wide"
        style={{ color: "var(--muted)" }}
      >
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
