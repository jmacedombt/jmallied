# Allied Print Agent — instalação no computador da impressora

Esse guia é pra instalar o Allied Print Agent no computador **que tem a
Zebra ZD220 ligada** e onde o operador vai usar o Sistema Allied no
navegador pra fazer a triagem/impressão. Leva uns 10 minutos.

## O que você precisa antes de começar

- A pasta `AlliedPrintAgent` (esses arquivos) copiada pra esse
  computador — por pendrive, e-mail, OneDrive/Google Drive, o que for
  mais fácil. Pode colocar em qualquer lugar, por exemplo
  `C:\AlliedPrintAgent`.
- A Zebra ZD220 já instalada no Windows (com o driver **ZDesigner**) e
  funcionando — se ainda não tiver, instale o driver da Zebra primeiro
  (vem no CD/pendrive da impressora ou no site da Zebra) e imprima uma
  página de teste pra confirmar que já funciona.

## Passo 1 — Instalar o Python (se ainda não tiver)

1. Abra o navegador nesse computador e vá em **https://python.org/downloads**.
2. Clique em **Download Python** (baixa a versão mais recente pro Windows).
3. Rode o instalador baixado. **Muito importante:** na primeira tela,
   marque a caixinha **"Add python.exe to PATH"** antes de clicar em
   "Install Now". Se pular esse passo, os comandos abaixo não vão
   funcionar.
4. Depois de instalar, abra o **Prompt de Comando** (tecla Windows,
   digite `cmd`, Enter) e digite:
   ```
   python --version
   ```
   Se aparecer algo como `Python 3.12.x`, deu certo. Se der erro
   "não é reconhecido", o Python não ficou no PATH — reinstale marcando
   a caixinha do passo 3.

## Passo 2 — Instalar as dependências do Allied Print Agent

1. No Prompt de Comando, entre na pasta onde você colocou o
   `AlliedPrintAgent` (troque o caminho pelo real):
   ```
   cd C:\AlliedPrintAgent
   ```
2. Instale as dependências:
   ```
   pip install -r requirements.txt
   ```
   Isso instala o `pywin32`, necessário pra falar com a impressora
   instalada no Windows.

## Passo 3 — Conferir o nome da impressora

1. Abra **Configurações → Bluetooth e dispositivos → Impressoras e
   scanners** (ou **Painel de Controle → Dispositivos e Impressoras**,
   no Windows mais antigo).
2. Localize a Zebra e copie o nome **exatamente** como aparece — algo
   como `ZDesigner ZD220-203dpi ZZPL`.
3. Abra o arquivo `config.py` (dentro da pasta `AlliedPrintAgent`) com o
   Bloco de Notas e confira a linha `NOME_IMPRESSORA_WINDOWS` — se o
   nome for diferente do que você copiou, ajuste ali e salve.

## Passo 4 — Rodar o Allied Print Agent

1. Na pasta `AlliedPrintAgent`, dê duplo clique em **`iniciar.bat`**.
2. Deve abrir uma janela preta (console) mostrando:
   ```
   ============================================================
    Allied Print Agent
    Escutando em http://127.0.0.1:47811
    Deixe essa janela aberta enquanto usar a Ag. Triagem
    ou a Impressão Avulsa no Sistema Allied.
    Pressione Ctrl+C pra encerrar.
   ============================================================
   ```
3. **Deixe essa janela aberta** (pode minimizar) — é ela que fica
   esperando o pedido de impressão vindo do navegador. Se fechar, a
   impressão para de funcionar até abrir de novo.

## Passo 5 — Testar se está no ar

1. Com a janela do passo 4 aberta, abra um navegador nesse mesmo
   computador e acesse:
   ```
   http://127.0.0.1:47811/status
   ```
2. Deve aparecer algo como `{"ok": true, "servico": "Allied Print Agent"}`.
   Se aparecer isso, o agente está funcionando certinho.

## Passo 6 — Testar na tela do Sistema Allied

1. Nesse mesmo computador, abra o Sistema Allied no navegador e faça
   login normalmente.
2. Vá em **Operacional → 1 - Ag. Triagem** (o popup de bipagem deve
   abrir sozinho).
3. Na primeira vez, o navegador pode mostrar um aviso pedindo permissão
   pra acessar "dispositivos/rede local" — aceite (é ele falando com o
   Allied Print Agent em `127.0.0.1`).
4. Bipe (ou digite) o **Trade Allied** de um aparelho que já esteja
   nessa lista e aperte Enter. Se tudo estiver certo, a etiqueta sai na
   Zebra e o histórico da tela mostra "etiqueta enviada".

## Passo 7 (opcional) — Abrir sozinho com o Windows

Pra não precisar dar duplo clique no `iniciar.bat` todo dia:

1. Clique com o botão direito em `iniciar.bat` → **Criar atalho**.
2. Pressione `Win + R`, digite `shell:startup` e Enter — abre a pasta
   de inicialização do Windows.
3. Arraste o atalho criado pra dentro dessa pasta.

Assim, toda vez que o Windows ligar, o Allied Print Agent já abre
sozinho (a janela preta aparece minimizada/no canto).

## Se der algum problema

- **"O pacote 'pywin32' não está instalado"** → volte no Passo 2 e rode
  `pip install -r requirements.txt` de novo.
- **"Não foi possível abrir a impressora..."** → o nome em
  `NOME_IMPRESSORA_WINDOWS` (config.py) não bate com o nome real da
  impressora — revise o Passo 3.
- **A tela do Sistema Allied mostra "Não consegui falar com o Allied
  Print Agent"** → confirme se a janela do Passo 4 ainda está aberta
  nesse computador (ela precisa estar rodando sempre que for usar a
  triagem/impressão).
- Qualquer outro erro aparece tanto na janela preta do agente quanto no
  histórico da tela de bipagem — copie a mensagem e me manda que eu
  ajudo a resolver.
