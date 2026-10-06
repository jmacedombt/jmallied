# -*- coding: utf-8 -*-
"""
Geração do comando ZPL (Zebra Programming Language) da etiqueta.

Layout 60mm x 40mm, herdado do Samsung Tools (mesmo desenho validado
antes: cabeçalho J MACEDO/ESC SANTOS, MODELO à esquerda + NF à direita,
OS bem grande no centro, dois códigos de barra (Code128) lado a lado —
OS na metade esquerda, NF na direita — e rodapé com data/hora.

Diferença em relação ao Samsung Tools original: aqui os dados chegam
prontos (os_reparadora, nf_remessa_allied, modelo_comercial), vindos do
Sistema Allied via POST /imprimir — não tem mais leitura de planilha nem
nomes de coluna pra mapear.
"""

from datetime import datetime

from config import (
    LARGURA_ETIQUETA_MM,
    ALTURA_ETIQUETA_MM,
    DPI,
    NOME_LOJA_TOPO,
    NOME_LOJA_DIREITA,
    RODAPE_DIREITA,
)


def mm_para_dots(mm: float) -> int:
    return int(round(mm / 25.4 * DPI))


def _sanitizar(valor) -> str:
    """Remove valores vazios/None e caracteres que quebram o ZPL (^ e ~)."""
    if valor is None:
        return ""
    texto = str(valor).strip()
    if texto.lower() in ("nan", "none"):
        return ""
    return texto.replace("^", "-").replace("~", "-")


def _estimar_largura_barcode(texto: str, modulo: int = 2) -> int:
    """Estima a largura (em dots) do código Code128 gerado, pra centralizá-lo."""
    n = max(len(texto), 1)
    modulos = 11 * (n + 2) + 13
    return modulos * modulo


