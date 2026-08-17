// components/produtos/CriarKitDialog.tsx
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Package, Search, Trash2, AlertCircle, DollarSign, Pencil, Save, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Produto {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  estoque: number;
  ativo: boolean;
  preco_venda?: number;
}

interface ItemKit {
  produto_id: string;
  produto?: Produto;
  quantidade: number;
}

interface CriarKitDialogProps {
  onKitAdded: () => void;
  kitParaEditar?: {
    id: string;
    codigo: string;
    nome: string;
    descricao: string | null;
    preco_total: number;
    itens: ItemKit[];
  } | null;
  isEditing?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export default function CriarKitDialog({ 
  onKitAdded, 
  kitParaEditar = null,
  isEditing = false,
  open: externalOpen,
  onOpenChange
}: CriarKitDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [produtosFiltrados, setProdutosFiltrados] = useState<Produto[]>([]);
  const [termoPesquisa, setTermoPesquisa] = useState("");
  const [itens, setItens] = useState<ItemKit[]>([]);
  const [selectedProdutoId, setSelectedProdutoId] = useState<string>("");
  
  // Dados do kit
  const [codigo, setCodigo] = useState("");
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [precoTotal, setPrecoTotal] = useState<string>("");
  const [kitId, setKitId] = useState<string | null>(null);

  // Usar externalOpen se fornecido, senão usar internalOpen
  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  
  const setOpen = (value: boolean) => {
    if (onOpenChange) {
      onOpenChange(value);
    } else {
      setInternalOpen(value);
    }
  };

  useEffect(() => {
    if (open) {
      fetchProdutos();
      
      // Se estiver editando, carregar dados do kit
      if (isEditing && kitParaEditar) {
        setKitId(kitParaEditar.id);
        setCodigo(kitParaEditar.codigo);
        setNome(kitParaEditar.nome);
        setDescricao(kitParaEditar.descricao || "");
        setPrecoTotal(kitParaEditar.preco_total.toString());
        setItens(kitParaEditar.itens || []);
      } else {
        resetForm();
      }
    }
  }, [open, isEditing, kitParaEditar]);

  // Filtrar produtos quando a pesquisa ou itens mudarem
  useEffect(() => {
    const produtosDisponiveis = produtos.filter(produto => {
      // Filtrar produtos que já estão no kit
      const jaAdicionado = itens.some(item => item.produto_id === produto.id);
      if (jaAdicionado) return false;
      
      // Se não tiver termo de pesquisa, mostrar todos os produtos disponíveis
      if (!termoPesquisa.trim()) return true;
      
      const searchTerm = termoPesquisa.toLowerCase().trim();
      return (
        produto.codigo?.toLowerCase().includes(searchTerm) ||
        produto.nome?.toLowerCase().includes(searchTerm) ||
        (produto.descricao && produto.descricao.toLowerCase().includes(searchTerm))
      );
    });
    
    setProdutosFiltrados(produtosDisponiveis);
  }, [produtos, itens, termoPesquisa]);

  const fetchProdutos = async () => {
    try {
      console.log("🔄 Buscando produtos...");
      const { data, error } = await supabase
        .from('produtos')
        .select('id, codigo, nome, descricao, estoque, ativo, preco_venda')
        .eq('ativo', true)
        .order('nome');

      if (error) throw error;
      console.log(`✅ ${data?.length || 0} produtos encontrados`);
      setProdutos(data || []);
    } catch (error: any) {
      console.error("❌ Erro ao carregar produtos:", error);
      toast({
        title: "Erro ao carregar produtos",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const calcularCustoTotal = () => {
    return itens.reduce((total, item) => {
      const precoUnitario = item.produto?.preco_venda || 0;
      return total + (precoUnitario * item.quantidade);
    }, 0);
  };

  const adicionarItem = () => {
    if (!selectedProdutoId) {
      toast({
        title: "Selecione um produto",
        description: "Escolha um produto na lista para adicionar ao kit.",
        variant: "default",
      });
      return;
    }
    
    console.log("➕ Adicionando produto:", selectedProdutoId);
    
    const produto = produtos.find(p => p.id === selectedProdutoId);
    if (!produto) {
      console.error("❌ Produto não encontrado:", selectedProdutoId);
      return;
    }

    const itemExistente = itens.find(item => item.produto_id === selectedProdutoId);
    if (itemExistente) {
      toast({
        title: "Produto já adicionado",
        description: "Este componente já está no kit. Ajuste a quantidade se necessário.",
        variant: "default",
      });
      setSelectedProdutoId("");
      return;
    }

    setItens([...itens, {
      produto_id: selectedProdutoId,
      produto: produto,
      quantidade: 1
    }]);
    
    setTermoPesquisa("");
    setSelectedProdutoId("");
  };

  const removerItem = (index: number) => {
    setItens(itens.filter((_, i) => i !== index));
  };

  const atualizarQuantidade = (index: number, quantidade: number) => {
    if (quantidade < 1) return;
    
    const novosItens = [...itens];
    novosItens[index].quantidade = quantidade;
    setItens(novosItens);
  };

  const limparPesquisa = () => {
    setTermoPesquisa("");
  };

  console.log("📊 Produtos filtrados:", produtosFiltrados.length);
  console.log("📦 Itens no kit:", itens.length);
  console.log("🔍 Termo de pesquisa:", termoPesquisa);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validações
    if (!codigo.trim()) {
      toast({
        title: "Campo obrigatório",
        description: "O código do kit é obrigatório.",
        variant: "destructive",
      });
      return;
    }

    if (!nome.trim()) {
      toast({
        title: "Campo obrigatório",
        description: "O nome do kit é obrigatório.",
        variant: "destructive",
      });
      return;
    }

    if (!precoTotal || parseFloat(precoTotal) <= 0) {
      toast({
        title: "Preço obrigatório",
        description: "O preço total do kit deve ser maior que zero.",
        variant: "destructive",
      });
      return;
    }

    if (itens.length === 0) {
      toast({
        title: "Nenhum componente",
        description: "Adicione pelo menos um componente ao kit.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      if (isEditing && kitId) {
        // EDITAR KIT EXISTENTE
        console.log("✏️ Editando kit...", kitId);
        
        // Atualizar dados do kit
        const { error: kitError } = await supabase
          .from('kits')
          .update({
            codigo: codigo.trim().toUpperCase(),
            nome: nome.trim(),
            descricao: descricao.trim() || null,
            preco_total: parseFloat(precoTotal),
            updated_at: new Date().toISOString()
          })
          .eq('id', kitId);

        if (kitError) {
          console.error("❌ Erro ao atualizar kit:", kitError);
          if (kitError.code === '23505') {
            toast({
              title: "Código já existe",
              description: "Já existe um kit com este código. Escolha um código diferente.",
              variant: "destructive",
            });
            return;
          }
          throw kitError;
        }

        // Remover itens antigos
        const { error: deleteError } = await supabase
          .from('kit_itens')
          .delete()
          .eq('kit_id', kitId);

        if (deleteError) {
          console.error("❌ Erro ao remover itens antigos:", deleteError);
          throw deleteError;
        }

        // Inserir novos itens
        if (itens.length > 0) {
          const itensParaInserir = itens.map(item => ({
            kit_id: kitId,
            produto_id: item.produto_id,
            quantidade: item.quantidade
          }));

          const { error: itensError } = await supabase
            .from('kit_itens')
            .insert(itensParaInserir);

          if (itensError) {
            console.error("❌ Erro ao inserir itens:", itensError);
            throw itensError;
          }

          console.log(`✅ ${itens.length} componentes atualizados`);
        }

        toast({
          title: "Kit atualizado com sucesso!",
          description: `O kit ${codigo} - ${nome} foi atualizado com ${itens.length} componente(s).`,
        });

      } else {
        // CRIAR NOVO KIT
        console.log("🆕 Criando novo kit...");
        
        const { data: kitData, error: kitError } = await supabase
          .from('kits')
          .insert({
            codigo: codigo.trim().toUpperCase(),
            nome: nome.trim(),
            descricao: descricao.trim() || null,
            preco_total: parseFloat(precoTotal),
            ativo: true
          })
          .select()
          .single();

        if (kitError) {
          console.error("❌ Erro ao inserir kit:", kitError);
          if (kitError.code === '23505') {
            toast({
              title: "Código já existe",
              description: "Já existe um kit com este código. Escolha um código diferente.",
              variant: "destructive",
            });
            return;
          }
          throw kitError;
        }

        console.log("✅ Kit criado:", kitData);

        // Inserir os itens do kit
        if (itens.length > 0) {
          const itensParaInserir = itens.map(item => ({
            kit_id: kitData.id,
            produto_id: item.produto_id,
            quantidade: item.quantidade
          }));

          const { error: itensError } = await supabase
            .from('kit_itens')
            .insert(itensParaInserir);

          if (itensError) {
            console.error("❌ Erro ao inserir itens:", itensError);
            throw itensError;
          }

          console.log(`✅ ${itens.length} componentes adicionados`);
        }

        toast({
          title: "Kit criado com sucesso!",
          description: `O kit ${kitData.codigo} - ${kitData.nome} foi criado com ${itens.length} componente(s).`,
        });
      }

      setOpen(false);
      resetForm();
      onKitAdded();
    } catch (error: any) {
      console.error("❌ Erro ao salvar kit:", error);
      toast({
        title: isEditing ? "Erro ao atualizar kit" : "Erro ao criar kit",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setCodigo("");
    setNome("");
    setDescricao("");
    setPrecoTotal("");
    setItens([]);
    setTermoPesquisa("");
    setKitId(null);
    setSelectedProdutoId("");
    setProdutosFiltrados([]);
  };

  const custoTotal = calcularCustoTotal();
  const precoVendaNum = parseFloat(precoTotal) || 0;
  const lucro = precoVendaNum - custoTotal;
  const margemLucro = precoVendaNum > 0 ? (lucro / precoVendaNum) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isEditing ? (
          <Button variant="outline" size="sm">
            <Pencil className="h-4 w-4 mr-2" />
            Editar
          </Button>
        ) : (
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Novo Kit
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              {isEditing ? 'Editar Kit' : 'Criar Novo Kit'}
            </DialogTitle>
            <DialogDescription>
              {isEditing 
                ? 'Edite as informações do kit, ajuste o preço total e modifique os componentes.'
                : 'Preencha as informações do kit, defina o preço total e adicione os componentes.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Dados básicos do kit */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="codigo">
                  Código do Kit <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="codigo"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  placeholder="Ex: KIT-001"
                  disabled={isEditing}
                />
                {isEditing && (
                  <p className="text-xs text-muted-foreground">
                    O código não pode ser alterado
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="nome">
                  Nome do Kit <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Kit Emergencial"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="preco">
                  Preço Total do Kit <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="preco"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={precoTotal}
                    onChange={(e) => setPrecoTotal(e.target.value)}
                    placeholder="0,00"
                    className="pl-9"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Preço de venda do kit (obrigatório)
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="descricao">Descrição</Label>
                <Textarea
                  id="descricao"
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Descreva o kit..."
                  rows={1}
                />
              </div>
            </div>

            {/* Busca e seleção de componentes */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">
                  Componentes do Kit <span className="text-destructive">*</span>
                </Label>
                <Badge variant="outline">
                  {itens.length} {itens.length === 1 ? 'componente' : 'componentes'}
                </Badge>
              </div>

              <div className="space-y-2">
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar componente por código ou nome..."
                      value={termoPesquisa}
                      onChange={(e) => setTermoPesquisa(e.target.value)}
                      className="pl-9 pr-8"
                    />
                    {termoPesquisa && (
                      <button
                        type="button"
                        onClick={limparPesquisa}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  
                  <Select 
                    value={selectedProdutoId} 
                    onValueChange={setSelectedProdutoId}
                  >
                    <SelectTrigger className="w-[220px]">
                      <SelectValue placeholder="Selecione um produto" />
                    </SelectTrigger>
                    <SelectContent>
                      {produtosFiltrados.length > 0 ? (
                        produtosFiltrados.map(produto => (
                          <SelectItem key={produto.id} value={produto.id}>
                            <div className="flex items-center justify-between w-full gap-4">
                              <span>
                                <span className="font-mono text-xs">{produto.codigo}</span>
                                <span className="ml-2">{produto.nome}</span>
                              </span>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  Est: {produto.estoque}
                                </Badge>
                                <Badge variant="secondary" className="text-xs">
                                  R$ {produto.preco_venda?.toFixed(2)}
                                </Badge>
                              </div>
                            </div>
                          </SelectItem>
                        ))
                      ) : (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">
                          {termoPesquisa ? 'Nenhum produto encontrado' : 'Nenhum produto disponível'}
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                  
                  <Button 
                    type="button" 
                    onClick={adicionarItem}
                    disabled={!selectedProdutoId}
                    className="gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Adicionar
                  </Button>
                </div>
                
                {produtosFiltrados.length === 0 && itens.length > 0 && produtos.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Todos os produtos disponíveis já foram adicionados ao kit.
                  </p>
                )}
                {produtos.length === 0 && (
                  <p className="text-xs text-destructive">
                    Nenhum produto cadastrado. Cadastre produtos antes de criar um kit.
                  </p>
                )}
              </div>

              {/* Tabela de componentes */}
              {itens.length > 0 ? (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Componente</TableHead>
                        <TableHead className="text-right">Estoque</TableHead>
                        <TableHead className="text-right">Preço Unit.</TableHead>
                        <TableHead className="text-right">Qtd</TableHead>
                        <TableHead className="text-right">Subtotal</TableHead>
                        <TableHead className="text-center">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {itens.map((item, index) => {
                        const subtotal = (item.produto?.preco_venda || 0) * item.quantidade;
                        const estoqueInsuficiente = (item.produto?.estoque || 0) < item.quantidade;
                        
                        return (
                          <TableRow key={item.produto_id}>
                            <TableCell className="font-mono text-sm">
                              {item.produto?.codigo}
                            </TableCell>
                            <TableCell>
                              <p className="font-medium">{item.produto?.nome}</p>
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge variant={estoqueInsuficiente ? "destructive" : "outline"}>
                                {item.produto?.estoque || 0}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              R$ {item.produto?.preco_venda?.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right">
                              <Input
                                type="number"
                                min="1"
                                value={item.quantidade}
                                onChange={(e) => atualizarQuantidade(index, parseInt(e.target.value) || 1)}
                                className="w-20 text-right ml-auto"
                              />
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              R$ {subtotal.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-center">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removerItem(index)}
                                className="h-8 w-8 text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Nenhum componente adicionado. Selecione um produto na lista e clique em "Adicionar".
                  </AlertDescription>
                </Alert>
              )}
            </div>

            {/* Resumo financeiro */}
            {itens.length > 0 && (
              <div className="bg-accent/5 p-4 rounded-lg border space-y-3">
                <h4 className="font-semibold">Resumo Financeiro</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Custo dos Componentes</p>
                    <p className="text-lg font-medium">R$ {custoTotal.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Preço de Venda</p>
                    <p className="text-lg font-medium text-primary">
                      R$ {precoVendaNum.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Lucro Estimado</p>
                    <p className={`text-lg font-medium ${lucro >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      R$ {lucro.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Margem de Lucro</p>
                    <p className={`text-lg font-medium ${margemLucro >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {margemLucro.toFixed(1)}%
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={loading || itens.length === 0 || !precoTotal}
              className="gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  {isEditing ? 'Salvando...' : 'Criando...'}
                </>
              ) : (
                <>
                  {isEditing ? (
                    <>
                      <Save className="h-4 w-4" />
                      Salvar Alterações
                    </>
                  ) : (
                    'Criar Kit'
                  )}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}