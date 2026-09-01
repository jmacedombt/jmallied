# -*- coding: utf-8 -*-
"""
Configuração do Allied Print Agent.
Ajuste os valores abaixo conforme o computador/impressora de cada loja.
"""

import os

# ---------------------------------------------------------------------------
# SERVIDOR LOCAL
# ---------------------------------------------------------------------------
# Porta em que o agente escuta em 127.0.0.1 (localhost). O sistema web
# (Sistema Allied) manda os pedidos de impressão pra
# http://127.0.0.1:<PORTA>/imprimir — só o navegador rodando NESSE
# computador consegue falar com o agente (não é acessível pela rede).
PORTA = int(os.getenv("ALLIED_PRINT_AGENT_PORTA", "47811"))

# ---------------------------------------------------------------------------
# IMPRESSORA ZEBRA ZD220
# ---------------------------------------------------------------------------
# MODO_IMPRESSAO:
#   "windows" -> envia ZPL "cru" (RAW) para uma impressora instalada no
#                Windows (driver ZDesigner). Use quando a ZD220 estiver
#                conectada via USB.
#   "rede"    -> envia ZPL diretamente por socket TCP para a porta 9100
#                da impressora. Use quando a ZD220 estiver na rede
#                (Ethernet/Wi-Fi).
MODO_IMPRESSAO = os.getenv("ALLIED_PRINT_AGENT_MODO", "windows")

# Nome exato da impressora tal como aparece em "Impressoras e Scanners"
# no Windows (Painel de Controle). Confirme antes de usar em produção.
NOME_IMPRESSORA_WINDOWS = os.getenv(
    "ALLIED_PRINT_AGENT_IMPRESSORA", "ZDesigner ZD220-203dpi ZZPL"
)

# Usado somente se MODO_IMPRESSAO = "rede"
IP_IMPRESSORA = os.getenv("ALLIED_PRINT_AGENT_IP", "192.168.0.50")
PORTA_IMPRESSORA = int(os.getenv("ALLIED_PRINT_AGENT_PORTA_IMPRESSORA", "9100"))

# ---------------------------------------------------------------------------
# ETIQUETA (60mm x 40mm, mesmo layout validado no Samsung Tools)
# ---------------------------------------------------------------------------
LARGURA_ETIQUETA_MM = 60
ALTURA_ETIQUETA_MM = 40

# Resolução da Zebra ZD220. A maioria dos modelos vendidos no Brasil é
# 203 dpi. Se a sua for a versão 300 dpi, altere aqui.
DPI = 203

# Textos fixos do layout — ajuste aqui se algum desses nomes mudar.
NOME_LOJA_TOPO = "J MACEDO ELETRONICA"   # canto superior esquerdo
NOME_LOJA_DIREITA = "ESC SANTOS"          # canto superior direito
RODAPE_DIREITA = "SAMSUNG ESC SANTOS"     # rodapé direito
