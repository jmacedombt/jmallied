# Sistema Allied | Grupo J.Macedo

Sistema de controle interno da Allied (Grupo J.Macedo), com login de acesso
e controle de usuários. Construído em Next.js (App Router) + Supabase.

Publicado com Vercel + Supabase (projeto "Controle Allied").

## Stack

- Next.js 14 + TypeScript + Tailwind CSS
- Supabase (Auth + Postgres) — projeto **Controle Allied**
  (`opfxfzfbfehltlmeaenw.supabase.co`)

## O que já está pronto

- Tela de login (usuário + senha, com olho para mostrar/ocultar senha),
  com a identidade visual do logo (fundo azul escuro).
- Login por **usuário** (formato `nome.sobrenome`), não por e-mail — por
  baixo dos panos o Supabase Auth usa um e-mail técnico interno
  (`usuario@jmacedoallied.internal`), então não é preciso e-mail real
  para logar.
- Primeiro acesso obrigatório: todo usuário novo entra com a senha
  padrão `Allied001` e é automaticamente redirecionado para trocar a
  senha antes de usar o sistema.
- Cadastro de usuários (`/usuarios/novo`) com nome, sobrenome, usuário
  (sugerido automaticamente, editável), e-mail, telefone e cargo
  (Diretor, Gerente, Supervisor, Técnico, Estoque, Operacional).
- Listagem de usuários (`/usuarios`).
- Usuário Administrador MASTER (login `admin` / senha `Admin123`),
  criado pelo script `scripts/seed-admin.mjs`.

As regras de permissão por cargo (quem pode ver o quê, quem pode
cadastrar usuário, etc.) ainda **não** foram implementadas — hoje
qualquer usuário logado acessa `/usuarios`. Isso fica para quando essas
regras forem definidas.

## Como rodar localmente

1. Instale as dependências:

   ```
   npm install
   ```

2. Renomeie `env.exemplo.txt` para `.env.local` (pelo Prompt de Comando:
   `ren env.exemplo.txt .env.local`) e preencha com as chaves do
   projeto Supabase "Controle Allied" (Project Settings → API, no
   painel do Supabase):

   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → chave **anon/public**
   - `SUPABASE_SERVICE_ROLE_KEY` → chave **service_role** (secreta,
     nunca deve ir para o navegador nem para o GitHub)

3. Rode a migration `supabase/migrations/0001_init.sql` no projeto
   Supabase (SQL Editor → cole o conteúdo do arquivo → Run). Isso cria
   a tabela `public.usuarios` e as políticas de acesso.

4. Crie o usuário Admin master (só precisa rodar uma vez):

   ```
   node --env-file=.env.local scripts/seed-admin.mjs
   ```

5. Suba o projeto:

   ```
   npm run dev
   ```

   Acesse http://localhost:3000 — vai cair direto na tela de login.

## Conectar ao GitHub (repositório `jmacedombt/jmallied`)

Dentro desta pasta:

```
git init
git add .
git commit -m "Primeira versão: login e controle de usuários"
git branch -M main
git remote add origin https://github.com/jmacedombt/jmallied.git
git push -u origin main
```

## Conectar ao Supabase (projeto Controle Allied)

O projeto já está criado (`Controle Allied`, região São Paulo). Falta:

1. Rodar a migration do passo 3 acima (tabela de usuários).
2. Rodar o `seed-admin.mjs` para criar o login master.
3. Se quiser, conectar o repositório do GitHub ao Supabase em
   Project Settings → Integrations → GitHub, para versionar as
   migrations junto com o projeto.

## Estrutura de pastas

```
src/
  app/
    login/            tela de login
    trocar-senha/      troca de senha obrigatória (1º acesso)
    dashboard/         painel inicial pós-login
    usuarios/          listagem de usuários
    usuarios/novo/      cadastro de usuário
    api/usuarios/       rotina de servidor que cria usuário + login
  components/          componentes de UI (formulários, campo de senha)
  lib/
    auth.ts            regras de geração de usuário, cargos, senha padrão
    supabase/           clientes Supabase (browser, server, admin)
  middleware.ts         protege rotas e força troca de senha
supabase/
  migrations/           SQL do banco (rodar no Supabase)
scripts/
  seed-admin.mjs        cria o usuário Admin master
```
