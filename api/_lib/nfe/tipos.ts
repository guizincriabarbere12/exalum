export interface EmitenteNFe {
  cnpj: string;
  xNome: string;
  ie: string;
  crt: 1 | 3; // 1 = Simples Nacional, 3 = Regime Normal
  logradouro: string;
  numero: string;
  bairro: string;
  codigoMunicipioIbge: string;
  municipio: string;
  uf: string;
  cep: string;
  telefone?: string | null;
}

export interface DestinatarioNFe {
  cnpj?: string | null;
  cpf?: string | null;
  xNome: string;
  indicadorIE: 1 | 2 | 9; // 1=contribuinte ICMS, 2=isento, 9=nao contribuinte
  ie?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  bairro?: string | null;
  codigoMunicipioIbge?: string | null;
  municipio?: string | null;
  uf?: string | null;
  cep?: string | null;
  email?: string | null;
}

export interface ItemNFe {
  numeroItem: number;
  codigo: string;
  descricao: string;
  ncm: string;
  cfop: string;
  cstIcms: string;
  origemMercadoria: number;
  unidade: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
}

export interface NotaFiscalInput {
  chaveAcesso: string;
  cUF: string;
  cNF: string;
  numeroNF: number;
  serie: number;
  dataEmissao: Date;
  tpAmb: 1 | 2; // 1 = producao, 2 = homologacao
  naturezaOperacao: string;
  emitente: EmitenteNFe;
  destinatario: DestinatarioNFe;
  itens: ItemNFe[];
  valorTotalProdutos: number;
  valorTotalNota: number;
  informacoesAdicionais?: string | null;
  indFinal: 0 | 1; // 0 = normal, 1 = consumidor final
  indPres: 0 | 1 | 2 | 3 | 4 | 9; // 1 = operacao presencial
  modFrete: 0 | 1 | 2 | 9; // 9 = sem frete (padrao para venda de balcao)
}
