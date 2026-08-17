// @ts-nocheck - Temporary fix until Supabase types are regenerated
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Package, Pencil } from "lucide-react";
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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import AddProductDialog from "@/components/produtos/AddProductDialog";
import EditProductDialog from "@/components/produtos/EditProductDialog";
import { useAuth } from "@/hooks/useAuth";

interface Product {
  id: string;
  codigo: string;
  nome: string | null;
  descricao: string | null;
  tipo: string | null;
  cor: string | null;
  liga: string | null;
  peso: number | null;
  unidade: string;
  preco_custo: number | null;
  preco_venda: number;
  preco_por_kg: number | null;
  imagem_url: string | null;
  localizacao: string | null;
}

export default function Produtos() {
  const [searchTerm, setSearchTerm] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const { isAdmin } = useAuth();

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('produtos')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProducts(data || []);
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
    fetchProducts();
  }, []);

  const filteredProducts = products.filter((product) =>
    (product.descricao?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (product.codigo?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (product.nome?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h2 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Produtos</h2>
          <p className="text-muted-foreground text-lg">Gerencie seu catálogo de produtos</p>
        </div>
        {isAdmin && <AddProductDialog onProductAdded={fetchProducts} />}
      </div>

      <Card className="border-0 shadow-lg">
        <div className="h-2 w-full bg-gradient-to-r from-primary via-accent to-primary"></div>
        <CardHeader className="bg-gradient-to-br from-white to-blue-50/30">
          <CardTitle className="flex items-center gap-2 text-xl">
            <div className="p-2 rounded-lg bg-gradient-to-br from-primary/10 to-accent/10">
              <Package className="h-5 w-5 text-primary" />
            </div>
            Lista de Produtos
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
                className="pl-11 h-12 border-border/50 focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Carregando produtos...
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Foto</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Cor</TableHead>
                  <TableHead>Localização</TableHead>
                  <TableHead className="text-right">Preço/kg</TableHead>
                  {isAdmin && <TableHead className="text-right">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 8 : 7} className="text-center py-8 text-muted-foreground">
                      Nenhum produto cadastrado. {isAdmin && "Clique em 'Novo Produto' para adicionar."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProducts.map((product) => (
                    <TableRow key={product.id} className="hover:bg-gradient-to-r hover:from-primary/5 hover:to-accent/5 transition-all duration-200">
                      <TableCell>
                        {product.imagem_url ? (
                          <img
                            src={product.imagem_url}
                            alt={product.descricao}
                            className="w-14 h-14 object-cover rounded-lg shadow-md"
                          />
                        ) : (
                          <div className="w-14 h-14 bg-gradient-to-br from-primary/10 to-accent/10 rounded-lg flex items-center justify-center shadow-sm">
                            <Package className="h-7 w-7 text-primary" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{product.codigo}</TableCell>
                      <TableCell>{product.descricao}</TableCell>
                      <TableCell>
                        {product.tipo ? (
                          <Badge variant="secondary">{product.tipo}</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>{product.cor || "-"}</TableCell>
                      <TableCell>{product.localizacao || "-"}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {product.preco_por_kg ? `R$ ${product.preco_por_kg.toFixed(2)}/kg` : "-"}
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingProduct(product)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {editingProduct && (
        <EditProductDialog
          product={editingProduct}
          open={!!editingProduct}
          onOpenChange={(open) => !open && setEditingProduct(null)}
          onProductUpdated={fetchProducts}
        />
      )}
    </div>
  );
}