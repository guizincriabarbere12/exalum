// @ts-nocheck - Temporary fix until Supabase types are regenerated
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Search, Package, ShoppingCart, Plus, Minus, Trash2, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface Product {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  categoria: string | null;
  preco: number;
  peso: number | null;
  imagem_url: string | null;
  estoque: number;
}

interface Kit {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  preco_total: number;
  estoque_disponivel: number;
}

interface CartItem {
  id: string;
  tipo: 'produto' | 'kit';
  nome: string;
  quantidade: number;
  preco_unitario: number;
  subtotal: number;
}

export default function CatalogoCliente() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [kits, setKits] = useState<Kit[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCart, setShowCart] = useState(false);
  const [observacoes, setObservacoes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchProducts();
    fetchKits();
    loadCart();
  }, []);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('produtos')
        .select('id, codigo, nome, descricao, categoria, preco, peso, imagem_url, estoque')
        .eq('ativo', true)
        .gt('estoque', 0)
        .order('nome', { ascending: true });

      if (error) throw error;
      setProducts(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar produtos",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const fetchKits = async () => {
    try {
      const { data, error } = await supabase
        .from('kits_estoque_disponivel')
        .select('kit_id, codigo, nome, descricao, preco_total, estoque_disponivel')
        .gt('estoque_disponivel', 0)
        .order('nome');

      if (error) throw error;
      setKits(data?.map(k => ({
        id: k.kit_id,
        codigo: k.codigo,
        nome: k.nome,
        descricao: k.descricao,
        preco_total: k.preco_total,
        estoque_disponivel: k.estoque_disponivel
      })) || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar kits",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadCart = () => {
    const savedCart = localStorage.getItem('cart_cliente');
    if (savedCart) {
      setCart(JSON.parse(savedCart));
    }
  };

  const saveCart = (newCart: CartItem[]) => {
    setCart(newCart);
    localStorage.setItem('cart_cliente', JSON.stringify(newCart));
  };

  const addToCart = (item: Product | Kit, tipo: 'produto' | 'kit') => {
    const estoqueDisponivel = tipo === 'produto'
      ? (item as Product).estoque
      : (item as Kit).estoque_disponivel;

    const existingItem = cart.find(i => i.id === item.id && i.tipo === tipo);

    if (existingItem) {
      const novaQuantidade = existingItem.quantidade + 1;

      if (novaQuantidade > estoqueDisponivel) {
        toast({
          title: "Estoque insuficiente",
          description: `Apenas ${estoqueDisponivel} unidade(s) disponível(is)`,
          variant: "destructive",
        });
        return;
      }

      const newCart = cart.map(i =>
        i.id === item.id && i.tipo === tipo
          ? { ...i, quantidade: novaQuantidade, subtotal: novaQuantidade * i.preco_unitario }
          : i
      );
      saveCart(newCart);
    } else {
      if (estoqueDisponivel < 1) {
        toast({
          title: "Item indisponível",
          description: "Este item não está disponível no momento",
          variant: "destructive",
        });
        return;
      }

      const preco = tipo === 'produto' ? (item as Product).preco : (item as Kit).preco_total;
      const newItem: CartItem = {
        id: item.id,
        tipo,
        nome: item.nome,
        quantidade: 1,
        preco_unitario: preco,
        subtotal: preco
      };
      saveCart([...cart, newItem]);
    }

    toast({
      title: "Adicionado ao carrinho",
      description: `${item.nome} foi adicionado ao carrinho`,
    });
  };

  const updateQuantity = (index: number, delta: number) => {
    const item = cart[index];
    if (!item) return;

    const novaQuantidade = Math.max(1, item.quantidade + delta);

    const estoqueDisponivel = item.tipo === 'produto'
      ? produtos.find(p => p.id === item.id)?.estoque || 0
      : kits.find(k => k.id === item.id)?.estoque_disponivel || 0;

    if (novaQuantidade > estoqueDisponivel) {
      toast({
        title: "Estoque insuficiente",
        description: `Apenas ${estoqueDisponivel} unidade(s) disponível(is)`,
        variant: "destructive",
      });
      return;
    }

    const newCart = cart.map((item, i) => {
      if (i === index) {
        return {
          ...item,
          quantidade: novaQuantidade,
          subtotal: novaQuantidade * item.preco_unitario
        };
      }
      return item;
    });
    saveCart(newCart);
  };

  const removeFromCart = (index: number) => {
    const newCart = cart.filter((_, i) => i !== index);
    saveCart(newCart);
  };

  const finalizarPedido = async () => {
    if (cart.length === 0) {
      toast({
        title: "Carrinho vazio",
        description: "Adicione itens ao carrinho antes de finalizar o pedido",
        variant: "destructive",
      });
      return;
    }

    if (!user) {
      toast({
        title: "Não autenticado",
        description: "Você precisa estar logado para fazer um pedido",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    try {
      // Preparar itens do pedido
      const itensJson = cart.map(item => ({
        produto_id: item.tipo === 'produto' ? item.id : null,
        kit_id: item.tipo === 'kit' ? item.id : null,
        quantidade: item.quantidade,
        preco_unitario: item.preco_unitario
      }));

      // Chamar função para criar pedido
      const { data, error } = await supabase.rpc('criar_pedido_catalogo', {
        cliente_id_param: user.id,
        itens_json: itensJson,
        observacoes_param: observacoes || null
      });

      if (error) throw error;

      if (data && !data.success) {
        toast({
          title: "Erro ao criar pedido",
          description: data.message,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Pedido criado!",
        description: data.message || "Seu pedido foi enviado e está aguardando aprovação",
      });

      // Limpar carrinho
      saveCart([]);
      setObservacoes("");
      setShowCart(false);

      // Recarregar produtos para atualizar estoque
      fetchProducts();
      fetchKits();
    } catch (error: any) {
      toast({
        title: "Erro ao finalizar pedido",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const totalCarrinho = cart.reduce((sum, item) => sum + item.subtotal, 0);

  const filteredProducts = products.filter(p =>
    p.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.codigo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredKits = kits.filter(k =>
    k.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    k.codigo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Catálogo de Produtos</h2>
          <p className="text-muted-foreground">Navegue e adicione produtos ao carrinho</p>
        </div>
        <Button
          size="lg"
          onClick={() => setShowCart(true)}
          className="relative"
        >
          <ShoppingCart className="h-5 w-5 mr-2" />
          Carrinho
          {cart.length > 0 && (
            <Badge className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0 flex items-center justify-center">
              {cart.length}
            </Badge>
          )}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar produtos ou kits..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Carregando produtos...</p>
            </div>
          ) : (
            <div className="space-y-8">
              {/* PRODUTOS */}
              {filteredProducts.length > 0 && (
                <div>
                  <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Produtos
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredProducts.map((product) => (
                      <Card key={product.id} className="hover:shadow-lg transition-shadow">
                        <CardContent className="p-4">
                          {product.imagem_url && (
                            <img
                              src={product.imagem_url}
                              alt={product.nome}
                              className="w-full h-48 object-cover rounded-lg mb-4"
                            />
                          )}
                          <div className="space-y-2">
                            <div>
                              <h4 className="font-semibold">{product.nome}</h4>
                              <p className="text-sm text-muted-foreground">{product.codigo}</p>
                            </div>
                            {product.descricao && (
                              <p className="text-sm text-muted-foreground line-clamp-2">
                                {product.descricao}
                              </p>
                            )}
                            <div className="flex items-center justify-between">
                              <span className="text-2xl font-bold text-primary">
                                R$ {product.preco.toFixed(2)}
                              </span>
                              <Badge variant="outline">
                                Estoque: {product.estoque}
                              </Badge>
                            </div>
                            <Button
                              className="w-full"
                              onClick={() => addToCart(product, 'produto')}
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              Adicionar
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* KITS */}
              {filteredKits.length > 0 && (
                <div>
                  <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Kits
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredKits.map((kit) => (
                      <Card key={kit.id} className="hover:shadow-lg transition-shadow border-primary/20">
                        <CardContent className="p-4">
                          <div className="space-y-2">
                            <div>
                              <Badge variant="secondary" className="mb-2">KIT</Badge>
                              <h4 className="font-semibold">{kit.nome}</h4>
                              <p className="text-sm text-muted-foreground">{kit.codigo}</p>
                            </div>
                            {kit.descricao && (
                              <p className="text-sm text-muted-foreground line-clamp-2">
                                {kit.descricao}
                              </p>
                            )}
                            <div className="flex items-center justify-between">
                              <span className="text-2xl font-bold text-primary">
                                R$ {kit.preco_total.toFixed(2)}
                              </span>
                              <Badge variant="outline">
                                Disponível: {kit.estoque_disponivel}
                              </Badge>
                            </div>
                            <Button
                              className="w-full"
                              onClick={() => addToCart(kit, 'kit')}
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              Adicionar
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {filteredProducts.length === 0 && filteredKits.length === 0 && (
                <div className="text-center py-12">
                  <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Nenhum produto ou kit encontrado</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* DIALOG CARRINHO */}
      <Dialog open={showCart} onOpenChange={setShowCart}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Carrinho de Compras</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {cart.length === 0 ? (
              <div className="text-center py-8">
                <ShoppingCart className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Seu carrinho está vazio</p>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {cart.map((item, index) => (
                    <Card key={index}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold">{item.nome}</h4>
                              {item.tipo === 'kit' && (
                                <Badge variant="secondary" className="text-xs">KIT</Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              R$ {item.preco_unitario.toFixed(2)} cada
                            </p>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                              <Button
                                size="icon"
                                variant="outline"
                                onClick={() => updateQuantity(index, -1)}
                              >
                                <Minus className="h-4 w-4" />
                              </Button>
                              <span className="font-semibold w-8 text-center">
                                {item.quantidade}
                              </span>
                              <Button
                                size="icon"
                                variant="outline"
                                onClick={() => updateQuantity(index, 1)}
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                            <div className="w-24 text-right">
                              <p className="font-bold">R$ {item.subtotal.toFixed(2)}</p>
                            </div>
                            <Button
                              size="icon"
                              variant="destructive"
                              onClick={() => removeFromCart(index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="space-y-4 pt-4 border-t">
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Observações (opcional)
                    </label>
                    <Textarea
                      placeholder="Informações adicionais sobre o pedido..."
                      value={observacoes}
                      onChange={(e) => setObservacoes(e.target.value)}
                      rows={3}
                    />
                  </div>

                  <div className="flex items-center justify-between text-xl font-bold">
                    <span>Total:</span>
                    <span className="text-primary">R$ {totalCarrinho.toFixed(2)}</span>
                  </div>

                  <Button
                    className="w-full"
                    size="lg"
                    onClick={finalizarPedido}
                    disabled={submitting}
                  >
                    <Send className="h-5 w-5 mr-2" />
                    {submitting ? "Enviando..." : "Finalizar Pedido"}
                  </Button>

                  <p className="text-xs text-center text-muted-foreground">
                    Seu pedido será enviado para aprovação do administrador
                  </p>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
