// src/components/compras/NovaCompra.tsx - VERSÃO COMPLETA CORRIGIDA
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, Save, X, Loader2, Package, AlertCircle, CreditCard, Percent, Truck, Receipt, CheckCircle } from 'lucide-react';
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Fornecedor {
  id: string;
  nome: string;
  email?: string;
  telefone?: string;
}

interface Produto {
  id: string;
  nome: string;
  codigo: string;
  unidade: string;
  custo: number;
  estoque: number;
}

interface ItemCompra {
  id: string;
  produto_id: string;
  nome: string;
  codigo: string;
  quantidade: number;
  unidade: string;
  valor_unitario: number;
  valor_total: number;
}

interface NovaCompraProps {
  fornecedores: Fornecedor[];
  onSuccess: () => void;
}

const CONDICOES_PAGAMENTO = {
  'TEC': {
    nome: 'TEC',
    descricao: '15/30/45/60 dias após faturamento',
    parcelas: [15, 30, 45, 60],
    tipo: 'parcelado',
    numeroParcelas: 4
  },
  'NA': {
    nome: 'NA',
    descricao: '15/30 dias após faturamento',
    parcelas: [15, 30],
    tipo: 'parcelado',
    numeroParcelas: 2
  },
  'GMF': {
    nome: 'GMF',
    descricao: '14/28/42/56 dias após faturamento',
    parcelas: [14, 28, 42, 56],
    tipo: 'parcelado',
    numeroParcelas: 4
  },
  '30/60': {
    nome: '30/60',
    descricao: '30/60 dias após faturamento',
    parcelas: [30, 60],
    tipo: 'parcelado',
    numeroParcelas: 2
  },
  'AVISTA': {
    nome: 'AVISTA',
    descricao: 'À vista - 30 dias após faturamento',
    parcelas: [30],
    tipo: 'avista',
    numeroParcelas: 1
  }
};

