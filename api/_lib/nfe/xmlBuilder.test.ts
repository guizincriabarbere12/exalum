import { XMLParser, XMLValidator } from "fast-xml-parser";
import { describe, expect, it } from "vitest";
import { montarChaveAcesso } from "./chaveAcesso.js";
import { montarXmlNFe } from "./xmlBuilder.js";
import type { NotaFiscalInput } from "./tipos.js";

function baseInput(overrides: Partial<NotaFiscalInput> = {}): NotaFiscalInput {
  const chave = montarChaveAcesso({
    cUF: "32",
    dataEmissao: new Date("2026-08-20T10:00:00"),
    cnpj: "48623880000189",
    modelo: "55",
    serie: 1,
    numeroNF: 1,
    cNF: "12345678",
  });

  return {
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
      xNome: "Cliente Teste & Cia",
      indicadorIE: 9,
      logradouro: "Rua Exemplo",
      numero: "10",
      bairro: "Centro",
      codigoMunicipioIbge: "3205002",
      municipio: "Serra",
      uf: "ES",
      cep: "29160000",
    },
    itens: [
      {
        numeroItem: 1,
        codigo: "KIT-001",
        descricao: 'Kit Deslizante <10mm> "Premium"',
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
    ...overrides,
  };
}

describe("montarXmlNFe", () => {
  it("gera XML bem formado", () => {
    const xml = montarXmlNFe(baseInput());
    const resultado = XMLValidator.validate(xml);
    expect(resultado).toBe(true);
  });

  it("escapa caracteres especiais em texto (nome do destinatario, descricao do item)", () => {
    const xml = montarXmlNFe(baseInput());
    expect(xml).toContain("Cliente Teste &amp; Cia");
    expect(xml).toContain("Kit Deslizante &lt;10mm&gt; &quot;Premium&quot;");
    // garante que nao sobrou um '&' ou '<' cru dentro de texto (quebraria o XML)
    const resultado = XMLValidator.validate(xml);
    expect(resultado).toBe(true);
  });

  it("respeita a ordem dos grupos exigida pelo XSD (ide < emit < dest < det < total < transp < pag)", () => {
    const xml = montarXmlNFe(baseInput());
    const posIde = xml.indexOf("<ide>");
    const posEmit = xml.indexOf("<emit>");
    const posDest = xml.indexOf("<dest>");
    const posDet = xml.indexOf("<det ");
    const posTotal = xml.indexOf("<total>");
    const posTransp = xml.indexOf("<transp>");
    const posPag = xml.indexOf("<pag>");

    expect(posIde).toBeGreaterThan(-1);
    expect(posEmit).toBeGreaterThan(posIde);
    expect(posDest).toBeGreaterThan(posEmit);
    expect(posDet).toBeGreaterThan(posDest);
    expect(posTotal).toBeGreaterThan(posDet);
    expect(posTransp).toBeGreaterThan(posTotal);
    expect(posPag).toBeGreaterThan(posTransp);
  });

  it("usa ICMS60 quando o produto tem CST 60 em regime normal (caso descrito pelo usuario)", () => {
    const xml = montarXmlNFe(baseInput());
    expect(xml).toContain("<ICMS60><orig>0</orig><CST>60</CST></ICMS60>");
  });

  it("usa CSOSN quando o emitente e Simples Nacional (CRT 1)", () => {
    const input = baseInput({
      emitente: { ...baseInput().emitente, crt: 1 },
      itens: [{ ...baseInput().itens[0], cstIcms: "102" }],
    });
    const xml = montarXmlNFe(input);
    expect(xml).toContain("<ICMSSN102><orig>0</orig><CSOSN>102</CSOSN></ICMSSN102>");
    // o bloco ICMS (nao PIS/COFINS) nao deve ter CST quando o regime e Simples Nacional
    expect(xml).not.toContain("ICMS60");
    expect(xml).not.toContain("ICMS00");
  });

  it("calcula idDest=1 quando emitente e destinatario sao do mesmo estado", () => {
    const xml = montarXmlNFe(baseInput());
    expect(xml).toContain("<idDest>1</idDest>");
  });

  it("calcula idDest=2 quando o destinatario e de outro estado", () => {
    const input = baseInput({ destinatario: { ...baseInput().destinatario, uf: "SP" } });
    const xml = montarXmlNFe(input);
    expect(xml).toContain("<idDest>2</idDest>");
  });

  it("usa tpAmb=2 (homologacao) quando configurado", () => {
    const xml = montarXmlNFe(baseInput({ tpAmb: 2 }));
    expect(xml).toContain("<tpAmb>2</tpAmb>");
  });

  it("lanca erro se nao houver itens", () => {
    expect(() => montarXmlNFe(baseInput({ itens: [] }))).toThrow();
  });

  it("formata valores monetarios com 2 casas decimais", () => {
    const xml = montarXmlNFe(baseInput());
    expect(xml).toContain("<vProd>301.00</vProd>");
    expect(xml).toContain("<vNF>301.00</vNF>");
  });

  it("parseia de volta e confirma os valores essenciais", () => {
    const xml = montarXmlNFe(baseInput());
    const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: false });
    const obj = parser.parse(xml);
    const infNFe = obj.NFe.infNFe;

    expect(infNFe["@_Id"]).toMatch(/^NFe\d{44}$/);
    expect(infNFe.emit.CNPJ).toBe("48623880000189");
    expect(infNFe.dest.CPF).toBe("12345678909");
    expect(infNFe.total.ICMSTot.vNF).toBe("301.00");
  });
});

