"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import PasswordInput from "./PasswordInput";

export default function TrocarSenhaForm() {
  const router = useRouter();
  const supabase = createClient();

  const [novaSenha, setNovaSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    if (novaSenha.length < 8) {
      setErro("A nova senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (novaSenha !== confirmar) {
      setErro("As senhas não conferem.");
      return;
    }

    setCarregando(true);

    const { error: authError } = await supabase.auth.updateUser({
      password: novaSenha,
    });

    if (authError) {
      setCarregando(false);
      setErro("Não foi possível atualizar a senha. Tente novamente.");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      await supabase
        .from("usuarios")
        .update({ must_change_password: false })
        .eq("id", user.id);
    }

    setCarregando(false);
    router.refresh();
    router.push("/dashboard");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-1.5">
        <label htmlFor="novaSenha" className="text-xs font-medium uppercase tracking-wide text-allied-silver/70">
          Nova senha
        </label>
        <PasswordInput
          id="novaSenha"
          name="novaSenha"
          autoComplete="new-password"
          value={novaSenha}
          onChange={setNovaSenha}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="confirmar" className="text-xs font-medium uppercase tracking-wide text-allied-silver/70">
          Confirmar nova senha
        </label>
        <PasswordInput
          id="confirmar"
          name="confirmar"
          autoComplete="new-password"
          value={confirmar}
          onChange={setConfirmar}
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
        {carregando ? "Salvando..." : "Salvar e continuar"}
      </button>
    </form>
  );
}
