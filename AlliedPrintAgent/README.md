# Allied Print Agent

Programinha que fica rodando no computador que tem a impressora **Zebra
ZD220** ligada, recebendo pedidos de impressão de etiqueta vindos do
**Sistema Allied** (tela Operacional > 1 - Ag. Triagem, e menu Impressão
> Impressão Avulsa) e mandando pra impressora.

Ele existe porque um site (rodando no navegador) não consegue falar
direto com uma impressora USB ou por socket de rede — só um programa
instalado no próprio computador consegue. É a evolução do **Samsung
Tools** que você já tinha: mesmo layout de etiqueta e mesma lógica de
impressão (USB via driver do Windows, ou rede via socket), só que agora
ele fica esperando o pedido chegar da tela web em vez de ler uma
planilha Excel.

## Como funciona

1. Você abre o Allied Print Agent (`python main.py`, ou dá duplo clique
   em `iniciar.bat`) — ele fica escutando em `http://127.0.0.1:47811`.
2. No Sistema Allied (no navegador desse mesmo computador), o operador
   bipa o Trade Allied na tela de Ag. Triagem ou na Impressão Avulsa.
3. O sistema web localiza o aparelho no banco de dados e manda os dados
   (OS Reparadora, NF, Modelo) direto pra esse programa, em
   `localhost:47811`.
4. O agente monta a etiqueta (ZPL) e envia pra Zebra ZD220 — sem
   precisar clicar em nada na tela do agente.

**Importante:** o agente precisa estar aberto no computador onde o
operador vai usar a tela de bipagem, porque o navegador só consegue
falar com `127.0.0.1` (o próprio computador) — não alcança o agente
rodando em outra máquina da loja.

## Instalação

```bash
pip install -r requirements.txt
```

No Windows, o pacote `pywin32` é necessário apenas se você for imprimir
pelo driver local da impressora (modo `"windows"` no `config.py`, que é
o padrão).

## Configuração (`config.py`)

| Variável | O que é |
|---|---|
| `PORTA` | Porta local que o agente escuta (padrão `47811`) |
| `MODO_IMPRESSAO` | `"windows"` (USB, via driver) ou `"rede"` (Ethernet/Wi-Fi) |
| `NOME_IMPRESSORA_WINDOWS` | Nome exato da impressora em "Impressoras e Scanners" do Windows |
| `IP_IMPRESSORA` / `PORTA_IMPRESSORA` | Usado apenas no modo `"rede"` (porta padrão Zebra = 9100) |

Cada uma dessas também pode ser sobrescrita por variável de ambiente,
sem precisar editar o arquivo (útil se cada loja tiver uma configuração
diferente): `ALLIED_PRINT_AGENT_PORTA`, `ALLIED_PRINT_AGENT_MODO`,
`ALLIED_PRINT_AGENT_IMPRESSORA`, `ALLIED_PRINT_AGENT_IP`,
`ALLIED_PRINT_AGENT_PORTA_IMPRESSORA`.

### Descobrindo o nome exato da impressora no Windows

1. Painel de Controle → Dispositivos e Impressoras.
2. Localize a Zebra ZD220 (instalada com o driver **ZDesigner**).
3. Copie o nome exatamente como aparece e cole em `NOME_IMPRESSORA_WINDOWS`.

## Executando

```bash
python main.py
```

ou dê duplo clique em `iniciar.bat`. Deixe a janela aberta enquanto o
balcão estiver usando a triagem/impressão avulsa — pode minimizar, só
não fechar.

### Abrir sozinho com o Windows (opcional)

Pra não precisar abrir manualmente todo dia: crie um atalho de
`iniciar.bat` e coloque na pasta de inicialização do Windows
(`Win + R` → digite `shell:startup` → Enter → cole o atalho lá).

## Testando se está no ar

Com o agente aberto, acesse `http://127.0.0.1:47811/status` em qualquer
navegador desse computador — deve responder algo como
`{"ok": true, "servico": "Allied Print Agent"}`.

## Estrutura do projeto

```
AlliedPrintAgent/
├── main.py                  # ponto de entrada
├── config.py                # configurações (porta, impressora)
├── requirements.txt
├── iniciar.bat               # atalho pra rodar no Windows
├── servidor.py               # servidor HTTP local (POST /imprimir, GET /status)
├── etiqueta.py                # geração do ZPL (60mm x 40mm, Code 128)
└── imprimir.py                # envio do ZPL (Windows RAW ou socket de rede)
```

## Observações

- Se a etiqueta não imprimir, o erro aparece tanto no console do agente
  quanto no histórico da tela de bipagem no Sistema Allied — a etiqueta
  simplesmente não sai, sem travar nada dos dois lados.
- Ao abrir a tela de Ag. Triagem ou Impressão Avulsa pela primeira vez,
  o navegador pode pedir uma confirmação de "acessar dispositivos na
  rede local" — é só aceitar uma vez.
- Layout, código de barras e tamanho de fonte são os mesmos já validados
  no Samsung Tools — se precisar ajustar algo do desenho da etiqueta, é
  só mexer em `etiqueta.py`.