def _fonte_ajustada(texto: str, largura_disponivel: int,
                     largura_max: int, proporcao: float = 1.36,
                     largura_min: int = 10) -> tuple:
    """
    Calcula (altura, largura) da fonte A0N pra que `texto` caiba dentro de
    `largura_disponivel` dots, sem estourar a etiqueta — ajusta automático
    conforme a quantidade de caracteres (ex: OS com 9, 10 ou 11 dígitos).
    """
    n = max(len(texto), 1)
    largura = min(largura_max, largura_disponivel // n)
    largura = max(largura, largura_min)
    altura = int(largura * proporcao)
    return altura, largura


def _campo_negrito(x: int, y: int, altura: int, largura: int, fb_largura: int,
                    justificacao: str, texto: str) -> str:
    """Imprime o mesmo campo duas vezes com 1 dot de deslocamento em X —
    a fonte A0N não tem variante bold de verdade, então o efeito de
    negrito é simulado assim (mesmo truque usado em etiquetas Zebra em
    geral quando não dá pra trocar a fonte)."""
    campo = (
        f"^FO{x},{y}^A0N,{altura},{largura}^FB{fb_largura},1,0,{justificacao},0^FD{texto}^FS\n"
    )
    campo += (
        f"^FO{x + 1},{y}^A0N,{altura},{largura}^FB{fb_largura},1,0,{justificacao},0^FD{texto}^FS\n"
    )
    return campo


def gerar_zpl_caixa(lote, volume_atual, volume_total, nf_retorno, observacao, nf_entrada) -> str:
    """
    Etiqueta de CAIXA — usada em "Ag. Emissão de Nota Fiscal" pra colar
    nas caixas de aparelhos que vão devolvidos pra Allied. Mesma etiqueta
    60x40mm da gerar_zpl() acima (sem timbrado/logo — pedido explícito),
    com:
      LOTE            -> número sequencial da caixa (reinicia a cada NF Remessa)
      VOLUME          -> "X/Y" (caixa atual / total de caixas desse lote,
                          calculado com base na quantidade de aparelhos —
                          21 aparelhos por caixa) — fonte BEM grande
                          (pedido explícito: "deixa bem maior")
      NF DE RETORNO   -> fonte maior e em negrito (pedido explícito)
      OBSERVAÇÃO      -> APROVADO ou REPROVADO, em destaque (fundo preto)
      NF DE ENTRADA   -> a NF Remessa que seguiu o(s) orçamento(s) até aqui
    Também usada pro "Teste de Impressão" e pra "Etiqueta Avulsa" (campos
    em aberto) da mesma tela — os dois usam essa mesma função.

    Layout todo recalculado a partir das seções anteriores (cada `y_*`
    depende da altura de fonte de fato usada na seção de cima) pra
    ocupar a etiqueta inteira, sem sobrar espaço em branco embaixo — e
    todas as fontes maiores que a primeira versão (pedido explícito:
    "aumentar o tamanho da fonte de maneira que tudo fique bem visível").
    """
    largura = mm_para_dots(LARGURA_ETIQUETA_MM)   # 60mm -> 480 dots (203dpi)
    altura = mm_para_dots(ALTURA_ETIQUETA_MM)      # 40mm -> 320 dots (203dpi)

    lote_str = _sanitizar(lote) or "—"
    volume_str = f"{_sanitizar(volume_atual) or '—'}/{_sanitizar(volume_total) or '—'}"
    nf_retorno_str = _sanitizar(nf_retorno) or "—"
    observacao_str = (_sanitizar(observacao) or "—").upper()
    nf_entrada_str = _sanitizar(nf_entrada) or "—"
    data_hora = datetime.now().strftime("%d/%m/%Y %H:%M")

    margem = 12
    coluna_direita_x = int(largura * 0.55)
    largura_coluna_direita = largura - coluna_direita_x - margem
    largura_coluna_esquerda = coluna_direita_x - margem

    # ------------------- LOTE (esquerda) / VOLUME (direita, bem maior) -------------------
    altura_lote, largura_lote = _fonte_ajustada(
        lote_str, largura_coluna_esquerda, largura_max=40, proporcao=1.15, largura_min=22
    )
    altura_volume, largura_volume = _fonte_ajustada(
        volume_str, largura_coluna_direita, largura_max=56, proporcao=1.15, largura_min=28
    )

    y_rotulo_topo = 8
    altura_rotulo_topo = 13
    y_valor_topo = y_rotulo_topo + altura_rotulo_topo + 4
    y_apos_topo = y_valor_topo + max(altura_lote, altura_volume) + 10

    zpl = (
        "^XA\n"
        f"^PW{largura}\n"
        f"^LL{altura}\n"
        "^CI28\n"

        f"^FO{margem},{y_rotulo_topo}^A0N,{altura_rotulo_topo},{altura_rotulo_topo}^FDLOTE^FS\n"
        f"^FO{margem},{y_valor_topo}^A0N,{altura_lote},{largura_lote}^FD{lote_str}^FS\n"
        f"^FO{coluna_direita_x},{y_rotulo_topo}^A0N,{altura_rotulo_topo},{altura_rotulo_topo}"
        f"^FB{largura_coluna_direita},1,0,R,0^FDVOLUME^FS\n"
        f"^FO{coluna_direita_x},{y_valor_topo}^A0N,{altura_volume},{largura_volume}"
        f"^FB{largura_coluna_direita},1,0,R,0^FD{volume_str}^FS\n"
        f"^FO0,{y_apos_topo}^GB{largura},2,2^FS\n"
    )

    # ------------------- NF DE RETORNO (grande, negrito) -------------------
    altura_nf, largura_nf = _fonte_ajustada(
        nf_retorno_str, largura - 2 * margem, largura_max=54, proporcao=1.1, largura_min=26
    )
    y_nf_rotulo = y_apos_topo + 7
    altura_rotulo_nf = 13
    y_nf_valor = y_nf_rotulo + altura_rotulo_nf + 6

    zpl += (
        f"^FO0,{y_nf_rotulo}^A0N,{altura_rotulo_nf},{altura_rotulo_nf}^FB{largura},1,0,C,0^FDNF DE RETORNO^FS\n"
    )
    zpl += _campo_negrito(0, y_nf_valor, altura_nf, largura_nf, largura, "C", nf_retorno_str)

    # (gaps das seções abaixo um pouco mais enxutos pra compensar o NF de
    # Retorno maior e ainda caber tudo dentro dos 320 dots da etiqueta)
    y_apos_nf = y_nf_valor + altura_nf + 8
    zpl += f"^FO0,{y_apos_nf}^GB{largura},2,2^FS\n"

    # ------------------- OBSERVAÇÃO (destaque fundo preto / texto branco) -------------------
    altura_obs, largura_obs = _fonte_ajustada(
        observacao_str, largura - 2 * margem, largura_max=36, proporcao=1.05, largura_min=22
    )
    y_obs = y_apos_nf + 6
    altura_caixa_obs = altura_obs + 28
    y_obs_texto = y_obs + (altura_caixa_obs - altura_obs) // 2

    zpl += (
        f"^FO0,{y_obs}^GB{largura},{altura_caixa_obs},{altura_caixa_obs}^FS\n"
        f"^FO0,{y_obs_texto}^FR^A0N,{altura_obs},{largura_obs}^FB{largura},1,0,C,0^FD{observacao_str}^FS\n"
    )

    y_apos_obs = y_obs + altura_caixa_obs + 6
    zpl += f"^FO0,{y_apos_obs}^GB{largura},2,2^FS\n"

    # ------------------- NF DE ENTRADA (esquerda) + DATA/HORA (direita) -------------------
    y_rodape_rotulo = y_apos_obs + 6
    altura_rotulo_rodape = 13
    y_rodape_valor = y_rodape_rotulo + altura_rotulo_rodape + 4

    zpl += (
        f"^FO{margem},{y_rodape_rotulo}^A0N,{altura_rotulo_rodape},{altura_rotulo_rodape}^FDNF DE ENTRADA^FS\n"
        f"^FO{margem},{y_rodape_valor}^A0N,24,20^FD{nf_entrada_str}^FS\n"
        f"^FO0,{y_rodape_rotulo}^A0N,11,11^FB{largura - margem},1,0,R,0^FD{data_hora}^FS\n"
        "^XZ\n"
    )
    return zpl


def gerar_zpl(os_reparadora: str, nf_remessa_allied: str, modelo_comercial: str) -> str:
    largura = mm_para_dots(LARGURA_ETIQUETA_MM)   # 60mm -> 480 dots (203dpi)
    altura = mm_para_dots(ALTURA_ETIQUETA_MM)     # 40mm -> 320 dots (203dpi)

    os_num = _sanitizar(os_reparadora)
    nf = _sanitizar(nf_remessa_allied)
    modelo = _sanitizar(modelo_comercial)
    data_hora = datetime.now().strftime("%d/%m/%Y %H:%M")

    margem = 12
    coluna_direita_x = int(largura * 0.60)
    largura_coluna_direita = largura - coluna_direita_x - margem
    largura_coluna_esquerda = coluna_direita_x - margem

    # ---- Fontes ajustadas automaticamente ao espaço disponível ----
    altura_modelo, largura_modelo = _fonte_ajustada(
        modelo, largura_coluna_esquerda, largura_max=20
    )
    altura_nf, largura_nf = _fonte_ajustada(
        nf, largura_coluna_direita, largura_max=18
    )
    altura_os, largura_os = _fonte_ajustada(
        os_num, largura - 2 * margem, largura_max=44
    )

    # ---- Código de barras da OS, centralizado na etiqueta inteira ----
    # (pedido explícito, 06/10/2026: tirar o código de barras da NF
    # Remessa — não precisa mais imprimir — e centralizar o da OS, que
    # antes dividia a largura com o da NF, cada um na sua metade)
    modulo_barra_os = 1
    altura_barra = 45

    largura_bc_os = _estimar_largura_barcode(os_num, modulo_barra_os)
    x_bc_os = max(margem, (largura - largura_bc_os) // 2)

    zpl = (
        "^XA\n"
        f"^PW{largura}\n"
        f"^LL{altura}\n"
        "^CI28\n"

        # ------------------- CABEÇALHO -------------------
        f"^FO{margem},10^A0N,16,16^FD{NOME_LOJA_TOPO}^FS\n"
        f"^FO0,12^A0N,13,13^FB{largura - margem},1,0,R,0^FD{NOME_LOJA_DIREITA}^FS\n"
        f"^FO0,38^GB{largura},2,2^FS\n"

        # -------------- MODELO (esquerda) / NF (direita) --------------
        f"^FO{margem},44^A0N,10,10^FDMODELO DO APARELHO^FS\n"
        f"^FO{margem},58^A0N,{altura_modelo},{largura_modelo}"
        f"^FB{largura_coluna_esquerda},1,0,L,0^FD{modelo}^FS\n"
        f"^FO{coluna_direita_x},44^A0N,10,10^FB{largura_coluna_direita},1,0,C,0^FDNF^FS\n"
        f"^FO{coluna_direita_x},58^A0N,{altura_nf},{largura_nf}"
        f"^FB{largura_coluna_direita},1,0,C,0^FD{nf}^FS\n"
        f"^FO0,108^GB{largura},2,2^FS\n"

        # ------------------- ORDEM DE SERVICO (centro, BEM grande) -------------------
        f"^FO0,113^A0N,12,12^FB{largura},1,0,C,0^FDORDEM DE SERVICO^FS\n"
        f"^FO0,130^A0N,{altura_os},{largura_os}^FB{largura},1,0,C,0^FD{os_num}^FS\n"
        f"^FO0,204^GB{largura},2,2^FS\n"

        # ------------- CÓDIGO DE BARRAS DA OS, CENTRALIZADO -------------
        f"^FO{x_bc_os},210^BY{modulo_barra_os}\n"
        f"^BCN,{altura_barra},N,N,N\n"
        f"^FD{os_num}^FS\n"
        f"^FO0,262^GB{largura},2,2^FS\n"

        # ------------------- RODAPÉ -------------------
        f"^FO{margem},270^A0N,11,11^FDDATA: {data_hora}^FS\n"
        f"^FO0,270^A0N,11,11^FB{largura - margem},1,0,R,0^FD{RODAPE_DIREITA}^FS\n"

        "^XZ\n"
    )
    return zpl
