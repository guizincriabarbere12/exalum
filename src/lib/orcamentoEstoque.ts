// @ts-nocheck - Temporary fix until Supabase types are regenerated (filiais/estoque_filial
// are not yet present in src/integrations/supabase/types.ts). Same convention used in
// src/pages/Estoque.tsx.
//
// ========== ESTOQUE DE ORÇAMENTOS (MATRIZ + FILIAIS) ==========
//
// Módulo compartilhado entre AddOrcamentoDialog.tsx e EditOrcamentoDialog.tsx.
// Antes, cada arquivo tinha sua própria cópia de verificarEstoqueSuficiente /
// baixarEstoqueOrcamento / voltarEstoqueOrcamento / expandirKitProdutos, sempre
// operando em produtos.estoque (a "matriz"), ignorando a filial selecionada no
// orçamento. Este módulo centraliza a lógica e passa a respeitar `filialId`:
// quando `filialId` é `null` (ou o sentinel MATRIZ_SENTINEL é resolvido para null
// pelo chamador), o estoque lido/gravado é `produtos.estoque` (comportamento
// idêntico ao anterior, preservado para orçamentos antigos/sem filial). Quando
// `filialId` é um uuid de filial, o estoque lido/gravado é `estoque_filial`.

import { supabase } from "@/integrations/supabase/client";

export const MATRIZ_SENTINEL = "__MATRIZ__";

// ========== LEITURA/ESCRITA DE ESTOQUE POR UNIDADE ==========
// Mesmo padrão usado em src/pages/Estoque.tsx (getEstoqueProduto/updateEstoqueProduto).

export const getEstoqueProduto = async (
  filialId: string | null,
  produtoId: string
): Promise<number> => {
  if (filialId === null) {
    const { data, error } = await supabase
      .from("produtos")
      .select("estoque")
      .eq("id", produtoId)
      .maybeSingle();
    if (error) throw error;
    return data?.estoque || 0;
  }

  const { data, error } = await supabase
    .from("estoque_filial")
    .select("quantidade")
    .eq("filial_id", filialId)
    .eq("produto_id", produtoId)
    .maybeSingle();
  if (error) throw error;
  return data ? Number(data.quantidade) : 0;
};

