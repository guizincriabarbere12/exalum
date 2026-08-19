// Função só de diagnóstico: confirma que os segredos do certificado estão
// configurados e que dá pra abrir o .p12 dentro do runtime da Edge Function
// (nunca retorna a senha nem a chave privada, só booleans/metadados públicos
// do certificado).
import forge from "npm:node-forge@1.3.1";

Deno.serve(async (_req: Request) => {
  const base64 = Deno.env.get("NFE_CERTIFICADO_P12_BASE64");
  const senha = Deno.env.get("NFE_CERTIFICADO_SENHA");

  const resultado: Record<string, unknown> = {
    segredo_certificado_presente: !!base64,
    segredo_senha_presente: !!senha,
  };

  if (base64 && senha) {
    try {
      const der = forge.util.decode64(base64);
      const asn1 = forge.asn1.fromDer(der);
      const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, senha);

      const bags = p12.getBags({ bagType: forge.pki.oids.certBag });
      const certBag = bags[forge.pki.oids.certBag]?.[0];
      const cert = certBag?.cert;

      const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
      const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0];

      resultado.certificado_abriu_com_sucesso = true;
      resultado.chave_privada_presente = !!keyBag?.key;
      resultado.subject_cn = cert?.subject.getField("CN")?.value ?? null;
      resultado.valido_de = cert?.validity.notBefore?.toISOString() ?? null;
      resultado.valido_ate = cert?.validity.notAfter?.toISOString() ?? null;
    } catch (err) {
      resultado.certificado_abriu_com_sucesso = false;
      resultado.erro = err instanceof Error ? err.message : String(err);
    }
  }

  return new Response(JSON.stringify(resultado, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
});
