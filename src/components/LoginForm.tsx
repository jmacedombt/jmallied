"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { usuarioParaEmailTecnico } from "@/lib/auth";
import PasswordInput from "./PasswordInput";

export default function LoginForm() {
  const router = useRouter();
  const supabase = createClient();

  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);

    const usuarioNormalizado = usuario.trim().toLowerCase();
    const email = usuarioParaEmailTecnico(usuarioNormalizado);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    });

    setCarregando(false);

    if (error) {
      setErro("Usuário ou senha inválidos.");
      return;
    }

    router.refresh();
    router.push("/dashboard");
  }

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-5">
      <div className="space-y-1.5">
        <label htmlFor="usuario" className="text-xs font-medium uppercase tracking-wide text-allied-silver/70">
          Login
        </label>
        <input
          id="usuario"
          name="usuario"
          type="text"
          autoComplete="username"
          required
          placeholder="nome.sobrenome"
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
          className="w-full rounded-lg bg-allied-panel2 border border-allied-border px-4 py-3 text-sm text-allied-silver placeholder:text-allied-silver/40 outline-none focus:border-allied-accent2 focus:ring-1 focus:ring-allied-accent2 transition"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="senha" className="text-xs font-medium uppercase tracking-wide text-allied-silver/70">
          Senha
        </label>
        <PasswordInput
          id="senha"
          name="senha"
          placeholder="••••••••"
          autoComplete="current-password"
          value={senha}
          onChange={setSenha}
        />
      </div>

      {erro && (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
          {erro}
        </p>
      )}

      <button
        type="submit"
        disabled={carregando}
        className="w-full rounded-lg bg-allied-accent hover:bg-allied-accent2 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium text-sm py-3 transition shadow-glow"
      >
        {carregando ? "Entrando..." : "Entrar"}
      </button>

      <p className="text-center text-xs text-allied-silver/50">
        Esqueci minha senha{" "}
        <span className="text-allied-silver/30">(em breve — fale com o administrador)</span>
      </p>
    </form>
  );
}
