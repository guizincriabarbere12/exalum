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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Package, Search, Trash2, CircleAlert as AlertCircle, DollarSign, Save, Layers } from "lucide-react";
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
  preco?: number;
}

interface Kit {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  preco_total: number;
  ativo: boolean | null;
}

interface ItemKit {
  id?: string;
  produto_id?: string;
  produto?: Produto;
  sub_kit_id?: string;
  sub_kit?: Kit;
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
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export default function CriarKitDialog({
  onKitAdded,
  kitParaEditar = null,
  isEditing = false,
  trigger,
  open: externalOpen,
  onOpenChange: externalOnOpenChange
}: CriarKitDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [kitsDisponiveis, setKitsDisponiveis] = useState<Kit[]>([]);
  const [termoPesquisa, setTermoPesquisa] = useState("");
  const [termoPesquisaKit, setTermoPesquisaKit] = useState("");
  const [itens, setItens] = useState<ItemKit[]>([]);

  // Dados do kit
  const [codigo, setCodigo] = useState("");
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [precoTotal, setPrecoTotal] = useState<string>("");
  const [kitId, setKitId] = useState<string | null>(null);
  const [codigoOriginal, setCodigoOriginal] = useState("");

  // Controlar estado de abertura (suporta controlled e uncontrolled)
  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = externalOnOpenChange || setInternalOpen;

  // Efeito para abrir o dialog quando estiver em modo de edição
  useEffect(() => {
    if (isEditing && kitParaEditar) {
      // Popula os dados do kit para edição
      setKitId(kitParaEditar.id);
      setCodigo(kitParaEditar.codigo);
      setCodigoOriginal(kitParaEditar.codigo);
      setNome(kitParaEditar.nome);
      setDescricao(kitParaEditar.descricao || "");
      setPrecoTotal(kitParaEditar.preco_total.toString());

      // Garantir que os itens estão no formato correto
      const itensComProduto = kitParaEditar.itens.map(item => ({
        id: item.id,
        produto_id: item.produto_id,
        sub_kit_id: item.sub_kit_id,
        quantidade: item.quantidade,
        produto: item.produto || undefined,
        sub_kit: item.sub_kit || undefined
      }));

      setItens(itensComProduto);

      // Buscar produtos e kits para o select
      fetchProdutos();
      fetchKitsDisponiveis(kitParaEditar.id);

      // Abrir o dialog se não estiver aberto
      if (!open) {
        setOpen(true);
      }
    }
  }, [isEditing, kitParaEditar]);

  useEffect(() => {
    if (open && !isEditing) {
      fetchProdutos();
      fetchKitsDisponiveis();
      resetForm();
    }
  }, [open]);

  const fetchProdutos = async () => {
    try {
      const { data, error } = await supabase
        .from('produtos')
        .select('id, codigo, nome, descricao, estoque, ativo, preco')
        .eq('ativo', true)
        .order('nome');

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

  const fetchKitsDisponiveis = async (excludeKitId?: string) => {
    try {
      let query = supabase
        .from('kits')
        .select('id, codigo, nome, descricao, preco_total, ativo')
        .eq('ativo', true)
        .order('nome');

      // Exclude current kit to prevent circular references
      if (excludeKitId) {
        query = query.neq('id', excludeKitId);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Also exclude kits that are already added as sub-kits to prevent duplicates
      const addedSubKitIds = itens.filter(i => i.sub_kit_id).map(i => i.sub_kit_id);
      const filteredData = (data || []).filter(k => !addedSubKitIds.includes(k.id));

      setKitsDisponiveis(filteredData);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar kits",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const calcularCustoTotal = () => {
    return itens.reduce((total, item) => {
      const precoUnitario = item.produto?.preco || item.sub_kit?.preco_total || 0;
      return total + (precoUnitario * item.quantidade);
    }, 0);
  };

  const adicionarItem = (produtoId: string) => {
    if (!produtoId) return;

    const produto = produtos.find(p => p.id === produtoId);
    if (!produto) return;

    const itemExistente = itens.find(item => item.produto_id === produtoId);
    if (itemExistente) {
      toast({
        title: "Produto já adicionado",
        description: "Este componente já está no kit. Ajuste a quantidade se necessário.",
        variant: "default",
      });
      return;
    }

    setItens([...itens, {
      produto_id: produtoId,
      produto: produto,
      quantidade: 1
    }]);

    setTermoPesquisa("");
  };

  const adicionarSubKit = (subKitId: string) => {
    if (!subKitId) return;

    const subKit = kitsDisponiveis.find(k => k.id === subKitId);
    if (!subKit) return;

    const itemExistente = itens.find(item => item.sub_kit_id === subKitId);
    if (itemExistente) {
      toast({
        title: "Kit já adicionado",
        description: "Este sub-kit já está no kit. Ajuste a quantidade se necessário.",
        variant: "default",
      });
      return;
    }

    setItens([...itens, {
      sub_kit_id: subKitId,
      sub_kit: subKit,
      quantidade: 1
    }]);

    // Remove from available kits list
    setKitsDisponiveis(prev => prev.filter(k => k.id !== subKitId));
    setTermoPesquisaKit("");
  };

  const removerItem = (index: number) => {
    const itemToRemove = itens[index];
    // If removing a sub-kit, add it back to available kits
    if (itemToRemove.sub_kit_id && itemToRemove.sub_kit) {
      setKitsDisponiveis(prev => [...prev, itemToRemove.sub_kit!]);
    }
    setItens(itens.filter((_, i) => i !== index));
  };

  const atualizarQuantidade = (index: number, quantidade: number) => {
    if (quantidade < 1) return;
    
    const novosItens = [...itens];
    novosItens[index].quantidade = quantidade;
    setItens(novosItens);
  };

  const produtosFiltrados = produtos.filter(produto =>
    produto.codigo?.toLowerCase().includes(termoPesquisa.toLowerCase()) ||
    produto.nome?.toLowerCase().includes(termoPesquisa.toLowerCase()) ||
    (produto.descricao && produto.descricao.toLowerCase().includes(termoPesquisa.toLowerCase()))
  );

  const kitsFiltrados = kitsDisponiveis.filter(kit =>
    kit.codigo?.toLowerCase().includes(termoPesquisaKit.toLowerCase()) ||
    kit.nome?.toLowerCase().includes(termoPesquisaKit.toLowerCase()) ||
    (kit.descricao && kit.descricao.toLowerCase().includes(termoPesquisaKit.toLowerCase()))
  );

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
        console.log(`Código original: ${codigoOriginal}, Novo código: ${codigo}`);
        
        // Verificar se o código foi alterado e se já existe outro kit com este código
        if (codigoOriginal !== codigo.trim().toUpperCase()) {
          const { data: existingKit, error: checkError } = await supabase
            .from('kits')
            .select('id')
            .eq('codigo', codigo.trim().toUpperCase())
            .neq('id', kitId)
            .maybeSingle();

          if (checkError) {
            console.error("❌ Erro ao verificar código:", checkError);
            throw checkError;
          }

          if (existingKit) {
            toast({
              title: "Código já existe",
              description: "Já existe outro kit com este código. Escolha um código diferente.",
              variant: "destructive",
            });
            setLoading(false);
            return;
          }
        }
        
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
            produto_id: item.produto_id || null,
            sub_kit_id: item.sub_kit_id || null,
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
            produto_id: item.produto_id || null,
            sub_kit_id: item.sub_kit_id || null,
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
    if (!isEditing) {
      setCodigo("");
      setNome("");
      setDescricao("");
      setPrecoTotal("");
      setItens([]);
      setTermoPesquisa("");
      setKitId(null);
      setCodigoOriginal("");
    }
  };

  const custoTotal = calcularCustoTotal();
  const precoVendaNum = parseFloat(precoTotal) || 0;
  const lucro = precoVendaNum - custoTotal;
  const margemLucro = precoVendaNum > 0 ? (lucro / precoVendaNum) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isEditing && (
        <DialogTrigger asChild>
          {trigger || (
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Novo Kit
            </Button>
          )}
        </DialogTrigger>
      )}
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
                  className={isEditing ? "border-yellow-400 focus:border-yellow-500" : ""}
                />
                {isEditing && (
                  <p className="text-xs text-yellow-600 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Você pode alterar o código do kit. Certifique-se de que ele seja único.
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

              <Tabs defaultValue="produtos" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="produtos" className="flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Produtos
                  </TabsTrigger>
                  <TabsTrigger value="kits" className="flex items-center gap-2">
                    <Layers className="h-4 w-4" />
                    Sub-Kits
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="produtos" className="space-y-2 mt-4">
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar produto por código ou nome..."
                        value={termoPesquisa}
                        onChange={(e) => setTermoPesquisa(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    <Select onValueChange={adicionarItem} value="">
                      <SelectTrigger className="w-[220px]">
                        <SelectValue placeholder="Adicionar produto" />
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
                                    R$ {produto.preco?.toFixed(2)}
                                  </Badge>
                                </div>
                              </div>
                            </SelectItem>
                          ))
                        ) : (
                          <div className="px-2 py-1.5 text-sm text-muted-foreground">
                            {termoPesquisa ? 'Nenhum produto encontrado' : 'Digite para buscar...'}
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </TabsContent>

                <TabsContent value="kits" className="space-y-2 mt-4">
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar kit por código ou nome..."
                        value={termoPesquisaKit}
                        onChange={(e) => setTermoPesquisaKit(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    <Select onValueChange={adicionarSubKit} value="">
                      <SelectTrigger className="w-[220px]">
                        <SelectValue placeholder="Adicionar kit" />
                      </SelectTrigger>
                      <SelectContent>
                        {kitsFiltrados.length > 0 ? (
                          kitsFiltrados.map(kit => (
                            <SelectItem key={kit.id} value={kit.id}>
                              <div className="flex items-center justify-between w-full gap-4">
                                <span>
                                  <span className="font-mono text-xs">{kit.codigo}</span>
                                  <span className="ml-2">{kit.nome}</span>
                                </span>
                                <Badge variant="secondary" className="text-xs">
                                  R$ {kit.preco_total?.toFixed(2)}
                                </Badge>
                              </div>
                            </SelectItem>
                          ))
                        ) : (
                          <div className="px-2 py-1.5 text-sm text-muted-foreground">
                            {termoPesquisaKit ? 'Nenhum kit encontrado' : kitsDisponiveis.length === 0 ? 'Nenhum kit disponível' : 'Digite para buscar...'}
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  {isEditing && kitsDisponiveis.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Kits já adicionados ou kit atual não disponível (referência circular).
                    </p>
                  )}
                </TabsContent>
              </Tabs>

              {/* Tabela de componentes */}
              {itens.length > 0 ? (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tipo</TableHead>
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
                        const isSubKit = !!item.sub_kit_id;
                        const codigo = isSubKit ? item.sub_kit?.codigo : item.produto?.codigo;
                        const nome = isSubKit ? item.sub_kit?.nome : item.produto?.nome;
                        const precoUnitario = isSubKit ? item.sub_kit?.preco_total : item.produto?.preco;
                        const subtotal = (precoUnitario || 0) * item.quantidade;

                        return (
                          <TableRow key={item.produto_id || item.sub_kit_id}>
                            <TableCell>
                              <Badge variant={isSubKit ? "secondary" : "outline"} className="flex items-center gap-1 w-fit">
                                {isSubKit ? <Layers className="h-3 w-3" /> : <Package className="h-3 w-3" />}
                                {isSubKit ? 'Kit' : 'Produto'}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {codigo}
                            </TableCell>
                            <TableCell>
                              <p className="font-medium">{nome}</p>
                            </TableCell>
                            <TableCell className="text-right">
                              {!isSubKit && (
                                <Badge variant={(item.produto?.estoque || 0) < item.quantidade ? "destructive" : "outline"}>
                                  {item.produto?.estoque || 0}
                                </Badge>
                              )}
                              {isSubKit && (
                                <span className="text-xs text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              R$ {precoUnitario?.toFixed(2)}
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
                    Nenhum componente adicionado. Use as abas acima para adicionar produtos ou sub-kits.
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