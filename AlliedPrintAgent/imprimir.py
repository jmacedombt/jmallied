# -*- coding: utf-8 -*-
"""
Envio do ZPL gerado para a impressora Zebra ZD220.

Dois modos suportados (ver config.MODO_IMPRESSAO):
  - "windows": impressão RAW via driver instalado no Windows (USB).
  - "rede":    envio direto por socket TCP (porta 9100) quando a
               impressora está na rede (Ethernet/Wi-Fi).

Idêntico em espírito ao impressao/imprimir.py do Samsung Tools original.
"""

import socket

from config import (
    MODO_IMPRESSAO,
    IP_IMPRESSORA,
    PORTA_IMPRESSORA,
    NOME_IMPRESSORA_WINDOWS,
)


class ErroImpressao(Exception):
    pass


def imprimir(zpl: str) -> None:
    if MODO_IMPRESSAO == "rede":
        _imprimir_rede(zpl)
    elif MODO_IMPRESSAO == "windows":
        _imprimir_windows(zpl)
    else:
        raise ErroImpressao(
            f"MODO_IMPRESSAO inválido em config.py: '{MODO_IMPRESSAO}'. "
            "Use 'windows' ou 'rede'."
        )


def _imprimir_rede(zpl: str) -> None:
    try:
        with socket.create_connection(
            (IP_IMPRESSORA, PORTA_IMPRESSORA), timeout=5
        ) as sock:
            sock.sendall(zpl.encode("utf-8"))
    except OSError as e:
        raise ErroImpressao(
            f"Falha ao conectar na impressora em {IP_IMPRESSORA}:{PORTA_IMPRESSORA}. "
            f"Verifique se a Zebra ZD220 está ligada e na mesma rede. Detalhe: {e}"
        ) from e


def _imprimir_windows(zpl: str) -> None:
    try:
        import win32print
    except ImportError as e:
        raise ErroImpressao(
            "O pacote 'pywin32' não está instalado. Rode: pip install pywin32 "
            "(necessário apenas no modo de impressão 'windows')."
        ) from e

    try:
        impressora = win32print.OpenPrinter(NOME_IMPRESSORA_WINDOWS)
    except Exception as e:
        raise ErroImpressao(
            f"Não foi possível abrir a impressora '{NOME_IMPRESSORA_WINDOWS}'. "
            "Confirme o nome exato em 'Impressoras e Scanners' no Windows. "
            f"Detalhe: {e}"
        ) from e

    try:
        hjob = win32print.StartDocPrinter(
            impressora, 1, ("Etiqueta Allied Print Agent", None, "RAW")
        )
        try:
            win32print.StartPagePrinter(impressora)
            win32print.WritePrinter(impressora, zpl.encode("utf-8"))
            win32print.EndPagePrinter(impressora)
        finally:
            win32print.EndDocPrinter(impressora)
    finally:
        win32print.ClosePrinter(impressora)
