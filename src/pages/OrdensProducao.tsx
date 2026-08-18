// @ts-nocheck
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { PaintBucket, Plus, Search, RefreshCw, Package, ArrowLeftRight, CircleCheck as CheckCircle, Circle as XCircle, Clock, DollarSign, Eye, History, TrendingDown, TrendingUp, ArrowRight, Filter, List, Grid } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface Produto {
  id: string; codigo: string; nome: string; descricao: string;
  estoque: number; unidade: string; custo: number | null; preco: number; cor: string | null;
}
interface OrdemProducao {
  id: string; numero: string; produto_id: string; produto_destino_id: string | null;
  quantidade: number; data_saida: string; data_retorno: string | null;
  custo_pintura: number; status: string; observacoes: string | null; created_at: string;
  produto?: Produto; produto_destino?: Produto;
}
interface HistoricoItem {
  id: string; status_anterior: string | null; status_novo: string;
  observacoes: string | null; created_at: string;
}

const formatCurrency = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
const formatDate = (d: string | null) => { if (!d) return "-"; const [a, m, di] = d.split("T")[0].split("-"); return `${di}/${m}/${a}`; };

const getStatusInfo = (s: string) => {
  switch (s) {
    case "em_pintura": return { label: "Em Pintura", className: "bg-amber-100 text-amber-800 border-amber-200", icon: Clock };
    case "retornado": return { label: "Retornado", className: "bg-green-100 text-green-800 border-green-200", icon: CheckCircle };
    case "cancelada": return { label: "Cancelada", className: "bg-red-100 text-red-800 border-red-200", icon: XCircle };
    default: return { label: s, className: "bg-gray-100 text-gray-800 border-gray-200", icon: Package };
  }
};

