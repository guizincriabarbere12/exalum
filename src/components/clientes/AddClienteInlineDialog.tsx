// @ts-nocheck - Temporary fix until Supabase types are regenerated
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface AddClienteInlineDialogProps {
  onClienteAdded: (cliente: { id: string; nome: string; cpf_cnpj: string }) => void;
  buttonText?: string;
  buttonVariant?: "default" | "outline" | "secondary" | "ghost" | "link" | "destructive";
  buttonSize?: "default" | "sm" | "lg" | "icon";
}

export default function AddClienteInlineDialog({
  onClienteAdded,
  buttonText = "Novo Cliente",
  buttonVariant = "outline",
  buttonSize = "sm",
}: AddClienteInlineDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    nome: "",
    cpf_cnpj: "",
    inscricao_estadual: "",
    telefone: "",
    email: "",
    cep: "",
    endereco: "",
    bairro: "",
    cidade: "",
    estado: "",
  });
  const [loadingCep, setLoadingCep] = useState(false);

  const buscarCep = async (cep: string) => {
    const cepLimpo = cep.replace(/\D/g, '');
    if (cepLimpo.length !== 8) return;

    setLoadingCep(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
      const data = await response.json();

      if (!data.erro) {
        setFormData(prev => ({
          ...prev,
          endereco: data.logradouro || '',
          bairro: data.bairro || '',
          cidade: data.localidade || '',
          estado: data.uf || '',
        }));
      } else {
        toast({
          title: "CEP não encontrado",
          description: "Verifique o CEP digitado.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Erro ao buscar CEP",
        description: "Não foi possível buscar o endereço.",
        variant: "destructive",
      });
    } finally {
      setLoadingCep(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.from('clientes').insert({
        nome: formData.nome,
        cpf_cnpj: formData.cpf_cnpj,
        inscricao_estadual: formData.inscricao_estadual || null,
        telefone: formData.telefone || null,
        email: formData.email || null,
        cep: formData.cep || null,
        endereco: formData.endereco || null,
        bairro: formData.bairro || null,
        cidade: formData.cidade || null,
        estado: formData.estado || null,
      }).select('id, nome, cpf_cnpj').single();

      if (error) throw error;

      toast({
        title: "Sucesso!",
        description: "Cliente adicionado com sucesso.",
      });

      setOpen(false);
      setFormData({
        nome: "",
        cpf_cnpj: "",
        inscricao_estadual: "",
        telefone: "",
        email: "",
        cep: "",
        endereco: "",
        bairro: "",
        cidade: "",
        estado: "",
      });
      onClienteAdded(data);
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        variant={buttonVariant}
        size={buttonSize}
        className="gap-1 shrink-0"
        onClick={() => setOpen(true)}
      >
        <Plus className="h-4 w-4" />
        {buttonText}
      </Button>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cadastrar Novo Cliente</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome *</Label>
            <Input
              id="nome"
              required
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cpf_cnpj">CPF/CNPJ *</Label>
              <Input
                id="cpf_cnpj"
                required
                value={formData.cpf_cnpj}
                onChange={(e) => setFormData({ ...formData, cpf_cnpj: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inscricao_estadual">Inscrição Estadual</Label>
              <Input
                id="inscricao_estadual"
                value={formData.inscricao_estadual}
                onChange={(e) => setFormData({ ...formData, inscricao_estadual: e.target.value })}
                placeholder="Apenas para PJ"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone</Label>
              <Input
                id="telefone"
                value={formData.telefone}
                onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cep">CEP</Label>
            <Input
              id="cep"
              value={formData.cep}
              onChange={(e) => setFormData({ ...formData, cep: e.target.value })}
              onBlur={(e) => buscarCep(e.target.value)}
              placeholder="00000-000"
              maxLength={9}
            />
            {loadingCep && <p className="text-xs text-muted-foreground">Buscando endereço...</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="endereco">Endereço</Label>
            <Input
              id="endereco"
              value={formData.endereco}
              onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
              placeholder="Rua, Avenida, etc."
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="bairro">Bairro</Label>
              <Input
                id="bairro"
                value={formData.bairro}
                onChange={(e) => setFormData({ ...formData, bairro: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cidade">Cidade</Label>
              <Input
                id="cidade"
                value={formData.cidade}
                onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="estado">Estado (UF)</Label>
              <Input
                id="estado"
                value={formData.estado}
                onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
                maxLength={2}
                placeholder="SP"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : "Salvar Cliente"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
