/**
 * Envia um FormData via XHR (em vez de fetch) para conseguir acompanhar
 * o percentual de envio do arquivo — usado nas barras de progresso das
 * telas de importação de base.
 */
export function uploadComProgresso(
  url: string,
  formData: FormData,
  onProgresso: (percentual: number) => void
): Promise<{ ok: boolean; status: number; data: unknown }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgresso(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      let data: unknown = null;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        // resposta não era JSON — data fica null
      }
      resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, data });
    };

    xhr.onerror = () => reject(new Error("Falha de conexão ao enviar o arquivo."));

    xhr.send(formData);
  });
}
