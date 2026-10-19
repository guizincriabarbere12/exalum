import forge from "node-forge";

/**
 * Assinatura digital XML-DSig da NF-e: RSA-SHA1 sobre o <infNFe>, no formato
 * exigido pela SEFAZ (Canonical XML 1.0, nao exclusive C14N). Isso e uma
 * implementacao PARCIAL de C14N, suficiente pro formato fixo que o nosso
 * proprio gerador de XML produz (sem comentarios, sem CDATA, sem prefixos de
 * namespace, atributos sempre nos mesmos elementos) - nao e um canonicalizador
 * generico para XML arbitrario.
 *
 * Ponto mais importante e mais facil de errar: o <infNFe> nao declara o
 * xmlns nele mesmo (herda do <NFe> pai), mas o C14N exige que o namespace
 * herdado apareca no elemento quando ele e canonicalizado isoladamente - e
 * os atributos saem ordenados (Id antes de versao, por ordem de codigo
 * Unicode), mesmo que o XML final gerado escreva versao primeiro.
 */

export interface ChavePrivadaECertificado {
  privateKey: forge.pki.rsa.PrivateKey;
  certificadoDerBase64: string;
}

export function extrairChaveECertificadoDoP12(
  p12Base64: string,
  senha: string,
): ChavePrivadaECertificado {
  const der = forge.util.decode64(p12Base64);
  const asn1 = forge.asn1.fromDer(der);
  const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, senha);

  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
  const certBag = certBags[forge.pki.oids.certBag]?.[0];
  const cert = certBag?.cert;
  if (!cert) throw new Error("Certificado nao encontrado no arquivo .p12");

  const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
  const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0];
  const privateKey = keyBag?.key as forge.pki.rsa.PrivateKey | undefined;
  if (!privateKey) throw new Error("Chave privada nao encontrada no arquivo .p12");

  const certDer = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
  const certificadoDerBase64 = forge.util.encode64(certDer);

  return { privateKey, certificadoDerBase64 };
}

function sha1Base64(texto: string): string {
  const md = forge.md.sha1.create();
  md.update(forge.util.encodeUtf8(texto));
  return forge.util.encode64(md.digest().getBytes());
}

function rsaSha1SignBase64(texto: string, privateKey: forge.pki.rsa.PrivateKey): string {
  const md = forge.md.sha1.create();
  md.update(forge.util.encodeUtf8(texto));
  const assinatura = privateKey.sign(md);
  return forge.util.encode64(assinatura);
}

/**
 * Extrai o elemento <infNFe>...</infNFe> do XML completo e devolve sua forma
 * canonica (C14N) considerando o xmlns herdado do <NFe> pai e a ordem de
 * atributos exigida (Id antes de versao).
 */
export function canonicalizarInfNFe(xmlCompleto: string): { canonico: string; chaveAcesso: string } {
  const match = xmlCompleto.match(/<infNFe versao="([^"]+)" Id="(NFe\d{44})">([\s\S]*)<\/infNFe>/);
  if (!match) throw new Error("Nao foi possivel localizar <infNFe> no XML para assinar");

  const [, versao, id, conteudoInterno] = match;
  const chaveAcesso = id.replace("NFe", "");

  // ordem canonica: namespace herdado primeiro, depois atributos por ordem
  // alfabetica de nome (Id < versao, codigo Unicode)
  const canonico = `<infNFe xmlns="http://www.portalfiscal.inf.br/nfe" Id="${id}" versao="${versao}">${conteudoInterno}</infNFe>`;

  return { canonico, chaveAcesso };
}

/**
 * Monta o SignedInfo em forma ja canonica (sem self-closing tags, atributo
 * unico por elemento - nao precisa de reordenacao alem da que ja escrevemos).
 */
function montarSignedInfoCanonico(chaveAcesso: string, digestValue: string): string {
  return (
    `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#">` +
    `<CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"></CanonicalizationMethod>` +
    `<SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"></SignatureMethod>` +
    `<Reference URI="#NFe${chaveAcesso}">` +
    `<Transforms>` +
    `<Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"></Transform>` +
    `<Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"></Transform>` +
    `</Transforms>` +
    `<DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"></DigestMethod>` +
    `<DigestValue>${digestValue}</DigestValue>` +
    `</Reference>` +
    `</SignedInfo>`
  );
}

/**
 * Assina o XML da NF-e: calcula o digest do infNFe, monta e assina o
 * SignedInfo, e insere o elemento <Signature> completo como irmao do
 * infNFe (antes do fechamento de </NFe>), exatamente como a SEFAZ espera.
 */
export function assinarNFe(xmlCompleto: string, credenciais: ChavePrivadaECertificado): string {
  const { canonico, chaveAcesso } = canonicalizarInfNFe(xmlCompleto);
  const digestValue = sha1Base64(canonico);

  const signedInfoCanonico = montarSignedInfoCanonico(chaveAcesso, digestValue);
  const signatureValue = rsaSha1SignBase64(signedInfoCanonico, credenciais.privateKey);

  const signatureXml =
    `<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">` +
    signedInfoCanonico +
    `<SignatureValue>${signatureValue}</SignatureValue>` +
    `<KeyInfo><X509Data><X509Certificate>${credenciais.certificadoDerBase64}</X509Certificate></X509Data></KeyInfo>` +
    `</Signature>`;

  if (!xmlCompleto.includes("</infNFe></NFe>")) {
    throw new Error("Formato inesperado do XML da NFe - </infNFe></NFe> nao encontrado no final");
  }

  return xmlCompleto.replace("</infNFe></NFe>", `</infNFe>${signatureXml}</NFe>`);
}

/**
 * Verifica a assinatura de um XML ja assinado (usado nos testes locais para
 * confirmar que o par assinatura/verificacao e matematicamente consistente -
 * nao substitui a validacao real feita pela SEFAZ).
 */
export function verificarAssinatura(
  xmlAssinado: string,
  certificadoPem: string,
): boolean {
  const digestMatch = xmlAssinado.match(/<DigestValue>([^<]+)<\/DigestValue>/);
  const sigValueMatch = xmlAssinado.match(/<SignatureValue>([^<]+)<\/SignatureValue>/);
  if (!digestMatch || !sigValueMatch) return false;

  const { canonico } = canonicalizarInfNFe(xmlAssinado);
  const digestRecalculado = sha1Base64(canonico);
  if (digestRecalculado !== digestMatch[1]) return false;

  const chaveMatch = xmlAssinado.match(/<Reference URI="#NFe(\d{44})">/);
  if (!chaveMatch) return false;
  const signedInfoCanonico = montarSignedInfoCanonico(chaveMatch[1], digestMatch[1]);

  const cert = forge.pki.certificateFromPem(certificadoPem);
  const md = forge.md.sha1.create();
  md.update(forge.util.encodeUtf8(signedInfoCanonico));

  try {
    const signatureBytes = forge.util.decode64(sigValueMatch[1]);
    return (cert.publicKey as forge.pki.rsa.PublicKey).verify(md.digest().bytes(), signatureBytes);
  } catch {
    // node-forge lanca excecao (em vez de retornar false) quando o bloco
    // decriptado nao bate com o padding PKCS#1 v1.5 esperado - isso tambem
    // significa "assinatura invalida", so que de um jeito diferente.
    return false;
  }
}
