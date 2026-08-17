// @ts-nocheck - Temporary fix until Supabase types are regenerated
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Warehouse, TrendingDown, TrendingUp, Package, Search, Building2, Plus, Minus, RefreshCw, Layers } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface Filial { id: string; nome: string; codigo: string; }
interface ProdutoEstoque {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  categoria: string | null;
  localizacao: string | null;
  unidade: string | null;
  peso: number | null;
  preco: number;
  estoque: number;
  estoque_minimo: number;
  estoque_filial: number;
}
interface KitItemData {
  produto_id: string;
  quantidade: number;
  produto: { id: string; nome: string; codigo: string } | null;
}
interface KitEstoque {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  preco_total: number;
  itens: KitItemData[];
  estoque_disponivel: number;
}
interface Movimentacao {
  id: string;
  tipo: string;
  quantidade: number;
  data: string;
  observacoes: string | null;
  produto_id: string;
  produtos: { nome: string; descricao: string } | null;
}

const MATRIZ_ID = "__MATRIZ__";

export default function Estoque() {
  const { user } = useAuth();
  const [estoque, setEstoque] = useState<ProdutoEstoque[]>([]);
  const [kits, setKits] = useState<KitEstoque[]>([]);
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([]);
  const [filiais, setFiliais] = useState<Filial[]>([]);
  const [filialSel, setFilialSel] = useState<string>(MATRIZ_ID);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [categorias, setCategorias] = useState<string[]>([]);
  const [expandedKits, setExpandedKits] = useState<Set<string>>(new Set());

  const [dialogAjusteAberto, setDialogAjusteAberto] = useState(false);
  const [itemAjuste, setItemAjuste] = useState<{ id: string; nome: string; estoque_filial: number; unidade: string; isKit: boolean; itens?: KitItemData[] } | null>(null);
  const [tipoAjuste, setTipoAjuste] = useState<"entrada" | "saida">("entrada");
  const [qtdAjuste, setQtdAjuste] = useState(1);
  const [obsAjuste, setObsAjuste] = useState("");
  const [processandoAjuste, setProcessandoAjuste] = useState(false);

  const fetchEstoque = useCallback(async () => {
    try {
      setLoading(true);
      const [{ data: filiaisData, error: filiaisError }, { data: produtosData, error: produtosError }, { data: kitsData, error: kitsError }] = await Promise.all([
        supabase.from("filiais").select("id, nome, codigo").eq("ativo", true).order("nome"),
        supabase.from("produtos").select("id, codigo, nome, descricao, estoque, estoque_minimo, peso, preco, categoria, localizacao, unidade, ativo").eq("ativo", true).order("nome"),
        supabase.from("kits").select("id, codigo, nome, descricao, preco_total, ativo").eq("ativo", true).order("nome"),
      ]);
      if (filiaisError) throw filiaisError;
      if (produtosError) throw produtosError;
      if (kitsError) throw kitsError;
      setFiliais(filiaisData || []);

      // Build estoque filial map
      let estoqueFilialMap: Record<string, number> = {};
      if (filialSel !== MATRIZ_ID) {
        const { data: efData, error: efError } = await supabase.from("estoque_filial").select("produto_id, quantidade").eq("filial_id", filialSel);
        if (efError) throw efError;
        estoqueFilialMap = (efData || []).reduce((acc, row: any) => { acc[row.produto_id] = Number(row.quantidade); return acc; }, {} as Record<string, number>);
      }

      // Map produtos
      const produtosMapeados: ProdutoEstoque[] = (produtosData || []).map((p: any) => ({
        id: p.id, codigo: p.codigo, nome: p.nome, descricao: p.descricao,
        categoria: p.categoria, localizacao: p.localizacao, unidade: p.unidade,
        peso: p.peso, preco: p.preco,
        estoque: p.estoque, estoque_minimo: p.estoque_minimo,
        estoque_filial: filialSel === MATRIZ_ID ? p.estoque : (estoqueFilialMap[p.id] || 0),
      }));
      setEstoque(produtosMapeados);

      const catsUnicas = [...new Set(produtosMapeados.map(p => p.categoria).filter(Boolean) as string[])];
      setCategorias(catsUnicas);

      // Fetch kit items and calculate available stock per kit
      const produtosMap = new Map((produtosData || []).map((p: any) => [p.id, p]));
      const kitsComItens: KitEstoque[] = await Promise.all((kitsData || []).map(async (kit: any) => {
        const { data: itensData, error: itensError } = await supabase
          .from("kit_itens")
          .select("produto_id, quantidade")
          .eq("kit_id", kit.id);
        if (itensError) return { ...kit, itens: [], estoque_disponivel: 0 };

        const itens: KitItemData[] = (itensData || []).filter((item: any) => item.produto_id).map((item: any) => ({
          produto_id: item.produto_id,
          quantidade: item.quantidade,
          produto: produtosMap.has(item.produto_id)
            ? { id: produtosMap.get(item.produto_id).id, nome: produtosMap.get(item.produto_id).nome, codigo: produtosMap.get(item.produto_id).codigo }
            : null,
        }));
        let estoqueDisp = Infinity;
        for (const item of itens) {
          const compEstoque = filialSel === MATRIZ_ID
            ? (produtosMapeados.find(p => p.id === item.produto_id)?.estoque_filial ?? 0)
            : (estoqueFilialMap[item.produto_id] || 0);
          const possiveis = Math.floor(compEstoque / item.quantidade);
          if (possiveis < estoqueDisp) estoqueDisp = possiveis;
        }
        return {
          id: kit.id, codigo: kit.codigo, nome: kit.nome, descricao: kit.descricao,
          preco_total: kit.preco_total, itens,
          estoque_disponivel: estoqueDisp === Infinity ? 0 : estoqueDisp,
        };
      }));
      setKits(kitsComItens);

      const { data: movData, error: movError } = await supabase
        .from("movimentacoes_estoque")
        .select("id, tipo, quantidade, data, observacoes, produto_id, produtos:produto_id(nome, descricao)")
        .order("data", { ascending: false })
        .limit(10);
      if (movError) {
        console.error('Erro ao carregar movimentações:', movError);
      } else {
        setMovimentacoes(movData || []);
      }

    } catch (error: any) {
      toast({ title: "Erro ao carregar estoque", description: error.message, variant: "destructive" });
    } finally { setLoading(false); }
  }, [filialSel]);

  useEffect(() => { fetchEstoque(); }, [fetchEstoque]);

  const estoquesFiltrados = estoque.filter(item => {
    const matchSearch = (item.descricao || item.nome || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
                       item.codigo.toLowerCase().includes(searchTerm.toLowerCase());
    const matchTipo = filtroTipo === "todos" || item.categoria === filtroTipo;
    return matchSearch && matchTipo;
  });

  const kitsFiltrados = kits.filter(kit =>
    kit.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    kit.codigo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalKg = estoquesFiltrados.reduce((acc, item) => acc + (item.peso ? item.estoque_filial * item.peso : 0), 0);
  const valorTotal = estoquesFiltrados.reduce((acc, item) => acc + item.estoque_filial * item.preco, 0);
  const valorKits = kitsFiltrados.reduce((acc, kit) => acc + kit.estoque_disponivel * kit.preco_total, 0);
  const totalItens = estoquesFiltrados.length;
  const totalKits = kitsFiltrados.length;
  const nomeFilialSel = filialSel === MATRIZ_ID ? "Matriz" : (filiais.find(f => f.id === filialSel)?.nome || "Filial");

  const toggleKit = (kitId: string) => {
    setExpandedKits(prev => {
      const newSet = new Set(prev);
      if (newSet.has(kitId)) newSet.delete(kitId);
      else newSet.add(kitId);
      return newSet;
    });
  };

  const handleAbrirAjuste = (item: { id: string; nome: string; estoque_filial: number; unidade: string; isKit: boolean; itens?: KitItemData[] }, tipo: "entrada" | "saida") => {
    setItemAjuste(item);
    setTipoAjuste(tipo);
    setQtdAjuste(1);
    setObsAjuste("");
    setDialogAjusteAberto(true);
  };

  const getEstoqueProduto = async (dbFilialId: string | null, produtoId: string): Promise<number> => {
    if (dbFilialId === null) {
      const { data, error } = await supabase.from("produtos").select("estoque").eq("id", produtoId).maybeSingle();
      if (error) throw error;
      return data?.estoque || 0;
    }
    const { data, error } = await supabase.from("estoque_filial").select("quantidade").eq("filial_id", dbFilialId).eq("produto_id", produtoId).maybeSingle();
    if (error) throw error;
    return data ? Number(data.quantidade) : 0;
  };

  const updateEstoqueProduto = async (dbFilialId: string | null, produtoId: string, novoEstoque: number) => {
    if (dbFilialId === null) {
      const { error } = await supabase.from("produtos").update({ estoque: novoEstoque }).eq("id", produtoId);
      if (error) throw error;
    } else {
      const { data: ex } = await supabase.from("estoque_filial").select("id").eq("filial_id", dbFilialId).eq("produto_id", produtoId).maybeSingle();
      if (ex) {
        const { error } = await supabase.from("estoque_filial").update({ quantidade: novoEstoque, updated_at: new Date().toISOString() }).eq("id", ex.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("estoque_filial").insert({ filial_id: dbFilialId, produto_id: produtoId, quantidade: novoEstoque });
        if (error) throw error;
      }
    }
  };

  const handleConfirmarAjuste = async () => {
    if (!itemAjuste || qtdAjuste <= 0) return;
    try {
      setProcessandoAjuste(true);
      const dbFilialId = filialSel === MATRIZ_ID ? null : filialSel;

      if (itemAjuste.isKit && itemAjuste.itens) {
        // Kit adjustment: adjust all component products
        for (const item of itemAjuste.itens) {
          if (!item.produto_id) continue;
          const compEstoque = await getEstoqueProduto(dbFilialId, item.produto_id);
          const delta = item.quantidade * qtdAjuste;
          const novoComp = tipoAjuste === "entrada" ? compEstoque + delta : compEstoque - delta;
          if (novoComp < 0) { toast({ title: "Estoque insuficiente", description: `Componente ${item.produto?.nome || ""} não tem estoque suficiente`, variant: "destructive" }); return; }
        }
        // All checks passed, now apply
        for (const item of itemAjuste.itens) {
          if (!item.produto_id) continue;
          const compEstoque = await getEstoqueProduto(dbFilialId, item.produto_id);
          const delta = item.quantidade * qtdAjuste;
          const novoComp = tipoAjuste === "entrada" ? compEstoque + delta : compEstoque - delta;
          await updateEstoqueProduto(dbFilialId, item.produto_id, novoComp);
          const { error: movInsertError } = await supabase.from("movimentacoes_estoque").insert({
            produto_id: item.produto_id,
            tipo: tipoAjuste,
            quantidade: delta,
            quantidade_anterior: compEstoque,
            quantidade_atual: novoComp,
            origem: "ajuste_kit",
            observacoes: `${tipoAjuste === "entrada" ? "Entrada" : "Saída"} kit "${itemAjuste.nome}" (${qtdAjuste} kit(s)) - ${nomeFilialSel}`,
            usuario_id: user?.id || null,
            data: new Date().toISOString(),
          });
          if (movInsertError) console.error('Erro ao registrar movimentação do componente do kit:', movInsertError);
        }
        toast({ title: "Estoque do kit ajustado!", description: `${itemAjuste.nome}: ${qtdAjuste} kit(s) - ${tipoAjuste === "entrada" ? "entrada" : "saída"}` });
      } else {
        // Product adjustment
        const estoqueAtual = itemAjuste.estoque_filial;
        const novoEstoque = tipoAjuste === "entrada" ? estoqueAtual + qtdAjuste : estoqueAtual - qtdAjuste;
        if (novoEstoque < 0) { toast({ title: "Estoque insuficiente", variant: "destructive" }); return; }
        await updateEstoqueProduto(dbFilialId, itemAjuste.id, novoEstoque);
        const { error: movInsertError } = await supabase.from("movimentacoes_estoque").insert({
          produto_id: itemAjuste.id,
          tipo: tipoAjuste,
          quantidade: qtdAjuste,
          quantidade_anterior: estoqueAtual,
          quantidade_atual: novoEstoque,
          origem: "ajuste_manual",
          observacoes: obsAjuste || `${tipoAjuste === "entrada" ? "Entrada" : "Saída"} manual - ${nomeFilialSel}`,
          usuario_id: user?.id || null,
          data: new Date().toISOString(),
        });
        if (movInsertError) console.error('Erro ao registrar movimentação:', movInsertError);
        toast({ title: "Estoque ajustado!", description: `${itemAjuste.nome}: ${estoqueAtual} → ${novoEstoque}` });
      }

      setDialogAjusteAberto(false);
      await fetchEstoque();
    } catch (error: any) {
      toast({ title: "Erro ao ajustar estoque", description: error.message, variant: "destructive" });
    } finally { setProcessandoAjuste(false); }
  };

  const locs = [{ id: MATRIZ_ID, nome: "Matriz" }, ...filiais.map(f => ({ id: f.id, nome: f.nome }))];

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="text-center py-8 text-muted-foreground">Carregando estoque...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Controle de Estoque</h2>
          <p className="text-muted-foreground">Gerencie entradas e saídas de produtos e kits por filial</p>
        </div>
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-muted-foreground" />
          <Select value={filialSel} onValueChange={setFilialSel}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {locs.map(l => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={fetchEstoque} title="Atualizar"><RefreshCw className="h-4 w-4" /></Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Filial Selecionada</p>
                <h3 className="text-xl font-bold text-foreground">{nomeFilialSel}</h3>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10"><Building2 className="h-6 w-6 text-primary" /></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total em Alumínio</p>
                <h3 className="text-2xl font-bold text-foreground">{totalKg.toFixed(2)} kg</h3>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10"><Package className="h-6 w-6 text-primary" /></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Valor Produtos + Kits</p>
                <h3 className="text-2xl font-bold text-foreground">R$ {(valorTotal + valorKits).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-success/10"><TrendingUp className="h-6 w-6 text-success" /></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Produtos / Kits</p>
                <h3 className="text-2xl font-bold text-foreground">{totalItens} / {totalKits}</h3>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10"><Warehouse className="h-6 w-6 text-primary" /></div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="produtos">
        <TabsList>
          <TabsTrigger value="produtos" className="flex items-center gap-2"><Package className="h-4 w-4" />Produtos</TabsTrigger>
          <TabsTrigger value="kits" className="flex items-center gap-2"><Layers className="h-4 w-4" />Kits Montados</TabsTrigger>
        </TabsList>

        {/* TAB: PRODUTOS */}
        <TabsContent value="produtos">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Package className="h-5 w-5 text-primary" />Estoque de Produtos - {nomeFilialSel}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input placeholder="Buscar no estoque..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
                </div>
                <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                  <SelectTrigger className="w-[200px]"><SelectValue placeholder="Categoria" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todas</SelectItem>
                    {categorias.map(categoria => <SelectItem key={categoria} value={categoria}>{categoria}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Localização</TableHead>
                      <TableHead className="text-right">Quantidade</TableHead>
                      <TableHead className="text-right">Peso (kg)</TableHead>
                      <TableHead className="text-right">Total (kg)</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {estoquesFiltrados.length === 0 ? (
                      <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Nenhum produto encontrado.</TableCell></TableRow>
                    ) : estoquesFiltrados.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.codigo || '-'}</TableCell>
                        <TableCell>{item.descricao || item.nome || '-'}</TableCell>
                        <TableCell><Badge variant="outline">{item.categoria || 'Outros'}</Badge></TableCell>
                        <TableCell>{item.localizacao || '-'}</TableCell>
                        <TableCell className="text-right font-semibold">{item.estoque_filial} {item.unidade || "un"}</TableCell>
                        <TableCell className="text-right">{item.peso ? item.peso.toFixed(3) : '-'}</TableCell>
                        <TableCell className="text-right font-semibold">{item.peso ? (item.estoque_filial * item.peso).toFixed(2) : '-'}</TableCell>
                        <TableCell>
                          <Badge variant={item.estoque_filial <= item.estoque_minimo ? "destructive" : "default"}>
                            {item.estoque_filial <= item.estoque_minimo ? "Baixo" : "OK"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="outline" className="h-8 w-8 p-0 text-green-600 hover:bg-green-50" onClick={() => handleAbrirAjuste({ id: item.id, nome: item.nome, estoque_filial: item.estoque_filial, unidade: item.unidade || "un", isKit: false }, "entrada")} title="Entrada"><Plus className="h-4 w-4" /></Button>
                            <Button size="sm" variant="outline" className="h-8 w-8 p-0 text-red-600 hover:bg-red-50" onClick={() => handleAbrirAjuste({ id: item.id, nome: item.nome, estoque_filial: item.estoque_filial, unidade: item.unidade || "un", isKit: false }, "saida")} title="Saída"><Minus className="h-4 w-4" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: KITS MONTADOS */}
        <TabsContent value="kits">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Layers className="h-5 w-5 text-primary" />Estoque de Kits Montados - {nomeFilialSel}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input placeholder="Buscar kit..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
                </div>
              </div>
              {kitsFiltrados.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Layers className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  Nenhum kit encontrado.
                </div>
              ) : (
                <div className="space-y-4">
                  {kitsFiltrados.map((kit) => (
                    <Card key={kit.id} className="overflow-hidden border">
                      <Collapsible open={expandedKits.has(kit.id)} onOpenChange={() => toggleKit(kit.id)}>
                        <div className="p-4 bg-white">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 flex-wrap">
                                <h3 className="text-lg font-semibold flex items-center gap-2">
                                  <Layers className="h-4 w-4 text-primary" />
                                  {kit.nome}
                                </h3>
                                <Badge variant={kit.estoque_disponivel === 0 ? "destructive" : "default"}>
                                  {kit.estoque_disponivel === 0 ? "Sem Estoque" : kit.estoque_disponivel < 5 ? "Estoque Baixo" : "Disponível"}
                                </Badge>
                              </div>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
                                <div>
                                  <p className="text-xs text-muted-foreground">Código</p>
                                  <p className="text-sm font-mono">{kit.codigo}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Preço de Venda</p>
                                  <p className="text-sm font-semibold text-primary">R$ {kit.preco_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Kits Disponíveis</p>
                                  <p className="text-sm font-semibold">{kit.estoque_disponivel}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Valor em Estoque</p>
                                  <p className="text-sm font-semibold">R$ {(kit.estoque_disponivel * kit.preco_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                </div>
                              </div>
                              {kit.descricao && <p className="text-sm text-muted-foreground mt-2 italic">{kit.descricao}</p>}
                            </div>
                            <div className="flex items-center gap-2">
                              <Button size="sm" variant="outline" className="text-green-600 hover:bg-green-50" onClick={() => handleAbrirAjuste({ id: kit.id, nome: kit.nome, estoque_filial: kit.estoque_disponivel, unidade: "kit", isKit: true, itens: kit.itens }, "entrada")} title="Entrada"><Plus className="h-4 w-4 mr-1" />Entrada</Button>
                              <Button size="sm" variant="outline" className="text-red-600 hover:bg-red-50" onClick={() => handleAbrirAjuste({ id: kit.id, nome: kit.nome, estoque_filial: kit.estoque_disponivel, unidade: "kit", isKit: true, itens: kit.itens }, "saida")} title="Saída"><Minus className="h-4 w-4 mr-1" />Saída</Button>
                              <CollapsibleTrigger asChild>
                                <Button variant="ghost" size="sm" className="gap-2">
                                  {expandedKits.has(kit.id) ? <>Esconder <ChevronUp className="h-4 w-4" /></> : <>Ver componentes <ChevronDown className="h-4 w-4" /></>}
                                </Button>
                              </CollapsibleTrigger>
                            </div>
                          </div>
                        </div>
                        <CollapsibleContent>
                          <div className="border-t bg-gray-50 p-4">
                            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2"><Package className="h-4 w-4" />Componentes do Kit</h4>
                            {kit.itens && kit.itens.length > 0 ? (
                              <div className="rounded-md border bg-white">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Código</TableHead>
                                      <TableHead>Produto</TableHead>
                                      <TableHead className="text-right">Qtd por Kit</TableHead>
                                      <TableHead className="text-right">Total Necessário</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {kit.itens.map((item, idx) => (
                                      <TableRow key={idx}>
                                        <TableCell className="font-mono text-sm">{item.produto?.codigo || '-'}</TableCell>
                                        <TableCell className="font-medium">{item.produto?.nome || '-'}</TableCell>
                                        <TableCell className="text-right">{item.quantidade}</TableCell>
                                        <TableCell className="text-right font-semibold">{item.quantidade * kit.estoque_disponivel}</TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            ) : (
                              <div className="text-center py-4 bg-white rounded-lg border">
                                <p className="text-muted-foreground">Este kit não possui componentes cadastrados.</p>
                              </div>
                            )}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Warehouse className="h-5 w-5 text-primary" />Movimentações Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          {movimentacoes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Nenhuma movimentação cadastrada.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Quantidade</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movimentacoes.map((movement) => (
                  <TableRow key={movement.id}>
                    <TableCell className="font-medium">{movement.produtos?.nome || movement.produtos?.descricao || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={movement.tipo === "entrada" ? "default" : "secondary"} className="gap-1">
                        {movement.tipo === "entrada" ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {movement.tipo}
                      </Badge>
                    </TableCell>
                    <TableCell className={`text-right font-semibold ${movement.tipo === "entrada" ? "text-success" : "text-destructive"}`}>
                      {movement.tipo === "entrada" ? "+" : "-"}{movement.quantidade}
                    </TableCell>
                    <TableCell>
                      <div>{new Date(movement.data).toLocaleDateString("pt-BR")}</div>
                      {movement.observacoes && <div className="text-xs text-muted-foreground mt-0.5">{movement.observacoes}</div>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogAjusteAberto} onOpenChange={setDialogAjusteAberto}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {tipoAjuste === "entrada" ? <TrendingUp className="h-5 w-5 text-green-600" /> : <TrendingDown className="h-5 w-5 text-red-600" />}
              {tipoAjuste === "entrada" ? "Entrada" : "Saída"} de Estoque
              {itemAjuste?.isKit && <Badge variant="outline" className="ml-1"><Layers className="h-3 w-3 mr-1" />Kit</Badge>}
            </DialogTitle>
            <DialogDescription>
              {itemAjuste?.nome} - {nomeFilialSel}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {itemAjuste?.isKit ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Kits Disponíveis Atual</Label>
                    <div className="px-3 py-2 rounded-md bg-muted font-semibold">{itemAjuste?.estoque_filial} kits</div>
                  </div>
                  <div className="space-y-2">
                    <Label>Novo Estoque de Kits</Label>
                    <div className="px-3 py-2 rounded-md bg-muted font-semibold">
                      {itemAjuste ? (tipoAjuste === "entrada" ? itemAjuste.estoque_filial + qtdAjuste : itemAjuste.estoque_filial - qtdAjuste) : 0} kits
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="qtd_ajuste">Quantidade de Kits</Label>
                  <Input id="qtd_ajuste" type="number" min={1} value={qtdAjuste} onChange={(e) => setQtdAjuste(parseInt(e.target.value) || 0)} />
                </div>
                <div className="border rounded-lg p-3 bg-muted/30">
                  <p className="text-sm font-semibold mb-2">Componentes que serão ajustados:</p>
                  <div className="space-y-1">
                    {itemAjuste?.itens?.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{item.produto?.nome || "-"}</span>
                        <span className="font-medium">{tipoAjuste === "entrada" ? "+" : "-"}{item.quantidade * qtdAjuste} un</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Estoque Atual</Label>
                    <div className="px-3 py-2 rounded-md bg-muted font-semibold">{itemAjuste?.estoque_filial} {itemAjuste?.unidade || "un"}</div>
                  </div>
                  <div className="space-y-2">
                    <Label>Novo Estoque</Label>
                    <div className="px-3 py-2 rounded-md bg-muted font-semibold">
                      {itemAjuste ? (tipoAjuste === "entrada" ? itemAjuste.estoque_filial + qtdAjuste : itemAjuste.estoque_filial - qtdAjuste) : 0} {itemAjuste?.unidade || "un"}
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="qtd_ajuste">Quantidade</Label>
                  <Input id="qtd_ajuste" type="number" min={1} value={qtdAjuste} onChange={(e) => setQtdAjuste(parseInt(e.target.value) || 0)} />
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor="obs_ajuste">Observação</Label>
              <Textarea id="obs_ajuste" value={obsAjuste} onChange={(e) => setObsAjuste(e.target.value)} placeholder="Motivo do ajuste..." rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogAjusteAberto(false)}>Cancelar</Button>
            <Button onClick={handleConfirmarAjuste} disabled={processandoAjuste} className={tipoAjuste === "entrada" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}>
              {processandoAjuste ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div> : null}
              Confirmar {tipoAjuste === "entrada" ? "Entrada" : "Saída"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
