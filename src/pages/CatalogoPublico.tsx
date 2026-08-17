import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { ShoppingCart, Search, Package, Filter, X, Send, User, MapPin } from "lucide-react";
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
  localizacao: string | null; // Adicionado campo localizacao
  estoque?: { quantidade: number };
  item_tipo: 'produto' | 'kit';
  nome?: string;
}

interface Kit {
  id: string;
  codigo: string;
  nome: string;
  descricao: string;
  preco_total: number;
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
  const [enviandoPedido, setEnviandoPedido] = useState(false);
  const [logoEmpresa, setLogoEmpresa] = useState<string | null>(null);
  const [nomeEmpresa, setNomeEmpresa] = useState<string>("Catálogo");
  const [whatsappEmpresa, setWhatsappEmpresa] = useState<string>("5511999999999");
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
        .select('logo_url, nome_empresa, telefone')
        .single();

      if (error) throw error;
      if (data) {
        setLogoEmpresa(data.logo_url);
        setNomeEmpresa(data.nome_empresa || "Catálogo");
        setWhatsappEmpresa(data.telefone || "5585997311925");
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
        localizacao: p.localizacao || null, // Mapeando o campo localizacao
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
        localizacao: null, // Kits não têm localização
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

  const adicionarAoCarrinho = (produto: Produto) => {
    const estoqueDisponivel = produto.estoque?.quantidade || 0;
    const itemExistente = carrinho.find(item => item.produto.id === produto.id);

    if (itemExistente) {
      const novaQuantidade = itemExistente.quantidade + 1;

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

      setCarrinho([...carrinho, { produto, quantidade: 1 }]);
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

  const produtosFiltrados = produtos.filter(produto => {
    const matchSearch = produto.descricao.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       produto.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       (produto.nome && produto.nome.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchTipo = filtroTipo === "todos" || produto.tipo === filtroTipo;
    const matchLiga = filtroLiga === "todos" || produto.liga === filtroLiga;
    const matchLocalizacao = filtroLocalizacao === "todos" || produto.localizacao === filtroLocalizacao;
    
    return matchSearch && matchTipo && matchLiga && matchLocalizacao;
  });

  const tipos = [...new Set(produtos.map(p => p.tipo).filter(Boolean))];
  const ligas = [...new Set(produtos.map(p => p.liga).filter(Boolean))];
  const localizacoes = [...new Set(produtos.map(p => p.localizacao).filter(Boolean))];

  const totalCarrinho = carrinho.reduce((total, item) => 
    total + (item.produto.preco_venda * item.quantidade), 0
  );

  const totalItens = carrinho.reduce((total, item) => total + item.quantidade, 0);

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
        subtotal: item.quantidade * item.produto.preco_venda,
      }));

      const { error: itensError } = await supabase
        .from('pedido_itens')
        .insert(itens);

      if (itensError) throw itensError;

      toast({
        title: "Pedido enviado!",
        description: `Seu pedido ${numeroPedido} foi enviado com sucesso. Aguarde a confirmação.`,
      });

      setCarrinho([]);
      setDadosCliente({ nome: "", email: "", telefone: "", observacoes: "" });
      setCheckoutAberto(false);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50/40 to-purple-50/30">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-2xl border-b border-primary/10 shadow-xl">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              {logoEmpresa ? (
                <img
                  src={logoEmpresa}
                  alt="Logo"
                  className="h-16 w-auto object-contain"
                />
              ) : (
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg">
                  <Package className="h-7 w-7 text-white" />
                </div>
              )}
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  {nomeEmpresa}
                </h1>
                <p className="text-sm text-muted-foreground">Catálogo de Produtos</p>
              </div>
            </div>

            <Sheet open={carrinhoAberto} onOpenChange={setCarrinhoAberto}>
              <SheetTrigger asChild>
                <Button size="lg" className="bg-gradient-to-r from-primary to-accent hover:shadow-lg hover:scale-105 transition-all duration-200 relative h-12 px-6">
                  <ShoppingCart className="h-5 w-5 mr-2" />
                  <span className="hidden sm:inline">Carrinho</span>
                  {totalItens > 0 && (
                    <Badge className="absolute -top-2 -right-2 h-6 w-6 flex items-center justify-center p-0 bg-destructive animate-pulse">
                      {totalItens}
                    </Badge>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent className="w-full sm:max-w-lg">
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5" />
                    Meu Carrinho
                  </SheetTitle>
                  <SheetDescription>
                    {totalItens} {totalItens === 1 ? 'item' : 'itens'} no carrinho
                  </SheetDescription>
                </SheetHeader>

                <div className="mt-8 space-y-4">
                  {carrinho.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <ShoppingCart className="h-16 w-16 mx-auto mb-4 opacity-20" />
                      <p>Seu carrinho está vazio</p>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                        {carrinho.map(item => (
                          <Card key={item.produto.id}>
                            <CardContent className="p-4">
                              <div className="flex items-start gap-3">
                                <div className="flex-1">
                                  <h4 className="font-semibold text-sm">{item.produto.descricao}</h4>
                                  <p className="text-xs text-muted-foreground">{item.produto.codigo}</p>
                                  {item.produto.nome && item.produto.nome !== item.produto.descricao && (
                                    <p className="text-xs text-muted-foreground mt-1">{item.produto.nome}</p>
                                  )}
                                  <p className="text-sm font-bold text-primary mt-1">
                                    R$ {item.produto.preco_venda.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                  </p>
                                </div>
                                
                                <div className="flex items-center gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => atualizarQuantidade(item.produto.id, item.quantidade - 1)}
                                  >
                                    -
                                  </Button>
                                  <span className="w-8 text-center font-medium">{item.quantidade}</span>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => atualizarQuantidade(item.produto.id, item.quantidade + 1)}
                                  >
                                    +
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => removerDoCarrinho(item.produto.id)}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>

                      <div className="border-t pt-4 space-y-4">
                        <div className="flex justify-between items-center text-lg font-bold">
                          <span>Total:</span>
                          <span className="text-primary">
                            R$ {totalCarrinho.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
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

      {/* Filters */}
      <div className="container mx-auto px-4 py-6">
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl border border-primary/10 shadow-xl p-6 space-y-4 hover:shadow-2xl transition-shadow">
          <div className="flex items-center gap-2 text-base font-bold">
            <div className="p-2 rounded-lg bg-gradient-to-br from-primary/10 to-accent/10">
              <Filter className="h-5 w-5 text-primary" />
            </div>
            <span>Filtrar Produtos</span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative md:col-span-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Buscar produtos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-12 h-12 border-2 border-border/50 focus:border-primary focus:ring-4 focus:ring-primary/10 rounded-lg"
              />
            </div>

            <Select value={filtroTipo} onValueChange={setFiltroTipo}>
              <SelectTrigger className="h-12 border-2 border-border/50 focus:ring-4 focus:ring-primary/10">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os tipos</SelectItem>
                {tipos.map(tipo => (
                  <SelectItem key={tipo} value={tipo!}>{tipo}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filtroLiga} onValueChange={setFiltroLiga}>
              <SelectTrigger className="h-12 border-2 border-border/50 focus:ring-4 focus:ring-primary/10">
                <SelectValue placeholder="Liga" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas as ligas</SelectItem>
                {ligas.map(liga => (
                  <SelectItem key={liga} value={liga!}>{liga}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Filtro de Localização */}
            <Select value={filtroLocalizacao} onValueChange={setFiltroLocalizacao}>
              <SelectTrigger className="h-12 border-2 border-border/50 focus:ring-4 focus:ring-primary/10">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  <SelectValue placeholder="Localização" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas as localizações</SelectItem>
                {localizacoes.map(local => (
                  <SelectItem key={local} value={local!}>{local}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Products Grid */}
      <div className="container mx-auto px-4 pb-12">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-fade-in">
            {produtosFiltrados.map(produto => {
              const estoque = produto.estoque?.quantidade || 0;
              
              return (
                <Card key={produto.id} className="group hover-lift overflow-hidden border border-primary/10 shadow-xl bg-white/95 backdrop-blur-sm hover:shadow-2xl transition-all duration-300 hover:border-primary/30">
                  <div className="aspect-square bg-gradient-to-br from-blue-100 via-indigo-50 to-purple-100 relative overflow-hidden flex items-center justify-center">
                    {produto.imagem_url ? (
                      <img
                        src={produto.imagem_url}
                        alt={produto.descricao}
                        className="w-4/5 h-4/5 object-contain mx-auto group-hover:scale-110 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="h-16 w-16 text-primary/20" />
                      </div>
                    )}

                    {estoque > 0 && (
                      <Badge className="absolute top-3 right-3 bg-success shadow-lg">
                        {estoque} disponível
                      </Badge>
                    )}
                    {estoque === 0 && (
                      <Badge variant="destructive" className="absolute top-3 right-3 shadow-lg">
                        Sem Estoque
                      </Badge>
                    )}
                  </div>

                  <CardContent className="p-5 space-y-3">
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Cód: {produto.codigo}</p>
                      <h3 className="font-bold line-clamp-2 min-h-[3rem] text-lg">{produto.descricao}</h3>
                      {produto.nome && produto.nome !== produto.descricao && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{produto.nome}</p>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {produto.tipo && (
                        <Badge variant="outline" className="border-primary/30 text-primary text-xs">
                          {produto.tipo}
                        </Badge>
                      )}
                      {produto.cor && (
                        <Badge variant="outline" className="border-primary/30 text-primary text-xs">
                          {produto.cor}
                        </Badge>
                      )}
                      
                      {/* Exibindo a localização do produto */}
                      {produto.localizacao && (
                        <Badge variant="outline" className="border-accent/30 text-accent text-xs flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {produto.localizacao}
                        </Badge>
                      )}
                    </div>

                    <div className="border-t border-border/50 pt-3 mt-2">
                      {/* Só mostra o peso se for maior que zero e não for nulo */}
                      {produto.peso && produto.peso > 0 ? (
                        <p className="text-xs text-muted-foreground mb-2">
                          Peso: {produto.peso.toFixed(3)}kg
                        </p>
                      ) : null}

                      <div className="mb-3">
                        <p className="text-xs text-muted-foreground mb-1">Preço</p>
                        <p className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                          R$ {produto.preco_venda > 0 ? produto.preco_venda.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00'}
                        </p>
                      </div>

                      {estoque === 0 ? (
                        <div className="space-y-2">
                          <Button
                            className="w-full h-12 bg-gradient-to-r from-orange-500 to-orange-600 hover:shadow-xl hover:scale-105 transition-all duration-200 text-base font-semibold"
                            onClick={() => {
                              const mensagem = `Olá! Gostaria de saber sobre a disponibilidade do produto:\n\n📦 Código: ${produto.codigo}\n📝 Nome: ${produto.descricao}\n📍 Localização: ${produto.localizacao || 'Não informada'}\n💰 Preço: R$ ${produto.preco_venda > 0 ? produto.preco_venda.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00'}\n\nHá possibilidade de produção?`;
                              window.open(`https://wa.me/${whatsappEmpresa}?text=${encodeURIComponent(mensagem)}`, '_blank');
                            }}
                          >
                            <Send className="h-5 w-5 mr-2" />
                            Consultar Disponibilidade
                          </Button>
                          <p className="text-xs text-center text-muted-foreground">
                            Entre em contato para verificar possibilidade de produção
                          </p>
                        </div>
                      ) : (
                        <Button
                          className="w-full h-12 bg-gradient-to-r from-primary to-accent hover:shadow-xl hover:scale-105 transition-all duration-200 text-base font-semibold"
                          onClick={() => adicionarAoCarrinho(produto)}
                          disabled={produto.preco_venda === 0}
                        >
                          <ShoppingCart className="h-5 w-5 mr-2" />
                          {produto.preco_venda === 0 ? 'Preço Indisponível' : 'Adicionar ao Carrinho'}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Dialog de Checkout */}
      <Dialog open={checkoutAberto} onOpenChange={setCheckoutAberto}>
        <DialogContent className="max-w-md">
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
                  R$ {totalCarrinho.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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
        </DialogContent>
      </Dialog>
    </div>
  );
}