export default function OrdensProducao() {
  const { user } = useAuth();
  const [ordens, setOrdens] = useState<OrdemProducao[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroProduto, setFiltroProduto] = useState("todos");
  const [processandoId, setProcessandoId] = useState<string | null>(null);

  // Estados para busca de produtos
  const [buscaProduto, setBuscaProduto] = useState("");
  const [produtosFiltrados, setProdutosFiltrados] = useState<Produto[]>([]);

  const [dialogNovaOpAberto, setDialogNovaOpAberto] = useState(false);
  const [produtoSelecionado, setProdutoSelecionado] = useState("");
  const [produtoDestinoSelecionado, setProdutoDestinoSelecionado] = useState("");
  const [quantidade, setQuantidade] = useState(1);
  const [custoPintura, setCustoPintura] = useState(0);
  const [dataSaida, setDataSaida] = useState(new Date().toISOString().split("T")[0]);
  const [observacoes, setObservacoes] = useState("");

  const [dialogRetornoAberto, setDialogRetornoAberto] = useState(false);
  const [opParaRetornar, setOpParaRetornar] = useState<OrdemProducao | null>(null);
  const [dataRetorno, setDataRetorno] = useState(new Date().toISOString().split("T")[0]);

  const [dialogCancelarAberto, setDialogCancelarAberto] = useState(false);
  const [opParaCancelar, setOpParaCancelar] = useState<OrdemProducao | null>(null);

  const [dialogHistoricoAberto, setDialogHistoricoAberto] = useState(false);
  const [opHistorico, setOpHistorico] = useState<OrdemProducao | null>(null);
  const [historico, setHistorico] = useState<HistoricoItem[]>([]);

  const [dialogDetalhesAberto, setDialogDetalhesAberto] = useState(false);
  const [opDetalhes, setOpDetalhes] = useState<OrdemProducao | null>(null);

  const carregarDados = useCallback(async () => {
    try {
      setLoading(true);
      const { data: produtosData, error: produtosError } = await supabase
        .from("produtos").select("id, codigo, nome, descricao, estoque, unidade, custo, preco, cor")
        .eq("ativo", true).order("nome");
      if (produtosError) throw produtosError;
      setProdutos(produtosData || []);
      setProdutosFiltrados(produtosData || []);

      const { data: ordensData, error: ordensError } = await supabase
        .from("ordens_producao").select(`*, produto:produtos!ordens_producao_produto_id_fkey(id, codigo, nome, descricao, estoque, unidade, custo, preco, cor), produto_destino:produtos!ordens_producao_produto_destino_id_fkey(id, codigo, nome, descricao, estoque, unidade, custo, preco, cor)`)
        .order("created_at", { ascending: false });
      if (ordensError) throw ordensError;
      setOrdens(ordensData || []);
    } catch (error: any) {
      toast({ title: "Erro ao carregar dados", description: error.message, variant: "destructive" });
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { carregarDados(); }, [carregarDados]);

  // Filtrar produtos para exibição
  useEffect(() => {
    if (!buscaProduto.trim()) {
      setProdutosFiltrados(produtos);
    } else {
      const term = buscaProduto.toLowerCase().trim();
      const filtered = produtos.filter(p => 
        p.nome.toLowerCase().includes(term) ||
        p.codigo.toLowerCase().includes(term) ||
        (p.descricao && p.descricao.toLowerCase().includes(term)) ||
        (p.cor && p.cor.toLowerCase().includes(term))
      );
      setProdutosFiltrados(filtered);
    }
  }, [buscaProduto, produtos]);

  // Função melhorada de filtragem das ordens
  const ordensFiltradas = ordens.filter((op) => {
    const matchSearch = 
      op.numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (op.produto?.nome || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (op.produto?.codigo || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (op.produto_destino?.nome || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (op.produto_destino?.codigo || "").toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchStatus = filtroStatus === "todos" || op.status === filtroStatus;
    const matchProduto = 
      filtroProduto === "todos" || 
      op.produto_id === filtroProduto || 
      op.produto_destino_id === filtroProduto;
    
    return matchSearch && matchStatus && matchProduto;
  });

  const totalEmPintura = ordens.filter((o) => o.status === "em_pintura").length;
  const totalRetornados = ordens.filter((o) => o.status === "retornado").length;
  const custoTotalPintura = ordens.filter((o) => o.status !== "cancelada").reduce((acc, o) => acc + (Number(o.custo_pintura) || 0), 0);

  const handleCriarOp = async () => {
    if (!produtoSelecionado) { toast({ title: "Selecione um produto", variant: "destructive" }); return; }
    if (quantidade <= 0) { toast({ title: "Quantidade deve ser maior que zero", variant: "destructive" }); return; }
    try {
      setProcessandoId("nova");
      const produto = produtos.find((p) => p.id === produtoSelecionado);
      if (!produto) { toast({ title: "Produto não encontrado", variant: "destructive" }); return; }
      if (produto.estoque < quantidade) {
        toast({ title: "Estoque insuficiente", description: `Estoque atual: ${produto.estoque} ${produto.unidade || "un"}`, variant: "destructive" });
        return;
      }
      const { data: numeroOp, error: numeroError } = await supabase.rpc("gerar_numero_op");
      if (numeroError) throw numeroError;

      const { data: opInsert, error: opError } = await supabase
        .from("ordens_producao").insert({
          numero: numeroOp, produto_id: produtoSelecionado,
          produto_destino_id: produtoDestinoSelecionado || null,
          quantidade, data_saida: dataSaida, custo_pintura: custoPintura,
          status: "em_pintura", observacoes: observacoes || null, created_by: user?.id,
        }).select().single();
      if (opError) throw opError;

      const novoEstoque = produto.estoque - quantidade;
      const { error: estoqueError } = await supabase.from("produtos").update({ estoque: novoEstoque }).eq("id", produtoSelecionado);
      if (estoqueError) throw estoqueError;

      await supabase.from("movimentacoes_estoque").insert({
        produto_id: produtoSelecionado, tipo: "saida", quantidade,
        quantidade_anterior: produto.estoque, quantidade_atual: novoEstoque,
        origem: "ordem_producao", usuario_id: user?.id,
        observacoes: `Saída para pintura - OP ${numeroOp}`,
      });

      await supabase.from("ordens_producao_historico").insert({
        op_id: opInsert.id, status_anterior: null, status_novo: "em_pintura",
        observacoes: produtoDestinoSelecionado ? `OP criada - produto será transformado em ${produtos.find(p => p.id === produtoDestinoSelecionado)?.nome || "produto destino"}` : "OP criada",
        usuario_id: user?.id,
      });

      if (custoPintura > 0) {
        const { error: transError } = await supabase.from("transacoes_financeiras").insert({
          descricao: `Custo de Pintura - OP ${numeroOp} (${produto.nome})`,
          tipo: "despesa", valor: custoPintura, data: dataSaida, status: "pendente",
          categoria: "Pintura", origem_tipo: "ordem_producao",
          observacoes: `OP ${numeroOp} - ${quantidade} un de ${produto.nome}`,
          data_vencimento: dataSaida, created_by: user?.id,
        });
        if (transError) throw transError;
      }

      toast({ title: "OP criada com sucesso!", description: `OP ${numeroOp} - Produto enviado para pintura. Estoque debitado.` });
      setProdutoSelecionado(""); setProdutoDestinoSelecionado(""); setQuantidade(1); setCustoPintura(0);
      setDataSaida(new Date().toISOString().split("T")[0]); setObservacoes(""); setDialogNovaOpAberto(false);
      await carregarDados();
    } catch (error: any) {
      toast({ title: "Erro ao criar OP", description: error.message, variant: "destructive" });
    } finally { setProcessandoId(null); }
  };

  const handleRetornarOp = async () => {
    if (!opParaRetornar) return;
    try {
      setProcessandoId(opParaRetornar.id);
      const produtoOriginal = opParaRetornar.produto;
      if (!produtoOriginal) { toast({ title: "Produto não encontrado", variant: "destructive" }); return; }
      const produtoDestinoId = opParaRetornar.produto_destino_id || opParaRetornar.produto_id;
      const produtoDestino = opParaRetornar.produto_destino || produtoOriginal;
      const estoqueAtualDestino = produtoDestino.estoque || 0;
      const novoEstoqueDestino = estoqueAtualDestino + opParaRetornar.quantidade;

      const { error: estoqueError } = await supabase.from("produtos").update({ estoque: novoEstoqueDestino }).eq("id", produtoDestinoId);
      if (estoqueError) throw estoqueError;

      await supabase.from("movimentacoes_estoque").insert({
        produto_id: produtoDestinoId, tipo: "entrada", quantidade: opParaRetornar.quantidade,
        quantidade_anterior: estoqueAtualDestino, quantidade_atual: novoEstoqueDestino,
        origem: "ordem_producao", usuario_id: user?.id,
        observacoes: opParaRetornar.produto_destino_id
          ? `Retorno da pintura com transformação - OP ${opParaRetornar.numero} (${produtoOriginal.nome} → ${produtoDestino.nome})`
          : `Retorno da pintura - OP ${opParaRetornar.numero}`,
      });

      const { error: opError } = await supabase.from("ordens_producao").update({
        status: "retornado", data_retorno: dataRetorno, updated_at: new Date().toISOString(),
      }).eq("id", opParaRetornar.id);
      if (opError) throw opError;

      await supabase.from("ordens_producao_historico").insert({
        op_id: opParaRetornar.id, status_anterior: "em_pintura", status_novo: "retornado",
        observacoes: opParaRetornar.produto_destino_id
          ? `Produto retornado com transformação: ${produtoOriginal.nome} → ${produtoDestino.nome}`
          : "Produto retornado da pintura ao estoque",
        usuario_id: user?.id,
      });

      toast({ title: "Produto retornado com sucesso!",
        description: opParaRetornar.produto_destino_id
          ? `OP ${opParaRetornar.numero} - ${opParaRetornar.quantidade} un adicionadas a ${produtoDestino.nome}.`
          : `OP ${opParaRetornar.numero} - ${opParaRetornar.quantidade} un de ${produtoOriginal.nome} voltaram ao estoque.`,
      });
      setDialogRetornoAberto(false); setOpParaRetornar(null);
      await carregarDados();
    } catch (error: any) {
      toast({ title: "Erro ao retornar OP", description: error.message, variant: "destructive" });
    } finally { setProcessandoId(null); }
  };

  const handleCancelarOp = async () => {
    if (!opParaCancelar) return;
    try {
      setProcessandoId(opParaCancelar.id);
      if (opParaCancelar.status === "em_pintura" && opParaCancelar.produto) {
        const novoEstoque = opParaCancelar.produto.estoque + opParaCancelar.quantidade;
        await supabase.from("produtos").update({ estoque: novoEstoque }).eq("id", opParaCancelar.produto_id);
        await supabase.from("movimentacoes_estoque").insert({
          produto_id: opParaCancelar.produto_id, tipo: "entrada", quantidade: opParaCancelar.quantidade,
          quantidade_anterior: opParaCancelar.produto.estoque, quantidade_atual: novoEstoque,
          origem: "ordem_producao", usuario_id: user?.id,
          observacoes: `Cancelamento da OP ${opParaCancelar.numero} - devolução ao estoque`,
        });
      }
      const { error: opError } = await supabase.from("ordens_producao").update({
        status: "cancelada", updated_at: new Date().toISOString(),
      }).eq("id", opParaCancelar.id);
      if (opError) throw opError;
      await supabase.from("ordens_producao_historico").insert({
        op_id: opParaCancelar.id, status_anterior: opParaCancelar.status, status_novo: "cancelada",
        observacoes: "OP cancelada", usuario_id: user?.id,
      });
      toast({ title: "OP cancelada", description: `OP ${opParaCancelar.numero} foi cancelada.` });
      setDialogCancelarAberto(false); setOpParaCancelar(null);
      await carregarDados();
    } catch (error: any) {
      toast({ title: "Erro ao cancelar OP", description: error.message, variant: "destructive" });
    } finally { setProcessandoId(null); }
  };

  const handleVerHistorico = async (op: OrdemProducao) => {
    setOpHistorico(op); setDialogHistoricoAberto(true);
    try {
      const { data, error } = await supabase.from("ordens_producao_historico")
        .select("*").eq("op_id", op.id).order("created_at", { ascending: true });
      if (error) throw error;
      setHistorico(data || []);
    } catch (error: any) {
      toast({ title: "Erro ao carregar histórico", description: error.message, variant: "destructive" });
    }
  };

  const produtoOrigem = produtos.find((p) => p.id === produtoSelecionado);
  const produtoDestino = produtos.find((p) => p.id === produtoDestinoSelecionado);

  const limparFiltros = () => {
    setSearchTerm("");
    setFiltroStatus("todos");
    setFiltroProduto("todos");
    setBuscaProduto("");
  };

  const temFiltrosAtivos = searchTerm !== "" || filtroStatus !== "todos" || filtroProduto !== "todos" || buscaProduto !== "";

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-3">
            <PaintBucket className="h-7 w-7 sm:h-8 sm:w-8 text-primary shrink-0" /> Ordens de Produção
          </h1>
          <p className="text-muted-foreground mt-1">Controle de produtos enviados para pintura, transformação de cor e retorno ao estoque</p>
        </div>
        <Button onClick={() => setDialogNovaOpAberto(true)} className="bg-primary hover:bg-primary/90 w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" /> Nova OP
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-card to-amber-50/30 hover:shadow-xl transition-all duration-300">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl" />
          <CardContent className="pt-6 relative z-10">
            <div className="flex items-center justify-between">
              <div><p className="text-sm font-medium text-muted-foreground">Em Pintura</p><p className="text-2xl font-bold text-amber-600">{totalEmPintura}</p></div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg"><Clock className="h-6 w-6 text-white" /></div>
            </div>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-card to-green-50/30 hover:shadow-xl transition-all duration-300">
          <div className="absolute top-0 right-0 w-24 h-24 bg-green-500/5 rounded-full blur-2xl" />
          <CardContent className="pt-6 relative z-10">
            <div className="flex items-center justify-between">
              <div><p className="text-sm font-medium text-muted-foreground">Retornados</p><p className="text-2xl font-bold text-green-600">{totalRetornados}</p></div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-success shadow-lg"><CheckCircle className="h-6 w-6 text-white" /></div>
            </div>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-card to-blue-50/30 hover:shadow-xl transition-all duration-300">
          <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl" />
          <CardContent className="pt-6 relative z-10">
            <div className="flex items-center justify-between">
              <div><p className="text-sm font-medium text-muted-foreground">Custo Total Pintura</p><p className="text-2xl font-bold text-primary">{formatCurrency(custoTotalPintura)}</p></div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent shadow-lg"><DollarSign className="h-6 w-6 text-white" /></div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card><CardContent className="pt-6">
        <div className="flex flex-col space-y-4">
          {/* Linha de filtros - 2 linhas */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar por OP, produto, código..." 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
                className="pl-10" 
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos Status</SelectItem>
                  <SelectItem value="em_pintura">Em Pintura</SelectItem>
                  <SelectItem value="retornado">Retornado</SelectItem>
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={filtroProduto} onValueChange={setFiltroProduto}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filtrar por produto" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  <SelectItem value="todos">Todos os produtos</SelectItem>
                  {produtos.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome} {p.cor ? `(${p.cor})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Button variant="outline" onClick={carregarDados} title="Atualizar">
                <RefreshCw className="h-4 w-4" />
              </Button>
              
              {temFiltrosAtivos && (
                <Button variant="ghost" onClick={limparFiltros} className="text-muted-foreground">
                  <Filter className="h-4 w-4 mr-1" /> Limpar
                </Button>
              )}
            </div>
          </div>
          
          {/* Segunda linha - Busca de produtos */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Package className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar produtos no estoque..." 
                value={buscaProduto} 
                onChange={(e) => setBuscaProduto(e.target.value)} 
                className="pl-10" 
              />
            </div>
            <div className="text-sm text-muted-foreground flex items-center">
              {buscaProduto ? `${produtosFiltrados.length} produtos encontrados` : `${produtos.length} produtos no estoque`}
            </div>
          </div>
          
          {/* Indicador de filtros ativos */}
          {temFiltrosAtivos && (
            <div className="flex flex-wrap gap-2 items-center text-sm text-muted-foreground">
              <span className="font-medium">Filtros ativos:</span>
              {searchTerm && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  Busca: "{searchTerm}"
                  <button onClick={() => setSearchTerm("")} className="ml-1 hover:text-foreground">×</button>
                </Badge>
              )}
              {buscaProduto && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  Produtos: "{buscaProduto}"
                  <button onClick={() => setBuscaProduto("")} className="ml-1 hover:text-foreground">×</button>
                </Badge>
              )}
              {filtroStatus !== "todos" && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  Status: {filtroStatus === "em_pintura" ? "Em Pintura" : filtroStatus === "retornado" ? "Retornado" : "Cancelada"}
                  <button onClick={() => setFiltroStatus("todos")} className="ml-1 hover:text-foreground">×</button>
                </Badge>
              )}
              {filtroProduto !== "todos" && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  Produto: {produtos.find(p => p.id === filtroProduto)?.nome || filtroProduto}
                  <button onClick={() => setFiltroProduto("todos")} className="ml-1 hover:text-foreground">×</button>
                </Badge>
              )}
              <span className="text-xs">
                ({ordensFiltradas.length} {ordensFiltradas.length === 1 ? "resultado" : "resultados"})
              </span>
            </div>
          )}

          {/* Lista de produtos encontrados */}
          {buscaProduto && produtosFiltrados.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 mt-2">
              {produtosFiltrados.slice(0, 8).map((produto) => (
                <div key={produto.id} className="flex items-center justify-between p-2 bg-muted/30 rounded-lg border">
                  <div>
                    <p className="font-medium text-sm">{produto.nome}</p>
                    <p className="text-xs text-muted-foreground">{produto.codigo} {produto.cor ? `· ${produto.cor}` : ""}</p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    Est: {produto.estoque} {produto.unidade || "un"}
                  </Badge>
                </div>
              ))}
              {produtosFiltrados.length > 8 && (
                <div className="flex items-center justify-center p-2 text-muted-foreground text-sm">
                  + {produtosFiltrados.length - 8} produtos
                </div>
              )}
            </div>
          )}

          {buscaProduto && produtosFiltrados.length === 0 && (
            <div className="text-center py-4 text-muted-foreground">
              <Package className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              Nenhum produto encontrado com "{buscaProduto}"
            </div>
          )}
        </div>

        {loading ? (
          <div className="text-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div><p className="mt-4 text-muted-foreground">Carregando ordens de produção...</p></div>
        ) : (
          <div className="overflow-x-auto mt-4">
            <Table>
              <TableHeader><TableRow>
                <TableHead className="font-bold">Número</TableHead>
                <TableHead className="font-bold">Produto Origem</TableHead>
                <TableHead className="font-bold">Transforma em</TableHead>
                <TableHead className="font-bold text-right">Qtd</TableHead>
                <TableHead className="font-bold">Saída</TableHead>
                <TableHead className="font-bold">Retorno</TableHead>
                <TableHead className="font-bold text-right">Custo</TableHead>
                <TableHead className="font-bold">Status</TableHead>
                <TableHead className="font-bold text-right">Ações</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {ordensFiltradas.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    {temFiltrosAtivos ? "Nenhuma OP encontrada com os filtros aplicados." : "Nenhuma OP cadastrada. Clique em 'Nova OP' para começar."}
                  </TableCell></TableRow>
                ) : ordensFiltradas.map((op) => {
                  const si = getStatusInfo(op.status); const SIcon = si.icon;
                  return (
                    <TableRow key={op.id} className="hover:bg-muted/50">
                      <TableCell className="font-mono font-medium">{op.numero}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{op.produto?.nome || "-"}</span>
                          <span className="text-xs text-muted-foreground">{op.produto?.codigo || "-"} {op.produto?.cor ? `· ${op.produto.cor}` : ""}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {op.produto_destino ? (
                          <div className="flex items-center gap-2">
                            <ArrowRight className="h-3 w-3 text-primary" />
                            <div className="flex flex-col">
                              <span className="font-medium text-primary">{op.produto_destino.nome}</span>
                              <span className="text-xs text-muted-foreground">{op.produto_destino.codigo} {op.produto_destino.cor ? `· ${op.produto_destino.cor}` : ""}</span>
                            </div>
                          </div>
                        ) : <span className="text-muted-foreground text-sm">Sem transformação</span>}
                      </TableCell>
                      <TableCell className="text-right font-semibold">{op.quantidade} {op.produto?.unidade || "un"}</TableCell>
                      <TableCell>{formatDate(op.data_saida)}</TableCell>
                      <TableCell>{formatDate(op.data_retorno)}</TableCell>
                      <TableCell className="text-right font-bold text-primary">{formatCurrency(op.custo_pintura)}</TableCell>
                      <TableCell><Badge variant="outline" className={si.className}><SIcon className="h-3 w-3 mr-1" />{si.label}</Badge></TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => { setOpDetalhes(op); setDialogDetalhesAberto(true); }} title="Detalhes"><Eye className="h-4 w-4" /></Button>
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => handleVerHistorico(op)} title="Histórico"><History className="h-4 w-4" /></Button>
                          {op.status === "em_pintura" && (
                            <>
                              <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white h-8"
                                onClick={() => { setOpParaRetornar(op); setDataRetorno(new Date().toISOString().split("T")[0]); setDialogRetornoAberto(true); }}
                                disabled={processandoId === op.id} title="Retornar">
                                {processandoId === op.id ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> : <ArrowLeftRight className="h-4 w-4" />}
                              </Button>
                              <Button size="sm" variant="outline" className="border-red-500 text-red-600 hover:bg-red-50 h-8 w-8 p-0"
                                onClick={() => { setOpParaCancelar(op); setDialogCancelarAberto(true); }}
                                disabled={processandoId === op.id} title="Cancelar"><XCircle className="h-4 w-4" /></Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent></Card>

      {/* DIALOG NOVA OP - com busca de produtos integrada */}
      <Dialog open={dialogNovaOpAberto} onOpenChange={setDialogNovaOpAberto}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><PaintBucket className="h-5 w-5 text-primary" />Nova Ordem de Produção</DialogTitle>
            <DialogDescription>Envie um produto para pintura. O estoque será debitado e o custo será registrado no financeiro.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Produto de Origem (será debitado) *</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Buscar produto por nome ou código..." 
                  value={buscaProduto} 
                  onChange={(e) => setBuscaProduto(e.target.value)} 
                  className="pl-10" 
                />
              </div>
              <Select value={produtoSelecionado} onValueChange={(v) => { setProdutoSelecionado(v); setProdutoDestinoSelecionado(""); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o produto que vai para pintura..." />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {produtosFiltrados.length === 0 ? (
                    <SelectItem value="" disabled>Nenhum produto encontrado</SelectItem>
                  ) : (
                    produtosFiltrados.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.codigo} - {p.nome} {p.cor ? `(${p.cor})` : ""} (Est: {p.estoque} {p.unidade || "un"})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {produtoOrigem && (
                <div className="flex items-center gap-2 p-2 bg-primary/5 rounded-lg border border-primary/20">
                  <Package className="h-4 w-4 text-primary" />
                  <span className="text-sm">
                    <span className="font-medium">{produtoOrigem.nome}</span>
                    <span className="text-muted-foreground ml-2">Estoque: {produtoOrigem.estoque} {produtoOrigem.unidade || "un"} {produtoOrigem.cor ? `· Cor: ${produtoOrigem.cor}` : ""}</span>
                  </span>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>Produto Destino (após pintura - opcional)</Label>
              <Select value={produtoDestinoSelecionado} onValueChange={setProdutoDestinoSelecionado}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o produto transformado (ou deixe vazio para o mesmo)" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {produtos.filter((p) => p.id !== produtoSelecionado).map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.codigo} - {p.nome} {p.cor ? `(${p.cor})` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Use quando o produto muda de cor na pintura. O estoque será adicionado ao produto destino no retorno.</p>
              {produtoOrigem && produtoDestino && (
                <div className="flex items-center gap-2 p-2 bg-primary/5 rounded-lg border border-primary/20">
                  <span className="text-sm font-medium">{produtoOrigem.nome} {produtoOrigem.cor ? `(${produtoOrigem.cor})` : ""}</span>
                  <ArrowRight className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium text-primary">{produtoDestino.nome} {produtoDestino.cor ? `(${produtoDestino.cor})` : ""}</span>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Quantidade *</Label><Input type="number" min={1} value={quantidade} onChange={(e) => setQuantidade(parseInt(e.target.value) || 0)} /></div>
              <div className="space-y-2"><Label>Data de Saída</Label><Input type="date" value={dataSaida} onChange={(e) => setDataSaida(e.target.value)} /></div>
            </div>
            <div className="space-y-2">
              <Label>Custo de Pintura (R$)</Label>
              <Input type="number" min={0} step="0.01" value={custoPintura} onChange={(e) => setCustoPintura(parseFloat(e.target.value) || 0)} placeholder="0,00" />
              <p className="text-xs text-muted-foreground">Será registrado como despesa no financeiro.</p>
            </div>
            <div className="space-y-2"><Label>Observações</Label><Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Observações opcionais..." rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogNovaOpAberto(false)}>Cancelar</Button>
            <Button onClick={handleCriarOp} disabled={processandoId === "nova"} className="bg-primary">
              {processandoId === "nova" ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div> : <Plus className="h-4 w-4 mr-2" />}Criar OP
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG RETORNO */}
      <Dialog open={dialogRetornoAberto} onOpenChange={setDialogRetornoAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ArrowLeftRight className="h-5 w-5 text-green-600" />Confirmar Retorno da Pintura</DialogTitle>
            <DialogDescription>O produto voltará ao estoque. Confirme a data de retorno.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label>Data de Retorno</Label><Input type="date" value={dataRetorno} onChange={(e) => setDataRetorno(e.target.value)} /></div>
            {opParaRetornar && (
              <div className="border rounded-lg p-4 bg-muted/50">
                <p className="font-medium mb-2">Resumo:</p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span>OP:</span><span className="font-medium">{opParaRetornar.numero}</span></div>
                  <div className="flex justify-between"><span>Produto Origem:</span><span className="font-medium">{opParaRetornar.produto?.nome}</span></div>
                  {opParaRetornar.produto_destino ? (<div className="flex justify-between"><span>Produto Destino:</span><span className="font-medium text-primary">{opParaRetornar.produto_destino.nome}</span></div>) : null}
                  <div className="flex justify-between"><span>Quantidade:</span><span className="font-medium">{opParaRetornar.quantidade} {opParaRetornar.produto?.unidade || "un"}</span></div>
                  <div className="flex justify-between"><span>Custo Pintura:</span><span className="font-medium">{formatCurrency(opParaRetornar.custo_pintura)}</span></div>
                  <div className="flex justify-between border-t pt-1 mt-1"><span>Estoque após retorno:</span><span className="font-bold text-green-600">{(opParaRetornar.produto_destino?.estoque || opParaRetornar.produto?.estoque || 0) + opParaRetornar.quantidade}</span></div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogRetornoAberto(false)}>Cancelar</Button>
            <Button onClick={handleRetornarOp} disabled={processandoId !== null} className="bg-green-600 hover:bg-green-700">
              {processandoId ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div> : null}Confirmar Retorno
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG CANCELAR */}
      <AlertDialog open={dialogCancelarAberto} onOpenChange={setDialogCancelarAberto}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><XCircle className="h-5 w-5 text-red-600" />Cancelar OP {opParaCancelar?.numero}</AlertDialogTitle>
            <AlertDialogDescription>{opParaCancelar?.status === "em_pintura" ? "A OP será cancelada e o produto será devolvido ao estoque. Esta ação não pode ser desfeita." : "A OP será cancelada. Esta ação não pode ser desfeita."}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelarOp} className="bg-red-600 hover:bg-red-700 text-white" disabled={processandoId !== null}>
              {processandoId ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div> : null}Sim, Cancelar OP
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* DIALOG HISTÓRICO */}
      <Dialog open={dialogHistoricoAberto} onOpenChange={setDialogHistoricoAberto}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><History className="h-5 w-5 text-primary" />Histórico da OP {opHistorico?.numero}</DialogTitle>
            <DialogDescription>{opHistorico?.produto?.nome} - {opHistorico?.quantidade} {opHistorico?.produto?.unidade || "un"}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            {historico.length === 0 ? <p className="text-center text-muted-foreground py-4">Nenhum histórico encontrado.</p> : historico.map((item) => (
              <div key={item.id} className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30">
                <div className="flex-shrink-0 mt-0.5">
                  {item.status_novo === "em_pintura" && <TrendingDown className="h-4 w-4 text-amber-600" />}
                  {item.status_novo === "retornado" && <TrendingUp className="h-4 w-4 text-green-600" />}
                  {item.status_novo === "cancelada" && <XCircle className="h-4 w-4 text-red-600" />}
                </div>
                <div className="flex-1">
                  <span className="text-sm font-medium">{item.status_anterior || "Criada"} → {item.status_novo}</span>
                  {item.observacoes && <p className="text-xs text-muted-foreground mt-1">{item.observacoes}</p>}
                  <p className="text-xs text-muted-foreground mt-1">{formatDate(item.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogHistoricoAberto(false)}>Fechar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG DETALHES */}
      <Dialog open={dialogDetalhesAberto} onOpenChange={setDialogDetalhesAberto}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Eye className="h-5 w-5 text-primary" />Detalhes da OP {opDetalhes?.numero}</DialogTitle></DialogHeader>
          {opDetalhes && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-sm text-muted-foreground">Produto Origem</p><p className="font-medium">{opDetalhes.produto?.nome || "-"}</p><p className="text-xs text-muted-foreground">{opDetalhes.produto?.codigo} {opDetalhes.produto?.cor ? `· ${opDetalhes.produto.cor}` : ""}</p></div>
                <div><p className="text-sm text-muted-foreground">Produto Destino</p>{opDetalhes.produto_destino ? (<><p className="font-medium text-primary">{opDetalhes.produto_destino.nome}</p><p className="text-xs text-muted-foreground">{opDetalhes.produto_destino.codigo} {opDetalhes.produto_destino.cor ? `· ${opDetalhes.produto_destino.cor}` : ""}</p></>) : <p className="font-medium text-muted-foreground">Sem transformação</p>}</div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-sm text-muted-foreground">Quantidade</p><p className="font-medium">{opDetalhes.quantidade} {opDetalhes.produto?.unidade || "un"}</p></div>
                <div><p className="text-sm text-muted-foreground">Status</p>{(() => { const si = getStatusInfo(opDetalhes.status); const SIcon = si.icon; return <Badge variant="outline" className={si.className}><SIcon className="h-3 w-3 mr-1" />{si.label}</Badge>; })()}</div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-sm text-muted-foreground">Data de Saída</p><p className="font-medium">{formatDate(opDetalhes.data_saida)}</p></div>
                <div><p className="text-sm text-muted-foreground">Data de Retorno</p><p className="font-medium">{formatDate(opDetalhes.data_retorno)}</p></div>
              </div>
              <div><p className="text-sm text-muted-foreground">Custo de Pintura</p><p className="font-bold text-primary text-lg">{formatCurrency(opDetalhes.custo_pintura)}</p></div>
              {opDetalhes.observacoes && <div><p className="text-sm text-muted-foreground">Observações</p><p className="text-sm bg-muted/50 p-3 rounded">{opDetalhes.observacoes}</p></div>}
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setDialogDetalhesAberto(false)}>Fechar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}