describe("montarIcms - normalizacao de CST com zero a esquerda", () => {
  it("reconhece CST '060' (3 digitos, formato salvo no cadastro) como ICMS60, nao cai no bloco generico", () => {
    const xml = montarXmlNFe(baseInput({
      itens: [{ ...baseInput().itens[0], cstIcms: "060" }],
    }));
    expect(xml).toContain("<ICMS60><orig>0</orig><CST>60</CST></ICMS60>");
    expect(xml).not.toContain("ICMS00");
  });

  it("reconhece CST '00' (2 digitos) e CST '000' (3 digitos) da mesma forma no bloco generico", () => {
    const xmlDoisDigitos = montarXmlNFe(baseInput({
      itens: [{ ...baseInput().itens[0], cstIcms: "00" }],
    }));
    const xmlTresDigitos = montarXmlNFe(baseInput({
      itens: [{ ...baseInput().itens[0], cstIcms: "000" }],
    }));
    expect(xmlDoisDigitos).toContain("<ICMS00><orig>0</orig><CST>00</CST>");
    expect(xmlTresDigitos).toContain("<ICMS00><orig>0</orig><CST>00</CST>");
    // o bloco ICMS especificamente nunca deve ter 3 digitos (diferente do
    // <IBSCBS><CST>000</CST>, que e outro grupo de imposto e legitimamente
    // usa 3 digitos)
    expect(xmlTresDigitos).not.toContain("<ICMS00><orig>0</orig><CST>000</CST>");
  });
});

describe("montarIde - cNF extraido da chave precisa bater com o Id do infNFe", () => {
  it("o <cNF> do ide, concatenado com os outros campos, reproduz exatamente a chave usada no Id", () => {
    const cNFOriginal = "12345678";
    const input = baseInput({
      chaveAcesso: montarChaveAcesso({
        cUF: "32",
        dataEmissao: new Date("2026-08-20T10:00:00"),
        cnpj: "48623880000189",
        modelo: "55",
        serie: 1,
        numeroNF: 1,
        cNF: cNFOriginal,
      }),
    });
    const xml = montarXmlNFe(input);

    const idMatch = xml.match(/Id="NFe(\d{44})"/);
    const cnfMatch = xml.match(/<cNF>(\d+)<\/cNF>/);
    expect(idMatch).not.toBeNull();
    expect(cnfMatch).not.toBeNull();

    const chave = idMatch![1];
    const cNFNoIde = cnfMatch![1];

    // cNF extraido pro <ide> tem que ser exatamente os 8 digitos da posicao
    // 35-43 da chave (o bug antigo pegava 34-42, um digito deslocado)
    expect(cNFNoIde).toBe(cNFOriginal);
    expect(chave.slice(35, 43)).toBe(cNFNoIde);
  });
});

describe("montarIcms - grupo IBS/CBS (reforma tributaria, obrigatorio desde 2026)", () => {
  it("inclui o bloco IBSCBS em todo item, com CST/cClassTrib padrao e aliquotas de teste 2026", () => {
    const xml = montarXmlNFe(baseInput());
    expect(xml).toContain("<IBSCBS><CST>000</CST><cClassTrib>000001</cClassTrib>");
    expect(xml).toContain("<pIBSUF>0.1000</pIBSUF>");
    expect(xml).toContain("<pCBS>0.9000</pCBS>");

    const resultado = XMLValidator.validate(xml);
    expect(resultado).toBe(true);
  });

  it("calcula vIBSUF e vCBS proporcionais ao valor do item", () => {
    const input = baseInput({
      itens: [{ ...baseInput().itens[0], valorTotal: 1000 }],
    });
    const xml = montarXmlNFe(input);
    expect(xml).toContain("<vBC>1000.00</vBC>");
    expect(xml).toContain("<vIBSUF>1.00</vIBSUF>"); // 1000 * 0.10%
    expect(xml).toContain("<vCBS>9.00</vCBS>"); // 1000 * 0.90%
  });
});

describe("montarIbsCbsTot - agregado no <total> exigido junto do bloco por item", () => {
  it("inclui IBSCBSTot dentro de <total>, irmao do ICMSTot", () => {
    const xml = montarXmlNFe(baseInput());
    expect(xml).toContain("</ICMSTot><IBSCBSTot>");
    expect(xml).toContain("</IBSCBSTot></total>");
  });

  it("soma vIBS e vCBS de todos os itens no total, nao so o primeiro", () => {
    const input = baseInput({
      itens: [
        { ...baseInput().itens[0], numeroItem: 1, valorTotal: 1000 },
        { ...baseInput().itens[0], numeroItem: 2, valorTotal: 500 },
      ],
    });
    const xml = montarXmlNFe(input);

    // total agregado: vBC 1500 -> vIBSUF 1.50, vCBS 13.50
    const totMatch = xml.match(/<IBSCBSTot>([\s\S]*?)<\/IBSCBSTot>/);
    expect(totMatch).not.toBeNull();
    const blocoTotal = totMatch![1];
    expect(blocoTotal).toContain("<vBCIBSCBS>1500.00</vBCIBSCBS>");
    expect(blocoTotal).toContain("<vIBSUF>1.50</vIBSUF>");
    expect(blocoTotal).toContain("<vCBS>13.50</vCBS>");

    const resultado = XMLValidator.validate(xml);
    expect(resultado).toBe(true);
  });
});
