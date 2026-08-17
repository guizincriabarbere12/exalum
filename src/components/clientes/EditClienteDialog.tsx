// @ts-nocheck - Temporary fix until Supabase types are regenerated
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Cliente {
  id: string;
  nome: string;
  cpf_cnpj: string;
  inscricao_estadual: string;
  telefone: string;
  email: string;
  cep: string;
  endereco: string;
  bairro: string;
  cidade: string;
  estado: string;
}

interface EditClienteDialogProps {
  cliente: Cliente | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClienteUpdated: () => void;
}

export default function EditClienteDialog({
  cliente,
  open,
  onOpenChange,
  onClienteUpdated,
}: EditClienteDialogProps) {
  const [loading, setLoading] = useState(false);
  const [loadingCep, setLoadingCep] = useState(false);
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

  useEffect(() => {
    if (cliente) {
      setFormData({
        nome: cliente.nome || "",
        cpf_cnpj: cliente.cpf_cnpj || "",
        inscricao_estadual: cliente.inscricao_estadual || "",
        telefone: cliente.telefone || "",
        email: cliente.email || "",
        cep: cliente.cep || "",
        endereco: cliente.endereco || "",
        bairro: cliente.bairro || "",
        cidade: cliente.cidade || "",
        estado: cliente.estado || "",
      });
    }
  }, [cliente]);

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
        toast({
          title: "CEP encontrado!",
          description: "Endereço preenchido automaticamente.",
        });
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
    if (!cliente) return;

    setLoading(true);

    try {
      const { error } = await supabase
        .from('clientes')
        .update({
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
        })
        .eq('id', cliente.id);

      if (error) throw error;

      toast({
        title: "Sucesso!",
        description: "Cliente atualizado com sucesso.",
      });

      onOpenChange(false);
      onClienteUpdated();
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Cliente</DialogTitle>
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
