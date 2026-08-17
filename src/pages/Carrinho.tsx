// @ts-nocheck - Temporary fix until Supabase types are regenerated
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ShoppingCart, Trash2, Plus, Minus, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

interface CartItem {
  produto_id: string;
  descricao: string;
  quantidade: number;
  preco_unitario: number;
  peso?: number;
}

export default function Carrinho() {
  const navigate = useNavigate();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [clienteNome, setClienteNome] = useState("");
  const [clienteTelefone, setClienteTelefone] = useState("");
  const [clienteEmail, setClienteEmail] = useState("");
  const [clienteEndereco, setClienteEndereco] = useState("");
  const [clienteCpfCnpj, setClienteCpfCnpj] = useState("");
  const [observacoes, setObservacoes] = useState("");

  useEffect(() => {
    loadCart();
  }, []);

  const loadCart = () => {
    const savedCart = localStorage.getItem('cart');
    if (savedCart) {
      setCart(JSON.parse(savedCart));
    }
  };

  const saveCart = (newCart: CartItem[]) => {
    setCart(newCart);
    localStorage.setItem('cart', JSON.stringify(newCart));
  };

  const updateQuantity = (produto_id: string, delta: number) => {
    const newCart = cart.map(item =>
      item.produto_id === produto_id
        ? { ...item, quantidade: Math.max(1, item.quantidade + delta) }
        : item
    );
    saveCart(newCart);
  };

  const removeItem = (produto_id: string) => {
    const newCart = cart.filter(item => item.produto_id !== produto_id);
    saveCart(newCart);
    toast({
      title: "Item removido",
      description: "O produto foi removido do carrinho",
    });
  };

  const finalizarPedido = async () => {
    if (cart.length === 0) {
      toast({
        title: "Carrinho vazio",
        description: "Adicione produtos ao carrinho antes de finalizar",
        variant: "destructive",
      });
      return;
    }

    // Validar dados do cliente
    if (!clienteNome.trim() || !clienteTelefone.trim() || !clienteEmail.trim()) {
      toast({
        title: "Dados incompletos",
        description: "Por favor, preencha seus dados de contato",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Buscar ou criar cliente associado ao usuário
      let { data: cliente, error: clienteError } = await supabase
        .from('clientes')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (clienteError) throw clienteError;

      if (!cliente) {
        // Criar cliente com os dados preenchidos
        const { data: newCliente, error: createError } = await supabase
          .from('clientes')
          .insert({
            user_id: user.id,
            nome: clienteNome,
            cpf_cnpj: clienteCpfCnpj || '00000000000',
            email: clienteEmail,
            telefone: clienteTelefone,
            endereco: clienteEndereco,
          })
          .select()
          .single();

        if (createError) throw createError;
        cliente = newCliente;
      } else {
        // Atualizar dados do cliente existente
        const { error: updateError } = await supabase
          .from('clientes')
          .update({
            nome: clienteNome,
            cpf_cnpj: clienteCpfCnpj || cliente.cpf_cnpj,
            email: clienteEmail,
            telefone: clienteTelefone,
            endereco: clienteEndereco,
          })
          .eq('id', cliente.id);

        if (updateError) throw updateError;
      }

      // Gerar número do pedido
      const { data: numeroPedido, error: numeroError } = await supabase
        .rpc('gerar_numero_pedido');

      if (numeroError) throw numeroError;

      // Criar pedido
      const { data: pedido, error: pedidoError } = await supabase
        .from('pedidos')
        .insert({
          numero: numeroPedido,
          cliente_id: cliente.id,
          status: 'pendente',
          valor_total: total,
          data: new Date().toISOString().split('T')[0],
          observacoes: observacoes || null,
        })
        .select()
        .single();

      if (pedidoError) throw pedidoError;

      // Adicionar itens do pedido
      const itens = cart.map(item => ({
        pedido_id: pedido.id,
        produto_id: item.produto_id,
        quantidade: item.quantidade,
        preco_unitario: item.preco_unitario,
        subtotal: item.quantidade * item.preco_unitario,
      }));

      const { error: itensError } = await supabase
        .from('pedido_itens')
        .insert(itens);

      if (itensError) throw itensError;

      // Limpar carrinho e formulário
      localStorage.removeItem('cart');
      setCart([]);
      setClienteNome("");
      setClienteTelefone("");
      setClienteEmail("");
      setClienteEndereco("");
      setClienteCpfCnpj("");
      setObservacoes("");

      toast({
        title: "Pedido realizado!",
        description: `Pedido ${numeroPedido} criado com sucesso. Nossa equipe entrará em contato em breve.`,
      });

      navigate('/meus-pedidos');
    } catch (error: any) {
      toast({
        title: "Erro ao finalizar pedido",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const subtotal = cart.reduce((sum, item) => {
    if (item.peso && item.peso > 0) {
      return sum + (item.quantidade * item.peso * item.preco_unitario);
    }
    return sum + (item.quantidade * item.preco_unitario);
  }, 0);
  const total = subtotal;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 animate-fade-in">
      <div className="container mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Carrinho de Compras</h2>
          <p className="text-muted-foreground">Revise seu pedido antes de finalizar</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2 border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gradient-to-br from-primary/10 to-accent/10">
                  <ShoppingCart className="h-5 w-5 text-primary" />
                </div>
                <span>Itens do Pedido</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {cart.length === 0 ? (
                <div className="text-center py-16">
                  <ShoppingCart className="h-20 w-20 text-muted-foreground/20 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-2">Seu carrinho está vazio</h3>
                  <p className="text-muted-foreground mb-6">Adicione produtos para continuar</p>
                  <Button onClick={() => navigate('/catalogo')} className="bg-gradient-to-r from-primary to-accent hover:shadow-lg hover:scale-105 transition-all duration-200">
                    Ver Catálogo
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {cart.map((item) => (
                    <div
                      key={item.produto_id}
                      className="flex items-center gap-4 p-5 border-0 rounded-xl bg-gradient-to-br from-white to-slate-50/50 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="flex-1">
                        <h3 className="font-bold text-foreground text-lg">{item.descricao}</h3>
                        <p className="text-sm text-primary font-semibold">
                          R$ {item.preco_unitario.toFixed(2)} por kg
                        </p>
                        {item.peso && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {item.peso} kg/un × {item.quantidade} = {(item.peso * item.quantidade).toFixed(2)} kg
                          </p>
                        )}
                      </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => updateQuantity(item.produto_id, -1)}
                        disabled={item.quantidade <= 1}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="w-12 text-center font-semibold">
                        {item.quantidade}
                      </span>
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => updateQuantity(item.produto_id, 1)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>

                      <div className="text-right min-w-[100px]">
                        <p className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                          R$ {item.peso && item.peso > 0
                            ? (item.quantidade * item.peso * item.preco_unitario).toFixed(2)
                            : (item.quantidade * item.preco_unitario).toFixed(2)}
                        </p>
                      </div>

                      <Button
                        size="icon"
                        variant="destructive"
                        onClick={() => removeItem(item.produto_id)}
                        className="hover:scale-110 transition-transform"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-primary/10 to-accent/10">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <span>Seus Dados para Contato</span>
                </CardTitle>
              </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome Completo *</Label>
                <Input
                  id="nome"
                  placeholder="Seu nome completo"
                  value={clienteNome}
                  onChange={(e) => setClienteNome(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="telefone">Telefone *</Label>
                <Input
                  id="telefone"
                  placeholder="(00) 00000-0000"
                  value={clienteTelefone}
                  onChange={(e) => setClienteTelefone(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">E-mail *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={clienteEmail}
                  onChange={(e) => setClienteEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cpf">CPF/CNPJ</Label>
                <Input
                  id="cpf"
                  placeholder="000.000.000-00"
                  value={clienteCpfCnpj}
                  onChange={(e) => setClienteCpfCnpj(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="endereco">Endereço de Entrega</Label>
                <Textarea
                  id="endereco"
                  placeholder="Rua, número, complemento, bairro, cidade, estado"
                  value={clienteEndereco}
                  onChange={(e) => setClienteEndereco(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="observacoes">Observações</Label>
                <Textarea
                  id="observacoes"
                  placeholder="Alguma informação adicional sobre seu pedido?"
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

            <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-slate-50/50">
              <CardHeader>
                <CardTitle className="text-xl">Resumo do Pedido</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between text-muted-foreground text-base">
                    <span>Subtotal</span>
                    <span className="font-semibold">R$ {subtotal.toFixed(2)}</span>
                  </div>
                  <div className="border-t-2 border-border pt-3">
                    <div className="flex justify-between font-bold text-2xl">
                      <span>Total</span>
                      <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">R$ {total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <Button
                  onClick={finalizarPedido}
                  disabled={cart.length === 0 || loading}
                  className="w-full bg-gradient-to-r from-primary to-accent hover:shadow-xl hover:scale-105 transition-all duration-200"
                  size="lg"
                >
                  {loading ? 'Finalizando...' : 'Finalizar Pedido'}
                </Button>

                <Button
                  onClick={() => navigate('/catalogo')}
                  variant="outline"
                  className="w-full border-2 hover:border-primary hover:bg-primary/5 transition-all"
                >
                  Continuar Comprando
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}