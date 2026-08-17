// @ts-nocheck
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CreditCard as Edit, Loader as Loader2, Trash2, Calculator, X, Zap, Plus, TriangleAlert as AlertTriangle, CreditCard as Edit2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

interface EditOrcamentoDialogProps {
  orcamentoId: string;
  onOrcamentoUpdated: () => void;
}

interface Cliente {
  id: string;
  nome: string;
  cpf_cnpj: string;
  limite_credito: number;
}

interface Vendedor {
  id: string;
  nome: string;
  comissao_percentual: number;
}

interface Produto {
  id: string;
  codigo: string;
  nome: string;
  descricao: string;
  cor: string | null;
  preco: number;
  estoque: number;
  localizacao: string | null;
  categoria: string | null;
  peso_kg_m?: number;
  comprimento_barra?: number;
}

interface Kit {
  id: string;
  codigo: string;
  nome: string;
  preco_total: number;
  descricao: string | null;
  estoque_disponivel?: number;
}

interface ItemOrcamento {
  id: string;
  produto_id?: string;
  kit_id?: string;
  codigo: string;
  nome: string;
  descricao: string;
  localizacao: string;
  quantidade: number;
  preco_unitario: number;
  peso: number | null;
  desconto: number;
  tipo: 'produto' | 'kit';
  estoque_disponivel?: number;
  categoria?: string | null;
  cor?: string | null;
  preco_por_kg_calculado?: number;
  comprimento_solicitado_mm?: number | null;
  isNew?: boolean;
  estoqueInsuficiente?: boolean;
  editandoPreco?: boolean;
}

