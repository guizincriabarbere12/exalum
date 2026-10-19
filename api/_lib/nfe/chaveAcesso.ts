/**
 * Chave de acesso da NF-e: 44 digitos.
 * cUF(2) + AAMM(4) + CNPJ(14) + mod(2) + serie(3) + nNF(9) + tpEmis(1) + cNF(8) + cDV(1)
 */

export interface DadosChaveAcesso {
  cUF: string; // codigo IBGE da UF, 2 digitos (ES = 32)
  dataEmissao: Date;
  cnpj: string; // apenas digitos, 14 caracteres
  modelo: string; // '55'
  serie: number;
  numeroNF: number;
  tpEmis?: string; // '1' = normal
  cNF?: string; // 8 digitos aleatorios; se omitido, gera
}

function apenasDigitos(v: string): string {
  return v.replace(/\D/g, "");
}

function gerarCNF(): string {
  return String(Math.floor(Math.random() * 100000000)).padStart(8, "0");
}

/** Digito verificador modulo 11 usado na chave de acesso da NF-e. */
export function calcularDV(chave43: string): string {
  if (chave43.length !== 43) {
    throw new Error(`calcularDV espera 43 digitos, recebeu ${chave43.length}`);
  }
  const pesos = [2, 3, 4, 5, 6, 7, 8, 9];
  let soma = 0;
  let indicePeso = 0;
  for (let i = chave43.length - 1; i >= 0; i--) {
    const digito = Number(chave43[i]);
    soma += digito * pesos[indicePeso % pesos.length];
    indicePeso++;
  }
  const resto = soma % 11;
  const dv = resto < 2 ? 0 : 11 - resto;
  return String(dv);
}

export function montarChaveAcesso(dados: DadosChaveAcesso): string {
  const cnpj = apenasDigitos(dados.cnpj).padStart(14, "0");
  if (cnpj.length !== 14) throw new Error(`CNPJ invalido: ${dados.cnpj}`);

  // AAMM tem que refletir o mes/ano em horario de Brasilia, nao o horario
  // local do runtime (Vercel roda em UTC) - so importa perto da virada do
  // mes (as primeiras ~3h de um mes em UTC ainda sao o mes anterior em
  // Brasilia), mas o dhEmi no XML usa o mesmo deslocamento e os dois
  // precisam ser consistentes entre si.
  const BRASILIA_OFFSET_MS = 3 * 60 * 60 * 1000;
  const emissaoBrasilia = new Date(dados.dataEmissao.getTime() - BRASILIA_OFFSET_MS);
  const ano = String(emissaoBrasilia.getUTCFullYear()).slice(-2);
  const mes = String(emissaoBrasilia.getUTCMonth() + 1).padStart(2, "0");
  const aamm = ano + mes;

  const serie = String(dados.serie).padStart(3, "0");
  const nNF = String(dados.numeroNF).padStart(9, "0");
  const tpEmis = dados.tpEmis ?? "1";
  const cNF = dados.cNF ?? gerarCNF();

  const chave43 =
    dados.cUF.padStart(2, "0") +
    aamm +
    cnpj +
    dados.modelo +
    serie +
    nNF +
    tpEmis +
    cNF;

  if (chave43.length !== 43) {
    throw new Error(`Chave parcial deveria ter 43 digitos, tem ${chave43.length}: ${chave43}`);
  }

  const dv = calcularDV(chave43);
  return chave43 + dv;
}

/** Valida uma chave de acesso completa (44 digitos) recalculando o DV. */
export function validarChaveAcesso(chave44: string): boolean {
  if (!/^\d{44}$/.test(chave44)) return false;
  const chave43 = chave44.slice(0, 43);
  const dvInformado = chave44.slice(43);
  return calcularDV(chave43) === dvInformado;
}
