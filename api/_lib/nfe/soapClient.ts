import https from "node:https";
import { CA_ICP_BRASIL } from "./caIcpBrasil.js";

/**
 * Cliente SOAP 1.2 com mTLS (certificado do cliente) para os webservices da
 * NF-e. Usa node:https diretamente (nao fetch) porque e o jeito confiavel de
 * fazer mutual TLS em Node - Deno.createHttpClient com certificado de
 * cliente NAO e suportado de forma estavel nas Supabase Edge Functions, por
 * isso essa parte roda como Vercel Serverless Function (runtime Node), nao
 * como Edge Function.
 */

export interface CredenciaisMTLS {
  pfxBuffer: Buffer;
  senha: string;
}

function montarEnvelopeSoap(namespaceServico: string, corpoXml: string): string {
  return (
    `<?xml version="1.0" encoding="utf-8"?>` +
    `<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ` +
    `xmlns:xsd="http://www.w3.org/2001/XMLSchema" ` +
    `xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">` +
    `<soap12:Body>` +
    `<nfeDadosMsg xmlns="${namespaceServico}">${corpoXml}</nfeDadosMsg>` +
    `</soap12:Body>` +
    `</soap12:Envelope>`
  );
}

export function chamarServicoSoap(
  url: string,
  namespaceServico: string,
  action: string,
  corpoXml: string,
  credenciais: CredenciaisMTLS,
  timeoutMs = 30000,
): Promise<string> {
  const envelope = montarEnvelopeSoap(namespaceServico, corpoXml);
  const urlObj = new URL(url);

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: urlObj.hostname,
        path: urlObj.pathname + urlObj.search,
        method: "POST",
        pfx: credenciais.pfxBuffer,
        passphrase: credenciais.senha,
        // sem isso o Node rejeita o certificado do servidor da SEFAZ com
        // "unable to get local issuer certificate" - a cadeia ICP-Brasil
        // nao esta no bundle padrao de CAs confiaveis do Node.
        ca: CA_ICP_BRASIL,
        headers: {
          // o "action" precisa ser o caminho completo da operacao
          // (ex.: .../NFeAutorizacao4/nfeAutorizacaoLote), nao so o
          // namespace base - a SVRS rejeita com HTTP 400 se for só o
          // namespace, mesmo a NfeStatusServico4 aceitando por acaso.
          "Content-Type": `application/soap+xml; charset=utf-8; action="${action}"`,
          "Content-Length": Buffer.byteLength(envelope),
        },
        timeout: timeoutMs,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const body = Buffer.concat(chunks).toString("utf-8");
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve(body);
          } else {
            reject(new Error(`SEFAZ respondeu HTTP ${res.statusCode}: ${body.slice(0, 2000)}`));
          }
        });
      },
    );

    req.on("timeout", () => {
      req.destroy(new Error(`Timeout de ${timeoutMs}ms ao chamar ${url}`));
    });
    req.on("error", (err) => {
      reject(new Error(`Falha de conexao mTLS com ${url}: ${err.message}`));
    });

    req.write(envelope);
    req.end();
  });
}

/** Extrai o conteudo de uma tag simples da resposta SOAP (sem namespace prefixado). */
export function extrairTagResposta(xmlResposta: string, tag: string): string | null {
  const match = xmlResposta.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`));
  return match ? match[1] : null;
}

/**
 * A resposta do NfeAutorizacao4 tem cStat/xMotivo em DOIS niveis: um no
 * <retEnviNFe> (status do LOTE - "recebido", "processado" etc, nao diz nada
 * sobre a nota em si) e outro dentro de <protNFe><infProt> (o resultado real
 * da nota: autorizada, rejeitada, etc). extrairTagResposta pega sempre a
 * PRIMEIRA ocorrencia no documento inteiro, que e a do lote - por isso um
 * lote "processado" com sucesso (cStat 104) mascarava uma rejeicao real
 * (cStat 598) que só existia dentro do infProt. Usa esta funcao para o
 * resultado que importa de verdade.
 */
export function extrairResultadoDaNota(xmlResposta: string): {
  cStat: string | null;
  xMotivo: string | null;
  nProt: string | null;
} {
  const infProtMatch = xmlResposta.match(/<infProt[^>]*>([\s\S]*?)<\/infProt>/);
  const bloco = infProtMatch ? infProtMatch[1] : xmlResposta;
  return {
    cStat: extrairTagResposta(bloco, "cStat"),
    xMotivo: extrairTagResposta(bloco, "xMotivo"),
    nProt: extrairTagResposta(bloco, "nProt"),
  };
}
