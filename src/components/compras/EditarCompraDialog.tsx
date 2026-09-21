// Edição de um pedido de compra já salvo. Só faz sentido enquanto a compra
// ainda não foi faturada nem recebida: depois disso, o financeiro já tem
// parcelas geradas e/ou o estoque já foi incrementado com base nos itens
// atuais, então mudar fornecedor/itens/valores retroativamente deixaria
// esses registros inconsistentes com o pedido.
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, Save, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { CondicaoPagamentoInput } from '@/components/CondicaoPagamentoInput';
import { diasCondicao, normalizarCondicao } from '@/utils/condicaoPagamento';

interface Fornecedor {
  id: string;
  nome: string;
}

interface Produto {
  id: string;
  nome: string;
  codigo: string;
  unidade: string;
  custo: number;
}

interface ItemEdicao {
  id: string;
  produto_id: string;
  quantidade: number;
  valor_unitario: number;
}

export interface CompraParaEditar {
  id: string;
  numero: string;
  fornecedor_id: string;
  data_emissao: string;
  data_entrega_prevista?: string | null;
  forma_pagamento?: string | null;
  condicao_pagamento?: string | null;
  observacoes?: string | null;
  itens?: Array<{ id: string; produto_id: string; quantidade: number; valor_unitario: number }>;
}

