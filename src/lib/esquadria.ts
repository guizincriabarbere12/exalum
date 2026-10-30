// ========== MONTAGEM DE ESQUADRIA × ESTOQUE ==========
//
// Motor de corte portado do AlumIA (alumia/src/lib/formula.ts e corte.ts):
// cada modelo do catálogo tem as fórmulas de corte por perfil (L, H, F...).
// Expande as esquadrias em peças, encaixa as peças em barras e cruza a
// quantidade de barras de cada perfil com produtos.estoque.

import modelosJson from "@/data/modelosEsquadria.json";

export interface ItemModelo {
  tipo: "perfil" | "vidro" | "componente";
  codigo: string;
  descricao: string;
  formula: string;
  formula2?: string;
  qtd: string;
  corte?: "90" | "45" | "45/90";
  baguete?: "com" | "sem";
  unidade?: "m";
}

export interface ModeloEsquadria {
  id: string;
  nome: string;
  sistema: string;
  folhas: number;
  itens: ItemModelo[];
  variaveis?: { nome: string; descricao: string; padrao: number }[];
  arredondamento?: "baixo";
}

export const MODELOS = modelosJson as unknown as ModeloEsquadria[];

export interface EsquadriaMontar {
  modeloId: string;
  largura: number; // vão (mm)
  altura: number; // vão (mm)
  quantidade: number;
  variaveis?: Record<string, number>;
  /** versão sem baguete (vidro preso só com guarnição); padrão: com baguete */
  semBaguete?: boolean;
}

/** O modelo tem itens diferentes para a versão com e sem baguete? */
export const temVersaoBaguete = (m?: ModeloEsquadria) => !!m?.itens.some((i) => i.baguete);

/** Folga do contorno (mm): a esquadria é cortada menor que o vão (igual ao AlumIA). */
export const FOLGA = { largura: 4, altura: 3 };

// ---------- fórmulas (sem eval) ----------
// Números com vírgula ou ponto, variáveis L, H, F..., + - * / ( ) e min, max, arred, teto, piso (args separados por ";").
const FUNCOES: Record<string, (...a: number[]) => number> = {
  min: Math.min,
  max: Math.max,
  arred: (x, c = 0) => Math.round(x * 10 ** c) / 10 ** c,
  teto: Math.ceil,
  piso: Math.floor,
};

export function avaliar(expr: string, vars: Record<string, number>): number {
  const src = expr.replace(/(\d),(\d)/g, "$1.$2").replace(/;/g, ",").replace(/×/g, "*").replace(/÷/g, "/").trim();
  if (!src) return 0;
  let i = 0;
  const skip = () => { while (i < src.length && /\s/.test(src[i])) i++; };

  const primary = (): number => {
    skip();
    const c = src[i];
    if (c === "(") {
      i++;
      const v = soma();
      skip();
      if (src[i] !== ")") throw new Error("Falta ')'");
      i++;
      return v;
    }
    if (c === "-") { i++; return -primary(); }
    if (c === "+") { i++; return primary(); }
    const num = /^\d+(\.\d+)?/.exec(src.slice(i));
    if (num) { i += num[0].length; return parseFloat(num[0]); }
    const id = /^[A-Za-z_][A-Za-z_0-9]*/.exec(src.slice(i));
    if (!id) throw new Error(`Expressão inválida perto de "${src.slice(i, i + 8)}"`);
    i += id[0].length;
    skip();
    if (src[i] === "(") {
      i++;
      const args: number[] = [];
      skip();
      if (src[i] !== ")") {
        for (;;) {
          args.push(soma());
          skip();
          if (src[i] === ",") { i++; continue; }
          break;
        }
      }
      if (src[i] !== ")") throw new Error("Falta ')'");
      i++;
      const f = FUNCOES[id[0].toLowerCase()];
      if (!f) throw new Error(`Função desconhecida: ${id[0]}`);
      return f(...args);
    }
    const v = vars[id[0].toUpperCase()];
    if (v === undefined) throw new Error(`Variável desconhecida: ${id[0]}`);
    return v;
  };
  const produto = (): number => {
    let v = primary();
    for (;;) {
      skip();
      if (src[i] === "*") { i++; v *= primary(); }
      else if (src[i] === "/") { i++; v /= primary(); }
      else return v;
    }
  };
  const soma = (): number => {
    let v = produto();
    for (;;) {
      skip();
      if (src[i] === "+") { i++; v += produto(); }
      else if (src[i] === "-") { i++; v -= produto(); }
      else return v;
    }
  };
  const v = soma();
  skip();
  if (i < src.length) throw new Error(`Sobrou "${src.slice(i)}"`);
  return v;
}

