// @ts-nocheck - Temporary fix until Supabase types are regenerated
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface AddTransactionDialogProps {
  onTransactionAdded: () => void;
  transactionToEdit?: any | null;
  onEditComplete?: () => void;
}

const CATEGORIAS_DESPESA = [
  "Fornecedor",
  "Fixo",
  "Variável",
  "Funcionário",
  "Pessoal",
  "Investimento",
  "Transportadora",
  "Prejuízo"
];

const CONTAS_BANCARIAS = [
  "Banco",
  "Itaú",
  "Cora",
  "Nubank Jessica PJ",
  "Mercado Pago"
];

export default function AddTransactionDialog({ 
  onTransactionAdded, 
  transactionToEdit = null,
  onEditComplete 
}: AddTransactionDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [schemaChecked, setSchemaChecked] = useState(false);
  const [selectedCategorias, setSelectedCategorias] = useState<string[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [temEntrada, setTemEntrada] = useState(false);
  const [valorEntrada, setValorEntrada] = useState("");
  const [formData, setFormData] = useState({
    descricao: "",
    tipo: "receita",
    categoria: "",
    valor: "",
    data: new Date().toISOString().split('T')[0],
    status: "pendente",
    forma_pagamento: "",
    conta_bancaria: "",
    data_vencimento: "",
    data_pagamento: "",
    numero_parcela: "",
    total_parcelas: "",
    observacoes: "",
  });

  useEffect(() => {
    if (transactionToEdit) {
      setIsEditing(true);
      setOpen(true);
      
      let categoriasArray: string[] = [];
      if (transactionToEdit.tipo === 'despesa' && transactionToEdit.categoria) {
        categoriasArray = transactionToEdit.categoria.split(',').map(cat => cat.trim());
      }
      setSelectedCategorias(categoriasArray);
      
      let contaBancaria = transactionToEdit.conta_bancaria || '';
      let observacoes = transactionToEdit.observacoes || '';
      
      if (!contaBancaria && observacoes && observacoes.includes('Conta:')) {
        const match = observacoes.match(/Conta:\s*([^|]+)/);
        if (match) {
          contaBancaria = match[1].trim();
          observacoes = observacoes.replace(/\s*\|\s*Conta:\s*[^|]+/, '').trim();
        }
      }

      setFormData({
        descricao: transactionToEdit.descricao || "",
        tipo: transactionToEdit.tipo || "receita",
        categoria: transactionToEdit.categoria || "",
        valor: transactionToEdit.valor?.toString() || "",
        data: transactionToEdit.data?.split('T')[0] || new Date().toISOString().split('T')[0],
        status: transactionToEdit.status || "pendente",
        forma_pagamento: transactionToEdit.forma_pagamento || "",
        conta_bancaria: contaBancaria,
        data_vencimento: transactionToEdit.data_vencimento?.split('T')[0] || "",
        data_pagamento: transactionToEdit.data_pagamento?.split('T')[0] || "",
        numero_parcela: transactionToEdit.numero_parcela || "",
        total_parcelas: transactionToEdit.total_parcelas?.toString() || "",
        observacoes: observacoes || "",
      });
    }
  }, [transactionToEdit]);

  useEffect(() => {
    if (!isEditing) {
      if (formData.tipo === "receita") {
        setFormData(prev => ({ ...prev, status: "recebido" }));
      } else if (formData.tipo === "despesa") {
        setFormData(prev => ({ ...prev, status: "pendente" }));
      }
    }
  }, [formData.tipo, isEditing]);

  const calcularDataParcela = (dataBase: string, numeroParcela: number) => {
    const data = new Date(dataBase);
    data.setMonth(data.getMonth() + numeroParcela); // +numeroParcela ao invés de numeroParcela-1
    return data.toISOString().split('T')[0];
  };

  const checkAndCreateColumn = async () => {
    try {
      const { error } = await supabase
        .from('transacoes_financeiras')
        .select('id')
        .limit(1);

      setSchemaChecked(true);
    } catch (error) {
      console.error('Erro ao verificar schema:', error);
      setSchemaChecked(true);
    }
  };

  useEffect(() => {
    if (open) {
      checkAndCreateColumn();
    }
  }, [open]);

  const handleClose = () => {
    setOpen(false);
    setIsEditing(false);
    setTemEntrada(false);
    setValorEntrada("");
    setFormData({
      descricao: "",
      tipo: "receita",
      categoria: "",
      valor: "",
      data: new Date().toISOString().split('T')[0],
      status: "pendente",
      forma_pagamento: "",
      conta_bancaria: "",
      data_vencimento: "",
      data_pagamento: "",
      numero_parcela: "",
      total_parcelas: "",
      observacoes: "",
    });
    setSelectedCategorias([]);
    if (onEditComplete) onEditComplete();
  };

  const handleCategoriaChange = (categoria: string) => {
    if (selectedCategorias.includes(categoria)) {
      setSelectedCategorias(selectedCategorias.filter(cat => cat !== categoria));
    } else {
      setSelectedCategorias([...selectedCategorias, categoria]);
    }
  };

  // Arredonda para 2 casas decimais evitando imprecisão de ponto flutuante
  const arredondar = (valor: number) => Math.round(valor * 100) / 100;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!schemaChecked) {
      toast({
        title: "Aguarde",
        description: "Verificando estrutura do banco de dados...",
        variant: "destructive",
      });
      return;
    }
    
    setLoading(true);

    try {
      const valorTotal = arredondar(parseFloat(formData.valor));
      
      if (isNaN(valorTotal) || valorTotal <= 0) {
        throw new Error("Valor inválido. Insira um valor maior que zero.");
      }

      const dadosBase: any = {
        tipo: formData.tipo,
        categoria: formData.tipo === "despesa" 
          ? selectedCategorias.join(", ") 
          : formData.categoria || null,
        forma_pagamento: formData.forma_pagamento || null,
        data: formData.data,
        observacoes: formData.observacoes || null,
      };

      if (formData.conta_bancaria) {
        dadosBase.conta_bancaria = formData.conta_bancaria;
        if (dadosBase.observacoes) {
          dadosBase.observacoes += ` | Conta: ${formData.conta_bancaria}`;
        } else {
          dadosBase.observacoes = `Conta: ${formData.conta_bancaria}`;
        }
      }

      if (isEditing && transactionToEdit) {
        const dadosUpdate = {
          ...dadosBase,
          descricao: formData.descricao,
          valor: valorTotal,
          status: formData.status,
          data_vencimento: formData.data_vencimento || null,
          data_pagamento: formData.data_pagamento || null,
          numero_parcela: formData.numero_parcela || null,
        };

        const { error } = await supabase
          .from('transacoes_financeiras')
          .update(dadosUpdate)
          .eq('id', transactionToEdit.id);

        if (error) throw error;

        toast({
          title: "Sucesso!",
          description: "Transação atualizada com sucesso.",
        });

      } else {
        let transacoes = [];
        const totalParcelas = formData.total_parcelas ? parseInt(formData.total_parcelas) : 0;

        // Determina se realmente tem entrada: checkbox marcado E valor preenchido e > 0
        const valorEntradaNum = arredondar(parseFloat(valorEntrada) || 0);
        const usarEntrada = temEntrada && valorEntradaNum > 0;

        if (totalParcelas > 0) {
          
          if (usarEntrada) {
            if (valorEntradaNum >= valorTotal) {
              throw new Error("Valor da entrada não pode ser maior ou igual ao valor total.");
            }

            const valorRestante = arredondar(valorTotal - valorEntradaNum);
            // Calcula parcelas com arredondamento; a última absorve o centavo residual
            const valorParcelaBase = arredondar(Math.floor((valorRestante / totalParcelas) * 100) / 100);
            const somaParcelasBase = arredondar(valorParcelaBase * (totalParcelas - 1));
            const valorUltimaParcela = arredondar(valorRestante - somaParcelasBase);

            // 1. Criar ENTRADA
            transacoes.push({
              ...dadosBase,
              descricao: `${formData.descricao} - ENTRADA`,
              valor: valorEntradaNum,
              status: "recebido",
              data_vencimento: formData.data,
              data_pagamento: formData.data,
              numero_parcela: "ENTRADA",
            });

            // 2. Criar PARCELAS
            for (let i = 1; i <= totalParcelas; i++) {
              const dataVencimentoParcela = formData.data_vencimento 
                ? calcularDataParcela(formData.data_vencimento, i - 1)
                : calcularDataParcela(formData.data, i);

              const valorParcela = i === totalParcelas ? valorUltimaParcela : valorParcelaBase;

              transacoes.push({
                ...dadosBase,
                descricao: `${formData.descricao} - PARCELA ${i}/${totalParcelas}`,
                valor: valorParcela,
                status: "pendente",
                data_vencimento: dataVencimentoParcela,
                data_pagamento: null,
                numero_parcela: `${i}/${totalParcelas}`,
              });
            }
          } else {
            // CASO: Apenas parcelas (sem entrada)
            // Calcula com arredondamento; a última parcela absorve o centavo residual
            const valorParcelaBase = arredondar(Math.floor((valorTotal / totalParcelas) * 100) / 100);
            const somaParcelasBase = arredondar(valorParcelaBase * (totalParcelas - 1));
            const valorUltimaParcela = arredondar(valorTotal - somaParcelasBase);
            
            for (let i = 1; i <= totalParcelas; i++) {
              const dataVencimentoParcela = formData.data_vencimento 
                ? calcularDataParcela(formData.data_vencimento, i - 1)
                : calcularDataParcela(formData.data, i - 1);

              const valorParcela = i === totalParcelas ? valorUltimaParcela : valorParcelaBase;

              transacoes.push({
                ...dadosBase,
                descricao: `${formData.descricao} - PARCELA ${i}/${totalParcelas}`,
                valor: valorParcela,
                status: "pendente",
                data_vencimento: dataVencimentoParcela,
                data_pagamento: null,
                numero_parcela: `${i}/${totalParcelas}`,
              });
            }
          }
        } else {
          // CASO: Transação única
          transacoes.push({
            ...dadosBase,
            descricao: formData.descricao,
            valor: valorTotal,
            status: formData.status,
            data_vencimento: formData.data_vencimento || formData.data,
            data_pagamento: formData.status === "recebido" || formData.status === "pago" ? formData.data : null,
            numero_parcela: formData.numero_parcela || null,
          });
        }

        const { error } = await supabase
          .from('transacoes_financeiras')
          .insert(transacoes);

        if (error) {
          if (error.message.includes('conta_bancaria')) {
            const transacoesSemConta = transacoes.map(t => {
              const { conta_bancaria, ...rest } = t;
              return rest;
            });
            const { error: retryError } = await supabase
              .from('transacoes_financeiras')
              .insert(transacoesSemConta);
            if (retryError) throw retryError;
          } else {
            throw error;
          }
        }

        const quantidade = transacoes.length;
        let mensagem = `${quantidade} transação(ões) registrada(s) com sucesso.`;
        
        if (usarEntrada) {
          mensagem += ` Entrada de R$ ${valorEntradaNum.toFixed(2)} já contabilizada como RECEBIDA.`;
        }

        toast({
          title: "Sucesso!",
          description: mensagem,
        });
      }

      handleClose();
      onTransactionAdded();
      
    } catch (error: any) {
      console.error('Erro detalhado:', error);
      toast({
        title: isEditing ? "Erro ao atualizar" : "Erro ao salvar",
        description: error.message || "Não foi possível salvar a transação",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => {
      if (!open) handleClose();
      else setOpen(open);
    }}>
      <DialogTrigger asChild>
        {!isEditing ? (
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Nova Transação
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="gap-1">
            <Pencil className="h-3 w-3" />
            Editar
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar Transação" : "Registrar Transação"}
          </DialogTitle>
        </DialogHeader>
        
        {!schemaChecked && (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md mb-4">
            <p className="text-sm text-yellow-800">
              Verificando estrutura do banco de dados...
            </p>
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição *</Label>
            <Input
              id="descricao"
              required
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              placeholder="Ex: ORC-00014 - TESTES"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo *</Label>
              <Select
                value={formData.tipo}
                onValueChange={(value) => {
                  setFormData({ ...formData, tipo: value });
                  if (!isEditing) {
                    setSelectedCategorias([]);
                  }
                }}
                disabled={isEditing}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="receita">Receita</SelectItem>
                  <SelectItem value="despesa">Despesa</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="valor">Valor Total (R$) *</Label>
              <Input
                id="valor"
                type="number"
                step="0.01"
                min="0.01"
                required
                value={formData.valor}
                onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
                placeholder="0.00"
              />
            </div>
          </div>

          {formData.tipo === "despesa" ? (
            <div className="space-y-3">
              <Label>Categorias de Despesa</Label>
              <div className="grid grid-cols-2 gap-2">
                {CATEGORIAS_DESPESA.map((categoria) => (
                  <div key={categoria} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id={`categoria-${categoria}`}
                      checked={selectedCategorias.includes(categoria)}
                      onChange={() => handleCategoriaChange(categoria)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <Label htmlFor={`categoria-${categoria}`} className="text-sm font-normal cursor-pointer">
                      {categoria}
                    </Label>
                  </div>
                ))}
              </div>
              {selectedCategorias.length > 0 && (
                <div className="text-sm text-gray-600">
                  Categorias selecionadas: {selectedCategorias.join(", ")}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="categoria">Categoria da Receita</Label>
              <Input
                id="categoria"
                value={formData.categoria}
                onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                placeholder="Ex: Venda, Serviço, etc"
              />
            </div>
          )}

          {!isEditing && (
            <>
              <div className="space-y-4 border p-4 rounded-md bg-gray-50">
                <h3 className="font-medium text-sm">Configuração de Parcelamento</h3>
                
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="temEntrada"
                    checked={temEntrada}
                    onChange={(e) => setTemEntrada(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <Label htmlFor="temEntrada" className="text-sm font-medium cursor-pointer">
                    Este orçamento tem entrada separada
                  </Label>
                </div>

                {temEntrada && (
                  <div className="space-y-2 pl-6">
                    <Label htmlFor="valorEntrada">Valor da Entrada (R$)</Label>
                    <Input
                      id="valorEntrada"
                      type="number"
                      step="0.01"
                      min="0"
                      value={valorEntrada}
                      onChange={(e) => setValorEntrada(e.target.value)}
                      placeholder="0.00 — deixe vazio se não houver entrada"
                    />
                    {parseFloat(valorEntrada) > 0 ? (
                      <p className="text-xs text-green-600">
                        ✓ Entrada será criada com status RECEBIDO
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Deixe vazio ou zero para parcelas sem entrada
                      </p>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="total_parcelas">
                      Número de Parcelas {temEntrada ? '(após entrada)' : ''} *
                    </Label>
                    <Input
                      id="total_parcelas"
                      type="number"
                      min="1"
                      value={formData.total_parcelas}
                      onChange={(e) => setFormData({ ...formData, total_parcelas: e.target.value })}
                      placeholder="Ex: 3"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="data_vencimento">
                      Data 1ª Parcela
                    </Label>
                    <Input
                      id="data_vencimento"
                      type="date"
                      value={formData.data_vencimento}
                      onChange={(e) => setFormData({ ...formData, data_vencimento: e.target.value })}
                    />
                  </div>
                </div>

                {formData.total_parcelas && parseInt(formData.total_parcelas) > 0 && (() => {
                  const vTotal = Math.round((parseFloat(formData.valor) || 0) * 100) / 100;
                  const nParcelas = parseInt(formData.total_parcelas);
                  const vEntrada = Math.round((parseFloat(valorEntrada) || 0) * 100) / 100;
                  const usarEnt = temEntrada && vEntrada > 0;
                  const vRestante = usarEnt ? Math.round((vTotal - vEntrada) * 100) / 100 : vTotal;
                  const vParcelaBase = Math.round(Math.floor((vRestante / nParcelas) * 100) / 100 * 100) / 100;
                  const vUltima = Math.round((vRestante - vParcelaBase * (nParcelas - 1)) * 100) / 100;
                  return (
                    <div className="text-sm bg-blue-50 p-3 rounded border border-blue-200">
                      <p className="font-medium text-blue-800 mb-1">📌 Resumo do parcelamento:</p>
                      {usarEnt && (
                        <p className="text-blue-700">• ENTRADA: R$ {vEntrada.toFixed(2)} (RECEBIDO)</p>
                      )}
                      {nParcelas > 1 ? (
                        <>
                          <p className="text-blue-700">• {nParcelas - 1} parcela(s) de R$ {vParcelaBase.toFixed(2)} (PENDENTE)</p>
                          <p className="text-blue-700">• última parcela: R$ {vUltima.toFixed(2)} (PENDENTE)</p>
                        </>
                      ) : (
                        <p className="text-blue-700">• 1 parcela de R$ {vUltima.toFixed(2)} (PENDENTE)</p>
                      )}
                      <p className="text-xs text-blue-600 mt-1">Total: R$ {vTotal.toFixed(2)}</p>
                    </div>
                  );
                })()}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="forma_pagamento">Forma de Pagamento</Label>
                  <Select
                    value={formData.forma_pagamento}
                    onValueChange={(value) => setFormData({ ...formData, forma_pagamento: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dinheiro">Dinheiro</SelectItem>
                      <SelectItem value="pix">PIX</SelectItem>
                      <SelectItem value="debito">Cartão de Débito</SelectItem>
                      <SelectItem value="credito">Cartão de Crédito</SelectItem>
                      <SelectItem value="boleto">Boleto</SelectItem>
                      <SelectItem value="transferencia">Transferência</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="conta_bancaria">Conta Bancária</Label>
                  <Select
                    value={formData.conta_bancaria}
                    onValueChange={(value) => setFormData({ ...formData, conta_bancaria: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {CONTAS_BANCARIAS.map((conta) => (
                        <SelectItem key={conta} value={conta}>
                          {conta}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              value={formData.observacoes}
              onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
              placeholder="Observações adicionais..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : isEditing ? "Atualizar" : "Salvar"}
            </Button>
          </div>
        </form>


      </DialogContent>
    </Dialog>
  );
}