interface EditarCompraDialogProps {
  compra: CompraParaEditar | null;
  fornecedores: Fornecedor[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const formasPagamento = [
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'cartao_credito', label: 'Cartão de Crédito' },
  { value: 'cartao_debito', label: 'Cartão de Débito' },
  { value: 'pix', label: 'PIX' },
  { value: 'boleto', label: 'Boleto' },
  { value: 'transferencia', label: 'Transferência Bancária' },
];

export default function EditarCompraDialog({ compra, fornecedores, open, onOpenChange, onSuccess }: EditarCompraDialogProps) {
  const [fornecedorId, setFornecedorId] = useState('');
  const [dataEmissao, setDataEmissao] = useState('');
  const [dataEntregaPrevista, setDataEntregaPrevista] = useState('');
  const [formaPagamento, setFormaPagamento] = useState('dinheiro');
  const [condicaoPagamento, setCondicaoPagamento] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [itens, setItens] = useState<ItemEdicao[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingProdutos, setLoadingProdutos] = useState(false);

  useEffect(() => {
    if (open && compra) {
      setFornecedorId(compra.fornecedor_id);
      setDataEmissao(compra.data_emissao?.split('T')[0] || '');
      setDataEntregaPrevista(compra.data_entrega_prevista?.split('T')[0] || '');
      setFormaPagamento(compra.forma_pagamento || 'dinheiro');
      setCondicaoPagamento(compra.condicao_pagamento || '');
      setObservacoes(compra.observacoes || '');
      setItens((compra.itens || []).map((i) => ({
        id: i.id,
        produto_id: i.produto_id,
        quantidade: i.quantidade,
        valor_unitario: i.valor_unitario,
      })));
      carregarProdutos();
    }
  }, [open, compra]);

  const carregarProdutos = async () => {
    try {
      setLoadingProdutos(true);
      const { data, error } = await supabase
        .from('produtos')
        .select('id, nome, codigo, unidade, custo')
        .eq('ativo', true)
        .order('nome');

      if (error) throw error;
      setProdutos(data || []);
    } catch (error: any) {
      toast({ title: "Erro ao carregar produtos", description: error.message, variant: "destructive" });
    } finally {
      setLoadingProdutos(false);
    }
  };

  const adicionarItem = () => {
    setItens([...itens, { id: `novo-${Date.now()}`, produto_id: '', quantidade: 1, valor_unitario: 0 }]);
  };

  const removerItem = (id: string) => {
    if (itens.length > 1) setItens(itens.filter((i) => i.id !== id));
  };

  const atualizarItem = (id: string, campo: keyof ItemEdicao, valor: any) => {
    setItens(itens.map((item) => {
      if (item.id !== id) return item;
      const atualizado = { ...item, [campo]: valor };
      if (campo === 'produto_id') {
        const produto = produtos.find((p) => p.id === valor);
        if (produto) atualizado.valor_unitario = produto.custo || item.valor_unitario;
      }
      return atualizado;
    }));
  };

  const calcularTotal = () => itens.reduce((acc, i) => acc + (i.quantidade || 0) * (i.valor_unitario || 0), 0);

  const salvar = async () => {
    if (!compra) return;

    if (!fornecedorId) {
      toast({ title: "Fornecedor obrigatório", variant: "destructive" });
      return;
    }
    if (!dataEmissao) {
      toast({ title: "Data de emissão obrigatória", variant: "destructive" });
      return;
    }
    for (const item of itens) {
      if (!item.produto_id || item.quantidade <= 0) {
        toast({
          title: "Revise os itens",
          description: "Todo item precisa de produto e quantidade maior que zero",
          variant: "destructive",
        });
        return;
      }
    }

    try {
      setLoading(true);
      const valorTotal = calcularTotal();
      const dias = diasCondicao(condicaoPagamento);

      const { error: compraError } = await supabase
        .from('compras')
        .update({
          fornecedor_id: fornecedorId,
          data_emissao: dataEmissao,
          data_entrega_prevista: dataEntregaPrevista || null,
          forma_pagamento: formaPagamento,
          condicao_pagamento: normalizarCondicao(condicaoPagamento) || null,
          parcelado: dias.length > 1,
          numero_parcelas: Math.max(dias.length, 1),
          valor_total: valorTotal,
          observacoes: observacoes || null,
        })
        .eq('id', compra.id);

      if (compraError) throw compraError;

      const { error: deleteError } = await supabase
        .from('compra_itens')
        .delete()
        .eq('compra_id', compra.id);

      if (deleteError) throw deleteError;

      const { error: itensError } = await supabase
        .from('compra_itens')
        .insert(itens.map((item) => ({
          compra_id: compra.id,
          produto_id: item.produto_id,
          quantidade: item.quantidade,
          valor_unitario: item.valor_unitario,
          subtotal: item.quantidade * item.valor_unitario,
        })));

      if (itensError) throw itensError;

      toast({
        title: "✅ Compra atualizada!",
        description: `Compra ${compra.numero} atualizada com sucesso.`,
      });

      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast({ title: "Erro ao atualizar compra", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Compra {compra?.numero}</DialogTitle>
          <DialogDescription>
            Fornecedor, itens e valores só podem ser alterados enquanto o pedido ainda não foi faturado nem recebido.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Fornecedor <span className="text-red-500">*</span></Label>
              <Select value={fornecedorId} onValueChange={setFornecedorId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {fornecedores.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Data de Emissão <span className="text-red-500">*</span></Label>
              <Input type="date" value={dataEmissao} onChange={(e) => setDataEmissao(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Entrega Prevista</Label>
              <Input type="date" value={dataEntregaPrevista} onChange={(e) => setDataEntregaPrevista(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Forma de Pagamento</Label>
              <Select value={formaPagamento} onValueChange={setFormaPagamento}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {formasPagamento.map((f) => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Condição de Pagamento</Label>
              <CondicaoPagamentoInput
                value={condicaoPagamento}
                onChange={setCondicaoPagamento}
                placeholder="Ex: 28 56 (vazio = à vista)"
              />
            </div>
          </div>

          <div className="border rounded-lg">
            <div className="p-3 border-b bg-gray-50 flex justify-between items-center">
              <p className="font-semibold">Itens</p>
              <Button size="sm" type="button" onClick={adicionarItem}>
                <Plus className="h-4 w-4 mr-1" />
                Adicionar
              </Button>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead>Qtd</TableHead>
                    <TableHead>Valor Unit.</TableHead>
                    <TableHead>Subtotal</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingProdutos ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-6">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto text-blue-600" />
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
                              {produtos.map((p) => (
                                <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0.01"
                            step="0.01"
                            className="w-20"
                            value={item.quantidade}
                            onChange={(e) => atualizarItem(item.id, 'quantidade', parseFloat(e.target.value) || 0)}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            className="w-28"
                            value={item.valor_unitario}
                            onChange={(e) => atualizarItem(item.id, 'valor_unitario', parseFloat(e.target.value) || 0)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(item.quantidade * item.valor_unitario)}
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

          <div className="space-y-2">
            <Label>Observações</Label>
            <Input value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
          </div>

          <div className="text-right text-xl font-bold text-blue-700">
            Total: {formatCurrency(calcularTotal())}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={loading || loadingProdutos}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
