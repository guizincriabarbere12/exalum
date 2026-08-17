// components/conferencia/ListaFotosConferencia.tsx
import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Camera, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface FotoConferencia {
  id: number;
  produto_codigo: string;
  produto_nome: string;
  foto_base64: string;
  created_at: string;
}

interface ListaFotosConferenciaProps {
  orcamentoId: string;
  onUpdate?: () => void;
}

export function ListaFotosConferencia({ orcamentoId, onUpdate }: ListaFotosConferenciaProps) {
  const [fotos, setFotos] = useState<FotoConferencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [fotoSelecionada, setFotoSelecionada] = useState<string | null>(null);

  const carregarFotos = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("conferencia_fotos")
        .select("*")
        .eq("orcamento_id", orcamentoId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setFotos(data || []);
    } catch (error: any) {
      console.error("Erro:", error);
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (orcamentoId) carregarFotos();
  }, [orcamentoId]);

  const formatarData = (data: string) => {
    return new Date(data).toLocaleString("pt-BR");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (fotos.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Camera className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Nenhuma foto registrada ainda</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm">Total: {fotos.length} foto(s)</p>
        <Button variant="outline" size="sm" onClick={carregarFotos}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {fotos.map((foto) => (
          <Card key={foto.id} className="overflow-hidden cursor-pointer" onClick={() => setFotoSelecionada(foto.foto_base64)}>
            <div className="aspect-video bg-muted">
              <img src={foto.foto_base64} alt={foto.produto_nome} className="w-full h-full object-cover" />
            </div>
            <CardContent className="p-3">
              <p className="font-semibold">{foto.produto_nome}</p>
              <p className="text-sm text-muted-foreground">{foto.produto_codigo}</p>
              <p className="text-xs text-muted-foreground mt-1">{formatarData(foto.created_at)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!fotoSelecionada} onOpenChange={() => setFotoSelecionada(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Foto da Conferência</DialogTitle>
          </DialogHeader>
          {fotoSelecionada && <img src={fotoSelecionada} alt="Foto" className="w-full rounded-lg" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}