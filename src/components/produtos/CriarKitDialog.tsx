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
import { Plus, Package, Search, Trash2, AlertCircle, DollarSign } from "lucide-react";
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

interface ItemKit {
  produto_id: string;
  produto?: Produto;
  quantidade: number;
}

interface CriarKitDialogProps {
  onKitAdded: () => void;
}

export default function CriarKitDialog({ onKitAdded }: CriarKitDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [termoPesquisa, setTermoPesquisa] = useState("");
  const [itens, setItens] = useState<ItemKit[]>([]);
  
  // Dados do kit
  const [codigo, setCodigo] = useState("");
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [precoTotal, setPrecoTotal] = useState<string>("");

  useEffect(() => {
    if (open) {
      fetchProdutos();
    }
  }, [open]);

  // Reset apenas quando abrir, não a cada render
  useEffect(() => {
    if (open) {
      resetForm();
    }
  }, [open]);

  const fetchProdutos = async () => {
    try {
      console.log("📦 Buscando produtos...");
      const { data, error } = await supabase
        .from('produtos')
        .select('id, codigo, nome, descricao, estoque, ativo, preco')
        .eq('ativo', true)
        .order('nome');

      if (error) throw error;
      console.log(`✅ ${data?.length} produtos encontrados`);
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
      const precoUnitario = item.produto?.preco || 0;
      return total + (precoUnitario * item.quantidade);
    }, 0);
  };

  const adicionarItem = (produtoId: string) => {
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

  const removerItem = (index: number) => {
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
      console.log("🆕 Criando novo kit...");
      console.log("Dados do kit:", {
        codigo: codigo.trim().toUpperCase(),
        nome: nome.trim(),
        descricao: descricao.trim() || null,
        preco_total: parseFloat(precoTotal),
        ativo: true
      });
      
      // Inserir o kit com preco_total (campo NOT NULL)
      const { data: kitData, error: kitError } = await supabase
        .from('kits')
        .insert({
          codigo: codigo.trim().toUpperCase(),
          nome: nome.trim(),
          descricao: descricao.trim() || null,
          preco_total: parseFloat(precoTotal), // Campo obrigatório
          ativo: true
        })
        .select()
        .single();

      if (kitError) {
        console.error("❌ Erro ao inserir kit:", kitError);
        
        // Tratar erro de código duplicado
        if (kitError.code === '23505') {
          toast({
            title: "Código já existe",
            description: "Já existe um kit com este código. Escolha um código diferente.",
            variant: "destructive",
          });
          return;
        }
        
        // Tratar erro de campo obrigatório
        if (kitError.message?.includes('null value in column')) {
          toast({
            title: "Erro de validação",
            description: "Todos os campos obrigatórios devem ser preenchidos.",
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

        console.log("📦 Inserindo itens:", itensParaInserir);

        const { error: itensError } = await supabase
          .from('kit_itens')
          .insert(itensParaInserir);

        if (itensError) {
          console.error("❌ Erro ao inserir itens:", itensError);
          
          // Se erro nos itens, deletar o kit criado para não ficar órfão
          await supabase.from('kits').delete().eq('id', kitData.id);
          
          throw itensError;
        }

        console.log(`✅ ${itens.length} componentes adicionados`);
      }

      toast({
        title: "Kit criado com sucesso!",
        description: `O kit ${kitData.codigo} - ${kitData.nome} foi criado com ${itens.length} componente(s).`,
      });

      setOpen(false);
      resetForm();
      onKitAdded();
    } catch (error: any) {
      console.error("❌ Erro ao criar kit:", error);
      toast({
        title: "Erro ao criar kit",
        description: error.message || "Ocorreu um erro ao criar o kit. Tente novamente.",
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
  };

  const custoTotal = calcularCustoTotal();
  const precoVendaNum = parseFloat(precoTotal) || 0;
  const lucro = precoVendaNum - custoTotal;
  const margemLucro = precoVendaNum > 0 ? (lucro / precoVendaNum) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Novo Kit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Criar Novo Kit
            </DialogTitle>
            <DialogDescription>
              Preencha as informações do kit, defina o preço total e adicione os componentes.
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
                  maxLength={50}
                  required
                />
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
                  maxLength={100}
                  required
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
                    required
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
                      className="pl-9"
                    />
                  </div>
                  <Select onValueChange={adicionarItem} value="">
                    <SelectTrigger className="w-[220px]">
                      <SelectValue placeholder="Adicionar componente" />
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
                        const subtotal = (item.produto?.preco || 0) * item.quantidade;
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
                              R$ {item.produto?.preco?.toFixed(2)}
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
                    Nenhum componente adicionado. Use a busca acima para encontrar e adicionar produtos ao kit.
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
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Criando...
                </>
              ) : (
                'Criar Kit'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}