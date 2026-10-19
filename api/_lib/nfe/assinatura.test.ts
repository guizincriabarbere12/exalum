import forge from "node-forge";
import { beforeAll, describe, expect, it } from "vitest";
import { montarChaveAcesso } from "./chaveAcesso.js";
import { montarXmlNFe } from "./xmlBuilder.js";
import { assinarNFe, canonicalizarInfNFe, verificarAssinatura } from "./assinatura.js";
import type { NotaFiscalInput } from "./tipos.js";

function xmlDeTeste(): string {
  const chave = montarChaveAcesso({
    cUF: "32",
    dataEmissao: new Date("2026-08-20T10:00:00"),
    cnpj: "48623880000189",
    modelo: "55",
    serie: 1,
    numeroNF: 1,
    cNF: "12345678",
  });

  const input: NotaFiscalInput = {
    chaveAcesso: chave,
    cUF: "32",
    cNF: "12345678",
    numeroNF: 1,
    serie: 1,
    dataEmissao: new Date("2026-08-20T10:00:00"),
    tpAmb: 2,
    naturezaOperacao: "Venda de mercadoria",
    emitente: {
      cnpj: "48623880000189",
      xNome: "KITS DO BRASIL LTDA",
      ie: "84020830",
      crt: 3,
      logradouro: "Rua da Brauna",
      numero: "252",
      bairro: "Balneário de Carapebus",
      codigoMunicipioIbge: "3205002",
      municipio: "Serra",
      uf: "ES",
      cep: "29164855",
    },
    destinatario: {
      cpf: "12345678909",
      xNome: "Cliente Teste",
      indicadorIE: 9,
    },
    itens: [
      {
        numeroItem: 1,
        codigo: "KIT-001",
        descricao: "Kit Deslizante 10mm",
        ncm: "83024900",
        cfop: "5102",
        cstIcms: "60",
        origemMercadoria: 0,
        unidade: "UN",
        quantidade: 2,
        valorUnitario: 150.5,
        valorTotal: 301,
      },
    ],
    valorTotalProdutos: 301,
    valorTotalNota: 301,
    indFinal: 1,
    indPres: 1,
    modFrete: 9,
  };

  return montarXmlNFe(input);
}

// gera um par de chaves + certificado autoassinado SO para o teste local -
// nao e o certificado real da empresa (a senha dele nunca passa pelo Claude).
function gerarCertificadoDeTeste() {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = "01";
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  const attrs = [{ name: "commonName", value: "TESTE LOCAL" }];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey, forge.md.sha256.create());

  const certDer = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
  return {
    privateKey: keys.privateKey,
    certificadoDerBase64: forge.util.encode64(certDer),
    certificadoPem: forge.pki.certificateToPem(cert),
  };
}

describe("assinarNFe / verificarAssinatura", () => {
  let credenciais: ReturnType<typeof gerarCertificadoDeTeste>;

  beforeAll(() => {
    credenciais = gerarCertificadoDeTeste();
  });

  it("assina e a assinatura verifica corretamente contra o certificado usado", () => {
    const xml = xmlDeTeste();
    const assinado = assinarNFe(xml, credenciais);

    expect(assinado).toContain("<Signature xmlns=\"http://www.w3.org/2000/09/xmldsig#\">");
    expect(assinado).toContain("<SignatureValue>");
    expect(assinado).toContain("<X509Certificate>");
    expect(assinado.endsWith("</Signature></NFe>")).toBe(true);

    const valido = verificarAssinatura(assinado, credenciais.certificadoPem);
    expect(valido).toBe(true);
  });

  it("detecta adulteracao no conteudo do infNFe apos assinado (digest nao bate mais)", () => {
    const xml = xmlDeTeste();
    const assinado = assinarNFe(xml, credenciais);
    const adulterado = assinado.replace("KIT-001", "KIT-999");

    const valido = verificarAssinatura(adulterado, credenciais.certificadoPem);
    expect(valido).toBe(false);
  });

  it("detecta adulteracao na propria SignatureValue", () => {
    const xml = xmlDeTeste();
    const assinado = assinarNFe(xml, credenciais);
    const adulterado = assinado.replace(
      /<SignatureValue>([^<]+)<\/SignatureValue>/,
      (_m, valor) => `<SignatureValue>${valor.slice(0, -4)}AAAA</SignatureValue>`,
    );

    const valido = verificarAssinatura(adulterado, credenciais.certificadoPem);
    expect(valido).toBe(false);
  });

  it("rejeita verificacao com um certificado diferente do usado pra assinar", () => {
    const xml = xmlDeTeste();
    const assinado = assinarNFe(xml, credenciais);
    const outroCert = gerarCertificadoDeTeste();

    const valido = verificarAssinatura(assinado, outroCert.certificadoPem);
    expect(valido).toBe(false);
  });

  it("canonicalizarInfNFe injeta o xmlns herdado e reordena Id antes de versao", () => {
    const xml = xmlDeTeste();
    const { canonico } = canonicalizarInfNFe(xml);
    expect(canonico.startsWith('<infNFe xmlns="http://www.portalfiscal.inf.br/nfe" Id="NFe')).toBe(true);
    // versao deve vir depois do Id na forma canonica, mesmo o gerador escrevendo versao antes
    const posId = canonico.indexOf("Id=");
    const posVersao = canonico.indexOf("versao=");
    expect(posVersao).toBeGreaterThan(posId);
  });
});
