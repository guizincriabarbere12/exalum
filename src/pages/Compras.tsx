// src/pages/Compras.tsx - VERSÃO COMPLETA COM BOTÃO VER ITENS
import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PlusCircle, Package, FileText, CheckCircle, ShoppingBag, List, Search, RefreshCw, Receipt, Truck, XCircle, Clock, DollarSign, Eye } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import NovaCompra from '@/components/compras/NovaCompra';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

interface Fornecedor {
  id: string;
  nome: string;
  cnpj?: string;
  email?: string;
  telefone?: string;
}

interface CompraItem {
  id: string;
  compra_id: string;
  produto_id: string;
  quantidade: number;
  valor_unitario: number;
  subtotal: number;
  produto?: {
    id: string;
    nome: string;
    codigo: string;
    unidade: string;
  };
}

interface Compra {
  id: string;
  numero: string;
  fornecedor_id: string;
  fornecedor?: Fornecedor;
  data_emissao: string;
  data_entrega_prevista?: string;
  data_recebimento?: string | null;
  data_faturamento?: string | null;
  valor_total: number;
  status: 'pendente' | 'recebida' | 'cancelada';
  observacoes?: string;
  compra_faturada?: boolean;
  mercadoria_recebida?: boolean;
  condicao_pagamento?: string;
  numero_parcelas?: number;
  forma_pagamento?: string;
  created_at: string;
  itens?: CompraItem[];
}

