# Guia de publicação — Sistema Allied

Passo a passo completo para colocar o sistema no ar, sem pular nada.
Siga na ordem. Sempre que aparecer "Prompt de Comando", pode ser também
o PowerShell — os dois funcionam.

Tudo isso é feito **uma vez só**. Depois de publicado, qualquer
atualização futura é só repetir a Parte 3 (subir pro GitHub) — a
publicação (Parte 4) atualiza sozinha.

---

## Parte 1 — Preparar seu computador

Só precisa fazer isso se ainda não tiver essas ferramentas instaladas.

1. **Instalar o Node.js** (necessário para rodar o projeto):
   - Acesse https://nodejs.org
   - Baixe a versão **LTS** (a recomendada, em destaque)
   - Rode o instalador, clicando em "Avançar" até o fim
   - Para confirmar que instalou: abra o Prompt de Comando (tecla
     Windows, digite "cmd", Enter) e digite `node -v` — precisa
     aparecer um número de versão (ex: v20.11.0)

2. **Instalar o Git para Windows** (necessário para enviar o código ao
   GitHub):
   - Acesse https://git-scm.com/download/win
   - Baixe e instale, pode deixar todas as opções no padrão
   - Para confirmar: no Prompt de Comando, digite `git --version`

---

## Parte 2 — Configurar o Supabase (o banco de dados)

