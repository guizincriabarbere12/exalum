import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  User, 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  CreditCard,
  Settings,
  Plus,
  Minus
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ClienteSaldo {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  documento: string;
  saldo: number; // Positivo = devedor, Negativo = credor
  limite_credito: number;
  status: "ativo" | "inativo" | "bloqueado";
}

interface CreditoFormData {
  cliente_id: string;
  valor_credito: number;
  tipo: "adicionar_credor" | "remover_credor" | "definir_limite";
  observacao: string;
}

const SaldoClientes = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("todos");
  const [selectedCliente, setSelectedCliente] = useState<ClienteSaldo | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [creditoForm, setCreditoForm] = useState<CreditoFormData>({
    cliente_id: "",
    valor_credito: 0,
    tipo: "adicionar_credor",
    observacao: ""
  });
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Buscar clientes com seus dados
  const { data: clientes, isLoading } = useQuery({
    queryKey: ["clientes-saldo"],
    queryFn: async () => {
      console.log("Buscando clientes...");
      
      const { data: clientesData, error: clientesError } = await supabase
        .from("clientes")
        .select("*")
        .order('nome');

      if (clientesError) throw clientesError;

      if (!clientesData || clientesData.length === 0) {
        return [];
      }

      // Por enquanto, vamos usar apenas o limite_credito da tabela clientes
      // O saldo será gerenciado manualmente através do campo saldo_credor
      const clientesComDados = clientesData.map((cliente) => ({
        id: cliente.id,
        nome: cliente.nome,
        email: cliente.email || "",
        telefone: cliente.telefone || "",
        documento: cliente.documento || "",
        saldo: cliente.saldo_credor || 0, // Usando o campo saldo_credor da tabela
        limite_credito: cliente.limite_credito || 0,
        status: cliente.status || "ativo"
      }));

      return clientesComDados;
    },
  });

  // Mutation para atualizar saldo credor
  const updateSaldoCredor = useMutation({
    mutationFn: async ({ clienteId, novoSaldo }: { clienteId: string; novoSaldo: number }) => {
      const { error } = await supabase
        .from("clientes")
        .update({ saldo_credor: novoSaldo })
        .eq("id", clienteId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientes-saldo"] });
      toast({
        title: "Sucesso!",
        description: "Saldo atualizado com sucesso.",
      });
    },
    onError: (error) => {
      console.error("Erro ao atualizar saldo:", error);
      toast({
        title: "Erro!",
        description: "Não foi possível atualizar o saldo.",
        variant: "destructive",
      });
    },
  });

  // Mutation para atualizar limite de crédito
  const updateLimiteCredito = useMutation({
    mutationFn: async ({ clienteId, novoLimite }: { clienteId: string; novoLimite: number }) => {
      const { error } = await supabase
        .from("clientes")
        .update({ limite_credito: novoLimite })
        .eq("id", clienteId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientes-saldo"] });
      toast({
        title: "Sucesso!",
        description: "Limite de crédito atualizado.",
      });
    },
    onError: (error) => {
      console.error("Erro ao atualizar limite:", error);
      toast({
        title: "Erro!",
        description: "Não foi possível atualizar o limite.",
        variant: "destructive",
      });
    },
  });

  const handleSubmitCredito = async () => {
    if (creditoForm.valor_credito <= 0) {
      toast({
        title: "Erro!",
        description: "O valor deve ser maior que zero.",
        variant: "destructive",
      });
      return;
    }

    if (!selectedCliente) return;

    try {
      if (creditoForm.tipo === "definir_limite") {
        // Atualizar apenas o limite
        await updateLimiteCredito.mutateAsync({
          clienteId: selectedCliente.id,
          novoLimite: creditoForm.valor_credito
        });
      } else {
        // Atualizar saldo credor
        let novoSaldo = selectedCliente.saldo;
        
        if (creditoForm.tipo === "adicionar_credor") {
          // Adicionar crédito (aumenta saldo credor = fica mais negativo)
          novoSaldo = selectedCliente.saldo - creditoForm.valor_credito;
        } else if (creditoForm.tipo === "remover_credor") {
          // Remover crédito (diminui saldo credor = fica menos negativo)
          novoSaldo = selectedCliente.saldo + creditoForm.valor_credito;
        }

        await updateSaldoCredor.mutateAsync({
          clienteId: selectedCliente.id,
          novoSaldo: novoSaldo
        });
      }

      // Fechar dialog após sucesso
      setIsDialogOpen(false);
      setSelectedCliente(null);
      setCreditoForm({
        cliente_id: "",
        valor_credito: 0,
        tipo: "adicionar_credor",
        observacao: ""
      });

    } catch (error) {
      console.error("Erro na operação:", error);
      toast({
        title: "Erro!",
        description: "Não foi possível completar a operação.",
        variant: "destructive",
      });
    }
  };

  const filteredClientes = clientes?.filter((cliente: ClienteSaldo) => {
    const matchesSearch = 
      cliente.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cliente.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cliente.telefone.includes(searchTerm) ||
      cliente.documento.includes(searchTerm);
    
    const matchesStatus = filterStatus === "todos" || cliente.status === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ativo":
        return "bg-green-500";
      case "inativo":
        return "bg-gray-500";
      case "bloqueado":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  const getSaldoColor = (saldo: number, limite: number) => {
    if (saldo > limite) return "text-red-600 font-semibold"; // Devedor acima do limite
    if (saldo > 0) return "text-orange-600 font-semibold"; // Devedor dentro do limite
    if (saldo < 0) return "text-green-600 font-semibold"; // Credor (tem crédito)
    return "text-gray-600";
  };

  const handleOpenDialog = (cliente: ClienteSaldo) => {
    setSelectedCliente(cliente);
    setCreditoForm({
      cliente_id: cliente.id,
      valor_credito: 0,
      tipo: "adicionar_credor",
      observacao: ""
    });
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Saldo de Clientes</h1>
      </div>

      {/* Cards de Resumo */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total a Receber</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(filteredClientes?.reduce((acc, c) => acc + (c.saldo > 0 ? c.saldo : 0), 0) || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Clientes com saldo devedor
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total em Créditos</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(Math.abs(filteredClientes?.reduce((acc, c) => acc + (c.saldo < 0 ? c.saldo : 0), 0) || 0))}
            </div>
            <p className="text-xs text-muted-foreground">
              Clientes com saldo credor
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Limite Total</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(filteredClientes?.reduce((acc, c) => acc + c.limite_credito, 0) || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Limite de crédito total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo Líquido</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(filteredClientes?.reduce((acc, c) => acc + c.saldo, 0) || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {(filteredClientes?.reduce((acc, c) => acc + c.saldo, 0) || 0) > 0 
                ? "Saldo devedor total" 
                : "Saldo credor total"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros e Busca */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>
            Filtre os clientes por nome, email, telefone ou documento
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar cliente..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={filterStatus === "todos" ? "default" : "outline"}
                onClick={() => setFilterStatus("todos")}
              >
                Todos
              </Button>
              <Button
                variant={filterStatus === "ativo" ? "default" : "outline"}
                onClick={() => setFilterStatus("ativo")}
              >
                Ativos
              </Button>
              <Button
                variant={filterStatus === "inativo" ? "default" : "outline"}
                onClick={() => setFilterStatus("inativo")}
              >
                Inativos
              </Button>
              <Button
                variant={filterStatus === "bloqueado" ? "default" : "outline"}
                onClick={() => setFilterStatus("bloqueado")}
              >
                Bloqueados
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Saldos */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Clientes</CardTitle>
          <CardDescription>
            {clientes?.length || 0} clientes encontrados
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : !clientes || clientes.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">Nenhum cliente encontrado</p>
              <Button variant="outline" onClick={() => window.location.reload()}>
                Recarregar
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Contato/Documento</TableHead>
                  <TableHead className="text-right">Limite</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead className="text-right">Disponível</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClientes?.map((cliente: ClienteSaldo) => {
                  const disponivel = cliente.limite_credito - (cliente.saldo > 0 ? cliente.saldo : 0);
                  
                  return (
                    <TableRow key={cliente.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{cliente.nome}</p>
                            <p className="text-sm text-muted-foreground">{cliente.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p>{cliente.telefone}</p>
                          <p className="text-sm text-muted-foreground">{cliente.documento}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(cliente.limite_credito)}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={getSaldoColor(cliente.saldo, cliente.limite_credito)}>
                          {formatCurrency(Math.abs(cliente.saldo))}
                          {cliente.saldo > 0 ? " (D)" : cliente.saldo < 0 ? " (C)" : ""}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={disponivel >= 0 ? "text-green-600" : "text-red-600"}>
                          {formatCurrency(Math.max(0, disponivel))}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(cliente.status)}>
                          {cliente.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenDialog(cliente)}
                          className="hover:bg-primary/10"
                        >
                          <Settings className="h-4 w-4 mr-1" />
                          Gerenciar
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog para Gerenciar Crédito */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gerenciar Crédito - {selectedCliente?.nome}</DialogTitle>
            <DialogDescription>
              {selectedCliente?.saldo < 0 
                ? `Cliente tem crédito de ${formatCurrency(Math.abs(selectedCliente.saldo))} a favor` 
                : selectedCliente?.saldo > 0 
                ? `Cliente deve ${formatCurrency(selectedCliente.saldo)}` 
                : "Cliente está com saldo zero"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Tipo de Operação</label>
              <Select
                value={creditoForm.tipo}
                onValueChange={(value: "adicionar_credor" | "remover_credor" | "definir_limite") => 
                  setCreditoForm({ ...creditoForm, tipo: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="adicionar_credor">
                    <div className="flex items-center gap-2">
                      <Plus className="h-4 w-4 text-green-600" />
                      Adicionar Crédito (Saldo Credor)
                    </div>
                  </SelectItem>
                  <SelectItem value="remover_credor">
                    <div className="flex items-center gap-2">
                      <Minus className="h-4 w-4 text-red-600" />
                      Remover Crédito
                    </div>
                  </SelectItem>
                  <SelectItem value="definir_limite">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4" />
                      Definir Limite de Crédito
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                {creditoForm.tipo === "definir_limite" ? "Novo Limite" : "Valor do Crédito"}
              </label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0,00"
                value={creditoForm.valor_credito || ""}
                onChange={(e) => setCreditoForm({ 
                  ...creditoForm, 
                  valor_credito: parseFloat(e.target.value) || 0 
                })}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Observação</label>
              <Input
                placeholder="Motivo da alteração..."
                value={creditoForm.observacao}
                onChange={(e) => setCreditoForm({ 
                  ...creditoForm, 
                  observacao: e.target.value 
                })}
              />
            </div>

            {selectedCliente && (
              <div className="bg-muted p-3 rounded-lg space-y-1">
                <p className="text-sm">
                  <span className="font-medium">Limite Atual:</span> {formatCurrency(selectedCliente.limite_credito)}
                </p>
                <p className="text-sm">
                  <span className="font-medium">Saldo Atual:</span> {formatCurrency(Math.abs(selectedCliente.saldo))}
                  {selectedCliente.saldo > 0 ? " (Devedor)" : selectedCliente.saldo < 0 ? " (Credor)" : ""}
                </p>
                <p className="text-sm">
                  <span className="font-medium">Disponível:</span> {formatCurrency(Math.max(0, selectedCliente.limite_credito - (selectedCliente.saldo > 0 ? selectedCliente.saldo : 0)))}
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmitCredito} disabled={updateSaldoCredor.isPending || updateLimiteCredito.isPending}>
              {updateSaldoCredor.isPending || updateLimiteCredito.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SaldoClientes;