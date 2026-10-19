import { describe, expect, it } from "vitest";
import { calcularDV, montarChaveAcesso, validarChaveAcesso } from "./chaveAcesso.js";

describe("calcularDV", () => {
  it("calcula corretamente um caso construido a mao", () => {
    // 43 digitos = "1" repetido. Pesos direita->esquerda: 2,3,4,5,6,7,8,9 repetindo.
    // 43 digitos = 5 ciclos completos (40) + 3 digitos (pesos 2,3,4)
    // soma = 5*(2+3+4+5+6+7+8+9) + (2+3+4) = 5*44 + 9 = 220+9 = 229
    // 229 % 11 = 9 (11*20=220, resto 9) => dv = 11-9 = 2
    const chave43 = "1".repeat(43);
    expect(calcularDV(chave43)).toBe("2");
  });

  it("resto 0 produz DV 0", () => {
    // procura uma string de zeros -> soma = 0 -> resto 0 -> dv 0
    const chave43 = "0".repeat(43);
    expect(calcularDV(chave43)).toBe("0");
  });

  it("lanca erro se nao tiver 43 digitos", () => {
    expect(() => calcularDV("123")).toThrow();
  });
});

describe("montarChaveAcesso + validarChaveAcesso", () => {
  it("gera uma chave de 44 digitos valida (round-trip)", () => {
    const chave = montarChaveAcesso({
      cUF: "32",
      dataEmissao: new Date("2026-08-20"),
      cnpj: "48.623.880/0001-89",
      modelo: "55",
      serie: 1,
      numeroNF: 1,
      cNF: "12345678",
    });

    expect(chave).toHaveLength(44);
    expect(chave.startsWith("32")).toBe(true); // cUF
    expect(chave.slice(2, 6)).toBe("2608"); // AAMM
    expect(chave.slice(6, 20)).toBe("48623880000189"); // CNPJ so digitos
    expect(chave.slice(20, 22)).toBe("55"); // modelo
    expect(chave.slice(22, 25)).toBe("001"); // serie
    expect(chave.slice(25, 34)).toBe("000000001"); // numero
    expect(validarChaveAcesso(chave)).toBe(true);
  });

  it("detecta chave adulterada (DV nao bate)", () => {
    const chave = montarChaveAcesso({
      cUF: "32",
      dataEmissao: new Date("2026-08-20"),
      cnpj: "48623880000189",
      modelo: "55",
      serie: 1,
      numeroNF: 42,
    });
    const adulterada = chave.slice(0, 43) + (chave[43] === "0" ? "1" : "0");
    expect(validarChaveAcesso(adulterada)).toBe(false);
  });

  it("gera cNF aleatorio quando nao informado, sempre 8 digitos", () => {
    const chave = montarChaveAcesso({
      cUF: "32",
      dataEmissao: new Date("2026-08-20"),
      cnpj: "48623880000189",
      modelo: "55",
      serie: 1,
      numeroNF: 1,
    });
    expect(chave.slice(34, 42)).toHaveLength(8);
    expect(/^\d{8}$/.test(chave.slice(34, 42))).toBe(true);
  });
});
