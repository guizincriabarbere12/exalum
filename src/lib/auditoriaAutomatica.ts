import { supabase } from "@/integrations/supabase/client";

/**
 * Auditoria automática: intercepta TODA gravação que o sistema faz no Supabase
 * (insert, update, upsert, delete e funções rpc) e registra em audit_logs —
 * inclusive telas que nunca chamaram logActivity. Em updates/exclusões busca o
 * registro antes da alteração, para a auditoria mostrar "de → para".
 *
 * Nunca interfere na operação: qualquer falha da auditoria é apenas logada no console.
 */

const TABELAS_IGNORADAS = new Set(["audit_logs"]);
// Funções rpc que só consultam dados (não alteram nada) — não entram na auditoria
const RPC_SOMENTE_LEITURA = new Set([
  "get_users_with_roles", "is_admin", "consultar_pedido_publico", "buscar_pedido_assinatura",
  "gerar_numero_orcamento", "gerar_numero_pedido", "gerar_numero_transferencia",
  "gerar_numero_requisicao", "gerar_numero_op",
]);
const PARAMS_NAO_FILTRO = new Set(["select", "columns", "on_conflict", "order", "limit", "offset"]);
const MAX_LINHAS_ANTES = 50;

type Linha = Record<string, unknown>;

interface BuilderInterno {
  method: string;
  url: URL;
  body?: unknown;
  headers: Headers;
  // fetch do próprio cliente Supabase (já injeta apikey e o token do usuário logado)
  fetch: typeof fetch;
}

function resumirValor(v: unknown): unknown {
  if (typeof v === "string") {
    if (v.startsWith("data:")) return "[imagem/arquivo]";
    if (v.length > 300) return v.slice(0, 300) + "…";
    return v;
  }
  if (v && typeof v === "object") {
    const json = JSON.stringify(v);
    if (json.length > 1000) return "[dados extensos]";
  }
  return v;
}

function resumirLinha(linha: unknown): unknown {
  if (!linha || typeof linha !== "object" || Array.isArray(linha)) return resumirValor(linha);
  return Object.fromEntries(Object.entries(linha as Linha).map(([k, v]) => [k, resumirValor(v)]));
}

function textoCurto(v: unknown): string {
  if (v === null || v === undefined || v === "") return "vazio";
  const r = resumirValor(v);
  const s = typeof r === "string" ? r : JSON.stringify(r);
  return s.length > 60 ? s.slice(0, 60) + "…" : s;
}

function rotulo(linha?: Linha | null): string {
  if (!linha) return "";
  const v = linha.numero ?? linha.codigo ?? linha.nome ?? linha.nome_contato ?? linha.titulo ?? linha.descricao;
  return v ? String(v).slice(0, 60) : "";
}

const NOMES_TABELAS: Record<string, string> = {
  produtos: "Produto", kits: "Kit", kit_itens: "Item de kit", clientes: "Cliente", fornecedores: "Fornecedor",
  orcamentos: "Orçamento", orcamento_itens: "Item de orçamento", itens_orcamento: "Item de orçamento",
  pedidos: "Pedido", pedido_itens: "Item de pedido", vendas: "Venda", venda_itens: "Item de venda",
  compras: "Compra", compra_itens: "Item de compra", estoque_filial: "Estoque da filial",
  movimentacao_estoque: "Movimentação de estoque", movimentacoes_estoque: "Movimentação de estoque",
  transferencias_estoque: "Transferência", transferencias_estoque_itens: "Item de transferência",
  transferencias_estoque_historico: "Histórico de transferência", transacoes_financeiras: "Transação financeira",
  transacao_pagamentos: "Pagamento", notas_fiscais: "Nota fiscal", ordens_producao: "Ordem de produção",
  filiais: "Filial", user_roles: "Perfil de acesso", user_permissions: "Permissões", profiles: "Usuário",
  configuracoes: "Configurações", conferencia_materiais: "Conferência de materiais",
  conferencia_baixas: "Baixa de conferência", conferencia_historico: "Histórico de conferência",
  conferencia_fotos: "Foto de conferência", requisicoes_material: "Requisição de material",
  requisicao_itens: "Item de requisição", romaneios: "Romaneio", romaneio_itens: "Item de romaneio",
  sobras_perfis: "Sobra de perfil", sobras_vendas: "Venda de sobra", creditos: "Crédito", comissoes: "Comissão",
  crm_leads: "Lead (CRM)", crm_mensagens: "Mensagem (CRM)", crm_ia_config: "Configuração da IA (CRM)",
};

export const nomeTabela = (t: string) => NOMES_TABELAS[t] || t;

function lerAlvo(url: URL): { tabela: string; rpc: boolean } {
  const partes = url.pathname.split("/").filter(Boolean);
  const i = partes.indexOf("v1");
  const resto = partes.slice(i + 1);
  if (resto[0] === "rpc") return { tabela: resto[1] || "rpc", rpc: true };
  return { tabela: resto[0] || "?", rpc: false };
}

function lerFiltros(url: URL): Record<string, string> {
  const filtros: Record<string, string> = {};
  url.searchParams.forEach((valor, chave) => {
    if (!PARAMS_NAO_FILTRO.has(chave)) filtros[chave] = valor;
  });
  return filtros;
}

async function buscarAntes(b: BuilderInterno, filtros: Record<string, string>): Promise<Linha[] | null> {
  if (Object.keys(filtros).length === 0) return null;
  try {
    const url = new URL(b.url.toString());
    url.searchParams.set("select", "*");
    url.searchParams.set("limit", String(MAX_LINHAS_ANTES));
    const headers = new Headers(b.headers);
    headers.delete("Prefer");
    headers.delete("Content-Type");
    const res = await b.fetch(url.toString(), { method: "GET", headers });
    if (!res.ok) return null;
    return (await res.json()) as Linha[];
  } catch {
    return null;
  }
}

