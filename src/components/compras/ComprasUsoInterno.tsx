// @ts-nocheck - tabelas compras_uso_interno* ainda nao estao nos tipos gerados do Supabase
// Compras de itens que NAO sao produtos de venda (vidros para obras,
// ferramentas, material de consumo...). Itens digitados livremente, nao mexem
// no estoque e viram despesa no financeiro.
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Trash2, Save, Loader2, Search, ChevronDown, ChevronRight, XCircle, HardHat } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { CondicaoPagamentoInput } from '@/components/CondicaoPagamentoInput';
import { diasCondicao, descricaoCondicao } from '@/utils/condicaoPagamento';

interface Fornecedor { id: string; nome: string; }
interface ItemForm { descricao: string; quantidade: number; unidade: string; valor_unitario: number; }
interface CompraUsoInterno {
  id: string; numero: string; fornecedor_id: string | null; fornecedor_nome: string | null;
  obra: string | null; data_compra: string; forma_pagamento: string | null; condicao_pagamento: string | null;
  valor_total: number; status: string; observacoes: string | null; created_at: string;
  fornecedor?: { nome: string } | null;
  itens?: { id: string; descricao: string; quantidade: number; unidade: string; valor_unitario: number; subtotal: number }[];
}

const FORMAS = [
  { value: 'pix', label: 'Pix' },
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'boleto', label: 'Boleto' },
  { value: 'transferencia', label: 'Transferência' },
  { value: 'cartao_credito', label: 'Cartão de Crédito' },
  { value: 'cartao_debito', label: 'Cartão de Débito' },
];
const labelForma = (v: string | null) => FORMAS.find((f) => f.value === v)?.label || v || '-';
const UNIDADES = ['un', 'm²', 'm', 'kg', 'cx', 'pç', 'l', 'barra'];
const brl = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v) || 0);
const hojeISO = () => new Date().toISOString().split('T')[0];
const formatDate = (d: string | null) => { if (!d) return '-'; const [a, m, di] = d.split('T')[0].split('-'); return `${di}/${m}/${a}`; };
const itemVazio = (): ItemForm => ({ descricao: '', quantidade: 1, unidade: 'un', valor_unitario: 0 });

