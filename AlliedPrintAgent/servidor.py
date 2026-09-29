# -*- coding: utf-8 -*-
"""
Servidor HTTP local do Allied Print Agent.

Fica escutando em http://127.0.0.1:<PORTA> (só esse computador consegue
falar com ele — não é acessível pela rede). A tela do Sistema Allied
(Ag. Triagem e Impressão Avulsa) manda um POST /imprimir com os dados do
aparelho; o agente monta o ZPL e envia pra Zebra.

Rota /imprimir-caixa (Ag. Emissão de Nota Fiscal — etiqueta de caixa,
Teste de Impressão e Etiqueta Avulsa): mesma ideia, mas com os campos
LOTE / VOLUME / NF DE RETORNO / OBSERVAÇÃO / NF DE ENTRADA (ver
etiqueta.gerar_zpl_caixa) — usa a mesma etiqueta 60x40mm e a mesma
função imprimir(), só muda o layout do ZPL gerado.
"""

import json
import os
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from config import PORTA
from etiqueta import gerar_zpl, gerar_zpl_caixa
from imprimir import imprimir, ErroImpressao

# Salva sempre o ZPL da última etiqueta gerada, pra dar pra comparar
# exatamente o que foi mandado pra impressora com o que saiu no papel —
# útil pra depurar diferença entre o layout esperado e o impresso.
CAMINHO_ULTIMA_ETIQUETA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ultima_etiqueta.zpl")
CAMINHO_ULTIMA_ETIQUETA_CAIXA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ultima_etiqueta_caixa.zpl")


class Handler(BaseHTTPRequestHandler):
    def _cors(self):
        # CORS liberado — o agente só escuta em localhost, então só um
        # processo rodando NESSE computador (o navegador do operador)
        # consegue alcançá-lo de qualquer jeito.
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        if self.path == "/status":
            self._responder(200, {"ok": True, "servico": "Allied Print Agent"})
        else:
            self._responder(404, {"erro": "Rota não encontrada."})

    def do_POST(self):
        if self.path == "/imprimir":
            self._imprimir_padrao()
        elif self.path == "/imprimir-caixa":
            self._imprimir_caixa()
        else:
            self._responder(404, {"erro": "Rota não encontrada."})

    def _ler_json(self):
        tamanho = int(self.headers.get("Content-Length", 0) or 0)
        corpo = self.rfile.read(tamanho) if tamanho else b"{}"
        return json.loads(corpo or b"{}")

    def _imprimir_padrao(self):
        try:
            dados = self._ler_json()
        except (ValueError, json.JSONDecodeError):
            self._responder(400, {"erro": "JSON inválido."})
            return

        os_reparadora = str(dados.get("os_reparadora") or "").strip()
        nf_remessa_allied = str(dados.get("nf_remessa_allied") or "").strip()
        modelo_comercial = str(dados.get("modelo_comercial") or "").strip()

        if not os_reparadora:
            self._responder(400, {"erro": "os_reparadora é obrigatório."})
            return

        zpl = gerar_zpl(os_reparadora, nf_remessa_allied, modelo_comercial)

        try:
            with open(CAMINHO_ULTIMA_ETIQUETA, "w", encoding="utf-8") as f:
                f.write(zpl)
        except OSError:
            pass  # log auxiliar — não impede a impressão se falhar ao salvar

        self._log(f"ZPL gerado (salvo em {CAMINHO_ULTIMA_ETIQUETA}):\n{zpl}")

        try:
            imprimir(zpl)
        except ErroImpressao as e:
            self._log(f"FALHA ao imprimir OS {os_reparadora}: {e}")
            self._responder(502, {"erro": str(e)})
            return
        except Exception as e:
            self._log(f"ERRO inesperado ao imprimir OS {os_reparadora}: {e}")
            self._responder(500, {"erro": f"Erro inesperado: {e}"})
            return

        self._log(f"OK — etiqueta impressa: OS {os_reparadora} | NF {nf_remessa_allied} | {modelo_comercial}")
        self._responder(200, {"ok": True})

    def _imprimir_caixa(self):
        try:
            dados = self._ler_json()
        except (ValueError, json.JSONDecodeError):
            self._responder(400, {"erro": "JSON inválido."})
            return

        lote = dados.get("lote")
        volume_atual = dados.get("volume_atual")
        volume_total = dados.get("volume_total")
        nf_retorno = str(dados.get("nf_retorno") or "").strip()
        observacao = str(dados.get("observacao") or "").strip()
        nf_entrada = str(dados.get("nf_entrada") or "").strip()

        if lote is None or volume_atual is None or volume_total is None:
            self._responder(400, {"erro": "lote, volume_atual e volume_total são obrigatórios."})
            return

        zpl = gerar_zpl_caixa(lote, volume_atual, volume_total, nf_retorno, observacao, nf_entrada)

        try:
            with open(CAMINHO_ULTIMA_ETIQUETA_CAIXA, "w", encoding="utf-8") as f:
                f.write(zpl)
        except OSError:
            pass  # log auxiliar — não impede a impressão se falhar ao salvar

        self._log(f"ZPL de caixa gerado (salvo em {CAMINHO_ULTIMA_ETIQUETA_CAIXA}):\n{zpl}")

        try:
            imprimir(zpl)
        except ErroImpressao as e:
            self._log(f"FALHA ao imprimir etiqueta de caixa (lote {lote}): {e}")
            self._responder(502, {"erro": str(e)})
            return
        except Exception as e:
            self._log(f"ERRO inesperado ao imprimir etiqueta de caixa (lote {lote}): {e}")
            self._responder(500, {"erro": f"Erro inesperado: {e}"})
            return

        self._log(
            f"OK — etiqueta de caixa impressa: LOTE {lote} | VOLUME {volume_atual}/{volume_total} | "
            f"NF RETORNO {nf_retorno} | {observacao} | NF ENTRADA {nf_entrada}"
        )
        self._responder(200, {"ok": True})

    def _responder(self, status: int, corpo: dict):
        payload = json.dumps(corpo, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self._cors()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def _log(self, mensagem: str):
        hora = datetime.now().strftime("%H:%M:%S")
        print(f"[{hora}] {mensagem}")

    def log_message(self, format, *args):
        # silencia o log padrão barulhento do http.server (uma linha por
        # requisição) — cada ação relevante já é logada por _log() acima
        pass


def iniciar():
    servidor = ThreadingHTTPServer(("127.0.0.1", PORTA), Handler)
    print("=" * 60)
    print(" Allied Print Agent")
    print(f" Escutando em http://127.0.0.1:{PORTA}")
    print(" Deixe essa janela aberta enquanto usar a Ag. Triagem")
    print(" ou a Impressão Avulsa no Sistema Allied.")
    print(" Pressione Ctrl+C pra encerrar.")
    print("=" * 60)
    try:
        servidor.serve_forever()
    except KeyboardInterrupt:
        print("\nEncerrado.")
    finally:
        servidor.server_close()
