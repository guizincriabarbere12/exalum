import type { ItemNFe, NotaFiscalInput } from "./tipos.js";

/**
 * Monta o XML da NF-e (layout 4.00, modelo 55) a partir de um NotaFiscalInput
 * ja com a chave de acesso calculada. A ordem dos elementos SEGUE o XSD
 * (nfe_v4.00.xsd) - SEFAZ valida por posicao, nao so por presenca dos campos.
 *
 * Defaults fiscais assumidos aqui (documentados porque precisam de revisao
 * do contador antes de emitir em producao):
 *  - PIS/COFINS: CST 07 (isento/nao incidencia), sem calculo de aliquota -
 *    correto pra quem recolhe PIS/COFINS pelo Simples Nacional (embutido no
 *    DAS); se o regime for Lucro Presumido/Real com incidencia cumulativa,
 *    isso precisa mudar para PISAliq/COFINSAliq com a aliquota real.
 *  - ICMS: usa CST/CSOSN vindo do proprio produto (cst_icms). Para CST 60
 *    (ICMS ja retido por substituicao tributaria) e CSOSN 102/103/300/500
 *    (Simples Nacional sem credito) o bloco fica minimo (orig+CST/CSOSN),
 *    sem base de calculo - e exatamente o caso que o usuario descreveu
 *    ("ICMS ja tributado antes"). Qualquer outro CST cai num bloco generico
 *    com base de calculo zerada, que PRECISA ser revisado manualmente.
 */