const avaliarSeguro = (expr: string, vars: Record<string, number>): { valor: number; erro?: string } => {
  try {
    const v = avaliar(expr, vars);
    return isFinite(v) ? { valor: v } : { valor: 0, erro: "Resultado inválido" };
  } catch (e) {
    return { valor: 0, erro: (e as Error).message };
  }
};

// ---------- peças e barras ----------
export interface Peca { codigo: string; comprimento: number; rotulo: string }

export interface PerfilNecessario {
  codigo: string;
  descricao: string;
  pecas: Peca[];
  barras: number;
  pecasGrandes: Peca[];
}

export interface ComponenteNecessario { codigo: string; descricao: string; qtd: number; unidade?: "m" }

export interface ConfigCorte { barra: number; serra: number; refilo: number }
export const CORTE_PADRAO: ConfigCorte = { barra: 6000, serra: 4, refilo: 10 };

/** Quantas barras o lote de peças consome (best fit decreasing, igual ao AlumIA). */
function contarBarras(pecas: Peca[], cfg: ConfigCorte) {
  const util = cfg.barra - 2 * cfg.refilo;
  const grandes = pecas.filter((p) => p.comprimento > util);
  const usadas: number[] = [];
  const cabem = pecas.filter((p) => p.comprimento > 0 && p.comprimento <= util).sort((a, b) => b.comprimento - a.comprimento);
  for (const p of cabem) {
    let melhor = -1;
    usadas.forEach((u, k) => {
      if (u + p.comprimento + (u > 0 ? cfg.serra : 0) <= util && (melhor < 0 || u > usadas[melhor])) melhor = k;
    });
    if (melhor < 0) { usadas.push(p.comprimento); continue; }
    usadas[melhor] += p.comprimento + cfg.serra;
  }
  return { barras: usadas.length, grandes };
}

export function calcularMateriais(esquadrias: EsquadriaMontar[], cfg: ConfigCorte = CORTE_PADRAO) {
  const pecas: Peca[] = [];
  const descricoes = new Map<string, string>();
  const componentes = new Map<string, ComponenteNecessario>();
  const erros: string[] = [];

  esquadrias.forEach((e, n) => {
    const m = MODELOS.find((x) => x.id === e.modeloId);
    if (!m || !(e.largura > 0) || !(e.altura > 0) || !(e.quantidade > 0)) return;
    const rotuloEsq = `Esquadria ${n + 1}`;
    const vars: Record<string, number> = { L: e.largura - FOLGA.largura, H: e.altura - FOLGA.altura, VL: e.largura, VH: e.altura, F: m.folhas || 1 };
    for (const v of m.variaveis ?? []) vars[v.nome.toUpperCase()] = e.variaveis?.[v.nome] ?? v.padrao;
    const arred = m.arredondamento === "baixo" ? (v: number) => Math.floor(v + 1e-6) : Math.round;

    for (const it of m.itens) {
      if ((it.baguete === "sem" && !e.semBaguete) || (it.baguete === "com" && e.semBaguete)) continue;
      const q = avaliarSeguro(it.qtd || "1", vars);
      if (q.erro) erros.push(`${rotuloEsq} – ${it.codigo} (quantidade): ${q.erro}`);
      if (it.tipo === "perfil") {
        const c = avaliarSeguro(it.formula, vars);
        if (c.erro) erros.push(`${rotuloEsq} – ${it.codigo}: ${c.erro}`);
        const codigo = it.codigo.toUpperCase();
        if (!descricoes.has(codigo)) descricoes.set(codigo, it.descricao);
        const qtd = Math.round(q.valor) * e.quantidade;
        for (let k = 0; k < qtd; k++) pecas.push({ codigo, comprimento: arred(c.valor), rotulo: `${rotuloEsq} – ${it.descricao || it.codigo}` });
      } else if (it.tipo === "componente") {
        const qtd = it.unidade === "m" ? Math.round(q.valor * e.quantidade * 1000) / 1000 : Math.round(q.valor) * e.quantidade;
        const k = it.codigo || it.descricao;
        const atual = componentes.get(k);
        if (atual) atual.qtd = Math.round((atual.qtd + qtd) * 1000) / 1000;
        else componentes.set(k, { codigo: it.codigo, descricao: it.descricao, qtd, ...(it.unidade ? { unidade: it.unidade } : {}) });
      }
    }
  });

  const porCodigo = new Map<string, Peca[]>();
  for (const p of pecas) porCodigo.set(p.codigo, [...(porCodigo.get(p.codigo) ?? []), p]);
  const perfis: PerfilNecessario[] = [...porCodigo].sort(([a], [b]) => a.localeCompare(b)).map(([codigo, lista]) => {
    const { barras, grandes } = contarBarras(lista, cfg);
    for (const g of grandes) erros.push(`${g.rotulo}: peça de ${g.comprimento} mm maior que a barra útil (${cfg.barra - 2 * cfg.refilo} mm).`);
    return { codigo, descricao: descricoes.get(codigo) || "", pecas: lista, barras, pecasGrandes: grandes };
  });

  return { perfis, componentes: [...componentes.values()], erros };
}