export default function EditOrcamentoDialog({ orcamentoId, onOrcamentoUpdated }: EditOrcamentoDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [kits, setKits] = useState<Kit[]>([]);
  const [clienteId, setClienteId] = useState("");
  const [vendedorId, setVendedorId] = useState<string | null>(null);
  const [observacoes, setObservacoes] = useState("");
  const [itens, setItens] = useState<ItemOrcamento[]>([]);
  const [tipoItem, setTipoItem] = useState<'produto' | 'kit'>('produto');
  const [itemSelecionado, setItemSelecionado] = useState("");
  const [quantidade, setQuantidade] = useState(1);
  const [desconto, setDesconto] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [numeroOrcamento, setNumeroOrcamento] = useState("");
  
  const [formaPagamento, setFormaPagamento] = useState<string>("");
  const [condicaoPagamento, setCondicaoPagamento] = useState<string>("");
  const [entradaValor, setEntradaValor] = useState<number>(0);
  const [parcelas, setParcelas] = useState<number>(1);
  const [valorEntrada, setValorEntrada] = useState<number>(0);
  const [valorParcela, setValorParcela] = useState<number>(0);
  const [parcelado, setParcelado] = useState<boolean>(false);
  
  const [mostrarCalculoReverso, setMostrarCalculoReverso] = useState<number | null>(null);
  const [novoPrecoPorKg, setNovoPrecoPorKg] = useState<string>("");
  const [mostrarAplicarTodos, setMostrarAplicarTodos] = useState(false);
  const [precoPorKgTodos, setPrecoPorKgTodos] = useState<string>("");

  // ========== FUNÇÕES AUXILIARES ==========
  const formatCurrency = (value: number) => {
    if (isNaN(value)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const calcularPrecoPorKgReverso = (precoVenda: number, pesoKgM: number, comprimentoBarra: number = 6) => {
    const pesoTotal = pesoKgM * comprimentoBarra;
    if (pesoTotal <= 0) return 0;
    return precoVenda / pesoTotal;
  };

  const calcularPrecoVenda = (precoPorKg: number, pesoKgM: number, comprimentoBarra: number = 6) => {
    const pesoTotal = pesoKgM * comprimentoBarra;
    return pesoTotal * precoPorKg;
  };

  const produtoUsaFormula = (item: ItemOrcamento) => {
    if (item.tipo !== 'produto') return false;
    const produto = produtos.find(p => p.id === item.produto_id);
    return produto && produto.peso_kg_m && produto.peso_kg_m > 0;
  };

  const contarItensComFormula = () => {
    return itens.filter(item => produtoUsaFormula(item)).length;
  };

  const getFormaPagamentoLabel = (forma: string) => {
    const formas: Record<string, string> = {
      'avista': 'À Vista',
      'boleto': 'Boleto',
      'credito': 'Cartão de Crédito',
      'debito': 'Cartão de Débito',
      'credito_cliente': 'Crédito do Cliente',
    };
    return formas[forma] || forma;
  };

  const getDescricaoCondicao = (condicao: string): string => {
    const descricoes: Record<string, string> = {
      "28": "1 parcela em 28 dias",
      "28/56": "1ª em 28 dias, 2ª em 56 dias",
      "0/28/56": "1ª à vista, 2ª em 28 dias, 3ª em 56 dias",
      "15": "1 parcela em 15 dias",
      "15/30": "1ª em 15 dias, 2ª em 30 dias",
      "0/15/30": "1ª à vista, 2ª em 15 dias, 3ª em 30 dias",
    };
    return descricoes[condicao] || condicao;
  };

  // ========== GERENCIAMENTO DE ITENS ==========
  const handlePrecoUnitarioEdit = (index: number, novoPrecoUnitario: number) => {
    const newItens = [...itens];
    const item = newItens[index];
    
    newItens[index] = {
      ...item,
      preco_unitario: novoPrecoUnitario,
      editandoPreco: false
    };
    
    if (item.tipo === 'produto') {
      const produtoOriginal = produtos.find(p => p.id === item.produto_id);
      if (produtoOriginal?.peso_kg_m && produtoOriginal.peso_kg_m > 0) {
        const precoPorKgCalculado = calcularPrecoPorKgReverso(
          novoPrecoUnitario, 
          produtoOriginal.peso_kg_m, 
          produtoOriginal.comprimento_barra || 6
        );
        
        newItens[index].preco_por_kg_calculado = precoPorKgCalculado;
      }
    }
    
    setItens(newItens);
    
    toast({
      title: "Preço atualizado!",
      description: `Novo valor unitário: ${formatCurrency(novoPrecoUnitario)}`,
    });
  };

  const toggleEditPreco = (index: number) => {
    const newItens = [...itens];
    newItens[index].editandoPreco = !newItens[index].editandoPreco;
    setItens(newItens);
  };

  const aplicarPrecoPorKg = (index: number, precoPorKg: number) => {
    if (precoPorKg <= 0) {
      toast({
        title: "Valor inválido",
        description: "Digite um preço por kg válido",
        variant: "destructive",
      });
      return;
    }

    const newItens = [...itens];
    const item = newItens[index];
    
    if (item.tipo === 'produto') {
      const produtoOriginal = produtos.find(p => p.id === item.produto_id);
      if (produtoOriginal?.peso_kg_m && produtoOriginal.peso_kg_m > 0) {
        const novoPrecoVenda = calcularPrecoVenda(
          precoPorKg,
          produtoOriginal.peso_kg_m,
          produtoOriginal.comprimento_barra || 6
        );
        
        newItens[index] = {
          ...item,
          preco_unitario: parseFloat(novoPrecoVenda.toFixed(2)),
          preco_por_kg_calculado: precoPorKg,
          editandoPreco: false
        };
        
        setItens(newItens);
        setNovoPrecoPorKg("");
        setMostrarCalculoReverso(null);
        
        toast({
          title: "Preço atualizado!",
          description: `Preço por kg aplicado: ${formatCurrency(precoPorKg)}/kg | Novo preço: ${formatCurrency(novoPrecoVenda)}`,
        });
      }
    }
  };

  const aplicarDescontoPrecoPorKg = (index: number, percentualDesconto: number) => {
    const item = itens[index];
    if (item.preco_por_kg_calculado && percentualDesconto > 0) {
      const novoPrecoPorKg = item.preco_por_kg_calculado * (1 - percentualDesconto / 100);
      aplicarPrecoPorKg(index, parseFloat(novoPrecoPorKg.toFixed(2)));
    }
  };

  const abrirModalCalculoReverso = (index: number) => {
    setMostrarCalculoReverso(index);
    const item = itens[index];
    if (item.preco_por_kg_calculado) {
      setNovoPrecoPorKg(item.preco_por_kg_calculado.toFixed(2));
    } else if (item.tipo === 'produto') {
      const produtoOriginal = produtos.find(p => p.id === item.produto_id);
      if (produtoOriginal?.peso_kg_m && produtoOriginal.peso_kg_m > 0) {
        const precoPorKg = calcularPrecoPorKgReverso(
          item.preco_unitario,
          produtoOriginal.peso_kg_m,
          produtoOriginal.comprimento_barra || 6
        );
        setNovoPrecoPorKg(precoPorKg.toFixed(2));
      } else {
        setNovoPrecoPorKg("");
      }
    } else {
      setNovoPrecoPorKg("");
    }
  };

  const aplicarPrecoPorKgTodos = (precoPorKg: number) => {
    if (precoPorKg <= 0) {
      toast({
        title: "Valor inválido",
        description: "Digite um preço por kg válido",
        variant: "destructive",
      });
      return;
    }

    const newItens = [...itens];
    let itensAtualizados = 0;
    
    newItens.forEach((item, index) => {
      if (item.tipo === 'produto') {
        const produtoOriginal = produtos.find(p => p.id === item.produto_id);
        if (produtoOriginal?.peso_kg_m && produtoOriginal.peso_kg_m > 0) {
          const novoPrecoVenda = calcularPrecoVenda(
            precoPorKg,
            produtoOriginal.peso_kg_m,
            produtoOriginal.comprimento_barra || 6
          );
          
          newItens[index] = {
            ...item,
            preco_unitario: parseFloat(novoPrecoVenda.toFixed(2)),
            preco_por_kg_calculado: precoPorKg,
            editandoPreco: false
          };
          itensAtualizados++;
        }
      }
    });
    
    setItens(newItens);
    setPrecoPorKgTodos("");
    setMostrarAplicarTodos(false);
    
    toast({
      title: "Preço aplicado para todos!",
      description: `Preço por kg ${formatCurrency(precoPorKg)}/kg aplicado em ${itensAtualizados} itens do orçamento`,
    });
  };

  const aplicarDescontoPrecoPorKgTodos = (percentualDesconto: number) => {
    const newItens = [...itens];
    let itensAtualizados = 0;
    
    newItens.forEach((item, index) => {
      if (item.tipo === 'produto' && item.preco_por_kg_calculado) {
        const produtoOriginal = produtos.find(p => p.id === item.produto_id);
        if (produtoOriginal?.peso_kg_m && produtoOriginal.peso_kg_m > 0) {
          const novoPrecoPorKg = item.preco_por_kg_calculado * (1 - percentualDesconto / 100);
          const novoPrecoVenda = calcularPrecoVenda(
            novoPrecoPorKg,
            produtoOriginal.peso_kg_m,
            produtoOriginal.comprimento_barra || 6
          );
          
          newItens[index] = {
            ...item,
            preco_unitario: parseFloat(novoPrecoVenda.toFixed(2)),
            preco_por_kg_calculado: parseFloat(novoPrecoPorKg.toFixed(2)),
            editandoPreco: false
          };
          itensAtualizados++;
        }
      }
    });
    
    setItens(newItens);
    
    toast({
      title: "Desconto aplicado para todos!",
      description: `Desconto de ${percentualDesconto}% aplicado em ${itensAtualizados} itens do orçamento`,
    });
  };

  const calcularSubtotalComDesconto = (item: ItemOrcamento) => {
    const subtotal = item.quantidade * item.preco_unitario;
    const valorDesconto = (subtotal * item.desconto) / 100;
    return subtotal - valorDesconto;
  };

  const calcularValorTotal = () => {
    return itens.reduce((sum, item) => sum + calcularSubtotalComDesconto(item), 0);
  };

  const valorTotal = calcularValorTotal();

  const calcularPagamento = () => {
    if (valorTotal <= 0) {
      setValorEntrada(0);
      setValorParcela(0);
      return;
    }

    if (formaPagamento === "avista" || !parcelado || formaPagamento === "credito_cliente") {
      setValorEntrada(valorTotal);
      setValorParcela(0);
      setParcelas(1);
      setEntradaValor(0);
      setCondicaoPagamento("");
      return;
    }

    let totalParcelas = parcelas;
    let temEntradaHoje = false;
    
    if (condicaoPagamento) {
      switch (condicaoPagamento) {
        case "28": case "15": totalParcelas = 1; break;
        case "28/56": case "15/30": totalParcelas = 2; break;
        case "0/28/56": case "0/15/30": totalParcelas = 3; temEntradaHoje = true; break;
        default: totalParcelas = parcelas;
      }
    }
    
    setParcelas(totalParcelas);
    
    let valorCalculadoEntrada = entradaValor || 0;
    
    if (valorCalculadoEntrada > valorTotal) {
      valorCalculadoEntrada = valorTotal;
      setEntradaValor(valorTotal);
    }
    
    if (temEntradaHoje && valorCalculadoEntrada === 0) {
      valorCalculadoEntrada = Number((valorTotal * 0.5).toFixed(2));
      setEntradaValor(valorCalculadoEntrada);
    }
    
    if (temEntradaHoje) {
      const valorRestante = valorTotal - valorCalculadoEntrada;
      const parcelasFuturas = totalParcelas - 1;
      const valorParcelaCalc = parcelasFuturas > 0 ? Number((valorRestante / parcelasFuturas).toFixed(2)) : 0;
      setValorParcela(valorParcelaCalc);
    } else if (valorCalculadoEntrada > 0) {
      const valorRestante = valorTotal - valorCalculadoEntrada;
      setValorParcela(totalParcelas > 0 ? Number((valorRestante / totalParcelas).toFixed(2)) : 0);
    } else {
      setValorParcela(totalParcelas > 0 ? Number((valorTotal / totalParcelas).toFixed(2)) : 0);
    }
    
    setValorEntrada(valorCalculadoEntrada);
  };

  const verificarEstoqueEAtualizarObservacao = (itensAtualizados: ItemOrcamento[]) => {
    const observacoesEstoque: string[] = [];
    let outrasObservacoes = observacoes;
    
    const linhasObservacoes = observacoes.split('\n');
    const linhasSemEstoque = linhasObservacoes.filter(linha => !linha.includes('⚠️ Produto "'));
    outrasObservacoes = linhasSemEstoque.join('\n').trim();
    
    itensAtualizados.forEach(item => {
      if (item.tipo === 'produto' && item.estoque_disponivel !== undefined) {
        if (item.quantidade > item.estoque_disponivel) {
          const falta = item.quantidade - item.estoque_disponivel;
          observacoesEstoque.push(
            `⚠️ Produto "${item.nome}" (${item.codigo}): Quantidade solicitada ${item.quantidade} > Estoque disponível ${item.estoque_disponivel}. Falta ${falta} unidade(s).`
          );
        }
      }
    });
    
    if (observacoesEstoque.length > 0) {
      const observacaoEstoqueTexto = observacoesEstoque.join('\n');
      const observacoesCompletas = outrasObservacoes 
        ? `${observacaoEstoqueTexto}\n\n${outrasObservacoes}`
        : observacaoEstoqueTexto;
      setObservacoes(observacoesCompletas);
    } else {
      setObservacoes(outrasObservacoes);
    }
    
    return observacoesEstoque;
  };

  // ========== FETCH FUNCTIONS ==========
  const fetchClientes = async () => {
    const { data } = await supabase.from('clientes').select('*').order('nome');
    if (data) setClientes(data);
  };

  const fetchVendedores = async () => {
    const { data } = await supabase
      .from('vendedores')
      .select('id, nome, comissao_percentual')
      .eq('ativo', true);
    if (data) setVendedores(data);
  };

  const fetchProdutos = async () => {
    const { data } = await supabase
      .from('produtos')
      .select('id, codigo, nome, descricao, cor, preco, estoque, localizacao, categoria, peso_kg_m, comprimento_barra')
      .eq('ativo', true);
    if (data) setProdutos(data);
  };

  const fetchKits = async () => {
    const { data } = await supabase
      .from('kits')
      .select('*')
      .eq('ativo', true);
    if (data) setKits(data.map(k => ({ ...k, estoque_disponivel: 999 })));
  };

  const fetchOrcamento = async () => {
    try {
      setLoading(true);
      
      const { data: orcamento, error } = await supabase
        .from('orcamentos')
        .select('*, clientes(*)')
        .eq('id', orcamentoId)
        .single();

      if (error) throw error;

      setClienteId(orcamento.cliente_id);
      setVendedorId(orcamento.vendedor_id || null);
      setObservacoes(orcamento.observacoes || "");
      setNumeroOrcamento(orcamento.numero);
      setFormaPagamento(orcamento.forma_pagamento || "");
      setCondicaoPagamento(orcamento.condicao_pagamento || "");
      setEntradaValor(orcamento.entrada_valor || 0);
      setParcelas(orcamento.parcelas || 1);
      setValorEntrada(orcamento.entrada_valor || 0);
      setValorParcela(orcamento.valor_parcela || 0);
      setParcelado(orcamento.parcelado || false);

      const { data: itensData } = await supabase
        .from('orcamento_itens')
        .select('*, produto:produtos(*)')
        .eq('orcamento_id', orcamentoId);

      if (itensData && itensData.length > 0) {
        const itensFormatados = itensData.map(item => {
          const estoqueDisponivel = item.produto?.estoque || 0;
          const estoqueInsuficiente = item.quantidade > estoqueDisponivel;
          
          let precoPorKgCalculado = 0;
          if (item.produto?.peso_kg_m && item.produto.peso_kg_m > 0) {
            precoPorKgCalculado = calcularPrecoPorKgReverso(
              item.preco_unitario,
              item.produto.peso_kg_m,
              item.produto.comprimento_barra || 6
            );
          }
          
          return {
            id: item.id,
            produto_id: item.produto_id,
            codigo: item.produto?.codigo || '',
            nome: item.produto?.nome || '',
            descricao: item.produto?.descricao || '',
            localizacao: item.produto?.localizacao || '-',
            quantidade: item.quantidade,
            preco_unitario: item.preco_unitario,
            peso: null,
            desconto: item.desconto || 0,
            tipo: 'produto' as const,
            estoque_disponivel: estoqueDisponivel,
            categoria: item.produto?.categoria,
            cor: item.produto?.cor,
            estoqueInsuficiente,
            preco_por_kg_calculado: precoPorKgCalculado,
            comprimento_solicitado_mm: item.comprimento_solicitado_mm ?? null,
            editandoPreco: false
          };
        });
        setItens(itensFormatados);
        
        setTimeout(() => {
          verificarEstoqueEAtualizarObservacao(itensFormatados);
        }, 100);
      }
    } catch (error) {
      console.error('Erro ao carregar orçamento:', error);
      toast({
        title: "Erro ao carregar orçamento",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // ========== ADICIONAR/REMOVER ITENS ==========
  const addItem = () => {
    if (!itemSelecionado || quantidade <= 0) return;

    const produto = produtos.find(p => p.id === itemSelecionado);
    if (!produto) return;

    const estoqueInsuficiente = quantidade > produto.estoque;
    
    let precoPorKgCalculado = 0;
    if (produto.peso_kg_m && produto.peso_kg_m > 0) {
      precoPorKgCalculado = calcularPrecoPorKgReverso(
        produto.preco,
        produto.peso_kg_m,
        produto.comprimento_barra || 6
      );
    }

    const novoItem: ItemOrcamento = {
      id: `temp-${Date.now()}-${Math.random()}`,
      produto_id: produto.id,
      codigo: produto.codigo,
      nome: produto.nome,
      descricao: produto.descricao || produto.nome,
      localizacao: produto.localizacao || '-',
      quantidade,
      preco_unitario: produto.preco,
      peso: null,
      desconto: desconto,
      tipo: 'produto',
      estoque_disponivel: produto.estoque,
      categoria: produto.categoria,
      cor: produto.cor,
      preco_por_kg_calculado: precoPorKgCalculado,
      isNew: true,
      estoqueInsuficiente,
      editandoPreco: false
    };

    const novosItens = [...itens, novoItem];
    setItens(novosItens);
    
    verificarEstoqueEAtualizarObservacao(novosItens);

    if (estoqueInsuficiente) {
      toast({
        title: "⚠️ Estoque insuficiente!",
        description: `Produto "${produto.nome}" possui apenas ${produto.estoque} unidade(s) em estoque.`,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Item adicionado!",
        description: `${produto.nome} - ${quantidade}x ${formatCurrency(produto.preco)}`,
      });
    }

    setItemSelecionado("");
    setQuantidade(1);
    setDesconto(0);
    setSearchTerm("");
  };

  const removeItem = (index: number) => {
    const itemRemovido = itens[index];
    const novosItens = itens.filter((_, i) => i !== index);
    setItens(novosItens);
    verificarEstoqueEAtualizarObservacao(novosItens);
    if (mostrarCalculoReverso === index) {
      setMostrarCalculoReverso(null);
    }
    
    toast({
      title: "Item removido",
      description: `${itemRemovido.nome} foi removido do orçamento`,
    });
  };

  // ========== SALVAR ORÇAMENTO ==========
  const salvarOrcamento = async () => {
    if (!clienteId) {
      toast({ title: "Erro", description: "Selecione um cliente", variant: "destructive" });
      return;
    }
    
    if (itens.length === 0) {
      toast({ title: "Erro", description: "Adicione pelo menos um item ao orçamento", variant: "destructive" });
      return;
    }

    if (!formaPagamento) {
      toast({ title: "Erro", description: "Selecione uma forma de pagamento", variant: "destructive" });
      return;
    }

    const itensComEstoqueInsuficiente = itens.filter(item => 
      item.tipo === 'produto' && item.quantidade > (item.estoque_disponivel || 0)
    );

    if (itensComEstoqueInsuficiente.length > 0) {
      const nomesProdutos = itensComEstoqueInsuficiente.map(i => i.nome).join(', ');
      toast({
        title: "⚠️ Atenção: Estoque insuficiente!",
        description: `Os seguintes produtos estão com quantidade acima do estoque: ${nomesProdutos}. Verifique as observações.`,
        variant: "destructive",
      });
    }

    setLoading(true);

    try {
      let totalParcelas = parcelas;
      if (condicaoPagamento?.startsWith('0/')) totalParcelas = parcelas;
      
      const entradaPercentual = valorEntrada > 0 ? (valorEntrada / valorTotal) * 100 : 0;
      
      const vendedorFinalId = vendedorId === "none" ? null : vendedorId;
      
      // Atualizar observações com itens e estoque
      let observacoesFinais = observacoes;
      
      // Adicionar resumo dos itens nas observações se necessário
      if (itensComEstoqueInsuficiente.length > 0 && !observacoes.includes('⚠️ Produto')) {
        const resumoEstoque = itensComEstoqueInsuficiente.map(item => 
          `⚠️ Produto "${item.nome}": Estoque: ${item.estoque_disponivel}, Solicitado: ${item.quantidade}`
        ).join('\n');
        observacoesFinais = observacoesFinais ? `${resumoEstoque}\n\n${observacoesFinais}` : resumoEstoque;
      }
      
      const { error: updateError } = await supabase
        .from('orcamentos')
        .update({
          cliente_id: clienteId,
          vendedor_id: vendedorFinalId,
          valor_total: Number(valorTotal.toFixed(2)),
          observacoes: observacoesFinais,
          forma_pagamento: formaPagamento,
          condicao_pagamento: condicaoPagamento || null,
          entrada_percentual: entradaPercentual || null,
          entrada_valor: valorEntrada || null,
          parcelas: totalParcelas || null,
          valor_parcela: valorParcela || null,
          parcelado: parcelado,
          updated_at: new Date().toISOString()
        })
        .eq('id', orcamentoId);

      if (updateError) throw updateError;

      // Remover itens antigos
      const { error: deleteError } = await supabase
        .from('orcamento_itens')
        .delete()
        .eq('orcamento_id', orcamentoId);

      if (deleteError) throw deleteError;

      // Inserir novos itens
      const itensOrcamento = itens.map(item => ({
        orcamento_id: orcamentoId,
        produto_id: item.produto_id,
        quantidade: item.quantidade,
        preco_unitario: Number(item.preco_unitario.toFixed(2)),
        desconto: item.desconto,
        subtotal: Number((item.quantidade * item.preco_unitario * (1 - item.desconto / 100)).toFixed(2)),
        comprimento_solicitado_mm: item.comprimento_solicitado_mm ?? null,
      }));

      const { error: insertError } = await supabase
        .from('orcamento_itens')
        .insert(itensOrcamento);

      if (insertError) throw insertError;

      toast({ 
        title: "✅ Orçamento atualizado!",
        description: `Orçamento ${numeroOrcamento} foi atualizado com sucesso.`
      });
      
      onOrcamentoUpdated();
      setOpen(false);
      
    } catch (error: any) {
      console.error('Erro ao salvar:', error);
      toast({ 
        title: "Erro ao atualizar orçamento", 
        description: error.message, 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  // ========== EFFECTS ==========
  useEffect(() => {
    if (open && orcamentoId) {
      fetchClientes();
      fetchVendedores();
      fetchProdutos();
      fetchKits();
      fetchOrcamento();
    }
  }, [open, orcamentoId]);

  useEffect(() => {
    if (valorTotal > 0 && open) {
      calcularPagamento();
    }
  }, [formaPagamento, condicaoPagamento, entradaValor, parcelas, valorTotal, parcelado, open]);

  // ========== FILTROS ==========
  const produtosFiltrados = produtos.filter(produto => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase().trim();
    return (
      produto.nome?.toLowerCase().includes(search) ||
      produto.codigo?.toLowerCase().includes(search) ||
      produto.cor?.toLowerCase().includes(search) ||
      produto.descricao?.toLowerCase().includes(search) ||
      produto.categoria?.toLowerCase().includes(search)
    );
  });

  const itensComFormula = contarItensComFormula();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Edit className="h-4 w-4 mr-1" />
          Editar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Orçamento {numeroOrcamento}</DialogTitle>
        </DialogHeader>

        {loading && !itens.length ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* CLIENTE */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Cliente *</label>
              <Select value={clienteId} onValueChange={setClienteId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clientes.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome} - {c.cpf_cnpj}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* VENDEDOR */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Vendedor (opcional)</label>
              <Select 
                value={vendedorId || "none"} 
                onValueChange={(value) => setVendedorId(value === "none" ? null : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um vendedor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {vendedores.map(v => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.nome} ({v.comissao_percentual}% de comissão)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* PAGAMENTO */}
            <div className="border rounded-lg p-4 space-y-4">
              <h3 className="font-semibold">Condições de Pagamento</h3>
              
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={parcelado}
                  onChange={(e) => {
                    setParcelado(e.target.checked);
                    if (!e.target.checked) {
                      setFormaPagamento("avista");
                      setCondicaoPagamento("");
                      setEntradaValor(0);
                    }
                  }}
                  className="h-4 w-4 rounded border-gray-300"
                  disabled={formaPagamento === "credito_cliente"}
                />
                <label className="text-sm font-medium">Pagamento Parcelado?</label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Forma de Pagamento *</label>
                  <Select value={formaPagamento} onValueChange={(value) => {
                    setFormaPagamento(value);
                    if (value === "credito_cliente") {
                      setParcelado(false);
                      setCondicaoPagamento("");
                      setEntradaValor(0);
                      setParcelas(1);
                    } else if (value === "avista") {
                      setParcelado(false);
                      setCondicaoPagamento("");
                      setEntradaValor(0);
                      setParcelas(1);
                    }
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="avista">À Vista</SelectItem>
                      <SelectItem value="boleto">Boleto</SelectItem>
                      <SelectItem value="credito">Cartão de Crédito</SelectItem>
                      <SelectItem value="debito">Cartão de Débito</SelectItem>
                      <SelectItem value="credito_cliente">Crédito do Cliente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {parcelado && formaPagamento !== "avista" && formaPagamento !== "credito_cliente" && (
                  <>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Condição de Pagamento</label>
                      <Select value={condicaoPagamento} onValueChange={setCondicaoPagamento}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="28">28 dias</SelectItem>
                          <SelectItem value="28/56">28/56 dias</SelectItem>
                          <SelectItem value="0/28/56">0/28/56 dias</SelectItem>
                          <SelectItem value="15">15 dias</SelectItem>
                          <SelectItem value="15/30">15/30 dias</SelectItem>
                          <SelectItem value="0/15/30">0/15/30 dias</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Valor da Entrada (R$)</label>
                      <Input
                        type="number"
                        min="0"
                        max={valorTotal}
                        step="0.01"
                        value={entradaValor}
                        onChange={(e) => setEntradaValor(parseFloat(e.target.value) || 0)}
                        placeholder="0,00"
                      />
                      <p className="text-xs text-muted-foreground">
                        {condicaoPagamento?.startsWith('0/') 
                          ? "Entrada obrigatória - vencimento hoje"
                          : "Entrada opcional"}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Número de Parcelas</label>
                      <Input
                        type="number"
                        min="1"
                        max="12"
                        value={parcelas}
                        onChange={(e) => setParcelas(parseInt(e.target.value) || 1)}
                        disabled={!!condicaoPagamento}
                      />
                    </div>
                  </>
                )}
              </div>

              {valorTotal > 0 && formaPagamento && (
                <div className="pt-4 border-t">
                  <h4 className="font-medium mb-2">Resumo do Pagamento:</h4>
                  <div className="bg-gray-50 p-3 rounded-lg text-sm space-y-1">
                    <div className="flex justify-between">
                      <span>Valor Total:</span>
                      <span className="font-bold">{formatCurrency(valorTotal)}</span>
                    </div>
                    
                    {formaPagamento === "credito_cliente" ? (
                      <div className="flex justify-between text-purple-600">
                        <span>Pagamento:</span>
                        <span className="font-medium">Crédito do Cliente</span>
                      </div>
                    ) : !parcelado || formaPagamento === "avista" ? (
                      <div className="flex justify-between text-green-600">
                        <span>Pagamento:</span>
                        <span className="font-medium">À Vista</span>
                      </div>
                    ) : (
                      <>
                        {valorEntrada > 0 && (
                          <div className="flex justify-between text-green-600">
                            <span>Entrada (hoje):</span>
                            <span className="font-medium">{formatCurrency(valorEntrada)}</span>
                          </div>
                        )}
                        
                        {valorParcela > 0 && (
                          <>
                            <div className="flex justify-between">
                              <span>
                                {condicaoPagamento?.startsWith('0/') 
                                  ? `${parcelas - 1}x de:`
                                  : `${parcelas}x de:`}
                              </span>
                              <span className="font-medium">{formatCurrency(valorParcela)}</span>
                            </div>
                            
                            <div className="flex justify-between text-xs text-gray-500 pt-1 border-t border-gray-200 mt-1">
                              <span>Total parcelado:</span>
                              <span>
                                {formatCurrency(
                                  condicaoPagamento?.startsWith('0/')
                                    ? valorParcela * (parcelas - 1)
                                    : valorParcela * parcelas
                                )}
                              </span>
                            </div>
                          </>
                        )}
                        
                        {condicaoPagamento && (
                          <div className="flex justify-between text-xs text-gray-500">
                            <span>Condição:</span>
                            <span>{getDescricaoCondicao(condicaoPagamento)}</span>
                          </div>
                        )}
                      </>
                    )}
                    
                    {vendedorId && vendedorId !== "none" && (
                      <div className="flex justify-between text-xs text-green-600 pt-1 border-t border-green-200 mt-1">
                        <span>Comissão do vendedor:</span>
                        <span className="font-medium">
                          {formatCurrency((valorTotal * (vendedores.find(v => v.id === vendedorId)?.comissao_percentual || 0)) / 100)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ITENS */}
            <div className="border rounded-lg p-4 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold">Itens do Orçamento</h3>
                {itensComFormula > 0 && (
                  <Button variant="outline" size="sm" onClick={() => setMostrarAplicarTodos(true)}>
                    <Zap className="h-4 w-4 mr-2" />
                    Aplicar Preço por Kg para Todos ({itensComFormula} itens)
                  </Button>
                )}
              </div>

              {/* Modal de aplicar para todos */}
              {mostrarAplicarTodos && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex justify-between items-center mb-3">
                    <h5 className="font-medium text-sm text-green-800">
                      Aplicar Preço por Kg para Todos os Itens
                    </h5>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setMostrarAplicarTodos(false);
                        setPrecoPorKgTodos("");
                      }}
                      className="h-6 w-6 p-0"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs">Preço por Kg para Todos os Itens</label>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="Digite o preço por kg para todos"
                          value={precoPorKgTodos}
                          onChange={(e) => setPrecoPorKgTodos(e.target.value)}
                          className="h-8 flex-1"
                        />
                        <Button 
                          size="sm" 
                          onClick={() => {
                            const precoPorKg = parseFloat(precoPorKgTodos) || 0;
                            if (precoPorKg > 0) {
                              aplicarPrecoPorKgTodos(precoPorKg);
                            } else {
                              toast({
                                title: "Valor inválido",
                                description: "Digite um preço por kg válido",
                                variant: "destructive",
                              });
                            }
                          }}
                        >
                          Aplicar para Todos
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => aplicarDescontoPrecoPorKgTodos(10)}
                        className="text-xs"
                      >
                        -10% Todos
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => aplicarDescontoPrecoPorKgTodos(15)}
                        className="text-xs"
                      >
                        -15% Todos
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => aplicarDescontoPrecoPorKgTodos(20)}
                        className="text-xs"
                      >
                        -20% Todos
                      </Button>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      Esta ação aplicará o mesmo preço por kg para todos os {itensComFormula} itens que usam a fórmula de cálculo.
                    </p>
                  </div>
                </div>
              )}

              {/* Formulário de adicionar item */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Pesquisar Produto</label>
                <div className="relative">
                  <Input
                    placeholder="Pesquisar por nome, código ou cor..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-5">
                <div className="md:col-span-2 space-y-2">
                  <label className="text-sm font-medium">Produto</label>
                  <Select value={itemSelecionado} onValueChange={setItemSelecionado}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um produto" />
                    </SelectTrigger>
                    <SelectContent className="max-w-[500px] max-h-60">
                      {produtosFiltrados.length > 0 ? (
                        produtosFiltrados.map(produto => {
                          const nomeCurto = produto.nome.length > 40 
                            ? produto.nome.substring(0, 40) + '...' 
                            : produto.nome;
                          
                          let corInfo = produto.cor ? ` - ${produto.cor}` : '';
                          let estiloCor = '';
                          if (produto.estoque <= 0) {
                            estiloCor = 'text-red-600';
                          } else if (produto.estoque < 10) {
                            estiloCor = 'text-yellow-600';
                          } else {
                            estiloCor = 'text-green-600';
                          }
                          
                          return (
                            <SelectItem key={produto.id} value={produto.id} className="py-2">
                              <div className="flex flex-col">
                                <span className="font-medium">
                                  {produto.codigo} - {nomeCurto}{corInfo} - {formatCurrency(produto.preco)}
                                </span>
                                <span className={`text-xs ${estiloCor}`}>
                                  Estoque: {produto.estoque} und
                                  {produto.peso_kg_m && ` | ${produto.peso_kg_m}kg/m`}
                                </span>
                              </div>
                            </SelectItem>
                          );
                        })
                      ) : (
                        <SelectItem value="" disabled>
                          Nenhum produto encontrado
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Quantidade</label>
                  <Input
                    type="number"
                    min="1"
                    value={quantidade}
                    onChange={(e) => setQuantidade(parseInt(e.target.value) || 1)}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Desconto %</label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={desconto}
                    onChange={(e) => setDesconto(parseFloat(e.target.value) || 0)}
                  />
                </div>

                <div className="space-y-2 flex items-end">
                  <Button onClick={addItem} className="w-full" disabled={!itemSelecionado || quantidade <= 0}>
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar
                  </Button>
                </div>
              </div>

              {/* Lista de itens */}
              {itens.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium">Itens do Orçamento:</h4>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                    {itens.map((item, index) => {
                      const subtotalBruto = item.quantidade * item.preco_unitario;
                      const valorDesconto = (subtotalBruto * item.desconto) / 100;
                      const subtotalLiquido = subtotalBruto - valorDesconto;
                      const usaFormula = produtoUsaFormula(item);
                      const produtoOriginal = produtos.find(p => p.id === item.produto_id);
                      const semEstoque = item.estoqueInsuficiente;
                      
                      return (
                        <div key={item.id} className={`grid grid-cols-12 gap-2 items-center p-3 rounded-lg ${semEstoque ? 'bg-red-50 border border-red-200' : 'bg-gray-50'}`}>
                          <div className="col-span-4">
                            <p className="font-medium text-sm">{item.descricao}</p>
                            <div className="flex gap-2 text-xs text-muted-foreground">
                              <span>Cód: {item.codigo}</span>
                              {item.cor && <span>| Cor: {item.cor}</span>}
                              {semEstoque && (
                                <span className="text-red-700 font-medium">
                                  ⚠️ Estoque: {item.estoque_disponivel}
                                </span>
                              )}
                            </div>
                            {usaFormula && produtoOriginal && (
                              <div className="flex gap-2 text-xs text-blue-700">
                                <span>Peso: {produtoOriginal.peso_kg_m}kg/m</span>
                                {item.preco_por_kg_calculado && item.preco_por_kg_calculado > 0 && (
                                  <span>{formatCurrency(item.preco_por_kg_calculado)}/kg</span>
                                )}
                              </div>
                            )}
                          </div>
                          
                          <div className="col-span-1">
                            <label className="text-xs">Qtd</label>
                            <Input
                              type="number"
                              min="1"
                              value={item.quantidade}
                              onChange={(e) => {
                                const newItens = [...itens];
                                const novaQuantidade = parseInt(e.target.value) || 1;
                                newItens[index].quantidade = novaQuantidade;
                                const estoqueInsuficiente = (item.estoque_disponivel || 0) < novaQuantidade;
                                newItens[index].estoqueInsuficiente = estoqueInsuficiente;
                                setItens(newItens);
                                verificarEstoqueEAtualizarObservacao(newItens);
                              }}
                              className="h-8"
                            />
                          </div>
                          
                          <div className="col-span-2">
                            <label className="text-xs">Preço Unit.</label>
                            <div className="flex gap-1">
                              {item.editandoPreco ? (
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={item.preco_unitario}
                                  onChange={(e) => {
                                    const newItens = [...itens];
                                    newItens[index].preco_unitario = parseFloat(e.target.value) || 0;
                                    setItens(newItens);
                                  }}
                                  className="h-8 flex-1"
                                  autoFocus
                                  onBlur={() => {
                                    handlePrecoUnitarioEdit(index, item.preco_unitario);
                                  }}
                                  onKeyPress={(e) => {
                                    if (e.key === 'Enter') {
                                      handlePrecoUnitarioEdit(index, item.preco_unitario);
                                    }
                                  }}
                                />
                              ) : (
                                <>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={item.preco_unitario}
                                    onChange={(e) => {
                                      handlePrecoUnitarioEdit(index, parseFloat(e.target.value) || 0);
                                    }}
                                    className="h-8 flex-1"
                                  />
                                  {usaFormula && (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      onClick={() => abrirModalCalculoReverso(index)}
                                      className="h-8 w-8"
                                      title="Calcular preço por kg"
                                    >
                                      <Calculator className="h-3 w-3" />
                                    </Button>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                          
                          <div className="col-span-1">
                            <label className="text-xs">Desc. %</label>
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              value={item.desconto}
                              onChange={(e) => {
                                const newItens = [...itens];
                                newItens[index].desconto = parseFloat(e.target.value) || 0;
                                setItens(newItens);
                              }}
                              className="h-8"
                            />
                          </div>

                          {usaFormula && produtoOriginal && (
                            <div className="col-span-12 grid grid-cols-12 gap-2 items-center bg-amber-50 border border-amber-200 rounded px-2 py-1 -mt-1">
                              <div className="col-span-4">
                                <label className="text-xs text-amber-700 font-medium">Comprimento solicitado (m)</label>
                                <Input
                                  type="number"
                                  min="0.001"
                                  max={produtoOriginal.comprimento_barra || 6}
                                  step="0.001"
                                  placeholder={`máx ${produtoOriginal.comprimento_barra || 6} m`}
                                  value={item.comprimento_solicitado_mm != null ? item.comprimento_solicitado_mm / 1000 : ""}
                                  onChange={(e) => {
                                    const newItens = [...itens];
                                    newItens[index].comprimento_solicitado_mm = e.target.value ? parseFloat(e.target.value) * 1000 : null;
                                    setItens(newItens);
                                  }}
                                  className="h-7 text-xs border-amber-300"
                                />
                              </div>
                              <div className="col-span-8 text-xs text-amber-700 flex items-center gap-4 pt-4">
                                {item.comprimento_solicitado_mm && item.comprimento_solicitado_mm > 0 && item.comprimento_solicitado_mm < (produtoOriginal.comprimento_barra || 6) * 1000 ? (
                                  <>
                                    <span>
                                      Sobra estimada: <strong>{(((produtoOriginal.comprimento_barra || 6) * 1000 - item.comprimento_solicitado_mm) / 1000).toFixed(3)} m</strong>
                                      {' '}x {item.quantidade} pc = <strong>{(((produtoOriginal.comprimento_barra || 6) * 1000 - item.comprimento_solicitado_mm) * item.quantidade / 1000).toFixed(3)} m</strong>
                                    </span>
                                    <span className="text-green-700 font-medium">Sobra sera registrada ao aprovar</span>
                                  </>
                                ) : item.comprimento_solicitado_mm && item.comprimento_solicitado_mm >= (produtoOriginal.comprimento_barra || 6) * 1000 ? (
                                  <span className="text-red-600">Comprimento maior ou igual à barra — sem sobra</span>
                                ) : (
                                  <span className="text-amber-600/70">Informe o comprimento para calcular a sobra automaticamente</span>
                                )}
                              </div>
                            </div>
                          )}
                          
                          <div className="col-span-3 text-right">
                            <p className="text-xs text-muted-foreground">R$ {subtotalBruto.toFixed(2)}</p>
                            {item.desconto > 0 && (
                              <p className="text-xs text-muted-foreground">-{item.desconto}% = R$ {valorDesconto.toFixed(2)}</p>
                            )}
                            <p className="font-semibold text-sm">R$ {subtotalLiquido.toFixed(2)}</p>
                          </div>
                          
                          <div className="col-span-1 text-right">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => removeItem(index)}
                              className="h-8 w-8 text-red-500"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="pt-2 border-t text-right">
                    <p className="text-xl font-bold">
                      Total: {formatCurrency(valorTotal)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {itens.length} item(ns) | {itensComFormula} com fórmula de cálculo por kg
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* OBSERVAÇÕES */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Observações</label>
              <textarea
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Informações adicionais..."
                rows={4}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
              />
              {observacoes.includes('⚠️') && (
                <p className="text-xs text-amber-600 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Alertas de estoque detectados nas observações
                </p>
              )}
            </div>

            {/* BOTÕES */}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
                Cancelar
              </Button>
              <Button onClick={salvarOrcamento} disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar Alterações
              </Button>
            </div>
          </div>
        )}
      </DialogContent>

      {/* Modal de Cálculo Reverso */}
      {mostrarCalculoReverso !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Calcular Preço por KG</h3>
              <Button variant="ghost" size="sm" onClick={() => setMostrarCalculoReverso(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Novo Preço por KG (R$/kg)</label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Digite o preço por KG"
                  value={novoPrecoPorKg}
                  onChange={(e) => setNovoPrecoPorKg(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => aplicarDescontoPrecoPorKg(mostrarCalculoReverso, 5)}
                >
                  -5%
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => aplicarDescontoPrecoPorKg(mostrarCalculoReverso, 10)}
                >
                  -10%
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => aplicarDescontoPrecoPorKg(mostrarCalculoReverso, 15)}
                >
                  -15%
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => aplicarDescontoPrecoPorKg(mostrarCalculoReverso, 20)}
                >
                  -20%
                </Button>
              </div>
              
              <div className="pt-4 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setMostrarCalculoReverso(null)}>
                  Cancelar
                </Button>
                <Button onClick={() => {
                  const precoPorKg = parseFloat(novoPrecoPorKg) || 0;
                  if (precoPorKg > 0) {
                    aplicarPrecoPorKg(mostrarCalculoReverso, precoPorKg);
                  } else {
                    toast({
                      title: "Valor inválido",
                      description: "Digite um preço por kg válido",
                      variant: "destructive",
                    });
                  }
                }}>
                  Aplicar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Dialog>
  );
}