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
  const [sucesso, setSucesso] = useState(false);

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
      // mostra o motivo real que o Supabase devolveu (ex: senha fraca
      // demais pras regras configuradas) em vez de uma mensagem genérica
      // que escondia o problema e deixava a pessoa travada sem saber
      // o que ajustar.
      setErro(authError.message || "Não foi possível atualizar a senha. Tente novamente.");
      return;
    }

    const {
      data: { user },
      error: getUserError,
    } = await supabase.auth.getUser();

    if (getUserError || !user) {
      // a senha JÁ foi trocada nesse ponto (updateUser acima deu certo) —
      // só não conseguimos confirmar a sessão pra liberar o acesso. Sem
      // isso, "Salvar e continuar" ficava sem nenhuma mensagem e parado
      // na mesma tela, e se a pessoa tentasse de novo com a MESMA senha
      // o Supabase recusava ("senha igual à anterior") sem explicar o
      // que realmente tinha acontecido.
      setCarregando(false);
      setErro("Sua senha foi trocada, mas não consegui confirmar sua sessão. Recarregue a página e entre com a senha nova.");
      return;
    }

    // libera o acesso (tira a obrigação de troca) — se isso falhar, o
    // middleware ia jogar a pessoa de volta pra essa mesma tela sem
    // explicação nenhuma, então checamos o erro em vez de ignorar.
    const { error: erroFlag } = await supabase
      .from("usuarios")
      .update({ must_change_password: false })
      .eq("id", user.id);

    if (erroFlag) {
      setCarregando(false);
      setErro(
        `Sua senha foi trocada, mas não consegui liberar seu acesso (${erroFlag.message}). Recarregue a página e entre com a senha nova.`
      );
      return;
    }

    setCarregando(false);
    setSucesso(true);
    router.refresh();
    // navegação "dura" (recarrega a página inteira) em vez de
    // router.push: garante que o middleware leia a sessão/flag já
    // atualizada nessa nova requisição, sem depender de cache do
    // roteador do Next — é exatamente essa falta de garantia que deixava
    // a pessoa presa na tela de trocar senha sem nenhum aviso.
    window.location.href = "/dashboard";
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

      {sucesso && (
        <p className="text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2">
          Senha atualizada! Entrando...
        </p>
      )}

      <button
        type="submit"
        disabled={carregando || sucesso}
        className="w-full rounded-lg bg-allied-accent hover:bg-allied-accent2 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium text-sm py-3 transition shadow-glow"
      >
        {sucesso ? "Entrando..." : carregando ? "Salvando..." : "Salvar e continuar"}
      </button>
    </form>
  );
}