// ---------- cruzamento com o estoque ----------
export interface ProdutoEstoque {
  id: string;
  codigo: string;
  cor: string | null;
  unidade: string | null;
  estoque: number | null;
  estoque_minimo?: number | null;
  comprimento_barra: number | string | null;
  peso_kg_m: number | string | null;
}

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Chave do código do perfil: "FZ-0093" e "FZ0093 PRETO" viram "FZ93"; "SU-292" e "SU292" viram "SU292". */
export const chavePerfil = (codigo: string) =>
  semAcento(codigo).toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/(^|[A-Z])0+(\d)/g, "$1$2");

/** Códigos do cadastro de produto: o primeiro trecho e o alternativo entre parênteses ("CL-015 (L-387)"). */
function chavesDoProduto(codigo: string) {
  const texto = (codigo || "").trim();
  const principal = texto.split(/[\s(]/)[0];
  const alternativo = /\(([^)]+)\)/.exec(texto)?.[1];
  return [principal, alternativo].filter(Boolean).map((c) => chavePerfil(c!)).filter((c) => c.length >= 3);
}

/** Cor normalizada: "Preta" = "PRETO", sem acento. Sem cor no cadastro usa o resto do código ("ALG-2030 PRETO"). */
export function corDoProduto(p: Pick<ProdutoEstoque, "codigo" | "cor">) {
  const bruta = p.cor?.trim() || (p.codigo || "").trim().split(/\s+/).slice(1).join(" ").replace(/\(.*?\)/g, "").trim();
  return normalizarCor(bruta) || "SEM COR";
}

export const normalizarCor = (cor: string) =>
  semAcento(cor || "").toUpperCase().replace(/\s+/g, " ").trim()
    .replace(/\bPRETA\b/g, "PRETO").replace(/\bBRANCA\b/g, "BRANCO");

/** Estoque do produto em barras (cadastro em kg é convertido pelo peso da barra). */
export function barrasEmEstoque(p: ProdutoEstoque) {
  const estoque = Number(p.estoque) || 0;
  if ((p.unidade || "").trim().toLowerCase() !== "kg") return estoque;
  const pesoBarra = (Number(p.peso_kg_m) || 0) * (Number(p.comprimento_barra) || 6);
  return pesoBarra > 0 ? Math.floor(estoque / pesoBarra) : 0;
}

export interface SituacaoPerfil extends PerfilNecessario {
  /** barras em estoque na cor escolhida (ou em todas, sem cor) */
  emEstoque: number;
  falta: number;
  /** estoque mínimo (barras) dos produtos na cor */
  minimo: number;
  /** barras a comprar para montar e deixar o estoque no mínimo */
  comprar: number;
  /** peso da barra (kg) pelo cadastro, para estimar a compra */
  pesoBarra: number | null;
  /** produtos do cadastro que casaram com o código, com as barras de cada um */
  produtos: { produto: ProdutoEstoque; cor: string; barras: number; naCor: boolean }[];
}

export function cruzarComEstoque(perfis: PerfilNecessario[], produtos: ProdutoEstoque[], cor: string) {
  const indice = new Map<string, ProdutoEstoque[]>();
  for (const p of produtos) for (const k of chavesDoProduto(p.codigo)) indice.set(k, [...(indice.get(k) ?? []), p]);
  const corAlvo = normalizarCor(cor);

  return perfis.map<SituacaoPerfil>((perfil) => {
    const achados = [...new Set(indice.get(chavePerfil(perfil.codigo)) ?? [])].map((produto) => {
      const c = corDoProduto(produto);
      return { produto, cor: c, barras: barrasEmEstoque(produto), naCor: !corAlvo || c === corAlvo };
    });
    const naCor = achados.filter((a) => a.naCor);
    const emEstoque = naCor.reduce((s, a) => s + a.barras, 0);
    const minimo = naCor.reduce((s, a) => s + (Number(a.produto.estoque_minimo) || 0), 0);
    // o peso do perfil não depende da cor: usa outra cor se a escolhida não tiver peso
    const ref = (naCor.find((a) => Number(a.produto.peso_kg_m) > 0) ?? achados.find((a) => Number(a.produto.peso_kg_m) > 0))?.produto;
    return {
      ...perfil,
      emEstoque,
      falta: Math.max(0, perfil.barras - emEstoque),
      minimo,
      // depois de montar sobra (estoque − usado); compra o que falta para voltar ao mínimo
      comprar: Math.max(0, perfil.barras + minimo - emEstoque),
      pesoBarra: ref ? Math.round(Number(ref.peso_kg_m) * (Number(ref.comprimento_barra) || 6) * 1000) / 1000 : null,
      produtos: achados,
    };
  });
}