export default function ComprasUsoInterno({ fornecedores }: { fornecedores: Fornecedor[] }) {
  const { user } = useAuth();
  const [compras, setCompras] = useState<CompraUsoInterno[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [busca, setBusca] = useState('');
  const [expandida, setExpandida] = useState<string | null>(null);
  const [paraCancelar, setParaCancelar] = useState<CompraUsoInterno | null>(null);

  // formulario
  const [fornecedorId, setFornecedorId] = useState('');
  const [fornecedorNome, setFornecedorNome] = useState('');
  const [obra, setObra] = useState('');
  const [dataCompra, setDataCompra] = useState(hojeISO());
  const [formaPagamento, setFormaPagamento] = useState('pix');
  const [condicao, setCondicao] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [itens, setItens] = useState<ItemForm[]>([itemVazio()]);

  const total = itens.reduce((s, i) => s + (Number(i.quantidade) || 0) * (Number(i.valor_unitario) || 0), 0);
  const dias = diasCondicao(condicao);

  const carregar = async () => {
    setCarregando(true);
    try {
      const { data, error } = await supabase
        .from('compras_uso_interno')
        .select('*, fornecedor:fornecedores(nome), itens:compras_uso_interno_itens(id, descricao, quantidade, unidade, valor_unitario, subtotal)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setCompras(data || []);
    } catch (error: any) {
      toast({ title: 'Erro ao carregar compras de uso interno', description: error.message, variant: 'destructive' });
    } finally { setCarregando(false); }
  };

  useEffect(() => { carregar(); }, []);

  const limparForm = () => {
    setFornecedorId(''); setFornecedorNome(''); setObra(''); setDataCompra(hojeISO());
    setFormaPagamento('pix'); setCondicao(''); setObservacoes(''); setItens([itemVazio()]);
  };

  const alterarItem = (idx: number, patch: Partial<ItemForm>) =>
    setItens((lista) => lista.map((i, k) => (k === idx ? { ...i, ...patch } : i)));

  const salvar = async () => {
    const itensValidos = itens.filter((i) => i.descricao.trim());
    if (itensValidos.length === 0) { toast({ title: 'Informe pelo menos um item', variant: 'destructive' }); return; }
    if (itensValidos.some((i) => !(Number(i.quantidade) > 0))) { toast({ title: 'Quantidades devem ser maiores que zero', variant: 'destructive' }); return; }
    if (!fornecedorId && !fornecedorNome.trim()) { toast({ title: 'Informe o fornecedor', variant: 'destructive' }); return; }
    const valorTotal = Math.round(itensValidos.reduce((s, i) => s + i.quantidade * i.valor_unitario, 0) * 100) / 100;

    setSalvando(true);
    try {
      const { data: compra, error } = await supabase.from('compras_uso_interno').insert({
        fornecedor_id: fornecedorId || null,
        fornecedor_nome: fornecedorId ? null : fornecedorNome.trim(),
        obra: obra.trim() || null,
        data_compra: dataCompra,
        forma_pagamento: formaPagamento,
        condicao_pagamento: condicao || null,
        valor_total: valorTotal,
        observacoes: observacoes.trim() || null,
        created_by: user?.id,
      }).select('id, numero').single();
      if (error) throw error;

      const { error: itensError } = await supabase.from('compras_uso_interno_itens').insert(
        itensValidos.map((i) => ({
          compra_id: compra.id,
          descricao: i.descricao.trim(),
          quantidade: i.quantidade,
          unidade: i.unidade || 'un',
          valor_unitario: i.valor_unitario,
          subtotal: Math.round(i.quantidade * i.valor_unitario * 100) / 100,
        }))
      );
      if (itensError) throw itensError;

      // Despesa no financeiro: 1 lancamento por dia da condicao (sem condicao = a vista na data da compra)
      if (valorTotal > 0) {
        const nomeFornecedor = fornecedorId ? fornecedores.find((f) => f.id === fornecedorId)?.nome : fornecedorNome.trim();
        const vencimentos = dias.length ? dias : [0];
        const valorParcela = Math.round((valorTotal / vencimentos.length) * 100) / 100;
        const parcelas = vencimentos.map((d, i) => {
          const venc = new Date(`${dataCompra}T12:00:00`);
          venc.setDate(venc.getDate() + d);
          const valor = i === vencimentos.length - 1
            ? Math.round((valorTotal - valorParcela * (vencimentos.length - 1)) * 100) / 100
            : valorParcela;
          return {
            descricao: `Compra uso interno ${compra.numero} - ${nomeFornecedor || 'Fornecedor'}${obra.trim() ? ` - ${obra.trim()}` : ''}${vencimentos.length > 1 ? ` (${i + 1}/${vencimentos.length})` : ''}`,
            tipo: 'despesa',
            categoria: 'Compras - Uso interno',
            valor,
            data: dataCompra,
            data_vencimento: venc.toISOString().split('T')[0],
            forma_pagamento: formaPagamento,
            status: 'pendente',
            origem_tipo: 'compra_uso_interno',
            origem_id: compra.id,
            parcela_numero: i + 1,
            total_parcelas: vencimentos.length,
            numero_parcela: `${i + 1}/${vencimentos.length}`,
            created_by: user?.id,
          };
        });
        const { error: finError } = await supabase.from('transacoes_financeiras').insert(parcelas);
        if (finError) throw finError;
      }

      toast({ title: `Compra ${compra.numero} registrada!`, description: `${itensValidos.length} item(ns) - ${brl(valorTotal)} lançado como despesa no financeiro.` });
      limparForm();
      await carregar();
    } catch (error: any) {
      toast({ title: 'Erro ao registrar compra', description: error.message, variant: 'destructive' });
    } finally { setSalvando(false); }
  };

  const cancelar = async () => {
    const c = paraCancelar;
    if (!c) return;
    try {
      const { error } = await supabase.from('compras_uso_interno').update({ status: 'cancelada' }).eq('id', c.id);
      if (error) throw error;
      // so cancela parcelas ainda pendentes; as ja pagas ficam como estao
      await supabase.from('transacoes_financeiras').update({ status: 'cancelado' })
        .eq('origem_tipo', 'compra_uso_interno').eq('origem_id', c.id).eq('status', 'pendente');
      toast({ title: `Compra ${c.numero} cancelada`, description: 'As parcelas pendentes no financeiro foram canceladas.' });
      setParaCancelar(null);
      await carregar();
    } catch (error: any) {
      toast({ title: 'Erro ao cancelar', description: error.message, variant: 'destructive' });
    }
  };

  const termo = busca.toLowerCase().trim();
  const filtradas = compras.filter((c) => !termo ||
    c.numero.toLowerCase().includes(termo) ||
    (c.obra || '').toLowerCase().includes(termo) ||
    (c.fornecedor?.nome || c.fornecedor_nome || '').toLowerCase().includes(termo) ||
    (c.itens || []).some((i) => i.descricao.toLowerCase().includes(termo)));
  const totalRegistrado = filtradas.filter((c) => c.status !== 'cancelada').reduce((s, c) => s + Number(c.valor_total || 0), 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><HardHat className="h-5 w-5 text-primary" />Nova compra de uso interno / obra</CardTitle>
          <CardDescription>Itens que não são vendidos (ex.: vidros para obras, ferramentas, material de consumo). Não entram no estoque e viram despesa no financeiro.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Fornecedor *</Label>
              <Select value={fornecedorId || '__outro__'} onValueChange={(v) => setFornecedorId(v === '__outro__' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  <SelectItem value="__outro__">Outro (digitar nome)</SelectItem>
                  {fornecedores.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                </SelectContent>
              </Select>
              {!fornecedorId && <Input placeholder="Nome do fornecedor" value={fornecedorNome} onChange={(e) => setFornecedorNome(e.target.value)} />}
            </div>
            <div className="space-y-2">
              <Label>Obra / destino</Label>
              <Input placeholder="Ex.: Obra Rua X, uso na fábrica..." value={obra} onChange={(e) => setObra(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Data da compra</Label>
              <Input type="date" value={dataCompra} onChange={(e) => setDataCompra(e.target.value)} />
            </div>
          </div>

          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead className="min-w-[240px]">Descrição do item *</TableHead>
                <TableHead className="w-24">Qtd</TableHead>
                <TableHead className="w-28">Unidade</TableHead>
                <TableHead className="w-36">Valor unit. (R$)</TableHead>
                <TableHead className="w-32 text-right">Subtotal</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {itens.map((i, idx) => (
                  <TableRow key={idx}>
                    <TableCell><Input placeholder="Ex.: Vidro temperado 8mm incolor" value={i.descricao} onChange={(e) => alterarItem(idx, { descricao: e.target.value })} /></TableCell>
                    <TableCell><Input type="number" min={0} step="any" value={i.quantidade} onChange={(e) => alterarItem(idx, { quantidade: parseFloat(e.target.value) || 0 })} /></TableCell>
                    <TableCell>
                      <Select value={i.unidade} onValueChange={(v) => alterarItem(idx, { unidade: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{UNIDADES.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell><Input type="number" min={0} step="0.01" value={i.valor_unitario} onChange={(e) => alterarItem(idx, { valor_unitario: parseFloat(e.target.value) || 0 })} /></TableCell>
                    <TableCell className="text-right font-medium">{brl((Number(i.quantidade) || 0) * (Number(i.valor_unitario) || 0))}</TableCell>
                    <TableCell>
                      <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-600" disabled={itens.length === 1}
                        onClick={() => setItens((lista) => lista.filter((_, k) => k !== idx))} title="Remover item"><Trash2 className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setItens((lista) => [...lista, itemVazio()])}><Plus className="h-4 w-4 mr-1" />Adicionar item</Button>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Forma de pagamento</Label>
              <Select value={formaPagamento} onValueChange={setFormaPagamento}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{FORMAS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Condição (dias)</Label>
              <CondicaoPagamentoInput value={condicao} onChange={setCondicao} placeholder="Vazio = à vista. Ex.: 30 60" />
            </div>
            <div className="space-y-2">
              <Label>Total</Label>
              <div className="h-10 flex items-center text-lg font-bold text-primary">{brl(total)}</div>
              {dias.length > 1 && <p className="text-xs text-muted-foreground">{dias.length}x de {brl(total / dias.length)}</p>}
            </div>
          </div>
          <div className="space-y-2"><Label>Observações</Label><Textarea rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Opcional" /></div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={limparForm} disabled={salvando}>Limpar</Button>
            <Button onClick={salvar} disabled={salvando}>
              {salvando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}Registrar compra
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Compras de uso interno registradas</CardTitle>
          <CardDescription>Total (sem canceladas): <span className="font-semibold text-foreground">{brl(totalRegistrado)}</span></CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por número, obra, fornecedor ou item..." value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-10" />
          </div>
          {carregando ? (
            <div className="py-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div>
          ) : filtradas.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhuma compra de uso interno registrada.</p>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Número</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>Obra / destino</TableHead>
                  <TableHead>Pagamento</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {filtradas.map((c) => (
                    <React.Fragment key={c.id}>
                      <TableRow className={c.status === 'cancelada' ? 'opacity-60' : ''}>
                        <TableCell>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setExpandida(expandida === c.id ? null : c.id)} title="Ver itens">
                            {expandida === c.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </Button>
                        </TableCell>
                        <TableCell className="font-mono font-medium">{c.numero}</TableCell>
                        <TableCell>{formatDate(c.data_compra)}</TableCell>
                        <TableCell>{c.fornecedor?.nome || c.fornecedor_nome || '-'}</TableCell>
                        <TableCell>{c.obra || '-'}</TableCell>
                        <TableCell className="text-sm">{labelForma(c.forma_pagamento)}{c.condicao_pagamento ? ` - ${c.condicao_pagamento}` : ''}</TableCell>
                        <TableCell className="text-right font-semibold">{brl(c.valor_total)}</TableCell>
                        <TableCell>
                          {c.status === 'cancelada'
                            ? <Badge variant="outline" className="bg-red-100 text-red-800 border-red-200">Cancelada</Badge>
                            : <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">Registrada</Badge>}
                        </TableCell>
                        <TableCell className="text-right">
                          {c.status !== 'cancelada' && (
                            <Button variant="outline" size="sm" className="h-8 w-8 p-0 border-red-500 text-red-600 hover:bg-red-50" onClick={() => setParaCancelar(c)} title="Cancelar compra">
                              <XCircle className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                      {expandida === c.id && (
                        <TableRow>
                          <TableCell colSpan={9} className="bg-muted/30">
                            <div className="space-y-1 text-sm">
                              {(c.itens || []).map((i) => (
                                <div key={i.id} className="flex justify-between gap-4">
                                  <span>{Number(i.quantidade)} {i.unidade} — {i.descricao}</span>
                                  <span className="text-muted-foreground">{brl(i.valor_unitario)} = <span className="font-medium text-foreground">{brl(i.subtotal)}</span></span>
                                </div>
                              ))}
                              {c.condicao_pagamento && <p className="text-xs text-muted-foreground pt-1">Condição: {descricaoCondicao(c.condicao_pagamento)}</p>}
                              {c.observacoes && <p className="text-xs text-muted-foreground">Obs.: {c.observacoes}</p>}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!paraCancelar} onOpenChange={(open) => { if (!open) setParaCancelar(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar compra {paraCancelar?.numero}?</AlertDialogTitle>
            <AlertDialogDescription>A compra fica marcada como cancelada e as parcelas ainda pendentes no financeiro são canceladas. Parcelas já pagas não são alteradas.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={cancelar} className="bg-red-600 hover:bg-red-700 text-white">Sim, cancelar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
