import type { VercelRequest, VercelResponse } from "@vercel/node";
import { chamarServicoSoap, extrairTagResposta } from "../_lib/nfe/soapClient.js";
import { ACTION_STATUS_SERVICO, CUF_ESPIRITO_SANTO, NAMESPACE_STATUS_SERVICO, urlStatusServico, type AmbienteNFe } from "../_lib/nfe/webservices.js";

/**
 * Endpoint so de diagnostico: consulta o status do servico da SEFAZ (SVRS)
 * via mTLS, sem envolver nenhuma nota fiscal. Primeiro teste real de ponta a
 * ponta da conexao mTLS a partir do Vercel - se isso funcionar, a submissao
 * de verdade (NfeAutorizacao4) tambem deve funcionar, ja que usa o mesmo
 * cliente SOAP.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const p12Base64 = process.env.NFE_CERTIFICADO_P12_BASE64;
  const senha = process.env.NFE_CERTIFICADO_SENHA;

  if (!p12Base64 || !senha) {
    return res.status(500).json({
      erro: "NFE_CERTIFICADO_P12_BASE64 / NFE_CERTIFICADO_SENHA nao configurados nas variaveis de ambiente do Vercel",
    });
  }

  const ambiente: AmbienteNFe = (req.query.ambiente as string) === "producao" ? "producao" : "homologacao";
  const tpAmb = ambiente === "producao" ? 1 : 2;

  const corpo = `<consStatServ xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><tpAmb>${tpAmb}</tpAmb><cUF>${CUF_ESPIRITO_SANTO}</cUF><xServ>STATUS</xServ></consStatServ>`;

  try {
    const pfxBuffer = Buffer.from(p12Base64, "base64");
    const resposta = await chamarServicoSoap(
      urlStatusServico(ambiente),
      NAMESPACE_STATUS_SERVICO,
      ACTION_STATUS_SERVICO,
      corpo,
      { pfxBuffer, senha },
    );

    return res.status(200).json({
      ambiente,
      cStat: extrairTagResposta(resposta, "cStat"),
      xMotivo: extrairTagResposta(resposta, "xMotivo"),
      dhRecbto: extrairTagResposta(resposta, "dhRecbto"),
      tMed: extrairTagResposta(resposta, "tMed"),
      respostaBrutaTruncada: resposta.slice(0, 3000),
    });
  } catch (error: any) {
    return res.status(502).json({ erro: error.message ?? String(error) });
  }
}