function escaparXml(valor: string): string {
  return valor
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function fmtMoeda(valor: number): string {
  return valor.toFixed(2);
}

function fmtQtd(valor: number): string {
  return valor.toFixed(4);
}

function fmtUnitario(valor: number): string {
  return valor.toFixed(4);
}

function fmtDataHora(data: Date): string {
  // formato TDateTimeUTC exigido: AAAA-MM-DDTHH:MM:SS-03:00 (fuso de Brasilia, sem horario de verao).
  // Usa sempre os getters UTC sobre um Date deslocado -3h, nunca getHours()
  // "cru": o runtime do Vercel roda em UTC, entao getHours() já devolvia a
  // hora UTC, e so colar o sufixo "-03:00" nela (sem de fato subtrair 3h)
  // produzia um horario 3h ADIANTADO do horario real de Brasilia - a SEFAZ
  // rejeitava com "Data-Hora de Emissao posterior ao horario de recebimento"
  // porque a nota parecia ter sido emitida no futuro.
  const BRASILIA_OFFSET_MS = 3 * 60 * 60 * 1000;
  const brasilia = new Date(data.getTime() - BRASILIA_OFFSET_MS);
  const pad = (n: number) => String(n).padStart(2, "0");
  const y = brasilia.getUTCFullYear();
  const m = pad(brasilia.getUTCMonth() + 1);
  const d = pad(brasilia.getUTCDate());
  const h = pad(brasilia.getUTCHours());
  const min = pad(brasilia.getUTCMinutes());
  const s = pad(brasilia.getUTCSeconds());
  return `${y}-${m}-${d}T${h}:${min}:${s}-03:00`;
}

function montarEnderEmit(dados: NotaFiscalInput): string {
  const e = dados.emitente;
  return [
    "<enderEmit>",
    `<xLgr>${escaparXml(e.logradouro)}</xLgr>`,
    `<nro>${escaparXml(e.numero)}</nro>`,
    `<xBairro>${escaparXml(e.bairro)}</xBairro>`,
    `<cMun>${e.codigoMunicipioIbge}</cMun>`,
    `<xMun>${escaparXml(e.municipio)}</xMun>`,
    `<UF>${e.uf}</UF>`,
    `<CEP>${e.cep.replace(/\D/g, "")}</CEP>`,
    "<cPais>1058</cPais>",
    "<xPais>Brasil</xPais>",
    e.telefone ? `<fone>${e.telefone.replace(/\D/g, "")}</fone>` : "",
    "</enderEmit>",
  ].join("");
}

function montarEmit(dados: NotaFiscalInput): string {
  const e = dados.emitente;
  return [
    "<emit>",
    `<CNPJ>${e.cnpj.replace(/\D/g, "")}</CNPJ>`,
    `<xNome>${escaparXml(e.xNome)}</xNome>`,
    montarEnderEmit(dados),
    `<IE>${e.ie.replace(/\D/g, "")}</IE>`,
    `<CRT>${e.crt}</CRT>`,
    "</emit>",
  ].join("");
}

function montarEnderDest(dados: NotaFiscalInput): string {
  const d = dados.destinatario;
  if (!d.logradouro || !d.codigoMunicipioIbge || !d.municipio || !d.uf || !d.cep) return "";
  return [
    "<enderDest>",
    `<xLgr>${escaparXml(d.logradouro)}</xLgr>`,
    `<nro>${escaparXml(d.numero || "S/N")}</nro>`,
    d.bairro ? `<xBairro>${escaparXml(d.bairro)}</xBairro>` : "<xBairro>Centro</xBairro>",
    `<cMun>${d.codigoMunicipioIbge}</cMun>`,
    `<xMun>${escaparXml(d.municipio)}</xMun>`,
    `<UF>${d.uf}</UF>`,
    `<CEP>${d.cep.replace(/\D/g, "")}</CEP>`,
    "<cPais>1058</cPais>",
    "<xPais>Brasil</xPais>",
    "</enderDest>",
  ].join("");
}

function montarDest(dados: NotaFiscalInput): string {
  const d = dados.destinatario;
  const docIdent = d.cnpj
    ? `<CNPJ>${d.cnpj.replace(/\D/g, "")}</CNPJ>`
    : d.cpf
      ? `<CPF>${d.cpf.replace(/\D/g, "")}</CPF>`
      : (() => {
          throw new Error("Destinatario precisa de CNPJ ou CPF");
        })();

  return [
    "<dest>",
    docIdent,
    `<xNome>${escaparXml(d.xNome)}</xNome>`,
    montarEnderDest(dados),
    `<indIEDest>${d.indicadorIE}</indIEDest>`,
    d.indicadorIE === 1 && d.ie ? `<IE>${d.ie.replace(/\D/g, "")}</IE>` : "",
    d.email ? `<email>${escaparXml(d.email)}</email>` : "",
    "</dest>",
  ].join("");
}

/** Grupo ICMS do item, ramificado pelo CRT do emitente e pelo CST/CSOSN do produto. */
function montarIcms(item: ItemNFe, crt: 1 | 3): string {
  const orig = item.origemMercadoria;
  // CST do ICMS tem sempre 2 digitos no XML ("60", nunca "060"), mas o
  // cadastro do produto guarda "060" (convencao visual comum) - normaliza
  // via Number() em vez de padStart, que so acrescenta zeros e nunca REMOVE
  // um zero a mais (padStart("060", 2, "0") continua "060", por isso o
  // comparativo cst === "60" nunca batia e tudo caia no bloco generico).
  const cst = String(Number(item.cstIcms)).padStart(2, "0");

  if (crt === 1) {
    // Simples Nacional: usa CSOSN, nao CST. Os codigos "sem credito" (102,103,300,500)
    // nao levam base de calculo.
    const csosnsSemCredito = ["102", "103", "300", "400", "500"];
    const csosn = String(Number(item.cstIcms)).padStart(3, "0");
    if (csosnsSemCredito.includes(csosn)) {
      return `<ICMS><ICMSSN102><orig>${orig}</orig><CSOSN>${csosn}</CSOSN></ICMSSN102></ICMS>`;
    }
    // qualquer outro CSOSN cai aqui como generico - precisa revisao do contador
    return `<ICMS><ICMSSN900><orig>${orig}</orig><CSOSN>${csosn}</CSOSN></ICMSSN900></ICMS>`;
  }

  // Regime Normal (CRT 3)
  if (cst === "60") {
    // ICMS ja retido por substituicao tributaria - o caso descrito pelo usuario
    return `<ICMS><ICMS60><orig>${orig}</orig><CST>60</CST></ICMS60></ICMS>`;
  }
  if (cst === "40" || cst === "41" || cst === "50") {
    // Isenta / nao tributada / suspensao
    return `<ICMS><ICMS40><orig>${orig}</orig><CST>${cst}</CST></ICMS40></ICMS>`;
  }

  // Generico (ex.: CST 00) - base de calculo e aliquota nao configuradas no
  // sistema ainda; fica zerado e PRECISA de revisao antes de emitir de verdade.
  return [
    "<ICMS><ICMS00>",
    `<orig>${orig}</orig>`,
    `<CST>${cst}</CST>`,
    `<modBC>3</modBC>`,
    `<vBC>${fmtMoeda(0)}</vBC>`,
    `<pICMS>${fmtMoeda(0)}</pICMS>`,
    `<vICMS>${fmtMoeda(0)}</vICMS>`,
    "</ICMS00></ICMS>",
  ].join("");
}

function montarPisCofins(): string {
  // Ver comentario no topo do arquivo: default e "nao incidencia" (CST 07),
  // seguro para Simples Nacional. Revisar se o regime mudar.
  return "<PIS><PISNT><CST>07</CST></PISNT></PIS><COFINS><COFINSNT><CST>07</CST></COFINSNT></COFINS>";
}

interface CalculoIbsCbs {
  vBC: number;
  pIBSUF: number;
  vIBSUF: number;
  pIBSMun: number;
  vIBSMun: number;
  vIBS: number;
  pCBS: number;
  vCBS: number;
}

/**
 * Aliquotas de teste da fase de calibragem de 2026: 0,10% de IBS estadual +
 * 0,90% de CBS federal (IBS municipal ainda proximo de zero nesta fase).
 * Essas aliquotas sao fixadas por lei para 2026 e sobem nos anos seguintes -
 * PRECISA ser revisado/atualizado quando a fase de transicao avancar.
 * Usada tanto no bloco por item quanto no total agregado da nota, pra nunca
 * os dois ficarem inconsistentes entre si.
 */
function calcularIbsCbs(item: ItemNFe): CalculoIbsCbs {
  const vBC = item.valorTotal;
  const pIBSUF = 0.1;
  const pIBSMun = 0;
  const pCBS = 0.9;
  const vIBSUF = Number((vBC * (pIBSUF / 100)).toFixed(2));
  const vIBSMun = Number((vBC * (pIBSMun / 100)).toFixed(2));
  const vIBS = Number((vIBSUF + vIBSMun).toFixed(2));
  const vCBS = Number((vBC * (pCBS / 100)).toFixed(2));
  return { vBC, pIBSUF, vIBSUF, pIBSMun, vIBSMun, vIBS, pCBS, vCBS };
}

/**
 * Grupo IBS/CBS por item (Reforma Tributaria - EC 132/2023), obrigatorio na
 * NF-e desde 01/01/2026 (NT 2025.002 e correlatas) - SEFAZ rejeita com
 * "IBS/CBS nao informado" sem isso, independente do CST/CRT do ICMS
 * tradicional, que continua coexistindo durante a fase de transicao.
 * Usa CST 000 + cClassTrib 000001 (tributacao integral padrao).
 */
function montarIbsCbs(item: ItemNFe): string {
  const { vBC, pIBSUF, vIBSUF, pIBSMun, vIBSMun, vIBS, pCBS, vCBS } = calcularIbsCbs(item);

  return [
    "<IBSCBS>",
    "<CST>000</CST>",
    "<cClassTrib>000001</cClassTrib>",
    "<gIBSCBS>",
    `<vBC>${fmtMoeda(vBC)}</vBC>`,
    "<gIBSUF>",
    `<pIBSUF>${pIBSUF.toFixed(4)}</pIBSUF>`,
    `<vIBSUF>${fmtMoeda(vIBSUF)}</vIBSUF>`,
    "</gIBSUF>",
    "<gIBSMun>",
    `<pIBSMun>${pIBSMun.toFixed(4)}</pIBSMun>`,
    `<vIBSMun>${fmtMoeda(vIBSMun)}</vIBSMun>`,
    "</gIBSMun>",
    `<vIBS>${fmtMoeda(vIBS)}</vIBS>`,
    "<gCBS>",
    `<pCBS>${pCBS.toFixed(4)}</pCBS>`,
    `<vCBS>${fmtMoeda(vCBS)}</vCBS>`,
    "</gCBS>",
    "</gIBSCBS>",
    "</IBSCBS>",
  ].join("");
}

function montarItem(item: ItemNFe, crt: 1 | 3): string {
  return [
    `<det nItem="${item.numeroItem}">`,
    "<prod>",
    `<cProd>${escaparXml(item.codigo)}</cProd>`,
    `<cEAN>SEM GTIN</cEAN>`,
    `<xProd>${escaparXml(item.descricao)}</xProd>`,
    `<NCM>${item.ncm.replace(/\D/g, "")}</NCM>`,
    `<CFOP>${item.cfop}</CFOP>`,
    `<uCom>${escaparXml(item.unidade)}</uCom>`,
    `<qCom>${fmtQtd(item.quantidade)}</qCom>`,
    `<vUnCom>${fmtUnitario(item.valorUnitario)}</vUnCom>`,
    `<vProd>${fmtMoeda(item.valorTotal)}</vProd>`,
    `<cEANTrib>SEM GTIN</cEANTrib>`,
    `<uTrib>${escaparXml(item.unidade)}</uTrib>`,
    `<qTrib>${fmtQtd(item.quantidade)}</qTrib>`,
    `<vUnTrib>${fmtUnitario(item.valorUnitario)}</vUnTrib>`,
    `<indTot>1</indTot>`,
    "</prod>",
    "<imposto>",
    montarIcms(item, crt),
    montarPisCofins(),
    montarIbsCbs(item),
    "</imposto>",
    "</det>",
  ].join("");
}

/**
 * Totais agregados do grupo IBS/CBS (Reforma Tributaria) - vai dentro de
 * <total>, irmao do <ICMSTot>. SEFAZ rejeita com "Total de IBS e CBS nao
 * informado" se so o bloco por item (dentro de cada <det>) estiver presente
 * sem esse agregado da nota inteira.
 */
function montarIbsCbsTot(dados: NotaFiscalInput): string {
  const calculos = dados.itens.map(calcularIbsCbs);
  const soma = (campo: keyof CalculoIbsCbs) => calculos.reduce((acc, c) => acc + c[campo], 0);

  const vBCIBSCBS = Number(soma("vBC").toFixed(2));
  const vIBSUF = Number(soma("vIBSUF").toFixed(2));
  const vIBSMun = Number(soma("vIBSMun").toFixed(2));
  const vIBS = Number(soma("vIBS").toFixed(2));
  const vCBS = Number(soma("vCBS").toFixed(2));

  return [
    "<IBSCBSTot>",
    `<vBCIBSCBS>${fmtMoeda(vBCIBSCBS)}</vBCIBSCBS>`,
    "<gIBS>",
    "<gIBSUF>",
    `<vDif>${fmtMoeda(0)}</vDif>`,
    `<vDevTrib>${fmtMoeda(0)}</vDevTrib>`,
    `<vIBSUF>${fmtMoeda(vIBSUF)}</vIBSUF>`,
    "</gIBSUF>",
    "<gIBSMun>",
    `<vDif>${fmtMoeda(0)}</vDif>`,
    `<vDevTrib>${fmtMoeda(0)}</vDevTrib>`,
    `<vIBSMun>${fmtMoeda(vIBSMun)}</vIBSMun>`,
    "</gIBSMun>",
    `<vIBS>${fmtMoeda(vIBS)}</vIBS>`,
    `<vCredPres>${fmtMoeda(0)}</vCredPres>`,
    `<vCredPresCondSus>${fmtMoeda(0)}</vCredPresCondSus>`,
    "</gIBS>",
    "<gCBS>",
    `<vDif>${fmtMoeda(0)}</vDif>`,
    `<vDevTrib>${fmtMoeda(0)}</vDevTrib>`,
    `<vCBS>${fmtMoeda(vCBS)}</vCBS>`,
    `<vCredPres>${fmtMoeda(0)}</vCredPres>`,
    `<vCredPresCondSus>${fmtMoeda(0)}</vCredPresCondSus>`,
    "</gCBS>",
    "</IBSCBSTot>",
  ].join("");
}

function montarTotal(dados: NotaFiscalInput): string {
  return [
    "<total><ICMSTot>",
    `<vBC>${fmtMoeda(0)}</vBC>`,
    `<vICMS>${fmtMoeda(0)}</vICMS>`,
    `<vICMSDeson>${fmtMoeda(0)}</vICMSDeson>`,
    `<vFCP>${fmtMoeda(0)}</vFCP>`,
    `<vBCST>${fmtMoeda(0)}</vBCST>`,
    `<vST>${fmtMoeda(0)}</vST>`,
    `<vFCPST>${fmtMoeda(0)}</vFCPST>`,
    `<vFCPSTRet>${fmtMoeda(0)}</vFCPSTRet>`,
    `<vProd>${fmtMoeda(dados.valorTotalProdutos)}</vProd>`,
    `<vFrete>${fmtMoeda(0)}</vFrete>`,
    `<vSeg>${fmtMoeda(0)}</vSeg>`,
    `<vDesc>${fmtMoeda(0)}</vDesc>`,
    `<vII>${fmtMoeda(0)}</vII>`,
    `<vIPI>${fmtMoeda(0)}</vIPI>`,
    `<vIPIDevol>${fmtMoeda(0)}</vIPIDevol>`,
    `<vPIS>${fmtMoeda(0)}</vPIS>`,
    `<vCOFINS>${fmtMoeda(0)}</vCOFINS>`,
    `<vOutro>${fmtMoeda(0)}</vOutro>`,
    `<vNF>${fmtMoeda(dados.valorTotalNota)}</vNF>`,
    "</ICMSTot>",
    montarIbsCbsTot(dados),
    "</total>",
  ].join("");
}

function montarIde(dados: NotaFiscalInput): string {
  const chave = dados.chaveAcesso;
  // layout da chave (44 digitos, indices 0-based):
  // cUF(0-2) AAMM(2-6) CNPJ(6-20) mod(20-22) serie(22-25) nNF(25-34) tpEmis(34-35) cNF(35-43) DV(43-44)
  const cNF = chave.slice(35, 43);
  const cDV = chave.slice(43);
  const destUf = dados.destinatario.uf;
  const idDest = !destUf || destUf === dados.emitente.uf ? 1 : 2;

  return [
    "<ide>",
    `<cUF>${dados.cUF}</cUF>`,
    `<cNF>${cNF}</cNF>`,
    `<natOp>${escaparXml(dados.naturezaOperacao)}</natOp>`,
    "<mod>55</mod>",
    `<serie>${dados.serie}</serie>`,
    `<nNF>${dados.numeroNF}</nNF>`,
    `<dhEmi>${fmtDataHora(dados.dataEmissao)}</dhEmi>`,
    "<tpNF>1</tpNF>",
    `<idDest>${idDest}</idDest>`,
    `<cMunFG>${dados.emitente.codigoMunicipioIbge}</cMunFG>`,
    "<tpImp>1</tpImp>",
    "<tpEmis>1</tpEmis>",
    `<cDV>${cDV}</cDV>`,
    `<tpAmb>${dados.tpAmb}</tpAmb>`,
    "<finNFe>1</finNFe>",
    `<indFinal>${dados.indFinal}</indFinal>`,
    `<indPres>${dados.indPres}</indPres>`,
    "<procEmi>0</procEmi>",
    "<verProc>1.0.0</verProc>",
    "</ide>",
  ].join("");
}

function montarTransp(dados: NotaFiscalInput): string {
  return `<transp><modFrete>${dados.modFrete}</modFrete></transp>`;
}

function montarPag(dados: NotaFiscalInput): string {
  return [
    "<pag>",
    "<detPag>",
    "<indPag>0</indPag>",
    "<tPag>01</tPag>",
    `<vPag>${fmtMoeda(dados.valorTotalNota)}</vPag>`,
    "</detPag>",
    "</pag>",
  ].join("");
}

export function montarXmlNFe(dados: NotaFiscalInput): string {
  if (dados.itens.length === 0) throw new Error("NF-e precisa de ao menos 1 item");

  const infAdic = dados.informacoesAdicionais
    ? `<infAdic><infCpl>${escaparXml(dados.informacoesAdicionais)}</infCpl></infAdic>`
    : "";

  const itensXml = dados.itens.map((item) => montarItem(item, dados.emitente.crt)).join("");

  const infNFe = [
    `<infNFe versao="4.00" Id="NFe${dados.chaveAcesso}">`,
    montarIde(dados),
    montarEmit(dados),
    montarDest(dados),
    itensXml,
    montarTotal(dados),
    montarTransp(dados),
    montarPag(dados),
    infAdic,
    "</infNFe>",
  ].join("");

  return `<?xml version="1.0" encoding="UTF-8"?><NFe xmlns="http://www.portalfiscal.inf.br/nfe">${infNFe}</NFe>`;
}
