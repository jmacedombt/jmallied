import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import PainelCargos from "@/components/PainelCargos";
import { podeGerenciarUsuarios } from "@/lib/usuarios";
import { RESUMO_ACESSO_CARGOS } from "@/lib/cargos";

export default async function CargosPage() {
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

  const { data: cargosCustomizados } = await supabase
    .from("cargos_customizados")
    .select("id, nome, descricao, criado_em")
    .order("criado_em", { ascending: false });

  const voltar = (
    <Link
      href="/sistema"
      title="Voltar para Sistema"
      aria-label="Voltar para Sistema"
      className="botao-voltar-brilho relative inline-flex items-center justify-center w-11 h-11 rounded-full mb-3 transition-transform hover:scale-110 active:scale-100"
    >
      <ArrowLeft size={20} strokeWidth={2.5} style={{ color: "var(--accent2)", filter: "drop-shadow(0 0 5px var(--accent2))" }} />
    </Link>
  );

  return (
    <AppShell
      titulo="Cargos"
      tituloInfo="Registro de referência: os cargos que o login usa hoje, com os módulos que cada um acessa, e um cadastro pra registrar um cargo novo. Cadastrar aqui não libera acesso sozinho — cada módulo continua sendo implementado em código, cargo por cargo."
      perfil={perfil}
    >
      {voltar}
      <PainelCargos
        cargosFixos={RESUMO_ACESSO_CARGOS}
        cargosCustomizados={cargosCustomizados ?? []}
        podeGerenciar={podeGerenciarUsuarios(perfil)}
      />
    </AppShell>
  );
}