export interface Capacidade {
  /** quantas esquadrias iguais dá para montar com o estoque */
  maximo: number;
  /** perfil que acaba primeiro (o que impede montar mais uma) */
  limitante: string | null;
  /** algum perfil do modelo não existe no cadastro */
  semCadastro: string[];
}

// ---------- relatório geral do estoque ----------
export type TipoModelo = "janela" | "maxim" | "porta-correr" | "porta-giro" | "outros";

export const TIPOS_MODELO: { id: TipoModelo; rotulo: string; largura: number; altura: number }[] = [
  { id: "janela", rotulo: "Janela de correr", largura: 1200, altura: 1000 },
  { id: "maxim", rotulo: "Janela maxim-ar", largura: 600, altura: 600 },
  { id: "porta-correr", rotulo: "Porta de correr", largura: 1600, altura: 2100 },
  { id: "porta-giro", rotulo: "Porta de giro", largura: 900, altura: 2100 },
  { id: "outros", rotulo: "Fixos e fachadas", largura: 1000, altura: 1000 },
];

export function tipoModelo(m: Pick<ModeloEsquadria, "nome">): TipoModelo {
  if (/maxim/i.test(m.nome)) return "maxim";
  if (/porta de giro/i.test(m.nome)) return "porta-giro";
  if (/porta/i.test(m.nome)) return "porta-correr";
  if (/janela/i.test(m.nome)) return "janela";
  return "outros";
}

export interface VersaoRelatorio {
  semBaguete: boolean;
  capacidade: Capacidade;
  /** perfis que faltam para montar a quantidade desejada */
  faltas: SituacaoPerfil[];
}

export interface LinhaRelatorio {
  modelo: ModeloEsquadria;
  tipo: TipoModelo;
  largura: number;
  altura: number;
  versoes: VersaoRelatorio[];
  /** nenhum perfil do modelo existe no cadastro (linha que a empresa não trabalha) */
  semCadastro: boolean;
}

/** Para cada modelo: quantas dá para montar (com e sem baguete) e o que falta para montar `desejado` unidades. */
export function relatorioEstoque(
  modelos: ModeloEsquadria[],
  produtos: ProdutoEstoque[],
  cor: string,
  medidas: Record<TipoModelo, { largura: number; altura: number }>,
  desejado = 1,
  cfg: ConfigCorte = CORTE_PADRAO,
): LinhaRelatorio[] {
  return modelos.map((modelo) => {
    const tipo = tipoModelo(modelo);
    const { largura, altura } = medidas[tipo];
    const versoes = (temVersaoBaguete(modelo) ? [false, true] : [false]).map<VersaoRelatorio>((semBaguete) => {
      const e: EsquadriaMontar = { modeloId: modelo.id, largura, altura, quantidade: desejado, semBaguete };
      const faltas = cruzarComEstoque(calcularMateriais([e], cfg).perfis, produtos, cor).filter((s) => s.falta > 0);
      return { semBaguete, capacidade: capacidade(e, produtos, cor, cfg, 500), faltas };
    });
    const perfis = cruzarComEstoque(calcularMateriais([{ modeloId: modelo.id, largura, altura, quantidade: 1 }], cfg).perfis, produtos, "");
    return { modelo, tipo, largura, altura, versoes, semCadastro: perfis.every((s) => s.produtos.length === 0) };
  });
}

/** Maior quantidade da esquadria que o estoque atende (busca binária sobre o plano de corte). */
export function capacidade(e: EsquadriaMontar, produtos: ProdutoEstoque[], cor: string, cfg: ConfigCorte = CORTE_PADRAO, teto = 999): Capacidade {
  const situacaoCom = (n: number) => cruzarComEstoque(calcularMateriais([{ ...e, quantidade: n }], cfg).perfis, produtos, cor);
  const um = situacaoCom(1);
  const semCadastro = um.filter((s) => s.produtos.length === 0).map((s) => s.codigo);
  if (um.length === 0) return { maximo: 0, limitante: null, semCadastro };
  const atende = (n: number) => situacaoCom(n).every((s) => s.falta === 0);
  if (!atende(1)) return { maximo: 0, limitante: um.find((s) => s.falta > 0)?.codigo ?? null, semCadastro };

  let ok = 1;
  let ruim = 2;
  while (ruim <= teto && atende(ruim)) { ok = ruim; ruim *= 2; }
  if (ruim > teto) return { maximo: teto, limitante: null, semCadastro };
  while (ruim - ok > 1) {
    const meio = Math.floor((ok + ruim) / 2);
    if (atende(meio)) ok = meio; else ruim = meio;
  }
  return { maximo: ok, limitante: situacaoCom(ok + 1).find((s) => s.falta > 0)?.codigo ?? null, semCadastro };
}
