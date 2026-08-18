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

interface Produto {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  categoria: string | null;
  imagem_url: string | null;
  estoque: number;
}

interface Kit {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  estoque_disponivel: number;
}

interface ItemPedido {
  id: string;
  tipo: "produto" | "kit";
  nome: string;
  quantidade: number;
  estoqueDisponivel: number;
}

export default function PedidoSerralheiro() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [kits, setKits] = useState<Kit[]>([]);
  const [itens, setItens] = useState<ItemPedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [showResumo, setShowResumo] = useState(false);
  const [observacoes, setObservacoes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchProdutos();
    fetchKits();
  }, []);

  const fetchProdutos = async () => {
    try {
      const { data, error } = await supabase
        .from("produtos")
        .select("id, codigo, nome, descricao, categoria, imagem_url, estoque")
        .eq("ativo", true)
        .gt("estoque", 0)
        .order("nome", { ascending: true });

      if (error) throw error;
      setProdutos(data || []);
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
        .from("kits_estoque_disponivel")
        .select("id, codigo, nome, descricao, estoque_disponivel")
        .gt("estoque_disponivel", 0)
        .order("nome");

      if (error) throw error;
      setKits(
        (data || []).map((k: any) => ({
          id: k.id,
          codigo: k.codigo,
          nome: k.nome,
          descricao: k.descricao,
          estoque_disponivel: k.estoque_disponivel,
        }))
      );
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

  const adicionarItem = (item: Produto | Kit, tipo: "produto" | "kit") => {
    const estoqueDisponivel = tipo === "produto" ? (item as Produto).estoque : (item as Kit).estoque_disponivel;
    const existente = itens.find((i) => i.id === item.id && i.tipo === tipo);

    if (existente) {
      const novaQuantidade = existente.quantidade + 1;
      if (novaQuantidade > estoqueDisponivel) {
        toast({
          title: "Estoque insuficiente",
          description: `Apenas ${estoqueDisponivel} unidade(s) disponível(is)`,
          variant: "destructive",
        });
        return;
      }
      setItens(itens.map((i) => (i.id === item.id && i.tipo === tipo ? { ...i, quantidade: novaQuantidade } : i)));
    } else {
      if (estoqueDisponivel < 1) return;
      setItens([...itens, { id: item.id, tipo, nome: item.nome, quantidade: 1, estoqueDisponivel }]);
    }

    toast({ title: "Adicionado ao pedido", description: `${item.nome} foi adicionado` });
  };

  const atualizarQuantidade = (index: number, delta: number) => {
    const item = itens[index];
    if (!item) return;
    const novaQuantidade = Math.max(1, item.quantidade + delta);
    if (novaQuantidade > item.estoqueDisponivel) {
      toast({
        title: "Estoque insuficiente",
        description: `Apenas ${item.estoqueDisponivel} unidade(s) disponível(is)`,
        variant: "destructive",
      });
      return;
    }
    setItens(itens.map((i, idx) => (idx === index ? { ...i, quantidade: novaQuantidade } : i)));
  };

  const removerItem = (index: number) => {
    setItens(itens.filter((_, i) => i !== index));
  };

  const finalizarPedido = async () => {
    if (itens.length === 0) {
      toast({ title: "Pedido vazio", description: "Adicione itens antes de enviar", variant: "destructive" });
      return;
    }
    if (!user) return;

    setSubmitting(true);
    try {
      const { data: numero, error: numeroError } = await supabase.rpc("gerar_numero_requisicao");
      if (numeroError) throw numeroError;

      const { data: requisicao, error: requisicaoError } = await supabase
        .from("requisicoes_material")
        .insert({
          numero,
          solicitante_id: user.id,
          observacoes: observacoes || null,
        })
        .select("id")
        .single();

      if (requisicaoError) throw requisicaoError;

      const itensParaInserir = itens.map((item) => ({
        requisicao_id: requisicao.id,
        produto_id: item.tipo === "produto" ? item.id : null,
        kit_id: item.tipo === "kit" ? item.id : null,
        quantidade: item.quantidade,
      }));

      const { error: itensError } = await supabase.from("requisicao_itens").insert(itensParaInserir);
      if (itensError) throw itensError;

      toast({ title: "Pedido enviado!", description: `Requisição ${numero} aguardando aprovação` });

      setItens([]);
      setObservacoes("");
      setShowResumo(false);
    } catch (error: any) {
      toast({ title: "Erro ao enviar pedido", description: error.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const filteredProdutos = produtos.filter(
    (p) => p.nome.toLowerCase().includes(searchTerm.toLowerCase()) || p.codigo.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const filteredKits = kits.filter(
    (k) => k.nome.toLowerCase().includes(searchTerm.toLowerCase()) || k.codigo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Fazer Pedido de Material</h2>
          <p className="text-muted-foreground">Escolha os itens que você precisa retirar do estoque</p>
        </div>
        <Button size="lg" onClick={() => setShowResumo(true)} className="relative w-full sm:w-auto">
          <ShoppingCart className="h-5 w-5 mr-2" />
          Meu Pedido
          {itens.length > 0 && (
            <Badge className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0 flex items-center justify-center">
              {itens.length}
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
              {filteredProdutos.length > 0 && (
                <div>
                  <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Produtos
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredProdutos.map((produto) => (
                      <Card key={produto.id} className="hover:shadow-lg transition-shadow">
                        <CardContent className="p-4">
                          {produto.imagem_url && (
                            <img src={produto.imagem_url} alt={produto.nome} className="w-full h-40 object-cover rounded-lg mb-4" />
                          )}
                          <div className="space-y-2">
                            <div>
                              <h4 className="font-semibold">{produto.nome}</h4>
                              <p className="text-sm text-muted-foreground">{produto.codigo}</p>
                            </div>
                            <div className="flex items-center justify-between">
                              <Badge variant="outline">Estoque: {produto.estoque}</Badge>
                            </div>
                            <Button className="w-full" onClick={() => adicionarItem(produto, "produto")}>
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
                            <div className="flex items-center justify-between">
                              <Badge variant="outline">Disponível: {kit.estoque_disponivel}</Badge>
                            </div>
                            <Button className="w-full" onClick={() => adicionarItem(kit, "kit")}>
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

              {filteredProdutos.length === 0 && filteredKits.length === 0 && (
                <div className="text-center py-12">
                  <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Nenhum produto ou kit encontrado</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showResumo} onOpenChange={setShowResumo}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Meu Pedido de Material</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {itens.length === 0 ? (
              <div className="text-center py-8">
                <ShoppingCart className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Você ainda não adicionou nenhum item</p>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {itens.map((item, index) => (
                    <Card key={index}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold">{item.nome}</h4>
                              {item.tipo === "kit" && (
                                <Badge variant="secondary" className="text-xs">KIT</Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                              <Button size="icon" variant="outline" onClick={() => atualizarQuantidade(index, -1)}>
                                <Minus className="h-4 w-4" />
                              </Button>
                              <span className="font-semibold w-8 text-center">{item.quantidade}</span>
                              <Button size="icon" variant="outline" onClick={() => atualizarQuantidade(index, 1)}>
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                            <Button size="icon" variant="destructive" onClick={() => removerItem(index)}>
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
                    <label className="text-sm font-medium mb-2 block">Observações (opcional)</label>
                    <Textarea
                      placeholder="Detalhes sobre para qual serviço é o material..."
                      value={observacoes}
                      onChange={(e) => setObservacoes(e.target.value)}
                      rows={3}
                    />
                  </div>

                  <Button className="w-full" size="lg" onClick={finalizarPedido} disabled={submitting}>
                    <Send className="h-5 w-5 mr-2" />
                    {submitting ? "Enviando..." : "Enviar Pedido"}
                  </Button>

                  <p className="text-xs text-center text-muted-foreground">
                    Seu pedido será enviado para aprovação da administração
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
