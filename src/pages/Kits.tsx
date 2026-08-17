// @ts-nocheck - Temporary fix until Supabase types are regenerated
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Package, Pencil, Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Produto {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  categoria: string;
  preco: number;
  custo: number;
  estoque: number;
  estoque_minimo: number;
  unidade: string;
  peso: number | null;
  imagem_url: string | null;
  ativo: boolean;
}

export default function Kits() {
  const [searchTerm, setSearchTerm] = useState("");
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [produtoToDelete, setProdutoToDelete] = useState<string | null>(null);
  const [categoriaAtiva, setCategoriaAtiva] = useState<"Acessório Kit" | "Acessório Caixa">("Acessório Kit");
  const [uploading, setUploading] = useState(false);

  // Estado para adicionar/editar produto
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduto, setEditingProduto] = useState<Produto | null>(null);
  const [formData, setFormData] = useState({
    codigo: "",
    nome: "",
    descricao: "",
    preco: "",
    custo: "",
    estoque: "",
    estoque_minimo: "",
  });
  const [imagemPreview, setImagemPreview] = useState<string | null>(null);
  const [imagemFile, setImagemFile] = useState<File | null>(null);

  const fetchProdutos = async () => {
    try {
      const { data, error } = await supabase
        .from('produtos')
        .select('*')
        .in('categoria', ['Acessório Kit', 'Acessório Caixa'])
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
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProdutos();
  }, []);

  const handleDeleteProduto = async () => {
    if (!produtoToDelete) return;

    try {
      const { error } = await supabase
        .from('produtos')
        .update({ ativo: false })
        .eq('id', produtoToDelete);

      if (error) throw error;

      toast({
        title: "Produto removido",
        description: "Produto removido com sucesso",
      });

      fetchProdutos();
    } catch (error: any) {
      toast({
        title: "Erro ao remover produto",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setProdutoToDelete(null);
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = event.target.files?.[0];
      if (!file) return;

      if (!file.type.startsWith('image/')) {
        toast({
          title: "Erro no upload",
          description: "Por favor, selecione apenas arquivos de imagem",
          variant: "destructive",
        });
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "Arquivo muito grande",
          description: "A imagem deve ter no máximo 5MB",
          variant: "destructive",
        });
        return;
      }

      setImagemFile(file);

      const reader = new FileReader();
      reader.onload = (e) => {
        setImagemPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      toast({
        title: "Erro ao carregar imagem",
        description: "Houve um erro ao processar a imagem",
        variant: "destructive",
      });
    }
  };

  const uploadImage = async (file: File, produtoId: string): Promise<string | null> => {
    try {
      setUploading(true);
      
      const fileExt = file.name.split('.').pop();
      const fileName = `${produtoId}/${Math.random().toString(36).substring(2)}.${fileExt}`;

      console.log('Fazendo upload para:', fileName);

      const { error: uploadError, data } = await supabase.storage
        .from('product-images')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) {
        console.error('Erro no upload:', uploadError);
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(fileName);

      console.log('Upload realizado com sucesso. URL:', publicUrl);
      return publicUrl;
    } catch (error: any) {
      console.error('Erro detalhado no upload:', error);
      toast({
        title: "Erro no upload da imagem",
        description: error.message || "Erro ao fazer upload da imagem",
        variant: "destructive",
      });
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleOpenDialog = (produto?: Produto) => {
    if (produto) {
      setEditingProduto(produto);
      setFormData({
        codigo: produto.codigo,
        nome: produto.nome,
        descricao: produto.descricao || "",
        preco: produto.preco.toString(),
        custo: produto.custo.toString(),
        estoque: produto.estoque.toString(),
        estoque_minimo: produto.estoque_minimo.toString(),
      });
      setImagemPreview(produto.imagem_url);
      setImagemFile(null);
    } else {
      setEditingProduto(null);
      setFormData({
        codigo: "",
        nome: "",
        descricao: "",
        preco: "",
        custo: "",
        estoque: "0",
        estoque_minimo: "10",
      });
      setImagemPreview(null);
      setImagemFile(null);
    }
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const produtoData: any = {
        codigo: formData.codigo,
        nome: formData.nome,
        descricao: formData.descricao || null,
        categoria: categoriaAtiva,
        preco: parseFloat(formData.preco),
        custo: parseFloat(formData.custo),
        estoque: parseInt(formData.estoque),
        estoque_minimo: parseInt(formData.estoque_minimo),
        unidade: 'UN',
        ativo: true,
      };

      // Se estamos editando e não há novo arquivo, mantemos a imagem existente
      if (editingProduto && !imagemFile) {
        produtoData.imagem_url = editingProduto.imagem_url;
      }

      let produtoId = editingProduto?.id;

      // Upload da imagem se houver um novo arquivo
      if (imagemFile) {
        if (editingProduto) {
          // Para edição: faz upload e atualiza o produto
          const imagemUrl = await uploadImage(imagemFile, editingProduto.id);
          if (imagemUrl) {
            produtoData.imagem_url = imagemUrl;
          }
        } else {
          // Para novo produto: primeiro criamos o produto para obter o ID
          const { data: newProduct, error: createError } = await supabase
            .from('produtos')
            .insert({
              ...produtoData,
              imagem_url: null // Inicialmente null, será atualizado após upload
            })
            .select()
            .single();

          if (createError) throw createError;

          produtoId = newProduct.id;

          // Faz upload da imagem com o ID do produto
          const imagemUrl = await uploadImage(imagemFile, newProduct.id);
          
          if (imagemUrl) {
            // Atualiza o produto com a URL da imagem
            const { error: updateError } = await supabase
              .from('produtos')
              .update({ imagem_url: imagemUrl })
              .eq('id', newProduct.id);

            if (updateError) throw updateError;
          }

          toast({
            title: "Produto adicionado",
            description: "Produto adicionado com sucesso",
          });

          setDialogOpen(false);
          fetchProdutos();
          return;
        }
      }

      // Atualizar produto existente ou criar sem imagem
      if (editingProduto) {
        const { error } = await supabase
          .from('produtos')
          .update(produtoData)
          .eq('id', editingProduto.id);

        if (error) throw error;

        toast({
          title: "Produto atualizado",
          description: "Produto atualizado com sucesso",
        });
      } else if (!imagemFile) {
        // Criar produto sem imagem
        const { error } = await supabase
          .from('produtos')
          .insert(produtoData);

        if (error) throw error;

        toast({
          title: "Produto adicionado",
          description: "Produto adicionado com sucesso",
        });
      }

      setDialogOpen(false);
      fetchProdutos();
    } catch (error: any) {
      console.error('Erro ao salvar produto:', error);
      toast({
        title: "Erro ao salvar produto",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const produtosFiltrados = produtos.filter((produto) => {
    const matchSearch =
      produto.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      produto.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (produto.descricao && produto.descricao.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchCategoria = produto.categoria === categoriaAtiva;

    return matchSearch && matchCategoria;
  });

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h2 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Acessórios e Componentes
          </h2>
          <p className="text-muted-foreground text-lg">
            Gerencie os acessórios para kits e caixas
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()}>
              <Package className="h-4 w-4 mr-2" />
              Novo Produto
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>
                  {editingProduto ? 'Editar Produto' : 'Adicionar Produto'}
                </DialogTitle>
                <DialogDescription>
                  Categoria: {categoriaAtiva}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                {/* Seção de Upload de Imagem - Igual ao código de Produtos */}
                <div className="space-y-2">
                  <Label htmlFor="imagem">Imagem do Produto</Label>
                  <div className="flex items-center gap-4">
                    <div className="flex-shrink-0">
                      {imagemPreview ? (
                        <img
                          src={imagemPreview}
                          alt="Preview"
                          className="w-20 h-20 object-cover rounded-lg border"
                        />
                      ) : (
                        <div className="w-20 h-20 bg-gradient-to-br from-primary/10 to-accent/10 rounded-lg flex items-center justify-center border">
                          <Package className="h-8 w-8 text-primary" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <Input
                        id="imagem"
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="cursor-pointer"
                      />
                      <p className="text-sm text-muted-foreground mt-1">
                        PNG, JPG, JPEG até 5MB
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="codigo">Código *</Label>
                    <Input
                      id="codigo"
                      required
                      value={formData.codigo}
                      onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nome">Nome *</Label>
                    <Input
                      id="nome"
                      required
                      value={formData.nome}
                      onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="descricao">Descrição</Label>
                  <Textarea
                    id="descricao"
                    value={formData.descricao}
                    onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                    rows={2}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="custo">Custo *</Label>
                    <Input
                      id="custo"
                      type="number"
                      step="0.01"
                      required
                      value={formData.custo}
                      onChange={(e) => setFormData({ ...formData, custo: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="preco">Preço *</Label>
                    <Input
                      id="preco"
                      type="number"
                      step="0.01"
                      required
                      value={formData.preco}
                      onChange={(e) => setFormData({ ...formData, preco: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="estoque">Estoque Atual</Label>
                    <Input
                      id="estoque"
                      type="number"
                      value={formData.estoque}
                      onChange={(e) => setFormData({ ...formData, estoque: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="estoque_minimo">Estoque Mínimo</Label>
                    <Input
                      id="estoque_minimo"
                      type="number"
                      value={formData.estoque_minimo}
                      onChange={(e) => setFormData({ ...formData, estoque_minimo: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={uploading}>
                  {uploading ? "Enviando..." : editingProduto ? 'Atualizar' : 'Adicionar'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={categoriaAtiva} onValueChange={(v) => setCategoriaAtiva(v as any)}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="Acessório Kit">Acessório Kit</TabsTrigger>
          <TabsTrigger value="Acessório Caixa">Acessório Caixa</TabsTrigger>
        </TabsList>

        <TabsContent value={categoriaAtiva} className="mt-6">
          <Card className="border-0 shadow-lg">
            <div className="h-2 w-full bg-gradient-to-r from-primary via-accent to-primary"></div>
            <CardHeader className="bg-gradient-to-br from-white to-blue-50/30">
              <CardTitle className="flex items-center gap-2 text-xl">
                <div className="p-2 rounded-lg bg-gradient-to-br from-primary/10 to-accent/10">
                  <Package className="h-5 w-5 text-primary" />
                </div>
                {categoriaAtiva}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-6">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar produtos..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : produtosFiltrados.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum produto encontrado nesta categoria
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Foto</TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Custo</TableHead>
                      <TableHead>Preço</TableHead>
                      <TableHead>Estoque</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {produtosFiltrados.map((produto) => (
                      <TableRow key={produto.id}>
                        <TableCell>
                          {produto.imagem_url ? (
                            <img
                              src={produto.imagem_url}
                              alt={produto.nome}
                              className="w-14 h-14 object-cover rounded-lg shadow-md"
                            />
                          ) : (
                            <div className="w-14 h-14 bg-gradient-to-br from-primary/10 to-accent/10 rounded-lg flex items-center justify-center shadow-sm">
                              <Package className="h-7 w-7 text-primary" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{produto.codigo}</TableCell>
                        <TableCell>{produto.nome}</TableCell>
                        <TableCell className="max-w-xs truncate">
                          {produto.descricao || '-'}
                        </TableCell>
                        <TableCell>R$ {produto.custo.toFixed(2)}</TableCell>
                        <TableCell>R$ {produto.preco.toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge variant={produto.estoque <= produto.estoque_minimo ? "destructive" : "default"}>
                            {produto.estoque} {produto.unidade}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenDialog(produto)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setProdutoToDelete(produto.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AlertDialog open={!!produtoToDelete} onOpenChange={() => setProdutoToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover este produto? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteProduto}>
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}