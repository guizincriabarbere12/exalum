/**
 * Endpoints do webservice de NF-e para o Espirito Santo. O ES nao tem SEFAZ
 * propria para autorizacao de NF-e - usa a Sefaz Virtual do Rio Grande do Sul
 * (SVRS) como autorizadora, confirmado em https://dfe-portal.svrs.rs.gov.br/Nfe/Servicos
 * (buscado ao vivo, nao de memoria - esses hosts mudam raramente mas a lista
 * exata de servicos disponiveis pode mudar).
 */

export type AmbienteNFe = "homologacao" | "producao";

const HOSTS: Record<AmbienteNFe, string> = {
  homologacao: "nfe-homologacao.svrs.rs.gov.br",
  producao: "nfe.svrs.rs.gov.br",
};

export function urlAutorizacao(ambiente: AmbienteNFe): string {
  return `https://${HOSTS[ambiente]}/ws/NfeAutorizacao/NFeAutorizacao4.asmx`;
}

export function urlRetAutorizacao(ambiente: AmbienteNFe): string {
  return `https://${HOSTS[ambiente]}/ws/NfeRetAutorizacao/NFeRetAutorizacao4.asmx`;
}

export function urlStatusServico(ambiente: AmbienteNFe): string {
  return `https://${HOSTS[ambiente]}/ws/NfeStatusServico/NfeStatusServico4.asmx`;
}

export function urlConsulta(ambiente: AmbienteNFe): string {
  return `https://${HOSTS[ambiente]}/ws/NfeConsulta/NfeConsulta4.asmx`;
}

/** cUF do Espirito Santo, usado no XML e nas consultas de status. */
export const CUF_ESPIRITO_SANTO = "32";

/**
 * SOAPAction (header Content-Type "action") de cada operacao - precisa ser o
 * caminho completo da operacao, nao so o namespace base do servico. Errar
 * isso causa HTTP 400 direto da SVRS, antes de qualquer processamento da
 * nota (confirmado testando NFeAutorizacao4 em producao por engano).
 */
export const NAMESPACE_STATUS_SERVICO = "http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4";
export const ACTION_STATUS_SERVICO = "http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4/nfeStatusServicoNF";

export const NAMESPACE_AUTORIZACAO = "http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4";
export const ACTION_AUTORIZACAO = "http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4/nfeAutorizacaoLote";

export const NAMESPACE_RET_AUTORIZACAO = "http://www.portalfiscal.inf.br/nfe/wsdl/NFeRetAutorizacao4";
export const ACTION_RET_AUTORIZACAO = "http://www.portalfiscal.inf.br/nfe/wsdl/NFeRetAutorizacao4/nfeRetAutorizacaoLote";