export default function NovaCompra({ fornecedores, onSuccess }: NovaCompraProps) {
  const { user } = useAuth();
  const [fornecedorId, setFornecedorId] = useState('');
  const [dataEmissao, setDataEmissao] = useState(new Date().toISOString().split('T')[0]);
  const [dataEntregaPrevista, setDataEntregaPrevista] = useState('');
  const [formaPagamento, setFormaPagamento] = useState('dinheiro');
  const [categoria, setCategoria] = useState('Compras');
  const [observacoes, setObservacoes] = useState('');
  const [itens, setItens] = useState<ItemCompra[]>([
    {
      id: `item-${Date.now()}`,
      produto_id: '',
      nome: '',
      codigo: '',
      quantidade: 1,
      unidade: 'un',
      valor_unitario: 0,
      valor_total: 0
    }
  ]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingProdutos, setLoadingProdutos] = useState(false);
  
  const [condicaoPagamento, setCondicaoPagamento] = useState('AVISTA');
  const [parcelado, setParcelado] = useState(false);
  const [numeroParcelas, setNumeroParcelas] = useState(1);
  const [parcelasGeradas, setParcelasGeradas] = useState<Array<{
    numero: number;
    dataVencimento: string;
    valor: number;
    status: string;
  }>>([]);

  const [dataFaturamento, setDataFaturamento] = useState(new Date().toISOString().split('T')[0]);
  const [dataRecebimento, setDataRecebimento] = useState(new Date().toISOString().split('T')[0]);
  const [dialogFaturamentoAberto, setDialogFaturamentoAberto] = useState(false);
  const [dialogRecebimentoAberto, setDialogRecebimentoAberto] = useState(false);

  const [compraId, setCompraId] = useState<string | null>(null);
  const [compraNumero, setCompraNumero] = useState<string | null>(null);
  const [compraSalva, setCompraSalva] = useState<boolean>(false);
  const [compraFaturada, setCompraFaturada] = useState<boolean>(false);
  const [compraRecebida, setCompraRecebida] = useState<boolean>(false);

  useEffect(() => {
    carregarProdutos();
  }, []);

  useEffect(() => {
    const condicao = CONDICOES_PAGAMENTO[condicaoPagamento as keyof typeof CONDICOES_PAGAMENTO];
    if (condicao) {
      if (condicaoPagamento === 'AVISTA') {
        setParcelado(false);
        setNumeroParcelas(1);
      } else {
        setParcelado(true);
        setNumeroParcelas(condicao.numeroParcelas);
      }
    }
  }, [condicaoPagamento]);

  useEffect(() => {
    if (dataFaturamento && condicaoPagamento !== 'AVISTA' && parcelado) {
      gerarParcelas();
    }
  }, [dataFaturamento, condicaoPagamento, parcelado, itens]);

  const carregarProdutos = async () => {
    try {
      setLoadingProdutos(true);
      const { data, error } = await supabase
        .from('produtos')
        .select('id, nome, codigo, unidade, custo, estoque')
        .eq('ativo', true)
        .order('nome');

      if (error) throw error;
      setProdutos(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar produtos",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoadingProdutos(false);
    }
  };

  const gerarParcelas = () => {
    const condicao = CONDICOES_PAGAMENTO[condicaoPagamento as keyof typeof CONDICOES_PAGAMENTO];
    if (!condicao || condicao.parcelas.length === 0) return;

    const valorTotal = calcularTotal();
    const valorParcela = valorTotal / condicao.parcelas.length;
    const dataBase = new Date(dataFaturamento);
    const parcelas = [];

    for (let i = 0; i < condicao.parcelas.length; i++) {
      const dataVencimento = new Date(dataBase);
      dataVencimento.setDate(dataVencimento.getDate() + condicao.parcelas[i]);
      
      parcelas.push({
        numero: i + 1,
        dataVencimento: dataVencimento.toISOString().split('T')[0],
        valor: valorParcela,
        status: 'pendente'
      });
    }

    setParcelasGeradas(parcelas);
  };

  const calcularTotal = () => {
    return itens.reduce((total, item) => total + (item.valor_total || 0), 0);
  };

  const adicionarItem = () => {
    const novoItem: ItemCompra = {
      id: `item-${Date.now()}`,
      produto_id: '',
      nome: '',
      codigo: '',
      quantidade: 1,
      unidade: 'un',
      valor_unitario: 0,
      valor_total: 0
    };
    setItens([...itens, novoItem]);
  };

  const removerItem = (id: string) => {
    if (itens.length > 1) {
      setItens(itens.filter(item => item.id !== id));
    }
  };

  const atualizarItem = (id: string, campo: keyof ItemCompra, valor: any) => {
    setItens(itens.map(item => {
      if (item.id === id) {
        const itemAtualizado = { ...item, [campo]: valor };
        
        if (campo === 'produto_id' && valor) {
          const produto = produtos.find(p => p.id === valor);
          if (produto) {
            itemAtualizado.nome = produto.nome;
            itemAtualizado.codigo = produto.codigo;
            itemAtualizado.unidade = produto.unidade;
            itemAtualizado.valor_unitario = produto.custo || 0;
            itemAtualizado.valor_total = itemAtualizado.quantidade * itemAtualizado.valor_unitario;
          }
        }
        
        if (campo === 'quantidade' || campo === 'valor_unitario') {
          itemAtualizado.valor_total = itemAtualizado.quantidade * itemAtualizado.valor_unitario;
        }
        
        return itemAtualizado;
      }
      return item;
    }));
  };

  const validarFormulario = () => {
    if (!fornecedorId) {
      toast({
        title: "Fornecedor obrigatório",
        description: "Selecione um fornecedor",
        variant: "destructive",
      });
      return false;
    }

    for (const item of itens) {
      if (!item.produto_id) {
        toast({
          title: "Produto obrigatório",
          description: "Todos os itens devem ter um produto",
          variant: "destructive",
        });
        return false;
      }
      
      if (item.quantidade <= 0) {
        toast({
          title: "Quantidade inválida",
          description: "Quantidade deve ser maior que zero",
          variant: "destructive",
        });
        return false;
      }
    }

    return true;
  };

  const criarParcelasFinanceiras = async (fornecedorId: string, valorTotal: number, numeroCompra: string, compraId: string) => {
    const fornecedor = fornecedores.find(f => f.id === fornecedorId);
    const nomeFornecedor = fornecedor?.nome || 'Fornecedor';
    const parcelasParaCriar = condicaoPagamento === 'AVISTA' 
      ? [{
          numero: 1,
          dataVencimento: new Date(new Date(dataFaturamento).setDate(new Date(dataFaturamento).getDate() + 30)).toISOString().split('T')[0],
          valor: valorTotal,
          status: 'pendente'
        }]
      : parcelasGeradas;

    const transacoesCriadas = [];

    for (const parcela of parcelasParaCriar) {
      const transacaoData = {
        descricao: `Compra ${numeroCompra} - ${nomeFornecedor}${parcelasParaCriar.length > 1 ? ` (${parcela.numero}/${parcelasParaCriar.length})` : ''}`,
        tipo: 'despesa',
        categoria: categoria,
        valor: parcela.valor,
        data: dataEmissao,
        data_vencimento: parcela.dataVencimento,
        forma_pagamento: formaPagamento,
        status: 'pendente',
        observacoes: observacoes || `Compra ${numeroCompra} - Faturada em ${new Date(dataFaturamento).toLocaleDateString('pt-BR')}`,
        origem_tipo: 'compra',
        compra_id: compraId,
        created_by: user?.id,
        parcela_numero: parcela.numero,
        total_parcelas: parcelasParaCriar.length,
        numero_parcela: `${parcela.numero}/${parcelasParaCriar.length}`
      };

      const { data, error } = await supabase
        .from('transacoes_financeiras')
        .insert(transacaoData)
        .select()
        .single();

      if (error) throw error;
      transacoesCriadas.push(data);
    }

    return transacoesCriadas;
  };

  const atualizarEstoque = async () => {
    for (const item of itens) {
      const { data: produto } = await supabase
        .from('produtos')
        .select('estoque')
        .eq('id', item.produto_id)
        .single();

      if (produto) {
        const novoEstoque = (produto.estoque || 0) + item.quantidade;
        
        await supabase
          .from('produtos')
          .update({ estoque: novoEstoque })
          .eq('id', item.produto_id);

        await supabase
          .from('movimentacao_estoque')
          .insert({
            produto_id: item.produto_id,
            tipo: 'entrada',
            quantidade: item.quantidade,
            motivo: 'compra',
            estoque_anterior: produto.estoque || 0,
            estoque_atual: novoEstoque,
            compra_id: compraId,
            data_recebimento: dataRecebimento
          });
      }
    }
  };

  const salvarCompra = async () => {
    if (!validarFormulario()) return;

    try {
      setLoading(true);

      const { data: ultimaCompra } = await supabase
        .from('compras')
        .select('numero')
        .order('created_at', { ascending: false })
        .limit(1);

      let proximoNumero = 1;
      if (ultimaCompra && ultimaCompra[0]?.numero) {
        const match = ultimaCompra[0].numero.match(/\d+/);
        if (match) proximoNumero = parseInt(match[0]) + 1;
      }

      const numeroCompra = `CMP-${String(proximoNumero).padStart(3, '0')}`;
      const valorTotal = calcularTotal();

      const compraData = {
        numero: numeroCompra,
        fornecedor_id: fornecedorId,
        data_emissao: dataEmissao,
        data_entrega_prevista: dataEntregaPrevista || null,
        valor_total: valorTotal,
        status: 'pendente',
        observacoes: observacoes || null,
        parcelado: condicaoPagamento !== 'AVISTA',
        condicao_pagamento: condicaoPagamento,
        numero_parcelas: condicaoPagamento === 'AVISTA' ? 1 : numeroParcelas,
        forma_pagamento: formaPagamento,
        compra_faturada: false,
        mercadoria_recebida: false
      };

      const { data: compra, error: compraError } = await supabase
        .from('compras')
        .insert(compraData)
        .select()
        .single();

      if (compraError) throw compraError;

      const itensParaInserir = itens.map(item => ({
        compra_id: compra.id,
        produto_id: item.produto_id,
        quantidade: item.quantidade,
        valor_unitario: item.valor_unitario,
        subtotal: item.valor_total
      }));

      const { error: itensError } = await supabase
        .from('compra_itens')
        .insert(itensParaInserir);

      if (itensError) throw itensError;

      setCompraId(compra.id);
      setCompraNumero(numeroCompra);
      setCompraSalva(true);
      setCompraFaturada(false);
      setCompraRecebida(false);

      toast({
        title: "✅ Compra Salva com Sucesso!",
        description: (
          <div>
            <p className="font-medium">Compra {numeroCompra} salva</p>
            <p className="text-sm">Agora utilize os botões de controle abaixo</p>
          </div>
        ),
      });

    } catch (error: any) {
      toast({
        title: "Erro ao salvar compra",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const faturarCompra = async () => {
    if (!compraId || !compraNumero) {
      toast({
        title: "Erro",
        description: "Compra não encontrada",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      const { error: updateError } = await supabase
        .from('compras')
        .update({
          compra_faturada: true,
          data_faturamento: dataFaturamento,
          status: compraRecebida ? 'finalizada' : 'faturada'
        })
        .eq('id', compraId);

      if (updateError) throw updateError;

      const transacoes = await criarParcelasFinanceiras(fornecedorId, calcularTotal(), compraNumero, compraId);

      setCompraFaturada(true);
      setDialogFaturamentoAberto(false);

      toast({
        title: "🧾 Pedido Faturado!",
        description: `${transacoes.length} despesa(s) financeira(s) criada(s)`,
      });

    } catch (error: any) {
      toast({
        title: "Erro ao faturar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const receberCompra = async () => {
    if (!compraId || !compraNumero) {
      toast({
        title: "Erro",
        description: "Compra não encontrada",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      await atualizarEstoque();

      const { error: updateError } = await supabase
        .from('compras')
        .update({
          mercadoria_recebida: true,
          data_recebimento: dataRecebimento,
          status: compraFaturada ? 'finalizada' : 'recebida'
        })
        .eq('id', compraId);

      if (updateError) throw updateError;

      setCompraRecebida(true);
      setDialogRecebimentoAberto(false);

      toast({
        title: "📦 Pedido Recebido!",
        description: "Estoque atualizado com sucesso",
      });

    } catch (error: any) {
      toast({
        title: "Erro ao receber",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetarFormulario = () => {
    setFornecedorId('');
    setDataEntregaPrevista('');
    setObservacoes('');
    setCondicaoPagamento('AVISTA');
    setCompraId(null);
    setCompraNumero(null);
    setCompraSalva(false);
    setCompraFaturada(false);
    setCompraRecebida(false);
    setItens([{
      id: `item-${Date.now()}`,
      produto_id: '',
      nome: '',
      codigo: '',
      quantidade: 1,
      unidade: 'un',
      valor_unitario: 0,
      valor_total: 0
    }]);
    setParcelasGeradas([]);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>, itemId: string, field: 'quantidade' | 'valor_unitario') => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value) && value >= 0) {
      atualizarItem(itemId, field, value);
    }
  };

  const formasPagamento = [
    { value: 'dinheiro', label: 'Dinheiro' },
    { value: 'cartao_credito', label: 'Cartão de Crédito' },
    { value: 'cartao_debito', label: 'Cartão de Débito' },
    { value: 'pix', label: 'PIX' },
    { value: 'boleto', label: 'Boleto' },
    { value: 'transferencia', label: 'Transferência Bancária' }
  ];

  const categorias = [
    'Compras',
    'Aluguel',
    'Salários',
    'Contas de Luz',
    'Contas de Água',
    'Internet',
    'Marketing',
    'Manutenção',
    'Transporte',
    'Outros'
  ];

  return (
    <Card className="border-2 border-blue-100">
      <CardHeader className="bg-blue-50">
        <CardTitle className="flex items-center gap-2 text-blue-700">
          <Package className="h-6 w-6" />
          Nova Compra
        </CardTitle>
        <CardDescription>
          Preencha os dados da compra, salve e depois controle faturamento e recebimento
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6 pt-6">
        {/* Status e Controles */}
        <div className="border-2 border-green-100 rounded-lg p-4 bg-green-50/50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-green-600" />
              <h3 className="font-semibold text-green-700">Status da Compra</h3>
            </div>
            <div className="flex gap-2">
              <Badge variant={compraFaturada ? "default" : "outline"} 
                     className={compraFaturada ? "bg-green-600" : "bg-gray-100"}>
                {compraFaturada ? '🧾 Faturado' : '⏳ Aguardando faturamento'}
              </Badge>
              <Badge variant={compraRecebida ? "default" : "outline"} 
                     className={compraRecebida ? "bg-blue-600" : "bg-gray-100"}>
                {compraRecebida ? '📦 Recebido' : '⏳ Aguardando recebimento'}
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dataFaturamento" className="font-medium flex items-center gap-1">
                <Receipt className="h-4 w-4" />
                Data de Faturamento
              </Label>
              <Input
                id="dataFaturamento"
                type="date"
                value={dataFaturamento}
                onChange={(e) => setDataFaturamento(e.target.value)}
                className="border-green-200"
              />
              <p className="text-xs text-green-600">
                ✓ Prazos de pagamento contarão a partir desta data
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dataRecebimento" className="font-medium flex items-center gap-1">
                <Truck className="h-4 w-4" />
                Data de Recebimento
              </Label>
              <Input
                id="dataRecebimento"
                type="date"
                value={dataRecebimento}
                onChange={(e) => setDataRecebimento(e.target.value)}
                className="border-blue-200"
              />
              <p className="text-xs text-blue-600">
                ✓ Estoque será atualizado nesta data
              </p>
            </div>
          </div>

          {compraSalva && (
            <Alert className={`mt-4 ${compraFaturada && compraRecebida ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'}`}>
              {compraFaturada && compraRecebida ? (
                <>
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-700">
                    <strong>✅ Compra Finalizada:</strong> {compraNumero} - Despesas criadas e estoque atualizado
                  </AlertDescription>
                </>
              ) : (
                <>
                  <Package className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-700">
                    <strong>📋 Compra {compraNumero} salva:</strong> Use os botões abaixo para controlar
                  </AlertDescription>
                </>
              )}
            </Alert>
          )}
        </div>

        {/* Dados Básicos */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="fornecedor">Fornecedor <span className="text-red-500">*</span></Label>
            <Select value={fornecedorId} onValueChange={setFornecedorId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um fornecedor" />
              </SelectTrigger>
              <SelectContent>
                {fornecedores.map(f => (
                  <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dataEmissao">Data de Emissão <span className="text-red-500">*</span></Label>
            <Input
              id="dataEmissao"
              type="date"
              value={dataEmissao}
              onChange={(e) => setDataEmissao(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="formaPagamento">Forma de Pagamento</Label>
            <Select value={formaPagamento} onValueChange={setFormaPagamento}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {formasPagamento.map(f => (
                  <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Condições de Pagamento */}
        <div className="border-2 border-green-100 rounded-lg p-4 bg-green-50/50">
          <div className="flex items-center gap-2 mb-4">
            <Percent className="h-5 w-5 text-green-600" />
            <h3 className="font-semibold text-green-700">Condição de Pagamento</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="condicaoPagamento">Condição <span className="text-red-500">*</span></Label>
              <Select value={condicaoPagamento} onValueChange={setCondicaoPagamento}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione condição" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AVISTA">À Vista - 30 dias após faturamento</SelectItem>
                  <SelectItem value="TEC">TEC - 15/30/45/60 dias</SelectItem>
                  <SelectItem value="NA">NA - 15/30 dias</SelectItem>
                  <SelectItem value="GMF">GMF - 14/28/42/56 dias</SelectItem>
                  <SelectItem value="30/60">30/60 - 30/60 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="categoria">Categoria</Label>
              <Select value={categoria} onValueChange={setCategoria}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione categoria" />
                </SelectTrigger>
                <SelectContent>
                  {categorias.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Produtos */}
        <div className="border-2 border-blue-100 rounded-lg">
          <div className="p-4 border-b border-blue-100 bg-blue-50 flex justify-between items-center">
            <div>
              <h3 className="font-semibold text-blue-700">Produtos da Compra</h3>
              <p className="text-sm text-blue-600">
                {compraRecebida ? '✅ Estoque atualizado' : '⏳ Estoque aguardando recebimento'}
              </p>
            </div>
            <Button size="sm" onClick={adicionarItem} type="button" className="bg-blue-600">
              <Plus className="mr-2 h-4 w-4" />
              Adicionar Produto
            </Button>
          </div>
          
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-blue-50">
                  <TableHead className="font-bold text-blue-700">Produto *</TableHead>
                  <TableHead className="font-bold text-blue-700">Qtd</TableHead>
                  <TableHead className="font-bold text-blue-700">Un</TableHead>
                  <TableHead className="font-bold text-blue-700">Valor Unit.</TableHead>
                  <TableHead className="font-bold text-blue-700">Valor Total</TableHead>
                  <TableHead className="font-bold text-blue-700 w-20">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingProdutos ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
                    </TableCell>
                  </TableRow>
                ) : (
                  itens.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Select value={item.produto_id} onValueChange={(v) => atualizarItem(item.id, 'produto_id', v)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            {produtos.map(p => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.nome} - Estoque: {p.estoque} {p.unidade}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={item.quantidade}
                          onChange={(e) => handleInputChange(e, item.id, 'quantidade')}
                          className="w-20"
                        />
                      </TableCell>
                      <TableCell>{item.unidade}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.valor_unitario}
                          onChange={(e) => handleInputChange(e, item.id, 'valor_unitario')}
                          className="w-28"
                        />
                      </TableCell>
                      <TableCell className="font-bold text-blue-700">
                        {formatCurrency(item.valor_total)}
                      </TableCell>
                      <TableCell>
                        {itens.length > 1 && (
                          <Button variant="ghost" size="sm" onClick={() => removerItem(item.id)} className="text-red-500">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Observações */}
        <div className="space-y-2">
          <Label htmlFor="observacoes">Observações</Label>
          <Input
            id="observacoes"
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="Informações adicionais sobre a compra..."
          />
        </div>

        {/* Resumo e Botões */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-t pt-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <p className="text-sm text-gray-500">Total da Compra:</p>
              <Badge variant="outline" className="bg-blue-50">
                {CONDICOES_PAGAMENTO[condicaoPagamento as keyof typeof CONDICOES_PAGAMENTO]?.nome}
              </Badge>
            </div>
            <div className="text-3xl font-bold text-blue-700">
              {formatCurrency(calcularTotal())}
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            <Button variant="outline" onClick={onSuccess} disabled={loading} className="flex-1 md:flex-none">
              <X className="mr-2 h-4 w-4" />
              Cancelar
            </Button>
            
            {!compraSalva ? (
              <Button onClick={salvarCompra} disabled={loading || loadingProdutos} className="flex-1 md:flex-none bg-blue-600">
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Salvar Compra
              </Button>
            ) : (
              <>
                {!compraFaturada && (
                  <Button onClick={() => setDialogFaturamentoAberto(true)} disabled={loading} className="bg-amber-600">
                    <Receipt className="mr-2 h-4 w-4" />
                    Pedido Faturado
                  </Button>
                )}
                
                {!compraRecebida && (
                  <Button onClick={() => setDialogRecebimentoAberto(true)} disabled={loading} className="bg-blue-600">
                    <Truck className="mr-2 h-4 w-4" />
                    Pedido Recebido
                  </Button>
                )}
                
                {compraFaturada && compraRecebida && (
                  <Button onClick={() => { resetarFormulario(); onSuccess(); }} className="bg-green-600">
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Finalizar
                  </Button>
                )}
                
                <Button variant="outline" onClick={salvarCompra} disabled={loading} className="border-blue-300 text-blue-700">
                  <Save className="mr-2 h-4 w-4" />
                  Atualizar
                </Button>
              </>
            )}
          </div>
        </div>
      </CardContent>

      {/* Dialog Faturamento */}
      <Dialog open={dialogFaturamentoAberto} onOpenChange={setDialogFaturamentoAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-amber-600" />
              Confirmar Faturamento
            </DialogTitle>
            <DialogDescription>
              As despesas serão criadas com base na data de faturamento informada.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Data de Faturamento</Label>
              <Input
                type="date"
                value={dataFaturamento}
                onChange={(e) => setDataFaturamento(e.target.value)}
              />
            </div>

            <div className="border rounded-lg p-4 bg-gray-50">
              <p className="font-medium mb-2">Resumo:</p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Compra:</span>
                  <span className="font-medium">{compraNumero}</span>
                </div>
                <div className="flex justify-between">
                  <span>Valor:</span>
                  <span className="font-medium">{formatCurrency(calcularTotal())}</span>
                </div>
                <div className="flex justify-between">
                  <span>Condição:</span>
                  <span className="font-medium">{CONDICOES_PAGAMENTO[condicaoPagamento as keyof typeof CONDICOES_PAGAMENTO]?.nome}</span>
                </div>
                <div className="flex justify-between">
                  <span>Parcelas:</span>
                  <span className="font-medium">
                    {condicaoPagamento === 'AVISTA' ? '1' : numeroParcelas}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogFaturamentoAberto(false)}>
              Cancelar
            </Button>
            <Button onClick={faturarCompra} disabled={loading} className="bg-amber-600">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirmar Faturamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Recebimento */}
      <Dialog open={dialogRecebimentoAberto} onOpenChange={setDialogRecebimentoAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-blue-600" />
              Confirmar Recebimento
            </DialogTitle>
            <DialogDescription>
              O estoque será atualizado com os produtos desta compra.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Data de Recebimento</Label>
              <Input
                type="date"
                value={dataRecebimento}
                onChange={(e) => setDataRecebimento(e.target.value)}
              />
            </div>

            <div className="border rounded-lg p-4 bg-gray-50">
              <p className="font-medium mb-2">Produtos a receber:</p>
              {itens.map(item => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span>{item.nome || 'Produto'}</span>
                  <span className="font-medium">{item.quantidade} {item.unidade}</span>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogRecebimentoAberto(false)}>
              Cancelar
            </Button>
            <Button onClick={receberCompra} disabled={loading} className="bg-blue-600">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirmar Recebimento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}