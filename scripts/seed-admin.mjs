// Cria (uma única vez) o usuário Administrador MASTER do sistema Allied.
//
// Como rodar (depois de preencher o .env.local com as chaves do Supabase):
//   node --env-file=.env.local scripts/seed-admin.mjs
//
// É seguro rodar mais de uma vez: se o usuário "Admin" já existir, o
// script apenas avisa e não faz nada.

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const authDomain = process.env.NEXT_PUBLIC_AUTH_EMAIL_DOMAIN || "jmacedoallied.internal";

if (!url || !serviceRoleKey) {
  console.error(
    "Faltou preencher NEXT_PUBLIC_SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY no .env.local"
  );
  process.exit(1);
}

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const USUARIO_MASTER = "admin";
const SENHA_MASTER = "Admin123";
const EMAIL_TECNICO = `${USUARIO_MASTER}@${authDomain}`;

async function main() {
  const { data: jaExiste } = await admin
    .from("usuarios")
    .select("id")
    .eq("usuario", USUARIO_MASTER)
    .maybeSingle();

  if (jaExiste) {
    console.log('Usuário "admin" já existe. Nada a fazer.');
    return;
  }

  const { data: novoUsuario, error: authError } = await admin.auth.admin.createUser({
    email: EMAIL_TECNICO,
    password: SENHA_MASTER,
    email_confirm: true,
  });

  if (authError || !novoUsuario?.user) {
    console.error("Erro ao criar o login do Admin:", authError?.message);
    process.exit(1);
  }

  const { error: perfilError } = await admin.from("usuarios").insert({
    id: novoUsuario.user.id,
    nome: "Admin",
    sobrenome: "Master",
    usuario: USUARIO_MASTER,
    email: EMAIL_TECNICO,
    telefone: null,
    cargo: "Diretor",
    is_master: true,
    must_change_password: false,
  });

  if (perfilError) {
    console.error("Erro ao criar o perfil do Admin:", perfilError.message);
    process.exit(1);
  }

  console.log("Usuário Admin master criado com sucesso.");
  console.log(`Login: ${USUARIO_MASTER}`);
  console.log(`Senha: ${SENHA_MASTER}`);
}

main();