1. Abra o Supabase (https://supabase.com/dashboard), entre no projeto
   **Controle Allied**.
2. No menu lateral, vá em **Project Settings** (ícone de engrenagem) →
   **API**.
3. Você vai ver duas chaves importantes — deixe essa aba aberta, vai
   precisar copiar:
   - **Project URL** (já sabemos: `https://opfxfzfbfehltlmeaenw.supabase.co`)
   - **anon public** (uma chave longa)
   - **service_role** (outra chave longa, secreta — clique no ícone de
     olho para revelar)

4. Na pasta `SISTEMA ALLIED-JMACEDO`, encontre o arquivo
   `env.exemplo.txt`. Renomeie ele para `.env.local`:
   - Clique com o botão direito nele → Renomear
   - Apague o nome todo e digite exatamente: `.env.local`
   - Se o Windows reclamar ou não deixar (às vezes ele exige um nome
     antes do ponto), abra o Prompt de Comando dentro da pasta e
     digite: `ren env.exemplo.txt .env.local`

5. Abra o `.env.local` com o Bloco de Notas (botão direito → Abrir com
   → Bloco de Notas) e cole as chaves que você copiou no lugar
   indicado:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://opfxfzfbfehltlmeaenw.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=cole_aqui_a_chave_anon_public
   SUPABASE_SERVICE_ROLE_KEY=cole_aqui_a_chave_service_role
   NEXT_PUBLIC_AUTH_EMAIL_DOMAIN=jmacedoallied.internal
   ```

   Salve e feche.

6. Ainda no Supabase, vá em **SQL Editor** (menu lateral) → **New
   query**. Abra o arquivo `supabase\migrations\0001_init.sql` (está
   na pasta do projeto) com o Bloco de Notas, copie todo o conteúdo,
   cole no SQL Editor do Supabase e clique em **Run**. Isso cria a
   tabela de usuários no banco.

---

## Parte 3 — Rodar no seu computador e criar o Admin

1. Abra o Prompt de Comando **dentro da pasta do projeto**: abra a
   pasta `SISTEMA ALLIED-JMACEDO` no Explorer, clique na barra de
   endereço, digite `cmd` e aperte Enter — o Prompt já abre na pasta
   certa.

2. Instale as dependências do projeto (baixa tudo que ele precisa
   para funcionar — só precisa fazer isso uma vez, ou quando eu
   avisar que mudou algo):

   ```
   npm install
   ```

   Isso demora alguns minutos na primeira vez.

3. Crie o usuário Administrador MASTER (login `admin`, senha
   `Admin123`):

   ```
   node --env-file=.env.local scripts/seed-admin.mjs
   ```

   Deve aparecer "Usuário Admin master criado com sucesso."

4. Teste localmente antes de publicar:

   ```
   npm run dev
   ```

   Abra o navegador em http://localhost:3000 — deve cair na tela de
   login. Entre com `admin` / `Admin123`, troque a senha quando for
   pedido, e veja se consegue acessar "Usuários" e cadastrar alguém.
   Depois de testar, volte ao Prompt de Comando e aperte `Ctrl+C` para
   parar.

---

## Parte 4 — Subir o código para o GitHub

1. No Prompt de Comando, ainda dentro da pasta do projeto, rode um
   por um (Enter depois de cada linha):

   ```
   git init
   git add .
   git commit -m "Primeira versão do sistema Allied"
   git branch -M main
   git remote add origin https://github.com/jmacedombt/jmallied.git
   git push -u origin main
   ```

2. Na hora do `git push`, o Windows deve abrir uma janela pedindo para
   você entrar com sua conta do GitHub — faça o login normalmente.

   Se preferir uma forma mais visual (sem digitar comando nenhum),
   pode instalar o **GitHub Desktop** (https://desktop.github.com),
   abrir a pasta do projeto por lá e clicar em "Publish repository" —
   faz a mesma coisa que os comandos acima.

3. Depois de terminar, atualize a página do repositório
   (https://github.com/jmacedombt/jmallied) no navegador — os
   arquivos devem aparecer lá.

---

## Parte 5 — Publicar o site (deploy) com a Vercel

A Vercel é o jeito mais simples e gratuito de colocar um projeto
Next.js no ar, e conversa direto com o GitHub: toda vez que você
mandar uma atualização pro GitHub, o site atualiza sozinho.

1. Acesse https://vercel.com e clique em **Sign Up**. Escolha
   **Continue with GitHub** e faça login com a mesma conta do GitHub
   usada no repositório.

2. Depois de entrar, clique em **Add New** → **Project**.

3. Na lista de repositórios, procure **jmallied** (ou
   `jmacedombt/jmallied`) e clique em **Import**.
   - Se não aparecer na lista, clique em "Adjust GitHub App
     Permissions" e dê acesso a esse repositório.

4. Na tela de configuração do projeto, antes de clicar em Deploy,
   abra **Environment Variables** e adicione, uma por uma (nome e
   valor, clicando em "Add" depois de cada uma) — os mesmos valores
   que você colocou no `.env.local`:

   | Nome | Valor |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://opfxfzfbfehltlmeaenw.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (a chave anon public que você copiou) |
   | `SUPABASE_SERVICE_ROLE_KEY` | (a chave service_role que você copiou) |
   | `NEXT_PUBLIC_AUTH_EMAIL_DOMAIN` | `jmacedoallied.internal` |

5. Clique em **Deploy**. Espere a barra de progresso terminar (1 a 3
   minutos).

6. Quando terminar, a Vercel mostra um botão para visitar o site — o
   endereço vai ser algo como `jmallied.vercel.app`. Esse já é o
   sistema no ar, acessível de qualquer lugar.

7. Teste de novo: acesse o link, entre com `admin` / `Admin123`,
   troque a senha e cadastre um usuário de teste, igual fez no passo
   4 da Parte 3.

### Domínio próprio (opcional, pode fazer depois)

Se um dia quiser um endereço tipo `allied.grupojmacedo.com.br` em vez
do `.vercel.app`, isso é feito em **Project → Settings → Domains** na
Vercel. Não precisa se preocupar com isso agora.

---

## Daqui pra frente

Sempre que eu (ou você) mudar algo no sistema, o caminho é:

1. Eu atualizo os arquivos na sua pasta.
2. Você roda de novo os comandos da Parte 4 (`git add .`,
   `git commit -m "..."`, `git push`) — não precisa repetir o `git
   init` nem o `remote add`, só a partir do `git add .`.
3. A Vercel detecta o novo envio e atualiza o site sozinha, sem
   precisar fazer nada na Parte 5 de novo.

Se travar em algum passo, me diga em qual número parou e o que
apareceu na tela.
