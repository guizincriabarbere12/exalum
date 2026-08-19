import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  ShoppingCart, Search, Package, X, Send, User, MapPin, Minus, Plus,
  Phone, Mail, MapPinned, PackageSearch, Truck, ShieldCheck, ClipboardList,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Produto {
  id: string;
  codigo: string;
  descricao: string;
  preco_venda: number;
  tipo: string | null;
  liga: string | null;
  cor: string | null;
  imagem_url: string | null;
  peso: number | null;
  unidade: string;
  localizacao: string | null;
  estoque?: { quantidade: number };
  item_tipo: 'produto' | 'kit';
  nome?: string;
}

interface ItemCarrinho {
  produto: Produto;
  quantidade: number;
}

export default function CatalogoPublico() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [filtroLiga, setFiltroLiga] = useState<string>("todos");
  const [filtroLocalizacao, setFiltroLocalizacao] = useState<string>("todos");
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
  const [carrinhoAberto, setCarrinhoAberto] = useState(false);
  const [checkoutAberto, setCheckoutAberto] = useState(false);
  const [pedidoConfirmado, setPedidoConfirmado] = useState<string | null>(null);
  const [enviandoPedido, setEnviandoPedido] = useState(false);
  const [produtoDetalhe, setProdutoDetalhe] = useState<Produto | null>(null);
  const [quantidadeDetalhe, setQuantidadeDetalhe] = useState(1);
  const [logoEmpresa, setLogoEmpresa] = useState<string | null>(null);
  const [nomeEmpresa, setNomeEmpresa] = useState<string>("Catálogo");
  const [whatsappEmpresa, setWhatsappEmpresa] = useState<string>("5511999999999");
  const [emailEmpresa, setEmailEmpresa] = useState<string | null>(null);
  const [enderecoEmpresa, setEnderecoEmpresa] = useState<string | null>(null);
  const [dadosCliente, setDadosCliente] = useState({
    nome: "",
    email: "",
    telefone: "",
    observacoes: "",
  });

  const fetchConfiguracoes = async () => {
    try {
      const { data, error } = await supabase
        .from('configuracoes')
        .select('logo_url, nome_empresa, telefone, email, endereco')
        .single();

      if (error) throw error;
      if (data) {
        setLogoEmpresa(data.logo_url);
        setNomeEmpresa(data.nome_empresa || "Catálogo");
        setWhatsappEmpresa(data.telefone || "5585997311925");
        setEmailEmpresa(data.email || null);
        setEnderecoEmpresa(data.endereco || null);
      }
    } catch (error: any) {
      console.error("Erro ao carregar configurações:", error.message);
    }
  };

  const fetchProdutos = async () => {
    try {
      const { data: produtosData, error: produtosError } = await supabase
        .from('produtos')
        .select('*')
        .order('nome');

      if (produtosError) throw produtosError;

      const { data: kitsData, error: kitsError } = await supabase
        .from('kits_estoque_disponivel')
        .select('*')
        .order('nome');

      if (kitsError) throw kitsError;

      const produtosFormatados: Produto[] = (produtosData || []).map(p => ({
        id: p.id,
        codigo: p.codigo,
        descricao: p.descricao || p.nome,
        preco_venda: p.preco || 0,
        tipo: p.categoria,
        liga: null,
        cor: p.cor,
        imagem_url: p.imagem_url,
        peso: p.peso,
        unidade: p.unidade,
        localizacao: p.localizacao || null,
        estoque: { quantidade: p.estoque || 0 },
        item_tipo: 'produto' as const,
        nome: p.nome
      }));

      const kitsFormatados: Produto[] = (kitsData || []).map(k => ({
        id: k.id,
        codigo: k.codigo,
        descricao: k.descricao || k.nome,
        preco_venda: k.preco_total,
        tipo: 'Kit',
        liga: null,
        cor: null,
        imagem_url: null,
        peso: null,
        unidade: 'un',
        localizacao: null,
        estoque: { quantidade: k.estoque_disponivel || 0 },
        item_tipo: 'kit' as const,
        nome: k.nome
      }));

      setProdutos([...produtosFormatados, ...kitsFormatados]);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar produtos",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfiguracoes();
    fetchProdutos();
  }, []);

  const adicionarAoCarrinho = (produto: Produto, quantidade = 1) => {
    const estoqueDisponivel = produto.estoque?.quantidade || 0;
    const itemExistente = carrinho.find(item => item.produto.id === produto.id);

    if (itemExistente) {
      const novaQuantidade = itemExistente.quantidade + quantidade;

      if (novaQuantidade > estoqueDisponivel) {
        toast({
          title: "Estoque insuficiente",
          description: `Apenas ${estoqueDisponivel} unidade(s) disponível(is)`,
          variant: "destructive",
        });
        return;
      }

      setCarrinho(carrinho.map(item =>
        item.produto.id === produto.id
          ? { ...item, quantidade: novaQuantidade }
          : item
      ));
    } else {
      if (estoqueDisponivel < 1) {
        toast({
          title: "Produto indisponível",
          description: "Este produto não está disponível no momento",
          variant: "destructive",
        });
        return;
      }

      if (quantidade > estoqueDisponivel) {
        toast({
          title: "Estoque insuficiente",
          description: `Apenas ${estoqueDisponivel} unidade(s) disponível(is)`,
          variant: "destructive",
        });
        return;
      }

      setCarrinho([...carrinho, { produto, quantidade }]);
    }

    toast({
      title: "Produto adicionado!",
      description: `${produto.descricao} foi adicionado ao carrinho`,
    });
  };

  const removerDoCarrinho = (produtoId: string) => {
    setCarrinho(carrinho.filter(item => item.produto.id !== produtoId));
  };

  const atualizarQuantidade = (produtoId: string, quantidade: number) => {
    if (quantidade < 1) {
      removerDoCarrinho(produtoId);
      return;
    }

    const item = carrinho.find(i => i.produto.id === produtoId);
    if (!item) return;

    const estoqueDisponivel = item.produto.estoque?.quantidade || 0;

    if (quantidade > estoqueDisponivel) {
      toast({
        title: "Estoque insuficiente",
        description: `Apenas ${estoqueDisponivel} unidade(s) disponível(is)`,
        variant: "destructive",
      });
      return;
    }

    setCarrinho(carrinho.map(item =>
      item.produto.id === produtoId
        ? { ...item, quantidade }
        : item
    ));
  };

  const produtosFiltrados = useMemo(() => produtos.filter(produto => {
    const matchSearch = produto.descricao.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       produto.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       (produto.nome && produto.nome.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchTipo = filtroTipo === "todos" || produto.tipo === filtroTipo;
    const matchLiga = filtroLiga === "todos" || produto.liga === filtroLiga;
    const matchLocalizacao = filtroLocalizacao === "todos" || produto.localizacao === filtroLocalizacao;

    return matchSearch && matchTipo && matchLiga && matchLocalizacao;
  }), [produtos, searchTerm, filtroTipo, filtroLiga, filtroLocalizacao]);

  const tipos = useMemo(() => [...new Set(produtos.map(p => p.tipo).filter(Boolean))] as string[], [produtos]);
  const ligas = useMemo(() => [...new Set(produtos.map(p => p.liga).filter(Boolean))] as string[], [produtos]);
  const localizacoes = useMemo(() => [...new Set(produtos.map(p => p.localizacao).filter(Boolean))] as string[], [produtos]);

  const totalCarrinho = carrinho.reduce((total, item) =>
    total + (item.produto.preco_venda * item.quantidade), 0
  );

  const totalItens = carrinho.reduce((total, item) => total + item.quantidade, 0);

  const abrirDetalhe = (produto: Produto) => {
    setQuantidadeDetalhe(1);
    setProdutoDetalhe(produto);
  };

  const abrirCheckout = () => {
    if (carrinho.length === 0) {
      toast({
        title: "Carrinho vazio",
        description: "Adicione produtos ao carrinho antes de finalizar",
        variant: "destructive",
      });
      return;
    }
    setCarrinhoAberto(false);
    setCheckoutAberto(true);
  };

  const finalizarPedido = async () => {
    if (!dadosCliente.nome || !dadosCliente.telefone) {
      toast({
        title: "Dados incompletos",
        description: "Por favor, preencha seu nome e telefone",
        variant: "destructive",
      });
      return;
    }

    setEnviandoPedido(true);

    try {
      let clienteId = null;

      if (dadosCliente.email) {
        const { data: clienteExistente } = await supabase
          .from('clientes')
          .select('id')
          .eq('email', dadosCliente.email)
          .maybeSingle();

        if (clienteExistente) {
          clienteId = clienteExistente.id;
        } else {
          const { data: novoCliente, error: clienteError } = await supabase
            .from('clientes')
            .insert({
              nome: dadosCliente.nome,
              email: dadosCliente.email,
              telefone: dadosCliente.telefone,
            })
            .select()
            .single();

          if (clienteError) throw clienteError;
          clienteId = novoCliente.id;
        }
      } else {
        const { data: clientePorTelefone } = await supabase
          .from('clientes')
          .select('id')
          .eq('telefone', dadosCliente.telefone)
          .maybeSingle();

        if (clientePorTelefone) {
          clienteId = clientePorTelefone.id;
        } else {
          const { data: novoCliente, error: clienteError } = await supabase
            .from('clientes')
            .insert({
              nome: dadosCliente.nome,
              telefone: dadosCliente.telefone,
            })
            .select()
            .single();

          if (clienteError) throw clienteError;
          clienteId = novoCliente.id;
        }
      }

      const numeroAleatorio = Math.floor(Math.random() * 90000) + 10000;
      const numeroPedido = `PED-${numeroAleatorio}`;

      const { data: pedido, error: pedidoError } = await supabase
        .from('pedidos')
        .insert({
          numero: numeroPedido,
          cliente_id: clienteId,
          status: 'pendente',
          valor_total: totalCarrinho,
          origem: 'catalogo',
          observacoes: dadosCliente.observacoes || null,
        })
        .select()
        .single();

      if (pedidoError) throw pedidoError;

      const itens = carrinho.map(item => ({
        pedido_id: pedido.id,
        produto_id: item.produto.item_tipo === 'produto' ? item.produto.id : null,
        kit_id: item.produto.item_tipo === 'kit' ? item.produto.id : null,
        quantidade: item.quantidade,
        preco_unitario: item.produto.preco_venda,
        // subtotal é calculado automaticamente pelo banco (coluna gerada)
      }));

      const { error: itensError } = await supabase
        .from('pedido_itens')
        .insert(itens);

      if (itensError) throw itensError;

      toast({
        title: "Pedido enviado!",
        description: `Seu pedido ${numeroPedido} foi enviado com sucesso.`,
      });

      setCarrinho([]);
      setPedidoConfirmado(numeroPedido);
    } catch (error: any) {
      toast({
        title: "Erro ao enviar pedido",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setEnviandoPedido(false);
    }
  };

  const formatarPreco = (valor: number) =>
    valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-2xl border-b border-primary/10 shadow-sm">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              {logoEmpresa ? (
                <img src={logoEmpresa} alt="Logo" className="h-11 w-auto object-contain" />
              ) : (
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg">
                  <Package className="h-5 w-5 text-white" />
                </div>
              )}
              <div>
                <h1 className="text-lg font-bold leading-tight">{nomeEmpresa}</h1>
                <p className="text-xs text-muted-foreground">Loja Online</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-10" asChild>
                <Link to="/acompanhar-pedido">
                  <ClipboardList className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Acompanhar Pedido</span>
                  <span className="sm:hidden">Pedido</span>
                </Link>
              </Button>

              <Sheet open={carrinhoAberto} onOpenChange={setCarrinhoAberto}>
                <SheetTrigger asChild>
                  <Button size="sm" className="relative h-10 px-4">
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Carrinho</span>
                    {totalItens > 0 && (
                      <Badge className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 bg-destructive">
                        {totalItens}
                      </Badge>
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent className="w-full sm:max-w-lg flex flex-col">
                  <SheetHeader>
                    <SheetTitle className="flex items-center gap-2">
                      <ShoppingCart className="h-5 w-5" />
                      Meu Carrinho
                    </SheetTitle>
                    <SheetDescription>
                      {totalItens} {totalItens === 1 ? 'item' : 'itens'} no carrinho
                    </SheetDescription>
                  </SheetHeader>

                  <div className="mt-6 flex-1 flex flex-col min-h-0">
                    {carrinho.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <ShoppingCart className="h-16 w-16 mx-auto mb-4 opacity-20" />
                        <p>Seu carrinho está vazio</p>
                      </div>
                    ) : (
                      <>
                        <div className="space-y-3 overflow-y-auto flex-1 pr-1">
                          {carrinho.map(item => (
                            <Card key={item.produto.id}>
                              <CardContent className="p-4">
                                <div className="flex items-start gap-3">
                                  <div className="h-14 w-14 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                                    {item.produto.imagem_url ? (
                                      <img src={item.produto.imagem_url} alt={item.produto.descricao} className="w-full h-full object-contain" />
                                    ) : (
                                      <Package className="h-6 w-6 text-muted-foreground" />
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <h4 className="font-semibold text-sm truncate">{item.produto.descricao}</h4>
                                    <p className="text-xs text-muted-foreground">{item.produto.codigo}</p>
                                    <p className="text-sm font-bold text-primary mt-1">
                                      R$ {formatarPreco(item.produto.preco_venda)}
                                    </p>
                                  </div>
                                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => removerDoCarrinho(item.produto.id)}>
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                                <div className="flex items-center justify-end gap-2 mt-3">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 w-8 p-0"
                                    onClick={() => atualizarQuantidade(item.produto.id, item.quantidade - 1)}
                                  >
                                    <Minus className="h-3.5 w-3.5" />
                                  </Button>
                                  <span className="w-8 text-center font-medium">{item.quantidade}</span>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 w-8 p-0"
                                    onClick={() => atualizarQuantidade(item.produto.id, item.quantidade + 1)}
                                  >
                                    <Plus className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>

                        <div className="border-t pt-4 space-y-4 mt-4">
                          <div className="flex justify-between items-center text-lg font-bold">
                            <span>Total:</span>
                            <span className="text-primary">R$ {formatarPreco(totalCarrinho)}</span>
                          </div>

                          <Button size="lg" className="w-full" onClick={abrirCheckout}>
                            <Send className="h-5 w-5 mr-2" />
                            Finalizar Pedido
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </div>

      {/* Hero */}
      <div className="bg-gradient-to-br from-primary via-primary to-accent text-primary-foreground">
        <div className="container mx-auto px-4 py-10 sm:py-14">
          <div className="max-w-2xl">
            <p className="text-sm font-medium uppercase tracking-widest text-primary-foreground/70 mb-2">Bem-vindo à loja</p>
            <h2 className="text-3xl sm:text-4xl font-bold mb-3">{nomeEmpresa}</h2>
            <p className="text-primary-foreground/85 text-base sm:text-lg mb-6">
              Perfis, kits e acessórios em alumínio com entrega rápida. Faça seu pedido online e acompanhe tudo pelo número gerado.
            </p>
            <div className="relative max-w-lg">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Buscar produtos, kits, códigos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-12 h-12 bg-white text-foreground border-0 shadow-lg rounded-xl"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mt-10 max-w-xl">
            <div className="flex items-center gap-2 text-sm text-primary-foreground/90">
              <Truck className="h-5 w-5 shrink-0" />
              <span>Entrega combinada</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-primary-foreground/90">
              <ShieldCheck className="h-5 w-5 shrink-0" />
              <span>Pedido rastreável</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-primary-foreground/90">
              <PackageSearch className="h-5 w-5 shrink-0" />
              <span>Estoque em tempo real</span>
            </div>
          </div>
        </div>
      </div>

      {/* Category pills + secondary filters */}
      <div className="border-b bg-white/70 backdrop-blur-sm sticky top-[65px] z-30">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 flex-1 min-w-0">
            <Button
              size="sm"
              variant={filtroTipo === "todos" ? "default" : "outline"}
              className="rounded-full shrink-0"
              onClick={() => setFiltroTipo("todos")}
            >
              Todos
            </Button>
            {tipos.map(tipo => (
              <Button
                key={tipo}
                size="sm"
                variant={filtroTipo === tipo ? "default" : "outline"}
                className="rounded-full shrink-0"
                onClick={() => setFiltroTipo(tipo)}
              >
                {tipo}
              </Button>
            ))}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {ligas.length > 0 && (
              <Select value={filtroLiga} onValueChange={setFiltroLiga}>
                <SelectTrigger className="h-9 w-[140px] rounded-full text-sm">
                  <SelectValue placeholder="Liga" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas as ligas</SelectItem>
                  {ligas.map(liga => (
                    <SelectItem key={liga} value={liga}>{liga}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {localizacoes.length > 0 && (
              <Select value={filtroLocalizacao} onValueChange={setFiltroLocalizacao}>
                <SelectTrigger className="h-9 w-[160px] rounded-full text-sm">
                  <div className="flex items-center gap-1.5 truncate">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <SelectValue placeholder="Localização" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas as localizações</SelectItem>
                  {localizacoes.map(local => (
                    <SelectItem key={local} value={local}>{local}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      </div>

      {/* Products Grid */}
      <div className="container mx-auto px-4 py-8 flex-1">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Carregando produtos...</p>
          </div>
        ) : produtosFiltrados.length === 0 ? (
          <div className="text-center py-12">
            <Package className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-20" />
            <p className="text-muted-foreground">Nenhum produto encontrado</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-4">
              {produtosFiltrados.length} {produtosFiltrados.length === 1 ? 'produto encontrado' : 'produtos encontrados'}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 animate-fade-in">
              {produtosFiltrados.map(produto => {
                const estoque = produto.estoque?.quantidade || 0;

                return (
                  <Card
                    key={produto.id}
                    className="group overflow-hidden border shadow-sm hover:shadow-lg transition-all duration-200 cursor-pointer flex flex-col"
                    onClick={() => abrirDetalhe(produto)}
                  >
                    <div className="aspect-square bg-muted relative overflow-hidden flex items-center justify-center">
                      {produto.imagem_url ? (
                        <img
                          src={produto.imagem_url}
                          alt={produto.descricao}
                          className="w-4/5 h-4/5 object-contain mx-auto group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <Package className="h-12 w-12 text-muted-foreground/30" />
                      )}

                      {estoque === 0 ? (
                        <Badge variant="destructive" className="absolute top-2 right-2 text-[10px]">
                          Sem estoque
                        </Badge>
                      ) : estoque <= 5 ? (
                        <Badge className="absolute top-2 right-2 bg-orange-500 text-[10px]">
                          Últimas {estoque}
                        </Badge>
                      ) : null}
                    </div>

                    <CardContent className="p-3 flex flex-col flex-1">
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{produto.codigo}</p>
                      <h3 className="font-semibold text-sm line-clamp-2 min-h-[2.5rem] mt-0.5">{produto.descricao}</h3>

                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {produto.tipo && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">{produto.tipo}</Badge>
                        )}
                        {produto.cor && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">{produto.cor}</Badge>
                        )}
                      </div>

                      <div className="mt-auto pt-2">
                        <p className="text-lg font-bold text-primary">
                          {produto.preco_venda > 0 ? `R$ ${formatarPreco(produto.preco_venda)}` : 'Sob consulta'}
                        </p>

                        {estoque === 0 ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full mt-2 text-xs h-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              const mensagem = `Olá! Gostaria de saber sobre a disponibilidade do produto:\n\n📦 Código: ${produto.codigo}\n📝 Nome: ${produto.descricao}\n📍 Localização: ${produto.localizacao || 'Não informada'}\n💰 Preço: R$ ${produto.preco_venda > 0 ? formatarPreco(produto.preco_venda) : '0,00'}\n\nHá possibilidade de produção?`;
                              window.open(`https://wa.me/${whatsappEmpresa}?text=${encodeURIComponent(mensagem)}`, '_blank');
                            }}
                          >
                            Consultar
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            className="w-full mt-2 text-xs h-8"
                            disabled={produto.preco_venda === 0}
                            onClick={(e) => {
                              e.stopPropagation();
                              adicionarAoCarrinho(produto);
                            }}
                          >
                            <ShoppingCart className="h-3.5 w-3.5 mr-1.5" />
                            Adicionar
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <footer className="bg-foreground text-background mt-auto">
        <div className="container mx-auto px-4 py-10 grid grid-cols-1 sm:grid-cols-3 gap-8">
          <div>
            <h4 className="font-bold text-lg mb-2">{nomeEmpresa}</h4>
            <p className="text-sm text-background/70">
              Perfis, kits e acessórios em alumínio. Faça seu pedido pelo catálogo online.
            </p>
          </div>
          <div className="space-y-2">
            <h5 className="font-semibold text-sm uppercase tracking-wide text-background/60">Contato</h5>
            {whatsappEmpresa && (
              <a
                href={`https://wa.me/${whatsappEmpresa}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 text-sm text-background/80 hover:text-background transition-colors"
              >
                <Phone className="h-4 w-4" /> WhatsApp
              </a>
            )}
            {emailEmpresa && (
              <p className="flex items-center gap-2 text-sm text-background/80">
                <Mail className="h-4 w-4" /> {emailEmpresa}
              </p>
            )}
            {enderecoEmpresa && (
              <p className="flex items-center gap-2 text-sm text-background/80">
                <MapPinned className="h-4 w-4" /> {enderecoEmpresa}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <h5 className="font-semibold text-sm uppercase tracking-wide text-background/60">Pedidos</h5>
            <Link to="/acompanhar-pedido" className="flex items-center gap-2 text-sm text-background/80 hover:text-background transition-colors">
              <ClipboardList className="h-4 w-4" /> Acompanhar meu pedido
            </Link>
          </div>
        </div>
        <div className="border-t border-background/10 py-4 text-center text-xs text-background/50">
          © {new Date().getFullYear()} {nomeEmpresa}. Todos os direitos reservados.
        </div>
      </footer>

      {/* Dialog de Detalhe do Produto */}
      <Dialog open={!!produtoDetalhe} onOpenChange={(open) => !open && setProdutoDetalhe(null)}>
        <DialogContent className="max-w-lg">
          {produtoDetalhe && (() => {
            const estoque = produtoDetalhe.estoque?.quantidade || 0;
            return (
              <>
                <DialogHeader>
                  <DialogTitle>{produtoDetalhe.descricao}</DialogTitle>
                  <DialogDescription>Código: {produtoDetalhe.codigo}</DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-[120px_1fr] gap-4">
                  <div className="aspect-square bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                    {produtoDetalhe.imagem_url ? (
                      <img src={produtoDetalhe.imagem_url} alt={produtoDetalhe.descricao} className="w-full h-full object-contain" />
                    ) : (
                      <Package className="h-10 w-10 text-muted-foreground/30" />
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-1.5">
                      {produtoDetalhe.tipo && <Badge variant="outline">{produtoDetalhe.tipo}</Badge>}
                      {produtoDetalhe.cor && <Badge variant="outline">{produtoDetalhe.cor}</Badge>}
                      {produtoDetalhe.localizacao && (
                        <Badge variant="outline" className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {produtoDetalhe.localizacao}
                        </Badge>
                      )}
                    </div>
                    {produtoDetalhe.peso && produtoDetalhe.peso > 0 && (
                      <p className="text-xs text-muted-foreground">Peso: {produtoDetalhe.peso.toFixed(3)}kg</p>
                    )}
                    <p className="text-2xl font-bold text-primary">
                      {produtoDetalhe.preco_venda > 0 ? `R$ ${formatarPreco(produtoDetalhe.preco_venda)}` : 'Sob consulta'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {estoque > 0 ? `${estoque} unidade(s) em estoque` : 'Sem estoque no momento'}
                    </p>
                  </div>
                </div>

                <Separator />

                {estoque === 0 ? (
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() => {
                      const mensagem = `Olá! Gostaria de saber sobre a disponibilidade do produto:\n\n📦 Código: ${produtoDetalhe.codigo}\n📝 Nome: ${produtoDetalhe.descricao}\n📍 Localização: ${produtoDetalhe.localizacao || 'Não informada'}\n💰 Preço: R$ ${produtoDetalhe.preco_venda > 0 ? formatarPreco(produtoDetalhe.preco_venda) : '0,00'}\n\nHá possibilidade de produção?`;
                      window.open(`https://wa.me/${whatsappEmpresa}?text=${encodeURIComponent(mensagem)}`, '_blank');
                    }}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Consultar Disponibilidade
                  </Button>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="flex items-center border rounded-lg">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-10 w-10 p-0"
                        onClick={() => setQuantidadeDetalhe(q => Math.max(1, q - 1))}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="w-10 text-center font-medium">{quantidadeDetalhe}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-10 w-10 p-0"
                        onClick={() => setQuantidadeDetalhe(q => Math.min(estoque, q + 1))}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <Button
                      className="flex-1"
                      disabled={produtoDetalhe.preco_venda === 0}
                      onClick={() => {
                        adicionarAoCarrinho(produtoDetalhe, quantidadeDetalhe);
                        setProdutoDetalhe(null);
                      }}
                    >
                      <ShoppingCart className="h-4 w-4 mr-2" />
                      Adicionar ao Carrinho
                    </Button>
                  </div>
                )}
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Dialog de Checkout */}
      <Dialog
        open={checkoutAberto}
        onOpenChange={(open) => {
          setCheckoutAberto(open);
          if (!open) {
            setPedidoConfirmado(null);
            setDadosCliente({ nome: "", email: "", telefone: "", observacoes: "" });
          }
        }}
      >
        <DialogContent className="max-w-md">
          {pedidoConfirmado ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Send className="h-5 w-5 text-primary" />
                  Pedido enviado!
                </DialogTitle>
                <DialogDescription>
                  Seu pedido <strong>{pedidoConfirmado}</strong> foi recebido e está aguardando análise.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3">
                <Button asChild size="lg" className="w-full">
                  <Link to={`/acompanhar-pedido?numero=${encodeURIComponent(pedidoConfirmado)}`}>
                    Acompanhar meu pedido
                  </Link>
                </Button>
                <Button variant="outline" size="lg" className="w-full" onClick={() => setCheckoutAberto(false)}>
                  Fechar
                </Button>
              </div>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Finalizar Pedido
                </DialogTitle>
                <DialogDescription>
                  Preencha seus dados para enviar o pedido
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome Completo *</Label>
                  <Input
                    id="nome"
                    value={dadosCliente.nome}
                    onChange={(e) => setDadosCliente({ ...dadosCliente, nome: e.target.value })}
                    placeholder="Seu nome completo"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="telefone">Telefone/WhatsApp *</Label>
                  <Input
                    id="telefone"
                    value={dadosCliente.telefone}
                    onChange={(e) => setDadosCliente({ ...dadosCliente, telefone: e.target.value })}
                    placeholder="(00) 00000-0000"
                  />
                  <p className="text-xs text-muted-foreground">Você vai usar esse número para acompanhar o pedido depois.</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">E-mail (opcional)</Label>
                  <Input
                    id="email"
                    type="email"
                    value={dadosCliente.email}
                    onChange={(e) => setDadosCliente({ ...dadosCliente, email: e.target.value })}
                    placeholder="seu@email.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="observacoes">Observações (opcional)</Label>
                  <Input
                    id="observacoes"
                    value={dadosCliente.observacoes}
                    onChange={(e) => setDadosCliente({ ...dadosCliente, observacoes: e.target.value })}
                    placeholder="Alguma observação sobre o pedido?"
                  />
                </div>

                <div className="border-t pt-4">
                  <div className="flex justify-between items-center mb-4">
                    <span className="font-semibold">Total do Pedido:</span>
                    <span className="text-xl font-bold text-primary">
                      R$ {formatarPreco(totalCarrinho)}
                    </span>
                  </div>

                  <Button
                    size="lg"
                    className="w-full"
                    onClick={finalizarPedido}
                    disabled={enviandoPedido}
                  >
                    {enviandoPedido ? (
                      <>Enviando...</>
                    ) : (
                      <>
                        <Send className="h-5 w-5 mr-2" />
                        Enviar Pedido
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
