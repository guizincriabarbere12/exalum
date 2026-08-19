// @ts-nocheck - Temporary fix until Supabase types are regenerated
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { logActivity } from "@/lib/auditLog";

interface DadosFiscaisProdutoDialogProps {
  produtoId: string;
  produtoNome: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

interface FiscalFields {
  ncm: string;
  cfop: string;
  cst_icms: string;
  origem_mercadoria: number;
  cest: string;
}

export default function DadosFiscaisProdutoDialog({
  produtoId,
  produtoNome,
  open,
  onOpenChange,
  onSaved,
}: DadosFiscaisProdutoDialogProps) {
  const [dados, setDados] = useState<FiscalFields>({
    ncm: "",
    cfop: "5102",
    cst_icms: "060",
    origem_mercadoria: 0,
    cest: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("produtos")
        .select("ncm, cfop, cst_icms, origem_mercadoria, cest")
        .eq("id", produtoId)
        .single();

      if (!error && data) {
        setDados({
          ncm: data.ncm || "",
          cfop: data.cfop || "5102",
          cst_icms: data.cst_icms || "060",
          origem_mercadoria: data.origem_mercadoria ?? 0,
          cest: data.cest || "",
        });
      }
      setLoading(false);
    })();
  }, [open, produtoId]);

  const handleSave = async () => {
    if (!dados.ncm) {
      toast({ title: "NCM é obrigatório", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("produtos")
        .update({
          ncm: dados.ncm,
          cfop: dados.cfop,
          cst_icms: dados.cst_icms,
          origem_mercadoria: dados.origem_mercadoria,
          cest: dados.cest || null,
        })
        .eq("id", produtoId);

      if (error) throw error;

      await logActivity({
        acao: "atualizar",
        entidade: "produto_fiscal",
        entidadeId: produtoId,
        descricao: `Atualizou os dados fiscais (NCM/CFOP/CST) de ${produtoNome}`,
      });

      toast({ title: "Dados fiscais salvos" });
      onSaved?.();
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dados fiscais — {produtoNome}</DialogTitle>
          <DialogDescription>Necessário pra incluir esse produto numa NF-e. Confirme com seu contador.</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="text-center py-4 text-muted-foreground">Carregando...</div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>NCM *</Label>
              <Input
                value={dados.ncm}
                onChange={(e) => setDados({ ...dados, ncm: e.target.value })}
                placeholder="8 dígitos, ex: 7610.10.00"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>CFOP</Label>
                <Input value={dados.cfop} onChange={(e) => setDados({ ...dados, cfop: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>CST ICMS</Label>
                <Input value={dados.cst_icms} onChange={(e) => setDados({ ...dados, cst_icms: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Origem da Mercadoria</Label>
                <Select
                  value={String(dados.origem_mercadoria)}
                  onValueChange={(value) => setDados({ ...dados, origem_mercadoria: Number(value) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">0 - Nacional</SelectItem>
                    <SelectItem value="1">1 - Estrangeira (importação direta)</SelectItem>
                    <SelectItem value="2">2 - Estrangeira (mercado interno)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>CEST (opcional)</Label>
                <Input value={dados.cest} onChange={(e) => setDados({ ...dados, cest: e.target.value })} />
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