export default function Compras() {
  const { user } = useAuth();
  const [compras, setCompras] = useState<Compra[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [activeTab, setActiveTab] = useState('lista');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [processandoId, setProcessandoId] = useState<string | null>(null);
  
  // Estados para VER ITENS
  const [dialogItensAberto, setDialogItensAberto] = useState(false);
  const [compraSelecionada, setCompraSelecionada] = useState<Compra | null>(null);
  
  // Estados para faturar
  const [dialogFaturamentoAberto, setDialogFaturamentoAberto] = useState(false);
  const [compraParaFaturar, setCompraParaFaturar] = useState<Compra | null>(null);
  const [dataFaturamento, setDataFaturamento] = useState(new Date().toISOString().split('T')[0]);
  
  // Estados para receber
  const [dialogRecebimentoAberto, setDialogRecebimentoAberto] = useState(false);
  const [compraParaReceber, setCompraParaReceber] = useState<Compra | null>(null);
  const [dataRecebimento, setDataRecebimento] = useState(new Date().toISOString().split('T')[0]);
  
  // Estados para cancelar
  const [dialogCancelarAberto, setDialogCancelarAberto] = useState(false);
  const [compraParaCancelar, setCompraParaCancelar] = useState<string | null>(null);

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    try {
      setLoading(true);
      
      // Carregar fornecedores
      const { data: fornecedoresData, error: fornecedoresError } = await supabase
        .from('fornecedores')
        .select('id, nome, cnpj, email, telefone')
        .order('nome');

      if (fornecedoresError) throw fornecedoresError;
      setFornecedores(fornecedoresData || []);

      // Carregar compras
      const { data: comprasData, error: comprasError } = await supabase
        .from('compras')
        .select(`
          *,
          fornecedor:fornecedores(id, nome, cnpj, email, telefone)
        `)
        .order('created_at', { ascending: false });

      if (comprasError) throw comprasError;
      
      // Carregar itens para cada compra
      const comprasComItens = await Promise.all(
        (comprasData || []).map(async (compra) => {
          const { data: itens } = await supabase
            .from('compra_itens')
            .select(`
              *,
              produto:produtos(id, nome, codigo, unidade)
            `)
            .eq('compra_id', compra.id);
          
          return {
            ...compra,
            itens: itens || []
          };
        })
      );
      
      setCompras(comprasComItens);
      
    } catch (error: any) {
      console.error('Erro ao carregar dados:', error);
      toast({
        title: "Erro ao carregar dados",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerItens = (compra: Compra) => {
    setCompraSelecionada(compra);
    setDialogItensAberto(true);
  };

  const handleFaturarClick = (compra: Compra) => {
    setCompraParaFaturar(compra);
    setDataFaturamento(new Date().toISOString().split('T')[0]);
    setDialogFaturamentoAberto(true);
  };

  const handleReceberClick = (compra: Compra) => {
    setCompraParaReceber(compra);
    setDataRecebimento(new Date().toISOString().split('T')[0]);
    setDialogRecebimentoAberto(true);
  };

  const handleCancelarClick = (compraId: string) => {
    setCompraParaCancelar(compraId);
    setDialogCancelarAberto(true);
  };

  const faturarCompra = async () => {
    if (!compraParaFaturar) return;
    
    try {
      setProcessandoId(compraParaFaturar.id);
      
      // Status permitidos: 'pendente', 'recebida', 'cancelada'
      const novoStatus = compraParaFaturar.mercadoria_recebida ? 'recebida' : 'pendente';
      
      const { error: updateError } = await supabase
        .from('compras')
        .update({
          compra_faturada: true,
          data_faturamento: dataFaturamento,
          status: novoStatus
        })
        .eq('id', compraParaFaturar.id);

      if (updateError) throw updateError;

      // Buscar condição de pagamento
      const condicaoPagamento = compraParaFaturar.condicao_pagamento || 'AVISTA';
      const numeroParcelas = compraParaFaturar.numero_parcelas || 1;
      const valorParcela = compraParaFaturar.valor_total / numeroParcelas;
      
      // Criar parcelas no financeiro
      const parcelas = [];
      const dataBase = new Date(dataFaturamento);
      
      for (let i = 0; i < numeroParcelas; i++) {
        let dias = 30;
        if (condicaoPagamento === 'TEC') dias = [15, 30, 45, 60][i] || 30;
        else if (condicaoPagamento === 'NA') dias = [15, 30][i] || 30;
        else if (condicaoPagamento === 'GMF') dias = [14, 28, 42, 56][i] || 30;
        else if (condicaoPagamento === '30/60') dias = [30, 60][i] || 30;
        
        const dataVencimento = new Date(dataBase);
        dataVencimento.setDate(dataVencimento.getDate() + dias);
        
        parcelas.push({
          descricao: `Compra ${compraParaFaturar.numero} - ${compraParaFaturar.fornecedor?.nome || 'Fornecedor'} (${i+1}/${numeroParcelas})`,
          tipo: 'despesa',
          categoria: 'Compras',
          valor: valorParcela,
          data: dataFaturamento,
          data_vencimento: dataVencimento.toISOString().split('T')[0],
          forma_pagamento: compraParaFaturar.forma_pagamento || 'boleto',
          status: 'pendente',
          observacoes: `Faturamento em ${new Date(dataFaturamento).toLocaleDateString('pt-BR')}`,
          origem_tipo: 'compra',
          compra_id: compraParaFaturar.id,
          parcela_numero: i + 1,
          total_parcelas: numeroParcelas,
          numero_parcela: `${i+1}/${numeroParcelas}`,
          created_by: user?.id
        });
      }

      const { error: transacaoError } = await supabase
        .from('transacoes_financeiras')
        .insert(parcelas);

      if (transacaoError) throw transacaoError;

      toast({
        title: "✅ Compra faturada com sucesso!",
        description: `${numeroParcelas} parcela(s) financeira(s) criada(s).`,
      });

      setDialogFaturamentoAberto(false);
      await carregarDados();
      
    } catch (error: any) {
      console.error('Erro ao faturar:', error);
      toast({
        title: "Erro ao faturar compra",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setProcessandoId(null);
      setCompraParaFaturar(null);
    }
  };

  const receberCompra = async () => {
    if (!compraParaReceber) return;
    
    try {
      setProcessandoId(compraParaReceber.id);
      
      // Buscar itens da compra
      const { data: itens, error: itensError } = await supabase
        .from('compra_itens')
        .select('*')
        .eq('compra_id', compraParaReceber.id);

      if (itensError) throw itensError;

      // Atualizar estoque de cada produto
      if (itens) {
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
              .from('movimentacoes_estoque')
              .insert({
                produto_id: item.produto_id,
                tipo: 'entrada',
                quantidade: item.quantidade,
                quantidade_anterior: produto.estoque || 0,
                quantidade_atual: novoEstoque,
                origem: 'compra',
                compra_id: compraParaReceber.id,
                usuario_id: user?.id,
                observacoes: `Recebimento da compra ${compraParaReceber.numero}`
              });
          }
        }
      }

      // Atualizar status da compra
      const { error: updateError } = await supabase
        .from('compras')
        .update({
          mercadoria_recebida: true,
          data_recebimento: dataRecebimento,
          status: 'recebida'
        })
        .eq('id', compraParaReceber.id);

      if (updateError) throw updateError;

      toast({
        title: "📦 Compra recebida com sucesso!",
        description: "Estoque atualizado.",
      });

      setDialogRecebimentoAberto(false);
      await carregarDados();
      
    } catch (error: any) {
      console.error('Erro ao receber:', error);
      toast({
        title: "Erro ao receber compra",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setProcessandoId(null);
      setCompraParaReceber(null);
    }
  };

  const cancelarCompra = async () => {
    if (!compraParaCancelar) return;
    
    try {
      setProcessandoId(compraParaCancelar);
      
      const { error } = await supabase
        .from('compras')
        .update({
          status: 'cancelada',
          data_recebimento: null,
          data_faturamento: null
        })
        .eq('id', compraParaCancelar);

      if (error) throw error;

      toast({
        title: "❌ Compra cancelada",
        description: "A compra foi cancelada com sucesso.",
      });

      setDialogCancelarAberto(false);
      await carregarDados();
      
    } catch (error: any) {
      console.error('Erro ao cancelar:', error);
      toast({
        title: "Erro ao cancelar compra",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setProcessandoId(null);
      setCompraParaCancelar(null);
    }
  };

  const filteredCompras = compras.filter(compra => {
    const fornecedorNome = compra.fornecedor?.nome?.toLowerCase() || '';
    const numero = compra.numero?.toLowerCase() || '';
    const term = searchTerm.toLowerCase();
    
    return fornecedorNome.includes(term) || numero.includes(term);
  });

  const totalComprasPendentes = compras.filter(c => c.status === 'pendente' && !c.compra_faturada).length;
  const totalComprasFaturadas = compras.filter(c => c.compra_faturada && !c.mercadoria_recebida).length;
  const totalComprasRecebidas = compras.filter(c => c.status === 'recebida').length;
  const totalValorPendente = compras
    .filter(c => c.status !== 'cancelada' && !(c.compra_faturada && c.mercadoria_recebida))
    .reduce((acc, compra) => acc + (compra.valor_total || 0), 0);

  const getStatusInfo = (compra: Compra) => {
    if (compra.status === 'cancelada') {
      return {
        label: 'Cancelada',
        className: 'bg-red-100 text-red-800 border-red-200',
        icon: XCircle
      };
    }
    
    if (compra.status === 'recebida') {
      if (compra.compra_faturada) {
        return {
          label: '✅ Finalizada',
          className: 'bg-green-100 text-green-800 border-green-200',
          icon: CheckCircle
        };
      }
      return {
        label: '📦 Recebida',
        className: 'bg-blue-100 text-blue-800 border-blue-200',
        icon: Package
      };
    }
    
    if (compra.compra_faturada) {
      return {
        label: '🧾 Faturada',
        className: 'bg-amber-100 text-amber-800 border-amber-200',
        icon: Receipt
      };
    }
    
    return {
      label: '⏳ Pendente',
      className: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      icon: Clock
    };
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0);
  };

  const formatDate = (dateString: string | undefined | null) => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      return isNaN(date.getTime()) ? '-' : date.toLocaleDateString('pt-BR');
    } catch {
      return '-';
    }
  };

  const calcularTotalItens = (itens: CompraItem[] = []) => {
    return itens.reduce((acc, item) => acc + (item.quantidade || 0), 0);
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Compras</h1>
          <p className="text-gray-600 mt-1">Gerencie as compras, faturamento e recebimento</p>
        </div>
        <Button onClick={() => setActiveTab('nova')} className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto">
          <PlusCircle className="mr-2 h-4 w-4" />
          Nova Compra
        </Button>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total de Compras</p>
                <p className="text-2xl font-bold">{compras.length}</p>
              </div>
              <FileText className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pendentes</p>
                <p className="text-2xl font-bold text-yellow-600">{totalComprasPendentes}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Faturadas</p>
                <p className="text-2xl font-bold text-amber-600">{totalComprasFaturadas}</p>
              </div>
              <Receipt className="h-8 w-8 text-amber-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Recebidas</p>
                <p className="text-2xl font-bold text-green-600">{totalComprasRecebidas}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Legenda de Status */}
      <div className="flex flex-wrap gap-4 text-sm bg-gray-50 p-3 rounded-lg">
        <div className="flex items-center gap-1">
          <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">⏳ Pendente</Badge>
          <span className="text-gray-500">- Aguardando NF</span>
        </div>
        <div className="flex items-center gap-1">
          <Badge className="bg-amber-100 text-amber-800 border-amber-200">🧾 Faturada</Badge>
          <span className="text-gray-500">- NF emitida</span>
        </div>
        <div className="flex items-center gap-1">
          <Badge className="bg-blue-100 text-blue-800 border-blue-200">📦 Recebida</Badge>
          <span className="text-gray-500">- Estoque atualizado</span>
        </div>
        <div className="flex items-center gap-1">
          <Badge className="bg-green-100 text-green-800 border-green-200">✅ Finalizada</Badge>
          <span className="text-gray-500">- Faturada + Recebida</span>
        </div>
        <div className="flex items-center gap-1">
          <Badge className="bg-red-100 text-red-800 border-red-200">❌ Cancelada</Badge>
          <span className="text-gray-500">- Cancelada</span>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="lista">
            <List className="mr-2 h-4 w-4" />
            Lista de Compras
          </TabsTrigger>
          <TabsTrigger value="nova">
            <ShoppingBag className="mr-2 h-4 w-4" />
            Nova Compra
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="lista" className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                <div className="flex-1 w-full sm:w-auto">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Buscar por fornecedor ou número..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 w-full"
                    />
                  </div>
                </div>
                <Button variant="outline" onClick={carregarDados} className="w-full sm:w-auto">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Atualizar
                </Button>
              </div>

              {loading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-4 text-gray-600">Carregando compras...</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="font-bold">Número</TableHead>
                        <TableHead className="font-bold">Fornecedor</TableHead>
                        <TableHead className="font-bold">Emissão</TableHead>
                        <TableHead className="font-bold">Entrega Prevista</TableHead>
                        <TableHead className="font-bold">Valor Total</TableHead>
                        <TableHead className="font-bold">Itens</TableHead>
                        <TableHead className="font-bold">Status</TableHead>
                        <TableHead className="font-bold text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCompras.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                            {searchTerm 
                              ? "Nenhuma compra encontrada" 
                              : "Nenhuma compra cadastrada. Clique em 'Nova Compra' para começar."
                            }
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredCompras.map((compra) => {
                          const statusInfo = getStatusInfo(compra);
                          const StatusIcon = statusInfo.icon;
                          const totalItens = compra.itens?.length || 0;
                          const quantidadeTotal = calcularTotalItens(compra.itens || []);
                          
                          return (
                            <TableRow key={compra.id} className="hover:bg-gray-50">
                              <TableCell className="font-medium">{compra.numero}</TableCell>
                              <TableCell>{compra.fornecedor?.nome || '-'}</TableCell>
                              <TableCell>{formatDate(compra.data_emissao)}</TableCell>
                              <TableCell>{formatDate(compra.data_entrega_prevista)}</TableCell>
                              <TableCell className="font-bold text-blue-700">
                                {formatCurrency(compra.valor_total)}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                                  <ShoppingBag className="h-3 w-3 mr-1" />
                                  {totalItens} itens
                                </Badge>
                                <div className="text-xs text-gray-500 mt-1">
                                  {quantidadeTotal} unidades
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className={statusInfo.className}>
                                  <StatusIcon className="h-3 w-3 mr-1" />
                                  {statusInfo.label}
                                </Badge>
                                
                                <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                                  {compra.data_faturamento && (
                                    <div className="flex items-center gap-1">
                                      <Receipt className="h-3 w-3 text-amber-600" />
                                      Faturamento: {formatDate(compra.data_faturamento)}
                                    </div>
                                  )}
                                  {compra.data_recebimento && (
                                    <div className="flex items-center gap-1">
                                      <Truck className="h-3 w-3 text-blue-600" />
                                      Recebimento: {formatDate(compra.data_recebimento)}
                                    </div>
                                  )}
                                  {compra.numero_parcelas && compra.numero_parcelas > 1 && (
                                    <div className="flex items-center gap-1">
                                      <DollarSign className="h-3 w-3 text-green-600" />
                                      {compra.numero_parcelas}x de {formatCurrency(compra.valor_total / compra.numero_parcelas)}
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  {/* ✅ BOTÃO VER ITENS - SEMPRE VISÍVEL */}
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="border-purple-300 text-purple-700 hover:bg-purple-50"
                                    onClick={() => handleVerItens(compra)}
                                  >
                                    <Eye className="h-4 w-4 mr-1" />
                                    Ver Itens
                                  </Button>

                                  {/* Botão Faturar */}
                                  {!compra.compra_faturada && compra.status !== 'cancelada' && (
                                    <Button
                                      size="sm"
                                      className="bg-amber-600 hover:bg-amber-700 text-white"
                                      onClick={() => handleFaturarClick(compra)}
                                      disabled={processandoId === compra.id}
                                    >
                                      {processandoId === compra.id ? (
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mx-auto"></div>
                                      ) : (
                                        <>
                                          <Receipt className="h-4 w-4 mr-1" />
                                          Faturar
                                        </>
                                      )}
                                    </Button>
                                  )}

                                  {/* Botão Receber */}
                                  {!compra.mercadoria_recebida && compra.status !== 'cancelada' && (
                                    <Button
                                      size="sm"
                                      className="bg-blue-600 hover:bg-blue-700 text-white"
                                      onClick={() => handleReceberClick(compra)}
                                      disabled={processandoId === compra.id}
                                    >
                                      {processandoId === compra.id ? (
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mx-auto"></div>
                                      ) : (
                                        <>
                                          <Truck className="h-4 w-4 mr-1" />
                                          Receber
                                        </>
                                      )}
                                    </Button>
                                  )}

                                  {/* Botão Cancelar */}
                                  {compra.status !== 'cancelada' && compra.status !== 'recebida' && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="border-red-500 text-red-600 hover:bg-red-50"
                                      onClick={() => handleCancelarClick(compra.id)}
                                      disabled={processandoId === compra.id}
                                    >
                                      <XCircle className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="nova">
          {fornecedores.length > 0 ? (
            <NovaCompra 
              fornecedores={fornecedores}
              onSuccess={() => {
                setActiveTab('lista');
                carregarDados();
              }}
            />
          ) : (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-4 text-gray-600">Carregando fornecedores...</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* ✅ DIALOG PARA VER ITENS DA COMPRA */}
      <Dialog open={dialogItensAberto} onOpenChange={setDialogItensAberto}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-purple-600" />
              Itens da Compra {compraSelecionada?.numero}
            </DialogTitle>
            <DialogDescription>
              Fornecedor: {compraSelecionada?.fornecedor?.nome}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow className="bg-purple-50">
                    <TableHead className="font-bold">Código</TableHead>
                    <TableHead className="font-bold">Produto</TableHead>
                    <TableHead className="font-bold text-right">Quantidade</TableHead>
                    <TableHead className="font-bold">Unidade</TableHead>
                    <TableHead className="font-bold text-right">Valor Unit.</TableHead>
                    <TableHead className="font-bold text-right">Valor Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {compraSelecionada?.itens?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                        Nenhum item encontrado nesta compra
                      </TableCell>
                    </TableRow>
                  ) : (
                    compraSelecionada?.itens?.map((item) => (
                      <TableRow key={item.id} className="hover:bg-gray-50">
                        <TableCell className="font-mono text-sm">
                          {item.produto?.codigo || '-'}
                        </TableCell>
                        <TableCell className="font-medium">
                          {item.produto?.nome || item.produto_id}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.quantidade.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          {item.produto?.unidade || 'un'}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(item.valor_unitario)}
                        </TableCell>
                        <TableCell className="text-right font-bold text-blue-700">
                          {formatCurrency(item.subtotal || item.valor_unitario * item.quantidade)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-between items-center p-4 bg-gray-50 rounded-md">
              <div>
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Data de Emissão:</span>{' '}
                  {formatDate(compraSelecionada?.data_emissao)}
                </p>
                {compraSelecionada?.data_entrega_prevista && (
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Entrega Prevista:</span>{' '}
                    {formatDate(compraSelecionada.data_entrega_prevista)}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">
                  Total de Itens: <strong>{compraSelecionada?.itens?.length || 0}</strong>
                </p>
                <p className="text-sm text-gray-600">
                  Quantidade Total: <strong>
                    {compraSelecionada ? calcularTotalItens(compraSelecionada.itens).toFixed(2) : 0}
                  </strong>
                </p>
                <p className="text-lg font-bold text-blue-700">
                  {formatCurrency(compraSelecionada?.valor_total || 0)}
                </p>
              </div>
            </div>

            {compraSelecionada?.observacoes && (
              <div className="p-3 bg-gray-50 rounded-md border">
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Observações:</span> {compraSelecionada.observacoes}
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogItensAberto(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Faturamento */}
      <Dialog open={dialogFaturamentoAberto} onOpenChange={setDialogFaturamentoAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-amber-600" />
              Confirmar Faturamento
            </DialogTitle>
            <DialogDescription>
              As despesas serão criadas no financeiro com base na data informada.
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

            {compraParaFaturar && (
              <div className="border rounded-lg p-4 bg-gray-50">
                <p className="font-medium mb-2">Resumo:</p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Compra:</span>
                    <span className="font-medium">{compraParaFaturar.numero}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Fornecedor:</span>
                    <span className="font-medium">{compraParaFaturar.fornecedor?.nome}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Valor:</span>
                    <span className="font-medium">{formatCurrency(compraParaFaturar.valor_total)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Condição:</span>
                    <span className="font-medium">{compraParaFaturar.condicao_pagamento || 'AVISTA'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Parcelas:</span>
                    <span className="font-medium">{compraParaFaturar.numero_parcelas || 1}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogFaturamentoAberto(false)}>
              Cancelar
            </Button>
            <Button onClick={faturarCompra} disabled={processandoId !== null} className="bg-amber-600">
              {processandoId ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div> : null}
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

            {compraParaReceber && (
              <div className="border rounded-lg p-4 bg-gray-50">
                <p className="font-medium mb-2">Produtos a receber:</p>
                <div className="max-h-40 overflow-y-auto">
                  {compraParaReceber.itens?.map(item => (
                    <div key={item.id} className="flex justify-between text-sm py-1 border-b last:border-0">
                      <span>{item.produto?.nome || 'Produto'}</span>
                      <span className="font-medium">{item.quantidade} {item.produto?.unidade || 'un'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogRecebimentoAberto(false)}>
              Cancelar
            </Button>
            <Button onClick={receberCompra} disabled={processandoId !== null} className="bg-blue-600">
              {processandoId ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div> : null}
              Confirmar Recebimento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Cancelar */}
      <Dialog open={dialogCancelarAberto} onOpenChange={setDialogCancelarAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-600" />
              Confirmar Cancelamento
            </DialogTitle>
            <DialogDescription>
              Esta ação não pode ser desfeita. A compra será cancelada.
            </DialogDescription>
          </DialogHeader>
          
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDialogCancelarAberto(false)}>
              Voltar
            </Button>
            <Button variant="destructive" onClick={cancelarCompra} disabled={processandoId !== null}>
              {processandoId ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div> : null}
              Sim, Cancelar Compra
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}