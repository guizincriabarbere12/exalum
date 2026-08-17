// @ts-nocheck - Temporary fix until Supabase types are regenerated
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Upload, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Product {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  categoria: string | null;
  cor: string | null;
  peso: number | null;
  peso_kg_m: number | null;
  comprimento_barra: number | null;
  unidade: string | null;
  custo: number | null;
  preco: number | null;
  preco_por_kg: number | null;
  imagem_url: string | null;
  estoque: number | null;
  estoque_minimo: number | null;
  localizacao: string | null;
  ativo: boolean | null;
}

interface EditProductDialogProps {
  product: Product;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProductUpdated: () => void;
}

export default function EditProductDialog({ product, open, onOpenChange, onProductUpdated }: EditProductDialogProps) {
  const [loading, setLoading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(product.imagem_url);

  // Lista de categorias que usam a fórmula de preço + 70%
  const categoriasComMarkup = [
    "ACESSORIO", 
    "ACESSORIO CAIXA",
    "ESCOVA",
    "ESPUMA",
    "GUARNIÇÕES",
    "PARAFUSO"
  ];

  // Categoria especial onde o preço é direto (sem fórmula)
  const CATEGORIA_PRECO_DIRETO = "COMPONENTES";

  // Categoria PERFIL usa a fórmula padrão (peso_kg/m × comprimento × preço/kg)
  const CATEGORIA_PERFIL = "PERFIL";

  const [formData, setFormData] = useState({
    codigo: product.codigo,
    nome: product.nome || "",
    descricao: product.descricao || "",
    categoria: product.categoria || "",
    cor: product.cor || "",
    peso_kg_m: product.peso_kg_m?.toString() || "",
    comprimento_barra: product.comprimento_barra?.toString() || "6",
    unidade: product.unidade || "UN",
    custo: product.custo?.toString() || "",
    preco_por_kg: product.preco_por_kg?.toString() || "",
    estoque: product.estoque?.toString() || "0",
    estoque_minimo: product.estoque_minimo?.toString() || "0",
    localizacao: product.localizacao || "",
  });

  useEffect(() => {
    setFormData({
      codigo: product.codigo,
      nome: product.nome || "",
      descricao: product.descricao || "",
      categoria: product.categoria || "",
      cor: product.cor || "",
      peso_kg_m: product.peso_kg_m?.toString() || "",
      comprimento_barra: product.comprimento_barra?.toString() || "6",
      unidade: product.unidade || "UN",
      custo: product.custo?.toString() || "",
      preco_por_kg: product.preco_por_kg?.toString() || "",
      estoque: product.estoque?.toString() || "0",
      estoque_minimo: product.estoque_minimo?.toString() || "0",
      localizacao: product.localizacao || "",
    });
    setImagePreview(product.imagem_url);
  }, [product]);

  // Função para verificar se a categoria usa markup de 70%
  const isCategoriaComMarkup = (categoria: string) => {
    return categoriasComMarkup.includes(categoria.toUpperCase());
  };

  // Função para verificar se é a categoria de preço direto
  const isCategoriaPrecoDireto = (categoria: string) => {
    return categoria.toUpperCase() === CATEGORIA_PRECO_DIRETO;
  };

  // Função para verificar se é a categoria PERFIL (usa fórmula padrão)
  const isCategoriaPerfil = (categoria: string) => {
    return categoria.toUpperCase() === CATEGORIA_PERFIL;
  };

  // Função para calcular o preço baseado na categoria
  const calcularPreco = () => {
    const precoPorKg = parseFloat(formData.preco_por_kg) || 0;
    
    // Se for COMPONENTES, retorna o preço direto
    if (isCategoriaPrecoDireto(formData.categoria)) {
      return precoPorKg;
    }
    
    if (isCategoriaComMarkup(formData.categoria)) {
      // Para categorias com markup: preço por kg + 70%
      return precoPorKg * 1.7;
    } else {
      // Para PERFIL e outras categorias: cálculo normal com kg/m
      const pesoKgM = parseFloat(formData.peso_kg_m) || 0;
      const comprimentoBarra = parseFloat(formData.comprimento_barra) || 0;
      const pesoTotal = pesoKgM * comprimentoBarra;
      return pesoTotal * precoPorKg;
    }
  };

  // Função para calcular o peso total (apenas para categorias sem markup e sem preço direto)
  const calcularPesoTotal = () => {
    if (!isCategoriaComMarkup(formData.categoria) && !isCategoriaPrecoDireto(formData.categoria)) {
      const pesoKgM = parseFloat(formData.peso_kg_m) || 0;
      const comprimentoBarra = parseFloat(formData.comprimento_barra) || 0;
      return pesoKgM * comprimentoBarra;
    }
    return 0;
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const precoPorKg = parseFloat(formData.preco_por_kg);

    if (isNaN(precoPorKg)) {
      toast({
        title: "Campo obrigatório",
        description: "Preencha o preço por kg",
        variant: "destructive",
      });
      return;
    }

    // Validações específicas para categorias que precisam de peso
    const precisaPeso = !isCategoriaComMarkup(formData.categoria) && !isCategoriaPrecoDireto(formData.categoria);
    
    if (precisaPeso) {
      const pesoKgM = parseFloat(formData.peso_kg_m);
      const comprimentoBarra = parseFloat(formData.comprimento_barra);

      if (isNaN(pesoKgM) || isNaN(comprimentoBarra)) {
        toast({
          title: "Campos obrigatórios",
          description: "Para esta categoria, preencha peso/kg e comprimento da barra",
          variant: "destructive",
        });
        return;
      }
    }

    const precoVenda = calcularPreco();
    const pesoTotal = calcularPesoTotal();

    setLoading(true);

    try {
      const updateData: any = {
        codigo: formData.codigo,
        nome: formData.nome,
        descricao: formData.descricao || null,
        categoria: formData.categoria || null,
        cor: formData.cor || null,
        unidade: formData.unidade || 'UN',
        custo: formData.custo && !isNaN(parseFloat(formData.custo)) ? parseFloat(formData.custo) : 0,
        preco: precoVenda,
        preco_por_kg: precoPorKg,
        estoque: formData.estoque && !isNaN(parseInt(formData.estoque)) ? parseInt(formData.estoque) : 0,
        estoque_minimo: formData.estoque_minimo && !isNaN(parseInt(formData.estoque_minimo)) ? parseInt(formData.estoque_minimo) : 0,
        localizacao: formData.localizacao || null,
        imagem_url: imagePreview || null,
      };

      // Atualiza peso_kg_m e comprimento_barra apenas para categorias que precisam
      if (precisaPeso) {
        updateData.peso_kg_m = parseFloat(formData.peso_kg_m);
        updateData.comprimento_barra = parseFloat(formData.comprimento_barra);
        updateData.peso = pesoTotal;
      } else {
        // Para categorias com markup ou preço direto, zera esses campos
        updateData.peso_kg_m = 0;
        updateData.comprimento_barra = 0;
        updateData.peso = 0;
      }

      const { error } = await supabase
        .from('produtos')
        .update(updateData)
        .eq('id', product.id);

      if (error) throw error;

      toast({
        title: "Sucesso!",
        description: "Produto atualizado com sucesso.",
      });

      onOpenChange(false);
      setImageFile(null);
      onProductUpdated();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const usaMarkup = isCategoriaComMarkup(formData.categoria);
  const precoDireto = isCategoriaPrecoDireto(formData.categoria);
  const isPerfil = isCategoriaPerfil(formData.categoria);
  const mostraCamposPeso = !usaMarkup && !precoDireto;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Produto</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Foto do Produto</Label>
            {imagePreview ? (
              <div className="relative w-full h-48 border rounded-lg overflow-hidden">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={removeImage}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <Label htmlFor="image-upload" className="cursor-pointer text-sm text-muted-foreground">
                  Clique para fazer upload da foto
                </Label>
                <Input
                  id="image-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageChange}
                />
              </div>
            )}
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
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="categoria">Categoria</Label>
              <Input
                id="categoria"
                value={formData.categoria}
                onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                placeholder="Ex: Perfil, Componentes, Acessório, etc."
              />
              {precoDireto && (
                <p className="text-xs text-blue-600 mt-1">
                  ⚡ Categoria COMPONENTES: preço direto (sem fórmula)
                </p>
              )}
              {isPerfil && (
                <p className="text-xs text-green-600 mt-1">
                  📐 Categoria PERFIL: fórmula padrão (peso_kg/m × comprimento × preço/kg)
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="cor">Cor</Label>
              <Input
                id="cor"
                value={formData.cor}
                onChange={(e) => setFormData({ ...formData, cor: e.target.value })}
                placeholder="Ex: Natural, Preto"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unidade">Unidade</Label>
              <Input
                id="unidade"
                value={formData.unidade}
                onChange={(e) => setFormData({ ...formData, unidade: e.target.value })}
                placeholder="UN, KG, M"
              />
            </div>
          </div>

          {mostraCamposPeso && (
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="peso_kg_m">
                  {isPerfil ? "Peso kg/m *" : "Peso kg/m *"}
                </Label>
                <Input
                  id="peso_kg_m"
                  type="number"
                  step="0.001"
                  min="0"
                  required={mostraCamposPeso}
                  value={formData.peso_kg_m}
                  onChange={(e) => setFormData({ ...formData, peso_kg_m: e.target.value })}
                  placeholder="0.000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="comprimento_barra">
                  {isPerfil ? "Comprimento Barra (m) *" : "Comprimento Barra (m) *"}
                </Label>
                <Input
                  id="comprimento_barra"
                  type="number"
                  step="0.01"
                  min="0"
                  required={mostraCamposPeso}
                  value={formData.comprimento_barra}
                  onChange={(e) => setFormData({ ...formData, comprimento_barra: e.target.value })}
                  placeholder="6.00"
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="localizacao">Localização (Box/Prateleira)</Label>
            <Input
              id="localizacao"
              value={formData.localizacao}
              onChange={(e) => setFormData({ ...formData, localizacao: e.target.value })}
              placeholder="Ex: Box A1, Prateleira 3"
            />
          </div>

          <div className="border rounded-lg p-4 bg-accent/5 space-y-4">
            <h3 className="font-semibold text-sm">Preços</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="custo">Custo</Label>
                <Input
                  id="custo"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.custo}
                  onChange={(e) => setFormData({ ...formData, custo: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="preco_por_kg">
                  {precoDireto ? "Preço de Venda *" : "Preço por Kg *"}
                </Label>
                <Input
                  id="preco_por_kg"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={formData.preco_por_kg}
                  onChange={(e) => setFormData({ ...formData, preco_por_kg: e.target.value })}
                  placeholder={precoDireto ? "0.00" : "0.00"}
                />
              </div>
            </div>
            {formData.preco_por_kg && (
              <div className="text-sm bg-primary/10 p-3 rounded">
                <div className="space-y-1">
                  {precoDireto ? (
                    <>
                      <p><strong>Preço de Venda:</strong> R$ {calcularPreco().toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        ⚡ Categoria COMPONENTES: valor direto sem fórmula
                      </p>
                    </>
                  ) : usaMarkup ? (
                    <>
                      <p><strong>Preço de Venda:</strong> R$ {calcularPreco().toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Fórmula: preço/kg + 70% (markup)
                      </p>
                    </>
                  ) : (
                    <>
                      {formData.peso_kg_m && formData.comprimento_barra && (
                        <>
                          <p><strong>Peso Total:</strong> {calcularPesoTotal().toFixed(3)} kg</p>
                          <p><strong>Preço de Venda:</strong> R$ {calcularPreco().toFixed(2)}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {isPerfil ? (
                              "📐 Fórmula PERFIL: peso_kg/m × comprimento × preço/kg"
                            ) : (
                              "Fórmula: peso_kg/m × comprimento × preço/kg"
                            )}
                          </p>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="border-t pt-4 mt-4">
            <h3 className="font-semibold mb-4">Controle de Estoque</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="estoque">Quantidade em Estoque</Label>
                <div className="relative">
                  <Input
                    id="estoque"
                    type="number"
                    step="1"
                    min="0"
                    value={formData.estoque}
                    onChange={(e) => setFormData({ ...formData, estoque: e.target.value })}
                    placeholder="0"
                  />
                  <div className="text-xs text-muted-foreground mt-1">
                    Disponível: {product.estoque || 0} unidades
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="estoque_minimo">Estoque Mínimo</Label>
                <Input
                  id="estoque_minimo"
                  type="number"
                  step="1"
                  min="0"
                  value={formData.estoque_minimo}
                  onChange={(e) => setFormData({ ...formData, estoque_minimo: e.target.value })}
                  placeholder="10"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}