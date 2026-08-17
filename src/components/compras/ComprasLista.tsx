// src/components/compras/ComprasLista.tsx
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MoreHorizontal, Eye, CheckCircle, XCircle, Receipt, Package, Truck, Clock, ChevronDown, ChevronUp, ShoppingBag, DollarSign } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface CompraItem {
  id: string;
  produto_id: string;
  nome: string;
  quantidade: number;
  unidade: string;
  valor_unitario: number;
  valor_total: number;
}

interface Fornecedor {
  id: string;
  nome: string;
  cnpj?: string;
  email?: string;
  telefone?: string;
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
  status: string;
  compra_faturada?: boolean;
  mercadoria_recebida?: boolean;
  condicao_pagamento?: string;
  numero_parcelas?: number;
  observacoes?: string;
  itens: CompraItem[];
  created_at: string;
}

interface ComprasListaProps {
  compras: Compra[];
  onCompraUpdated: () => void;
  
  // ✅ NOVAS PROPS
  onFaturarClick: (compra: Compra) => void;
  onReceberClick: (compra: Compra) => void;
  onCancelarClick: (compraId: string) => void;
  processandoId: string | null;
}

export default function ComprasLista({ 
  compras: comprasIniciais, 
  onCompraUpdated,
  onFaturarClick,
  onReceberClick,
  onCancelarClick,
  processandoId
}: ComprasListaProps) {
  const [compras, setCompras] = useState<Compra[]>(comprasIniciais);
  const [linhasExpandidas, setLinhasExpandidas] = useState<string[]>([]);
  
  // Estados para diálogo de itens (APENAS isso é local)
  const [dialogItensAberto, setDialogItensAberto] = useState(false);
  const [compraSelecionada, setCompraSelecionada] = useState<Compra | null>(null);

  // ✅ REMOVIDAS as funções handleFaturarCompra, handleReceberCompra e handleCancelarCompra
  // ✅ Elas agora vêm do pai via props

  const toggleExpandirLinha = (compraId: string) => {
    setLinhasExpandidas(prev => 
      prev.includes(compraId) 
        ? prev.filter(id => id !== compraId)
        : [...prev, compraId]
    );
  };

  const getStatusInfo = (compra: Compra) => {
    if (compra.status === 'cancelada') {
      return {
        label: 'Cancelada',
        className: 'bg-red-100 text-red-800 border-red-200',
        icon: XCircle
      };
    }
    
    if (compra.status === 'recebida') {
      if (compra.compra_faturada && compra.mercadoria_recebida) {
        return {
          label: '✅ Finalizada',
          className: 'bg-green-100 text-green-800 border-green-200',
          icon: CheckCircle
        };
      }
      if (compra.compra_faturada) {
        return {
          label: '🧾 Faturada + Despesa',
          className: 'bg-amber-100 text-amber-800 border-amber-200',
          icon: Receipt
        };
      }
      if (compra.mercadoria_recebida) {
        return {
          label: '📦 Recebida',
          className: 'bg-blue-100 text-blue-800 border-blue-200',
          icon: Package
        };
      }
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
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Lista de Compras</span>
            <Badge variant="outline" className="bg-blue-50 text-blue-700">
              {compras.length} compra(s)
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Legenda de Status */}
          <div className="flex flex-wrap gap-4 mb-4 text-sm">
            <div className="flex items-center gap-1">
              <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">⏳ Pendente</Badge>
              <span className="text-gray-500">- Aguardando NF</span>
            </div>
            <div className="flex items-center gap-1">
              <Badge className="bg-amber-100 text-amber-800 border-amber-200">🧾 Faturada</Badge>
              <span className="text-gray-500">- NF emitida + Despesa</span>
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

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead className="font-bold">Número</TableHead>
                  <TableHead className="font-bold">Fornecedor</TableHead>
                  <TableHead className="font-bold">Emissão</TableHead>
                  <TableHead className="font-bold">Entrega</TableHead>
                  <TableHead className="font-bold">Valor Total</TableHead>
                  <TableHead className="font-bold">Itens</TableHead>
                  <TableHead className="font-bold">Status</TableHead>
                  <TableHead className="font-bold w-[400px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {compras.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                      Nenhuma compra encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  compras.map((compra) => {
                    const statusInfo = getStatusInfo(compra);
                    const StatusIcon = statusInfo.icon;
                    const expandida = linhasExpandidas.includes(compra.id);
                    const totalItens = compra.itens?.length || 0;
                    const quantidadeTotal = calcularTotalItens(compra.itens || []);
                    
                    return (
                      <React.Fragment key={compra.id}>
                        {/* Linha principal */}
                        <TableRow className="hover:bg-gray-50">
                          <TableCell>
                            {compra.itens && compra.itens.length > 0 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => toggleExpandirLinha(compra.id)}
                              >
                                {expandida ? (
                                  <ChevronUp className="h-4 w-4" />
                                ) : (
                                  <ChevronDown className="h-4 w-4" />
                                )}
                              </Button>
                            )}
                          </TableCell>
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
                          <TableCell>
                            <div className="flex flex-wrap items-center gap-2">
                              {/* Botão Ver Itens */}
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-purple-300 text-purple-700 hover:bg-purple-50"
                                onClick={() => {
                                  setCompraSelecionada(compra);
                                  setDialogItensAberto(true);
                                }}
                              >
                                <ShoppingBag className="h-4 w-4 mr-1" />
                                Itens
                              </Button>

                              {/* ✅ BOTÃO FATURAR - USA A PROP DO PAI */}
                              {!compra.compra_faturada && compra.status !== 'cancelada' && (
                                <Button
                                  size="sm"
                                  className="bg-amber-600 hover:bg-amber-700 text-white"
                                  onClick={() => onFaturarClick(compra)}
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

                              {/* ✅ BOTÃO RECEBER - USA A PROP DO PAI */}
                              {!compra.mercadoria_recebida && compra.status !== 'cancelada' && (
                                <Button
                                  size="sm"
                                  className="bg-blue-600 hover:bg-blue-700 text-white"
                                  onClick={() => onReceberClick(compra)}
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

                              {/* Menu Ações */}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button size="sm" variant="outline" disabled={processandoId === compra.id}>
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuLabel>Ações</DropdownMenuLabel>
                                  <DropdownMenuSeparator />
                                  
                                  <DropdownMenuItem onClick={() => {
                                    setCompraSelecionada(compra);
                                    setDialogItensAberto(true);
                                  }}>
                                    <ShoppingBag className="mr-2 h-4 w-4" />
                                    Ver Itens
                                  </DropdownMenuItem>
                                  
                                  {/* ✅ BOTÃO CANCELAR - USA A PROP DO PAI */}
                                  {compra.status !== 'cancelada' && !(compra.compra_faturada && compra.mercadoria_recebida) && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem 
                                        className="text-red-600"
                                        onClick={() => onCancelarClick(compra.id)}
                                      >
                                        <XCircle className="mr-2 h-4 w-4" />
                                        Cancelar Compra
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>

                        {/* Linha expandida com itens */}
                        {expandida && compra.itens && compra.itens.length > 0 && (
                          <TableRow className="bg-gray-50">
                            <TableCell colSpan={9} className="p-0">
                              <Collapsible open={expandida}>
                                <CollapsibleContent className="p-4">
                                  <div className="border rounded-md bg-white">
                                    <div className="bg-gray-100 px-4 py-2 rounded-t-md flex justify-between items-center">
                                      <h4 className="font-medium text-sm flex items-center gap-2">
                                        <ShoppingBag className="h-4 w-4 text-purple-600" />
                                        Itens da Compra {compra.numero}
                                      </h4>
                                      <Badge variant="outline" className="bg-purple-50">
                                        Total: {formatCurrency(compra.valor_total)}
                                      </Badge>
                                    </div>
                                    
                                    <div className="p-4">
                                      <Table>
                                        <TableHeader>
                                          <TableRow>
                                            <TableHead className="font-bold">Produto</TableHead>
                                            <TableHead className="font-bold text-right">Quantidade</TableHead>
                                            <TableHead className="font-bold">Unidade</TableHead>
                                            <TableHead className="font-bold text-right">Valor Unit.</TableHead>
                                            <TableHead className="font-bold text-right">Valor Total</TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {compra.itens.map((item) => (
                                            <TableRow key={item.id} className="hover:bg-gray-50">
                                              <TableCell className="font-medium">{item.nome}</TableCell>
                                              <TableCell className="text-right">{item.quantidade.toFixed(2)}</TableCell>
                                              <TableCell>{item.unidade}</TableCell>
                                              <TableCell className="text-right">
                                                {formatCurrency(item.valor_unitario)}
                                              </TableCell>
                                              <TableCell className="text-right font-medium text-blue-700">
                                                {formatCurrency(item.valor_total)}
                                              </TableCell>
                                            </TableRow>
                                          ))}
                                        </TableBody>
                                      </Table>
                                      
                                      {compra.observacoes && (
                                        <div className="mt-4 p-3 bg-gray-50 rounded-md">
                                          <p className="text-xs text-gray-600">
                                            <span className="font-medium">Observações:</span> {compra.observacoes}
                                          </p>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </CollapsibleContent>
                              </Collapsible>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Dialog de Itens (único diálogo local) */}
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
                  <TableRow>
                    <TableHead className="font-bold">Produto</TableHead>
                    <TableHead className="font-bold text-right">Quantidade</TableHead>
                    <TableHead className="font-bold">Unidade</TableHead>
                    <TableHead className="font-bold text-right">Valor Unit.</TableHead>
                    <TableHead className="font-bold text-right">Valor Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {compraSelecionada?.itens?.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.nome}</TableCell>
                      <TableCell className="text-right">{item.quantidade.toFixed(2)}</TableCell>
                      <TableCell>{item.unidade}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.valor_unitario)}</TableCell>
                      <TableCell className="text-right font-medium text-blue-700">
                        {formatCurrency(item.valor_total)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-between items-center p-4 bg-gray-50 rounded-md">
              <span className="font-medium text-gray-700">Resumo:</span>
              <div className="space-x-4">
                <span className="text-sm text-gray-600">
                  Total de Itens: <strong>{compraSelecionada?.itens?.length || 0}</strong>
                </span>
                <span className="text-sm text-gray-600">
                  Quantidade Total: <strong>{compraSelecionada ? calcularTotalItens(compraSelecionada.itens).toFixed(2) : 0}</strong>
                </span>
                <span className="text-lg font-bold text-blue-700">
                  {formatCurrency(compraSelecionada?.valor_total || 0)}
                </span>
              </div>
            </div>

            {compraSelecionada?.observacoes && (
              <div className="p-3 bg-gray-50 rounded-md">
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
    </>
  );
}