async function registrar(
  b: BuilderInterno,
  tabela: string,
  rpc: boolean,
  filtros: Record<string, string>,
  antes: Linha[] | null,
  dados: unknown,
) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    const prefer = b.headers.get("Prefer") || "";
    const enviado = Array.isArray(b.body) ? b.body : b.body ? [b.body] : [];
    const retornado = Array.isArray(dados) ? (dados as Linha[]) : dados && typeof dados === "object" ? [dados as Linha] : [];
    const nome = nomeTabela(tabela);

    let acao: string;
    let descricao: string;
    let entidadeId: string | null = filtros.id?.startsWith("eq.") ? filtros.id.slice(3) : null;
    const metadados: Record<string, unknown> = { tabela, metodo: b.method, automatico: true };
    if (Object.keys(filtros).length) metadados.filtros = filtros;

    if (rpc) {
      acao = "executar";
      descricao = `Função executada: ${tabela}`;
      metadados.parametros = resumirLinha(b.body);
    } else if (b.method === "POST") {
      acao = prefer.includes("resolution=merge-duplicates") ? "salvar" : "criar";
      const primeiro = (retornado[0] || enviado[0]) as Linha | undefined;
      entidadeId = entidadeId || (primeiro?.id ? String(primeiro.id) : null);
      const qtd = Math.max(enviado.length, retornado.length);
      descricao = qtd > 1
        ? `${nome}: ${qtd} registros ${acao === "salvar" ? "salvos" : "criados"}`
        : `${nome} ${acao === "salvar" ? "salvo(a)" : "criado(a)"}${rotulo(primeiro) ? `: ${rotulo(primeiro)}` : ""}`;
      metadados.registros = (retornado.length ? retornado : enviado).slice(0, 20).map(resumirLinha);
    } else if (b.method === "PATCH") {
      acao = "atualizar";
      const novo = (b.body || {}) as Linha;
      const anterior = antes?.length === 1 ? antes[0] : null;
      const campos = Object.keys(novo).filter((k) => k !== "updated_at" && (!anterior || JSON.stringify(anterior[k]) !== JSON.stringify(novo[k])));
      if (anterior && campos.length === 0) return; // nada mudou de fato
      metadados.alteracoes = Object.fromEntries(campos.map((k) => [k, { de: anterior ? resumirValor(anterior[k]) : undefined, para: resumirValor(novo[k]) }]));
      if (antes && antes.length > 1) metadados.linhas_afetadas = antes.length;
      const alvo = rotulo(anterior || retornado[0]);
      const resumo = campos.slice(0, 6).map((k) => anterior ? `${k}: ${textoCurto(anterior[k])} → ${textoCurto(novo[k])}` : `${k} = ${textoCurto(novo[k])}`).join("; ");
      descricao = `${nome}${alvo ? ` ${alvo}` : ""}${antes && antes.length > 1 ? ` (${antes.length} registros)` : ""}: ${resumo}${campos.length > 6 ? ` (+${campos.length - 6} campos)` : ""}`;
      entidadeId = entidadeId || (anterior?.id ? String(anterior.id) : null);
    } else if (b.method === "DELETE") {
      acao = "excluir";
      const linhas = antes || retornado;
      metadados.registros_excluidos = linhas.slice(0, 20).map(resumirLinha);
      descricao = linhas.length > 1
        ? `${nome}: ${linhas.length} registros excluídos`
        : `${nome} excluído(a)${rotulo(linhas[0]) ? `: ${rotulo(linhas[0])}` : ""}`;
      entidadeId = entidadeId || (linhas[0]?.id ? String(linhas[0].id) : null);
    } else {
      return;
    }

    await (supabase as any).from("audit_logs").insert({
      user_id: session.user.id,
      user_email: session.user.email,
      acao,
      entidade: tabela,
      entidade_id: entidadeId,
      descricao: descricao.slice(0, 1000),
      metadados,
    });
  } catch (error) {
    console.error("Auditoria automática: falha ao registrar", error);
  }
}

let ativada = false;

export function ativarAuditoriaAutomatica() {
  if (ativada) return;
  ativada = true;

  // Encontra o protótipo do PostgrestBuilder (dono do método then) a partir de uma instância real
  let proto: any = Object.getPrototypeOf((supabase as any).from("audit_logs").select());
  while (proto && !Object.prototype.hasOwnProperty.call(proto, "then")) proto = Object.getPrototypeOf(proto);
  if (!proto) {
    console.error("Auditoria automática: não foi possível ativar");
    return;
  }

  const thenOriginal = proto.then;
  proto.then = function (this: BuilderInterno, onfulfilled?: (v: any) => any, onrejected?: (e: any) => any) {
    const metodo = this.method;
    if (metodo === "GET" || metodo === "HEAD" || !(this.url instanceof URL)) {
      return thenOriginal.call(this, onfulfilled, onrejected);
    }
    const { tabela, rpc } = lerAlvo(this.url);
    if (TABELAS_IGNORADAS.has(tabela) || (rpc && RPC_SOMENTE_LEITURA.has(tabela))) {
      return thenOriginal.call(this, onfulfilled, onrejected);
    }

    const filtros = lerFiltros(this.url);
    const precisaAntes = !rpc && (metodo === "PATCH" || metodo === "DELETE");
    const antesPromise = precisaAntes ? buscarAntes(this, filtros) : Promise.resolve(null);

    const executar = antesPromise.then((antes) =>
      thenOriginal.call(this, (res: any) => {
        if (!res?.error) void registrar(this, tabela, rpc, filtros, antes, res?.data);
        return res;
      }),
    );
    return executar.then(onfulfilled, onrejected);
  };
}
