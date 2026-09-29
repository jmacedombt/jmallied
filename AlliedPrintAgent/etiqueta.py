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
                          21 aparelhos por caixa)
      NF DE RETORNO   -> fonte maior e em negrito (pedido explícito)
      OBSERVAÇÃO      -> APROVADO ou REPROVADO, em destaque (fundo preto)
      NF DE ENTRADA   -> a NF Remessa que seguiu o(s) orçamento(s) até aqui
    Também usada pro "Teste de Impressão" e pra "Etiqueta Avulsa" (campos
    em aberto) da mesma tela — os dois usam essa mesma função.
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

    # ---- Fonte da NF de Retorno ajustada ao espaço, negrito aplicado à parte ----
    altura_nf, largura_nf = _fonte_ajustada(
        nf_retorno_str, largura - 2 * margem, largura_max=32, proporcao=1.1, largura_min=16
    )

    zpl = (
        "^XA\n"
        f"^PW{largura}\n"
        f"^LL{altura}\n"
        "^CI28\n"

        # ------------------- LOTE (esquerda) / VOLUME (direita) -------------------
        f"^FO{margem},8^A0N,11,11^FDLOTE^FS\n"
        f"^FO{margem},22^A0N,24,20^FD{lote_str}^FS\n"
        f"^FO{coluna_direita_x},8^A0N,11,11^FB{largura_coluna_direita},1,0,R,0^FDVOLUME^FS\n"
        f"^FO{coluna_direita_x},22^A0N,24,20^FB{largura_coluna_direita},1,0,R,0^FD{volume_str}^FS\n"
        f"^FO0,54^GB{largura},2,2^FS\n"

        # ------------------- NF DE RETORNO (grande, negrito) -------------------
        f"^FO0,60^A0N,12,12^FB{largura},1,0,C,0^FDNF DE RETORNO^FS\n"
    )
    zpl += _campo_negrito(0, 78, altura_nf, largura_nf, largura, "C", nf_retorno_str)

    y_apos_nf = 78 + altura_nf + 10
    zpl += f"^FO0,{y_apos_nf}^GB{largura},2,2^FS\n"

    # ------------------- OBSERVAÇÃO (destaque fundo preto / texto branco) -------------------
    y_obs = y_apos_nf + 6
    altura_caixa_obs = 46
    zpl += (
        f"^FO0,{y_obs}^GB{largura},{altura_caixa_obs},{altura_caixa_obs}^FS\n"
        f"^FO0,{y_obs + 12}^FR^A0N,22,20^FB{largura},1,0,C,0^FD{observacao_str}^FS\n"
    )

    y_apos_obs = y_obs + altura_caixa_obs + 8
    zpl += f"^FO0,{y_apos_obs}^GB{largura},2,2^FS\n"

    # ------------------- NF DE ENTRADA (esquerda) + DATA/HORA (direita) -------------------
    y_rodape = y_apos_obs + 6
    zpl += (
        f"^FO{margem},{y_rodape}^A0N,10,10^FDNF DE ENTRADA^FS\n"
        f"^FO{margem},{y_rodape + 14}^A0N,16,14^FD{nf_entrada_str}^FS\n"
        f"^FO0,{y_rodape}^A0N,9,9^FB{largura - margem},1,0,R,0^FD{data_hora}^FS\n"
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

    # ---- Códigos de barras lado a lado: OS na metade esquerda, NF na direita ----
    modulo_barra_os = 1
    modulo_barra_nf = 1
    altura_barra = 45
    metade = largura // 2

    largura_bc_os = _estimar_largura_barcode(os_num, modulo_barra_os)
    x_bc_os = max(margem, (metade - largura_bc_os) // 2)

    largura_bc_nf = _estimar_largura_barcode(nf, modulo_barra_nf)
    x_bc_nf = metade + max(0, (metade - largura_bc_nf) // 2)

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

        # ------------- CÓDIGOS DE BARRAS: OS (esquerda) / NF (direita) -------------
        f"^FO{x_bc_os},210^BY{modulo_barra_os}\n"
        f"^BCN,{altura_barra},N,N,N\n"
        f"^FD{os_num}^FS\n"
        f"^FO{x_bc_nf},210^BY{modulo_barra_nf}\n"
        f"^BCN,{altura_barra},N,N,N\n"
        f"^FD{nf}^FS\n"
        f"^FO0,262^GB{largura},2,2^FS\n"

        # ------------------- RODAPÉ -------------------
        f"^FO{margem},270^A0N,11,11^FDDATA: {data_hora}^FS\n"
        f"^FO0,270^A0N,11,11^FB{largura - margem},1,0,R,0^FD{RODAPE_DIREITA}^FS\n"

        "^XZ\n"
    )
    return zpl