export const updateEstoqueProduto = async (
  filialId: string | null,
  produtoId: string,
  novoEstoque: number
): Promise<void> => {
  if (filialId === null) {
    const { error } = await supabase
      .from("produtos")
      .update({ estoque: novoEstoque, updated_at: new Date().toISOString() })
      .eq("id", produtoId);
    if (error) throw error;
    return;
  }

  const { data: existente } = await supabase
    .from("estoque_filial")
    .select("id")
    .eq("filial_id", filialId)
    .eq("produto_id", produtoId)
    .maybeSingle();

  if (existente) {
    const { error } = await supabase
      .from("estoque_filial")
      .update({ quantidade: novoEstoque, updated_at: new Date().toISOString() })
      .eq("id", existente.id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("estoque_filial")
      .insert({ filial_id: filialId, produto_id: produtoId, quantidade: novoEstoque });
    if (error) throw error;
  }
};

const getNomeUnidade = async (filialId: string | null): Promise<string> => {
  if (filialId === null) return "Matriz";
  try {
    const { data } = await supabase
      .from("filiais")
      .select("nome")
      .eq("id", filialId)
      .maybeSingle();
    return data?.nome || "Unidade selecionada";
  } catch {
    return "Unidade selecionada";
  }
};

// ========== EXPANSÃO DE KITS ==========

export const expandirKitProdutos = async (
  kitId: string,
  quantidadeKits: number
): Promise<Record<string, number>> => {
  const resultado: Record<string, number> = {};

  try {
    const { data: itensKit, error } = await supabase
      .from('kit_itens')
      .select('quantidade, produto_id, sub_kit_id')
      .eq('kit_id', kitId);

    if (error) {
      console.error(`❌ Erro ao buscar itens do kit ${kitId}:`, error);
      return resultado;
    }

    if (!itensKit || itensKit.length === 0) {
      return resultado;
    }

    for (const item of itensKit) {
      // Verifica se é um produto
      if (item.produto_id && typeof item.produto_id === 'string' && item.produto_id.trim() !== '') {
        const qtd = quantidadeKits * item.quantidade;
        if (!resultado[item.produto_id]) resultado[item.produto_id] = 0;
        resultado[item.produto_id] += qtd;
      }
      // Verifica se é um sub-kit
      else if (item.sub_kit_id && typeof item.sub_kit_id === 'string' && item.sub_kit_id.trim() !== '') {
        const qtdSubKit = quantidadeKits * item.quantidade;
        const subProdutos = await expandirKitProdutos(item.sub_kit_id, qtdSubKit);
        for (const [pid, qtd] of Object.entries(subProdutos)) {
          if (!resultado[pid]) resultado[pid] = 0;
          resultado[pid] += qtd;
        }
      }
    }
  } catch (error) {
    console.error(`❌ Erro ao expandir kit ${kitId}:`, error);
    throw error;
  }

  return resultado;
};

// ========== VERIFICAÇÃO DE ESTOQUE ==========

export interface ProdutoSemEstoque {
  nome: string;
  estoque: number;
  quantidade: number;
  faltando: number;
}

export interface VerificacaoEstoque {
  suficiente: boolean;
  produtosSemEstoque: ProdutoSemEstoque[];
  unidadeNome: string;
}

export const verificarEstoqueSuficiente = async (
  orcamentoId: string,
  filialId: string | null
): Promise<VerificacaoEstoque> => {
  const unidadeNome = await getNomeUnidade(filialId);

  try {
    const { data: itensOrcamento, error: itensError } = await supabase
      .from('orcamento_itens')
      .select(`
        id,
        quantidade,
        produto_id,
        kit_id
      `)
      .eq('orcamento_id', orcamentoId);

    if (itensError) {
      console.error('❌ Erro ao buscar itens do orçamento:', itensError);
      throw itensError;
    }

    const produtosSemEstoque: ProdutoSemEstoque[] = [];
    let suficiente = true;
    const estoqueNecessario: Record<string, { nome: string; necessario: number; disponivel: number }> = {};

    for (const item of itensOrcamento || []) {
      // Verifica se é um produto
      if (item.produto_id && typeof item.produto_id === 'string' && item.produto_id.trim() !== '') {
        const { data: produto, error: produtoError } = await supabase
          .from('produtos')
          .select('id, nome, codigo')
          .eq('id', item.produto_id)
          .maybeSingle();

        if (produtoError) {
          console.error('❌ Erro ao buscar produto:', produtoError);
          throw produtoError;
        }

        if (!produto) continue;

        const disponivel = await getEstoqueProduto(filialId, produto.id);

        if (!estoqueNecessario[produto.id]) {
          estoqueNecessario[produto.id] = { nome: produto.nome, necessario: 0, disponivel };
        }
        estoqueNecessario[produto.id].necessario += item.quantidade;
      }

      // Verifica se é um kit
      if (item.kit_id && typeof item.kit_id === 'string' && item.kit_id.trim() !== '') {
        try {
          const produtosDoKit = await expandirKitProdutos(item.kit_id, item.quantidade);

          for (const [produtoId, quantidadeNecessaria] of Object.entries(produtosDoKit)) {
            const { data: produto, error: produtoError } = await supabase
              .from('produtos')
              .select('id, nome, codigo')
              .eq('id', produtoId)
              .maybeSingle();

            if (produtoError) {
              console.error('❌ Erro ao buscar produto do kit:', produtoError);
              throw produtoError;
            }

            if (produto) {
              const disponivel = await getEstoqueProduto(filialId, produto.id);

              if (!estoqueNecessario[produto.id]) {
                estoqueNecessario[produto.id] = { nome: produto.nome, necessario: 0, disponivel };
              }
              estoqueNecessario[produto.id].necessario += quantidadeNecessaria;
            }
          }
        } catch (kitError) {
          console.error(`❌ Erro ao processar kit ${item.kit_id}:`, kitError);
          throw kitError;
        }
      }
    }

    for (const [, info] of Object.entries(estoqueNecessario)) {
      if (info.necessario > info.disponivel) {
        suficiente = false;
        produtosSemEstoque.push({
          nome: info.nome,
          estoque: info.disponivel,
          quantidade: info.necessario,
          faltando: info.necessario - info.disponivel,
        });
      }
    }

    return { suficiente, produtosSemEstoque, unidadeNome };
  } catch (error) {
    console.error('❌ Erro ao verificar estoque:', error);
    return { suficiente: false, produtosSemEstoque: [], unidadeNome };
  }
};

// ========== BAIXA DE ESTOQUE (APROVAÇÃO) ==========

export const baixarEstoqueOrcamento = async (
  orcamentoId: string,
  filialId: string | null
): Promise<void> => {
  try {
    const { data: itensOrcamento, error: itensError } = await supabase
      .from('orcamento_itens')
      .select(`
        id,
        quantidade,
        produto_id,
        kit_id
      `)
      .eq('orcamento_id', orcamentoId);

    if (itensError) {
      console.error('❌ Erro ao buscar itens do orçamento:', itensError);
      throw itensError;
    }

    if (!itensOrcamento || itensOrcamento.length === 0) {
      return;
    }

    const atualizacoesEstoque: Record<string, number> = {};

    for (const item of itensOrcamento) {
      // Verifica se é um produto
      if (item.produto_id && typeof item.produto_id === 'string' && item.produto_id.trim() !== '') {
        if (!atualizacoesEstoque[item.produto_id]) atualizacoesEstoque[item.produto_id] = 0;
        atualizacoesEstoque[item.produto_id] += item.quantidade;
      }

      // Verifica se é um kit
      if (item.kit_id && typeof item.kit_id === 'string' && item.kit_id.trim() !== '') {
        try {
          const produtosDoKit = await expandirKitProdutos(item.kit_id, item.quantidade);

          for (const [produtoId, quantidadeTotal] of Object.entries(produtosDoKit)) {
            if (!atualizacoesEstoque[produtoId]) atualizacoesEstoque[produtoId] = 0;
            atualizacoesEstoque[produtoId] += quantidadeTotal;
          }
        } catch (kitError) {
          console.error(`❌ Erro ao expandir kit ${item.kit_id}:`, kitError);
          throw kitError;
        }
      }
    }

    if (Object.keys(atualizacoesEstoque).length === 0) {
      return;
    }

    const { data: orcamento } = await supabase
      .from('orcamentos')
      .select('numero')
      .eq('id', orcamentoId)
      .maybeSingle();

    const unidadeNome = await getNomeUnidade(filialId);

    for (const [produtoId, quantidadeDebitar] of Object.entries(atualizacoesEstoque)) {
      const { data: produto, error: selectError } = await supabase
        .from('produtos')
        .select('nome, codigo')
        .eq('id', produtoId)
        .maybeSingle();

      if (selectError) {
        console.error('❌ Erro ao buscar produto:', selectError);
        throw selectError;
      }

      if (!produto) {
        console.error(`❌ Produto ${produtoId} não encontrado`);
        continue;
      }

      const estoqueAtual = await getEstoqueProduto(filialId, produtoId);
      const novoEstoque = Math.max(0, estoqueAtual - quantidadeDebitar);

      await updateEstoqueProduto(filialId, produtoId, novoEstoque);

      // Registra a movimentação de estoque (não deve interromper a baixa se falhar)
      try {
        await supabase
          .from('movimentacoes_estoque')
          .insert({
            produto_id: produtoId,
            tipo: 'saida',
            quantidade: quantidadeDebitar,
            quantidade_anterior: estoqueAtual,
            quantidade_atual: novoEstoque,
            origem: 'orcamento',
            orcamento_id: orcamentoId,
            observacoes: `Orçamento ${orcamento?.numero || ''} aprovado - Unidade: ${unidadeNome}`,
          });
      } catch (logError) {
        console.warn('⚠️ Erro ao registrar movimentação de estoque:', logError);
      }
    }
  } catch (error) {
    console.error('❌ Erro ao baixar estoque:', error);
    throw error;
  }
};

// ========== DEVOLUÇÃO DE ESTOQUE (CANCELAMENTO/REJEIÇÃO) ==========

export const voltarEstoqueOrcamento = async (
  orcamentoId: string,
  filialId: string | null
): Promise<void> => {
  try {
    const { data: itensOrcamento, error: itensError } = await supabase
      .from('orcamento_itens')
      .select(`
        id,
        quantidade,
        produto_id,
        kit_id
      `)
      .eq('orcamento_id', orcamentoId);

    if (itensError) {
      console.error('❌ Erro ao buscar itens do orçamento:', itensError);
      throw itensError;
    }

    if (!itensOrcamento || itensOrcamento.length === 0) {
      return;
    }

    const atualizacoesEstoque: Record<string, number> = {};

    for (const item of itensOrcamento) {
      // Verifica se é um produto
      if (item.produto_id && typeof item.produto_id === 'string' && item.produto_id.trim() !== '') {
        if (!atualizacoesEstoque[item.produto_id]) atualizacoesEstoque[item.produto_id] = 0;
        atualizacoesEstoque[item.produto_id] += item.quantidade;
      }

      // Verifica se é um kit
      if (item.kit_id && typeof item.kit_id === 'string' && item.kit_id.trim() !== '') {
        try {
          const produtosDoKit = await expandirKitProdutos(item.kit_id, item.quantidade);

          for (const [produtoId, quantidadeTotal] of Object.entries(produtosDoKit)) {
            if (!atualizacoesEstoque[produtoId]) atualizacoesEstoque[produtoId] = 0;
            atualizacoesEstoque[produtoId] += quantidadeTotal;
          }
        } catch (kitError) {
          console.error(`❌ Erro ao expandir kit ${item.kit_id}:`, kitError);
          throw kitError;
        }
      }
    }

    if (Object.keys(atualizacoesEstoque).length === 0) {
      return;
    }

    const { data: orcamento } = await supabase
      .from('orcamentos')
      .select('numero')
      .eq('id', orcamentoId)
      .maybeSingle();

    const unidadeNome = await getNomeUnidade(filialId);

    for (const [produtoId, quantidadeDevolver] of Object.entries(atualizacoesEstoque)) {
      const { data: produto, error: selectError } = await supabase
        .from('produtos')
        .select('nome, codigo')
        .eq('id', produtoId)
        .maybeSingle();

      if (selectError) {
        console.error('❌ Erro ao buscar produto:', selectError);
        throw selectError;
      }

      if (!produto) {
        console.error(`❌ Produto ${produtoId} não encontrado`);
        continue;
      }

      const estoqueAtual = await getEstoqueProduto(filialId, produtoId);
      const novoEstoque = estoqueAtual + quantidadeDevolver;

      await updateEstoqueProduto(filialId, produtoId, novoEstoque);

      // Registra a movimentação de estoque (não deve interromper a devolução se falhar)
      try {
        await supabase
          .from('movimentacoes_estoque')
          .insert({
            produto_id: produtoId,
            tipo: 'entrada',
            quantidade: quantidadeDevolver,
            quantidade_anterior: estoqueAtual,
            quantidade_atual: novoEstoque,
            origem: 'orcamento',
            orcamento_id: orcamentoId,
            observacoes: `Orçamento ${orcamento?.numero || ''} cancelado/rejeitado - devolução - Unidade: ${unidadeNome}`,
          });
      } catch (logError) {
        console.warn('⚠️ Erro ao registrar movimentação de estoque:', logError);
      }
    }
  } catch (error) {
    console.error('❌ Erro ao devolver estoque:', error);
    throw error;
  }
};
