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

  const [isParcelasObrigatorio, setIsParcelasObrigatorio] = useState(false);

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

  useEffect(() => {
    const temCategoriaFixo = selectedCategorias.includes("Fixo");
    setIsParcelasObrigatorio(temCategoriaFixo);
    
    // Se "Fixo" foi selecionada, sugere 12 meses como padrão
    if (temCategoriaFixo && !formData.total_parcelas && !isEditing) {
      setFormData(prev => ({ ...prev, total_parcelas: "12" }));
    }
  }, [selectedCategorias, isEditing]);

  const calcularDataParcela = (dataBase: string, numeroParcela: number) => {
    const data = new Date(dataBase);
    data.setMonth(data.getMonth() + numeroParcela);
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
    setIsParcelasObrigatorio(false);
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
    
    // Validação para despesa fixa
    if (formData.tipo === "despesa" && selectedCategorias.includes("Fixo")) {
      const totalParcelas = parseInt(formData.total_parcelas);
      if (!formData.total_parcelas || isNaN(totalParcelas) || totalParcelas <= 0) {
        toast({
          title: "Campo obrigatório",
          description: "Para despesas fixas, você deve informar a quantidade de meses.",
          variant: "destructive",
        });
        const parcelasInput = document.getElementById('total_parcelas');
        if (parcelasInput) parcelasInput.focus();
        return;
      }
    }
    
    setLoading(true);

    try {
      const valorTotal = parseFloat(formData.valor);
      
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
        origem_tipo: 'manual',
        orcamento_id: null,
        credito_id: null,
        status: formData.status || (formData.tipo === 'receita' ? 'recebido' : 'pendente'),
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
          data: formData.data,
          data_vencimento: formData.data_vencimento || formData.data,
          data_pagamento: formData.data_pagamento || null,
          forma_pagamento: formData.forma_pagamento || null,
          conta_bancaria: formData.conta_bancaria || null,
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
        const ehDespesaFixa = formData.tipo === "despesa" && selectedCategorias.includes("Fixo");

        // 🔧 CORREÇÃO PRINCIPAL: Despesa Fixa vs Parcelamento
        if (totalParcelas > 0) {
          if (ehDespesaFixa) {
            // 🔧 DESPESA FIXA: Cria lançamentos mensais com o valor total (NÃO DIVIDIDO)
            const dataInicio = formData.data_vencimento || formData.data;
            
            for (let i = 0; i < totalParcelas; i++) {
              const dataMes = new Date(dataInicio);
              dataMes.setMonth(dataMes.getMonth() + i);
              
              transacoes.push({
                ...dadosBase,
                descricao: `${formData.descricao} - ${i + 1}/${totalParcelas} meses`,
                valor: valorTotal, // 🔧 VALOR TOTAL, não dividido
                status: i === 0 && formData.status === "pendente" ? "pendente" : "pendente",
                data_vencimento: dataMes.toISOString().split('T')[0],
                data_pagamento: null,
                numero_parcela: `${i + 1}/${totalParcelas}`,
                origem_tipo: 'manual',
                // 🔧 MARCA como despesa fixa
                observacoes: dadosBase.observacoes 
                  ? `${dadosBase.observacoes} | Despesa Fixa - Mês ${i + 1}/${totalParcelas}`
                  : `Despesa Fixa - Mês ${i + 1}/${totalParcelas}`,
              });
            }
          } else if (temEntrada) {
            // Parcelamento com entrada (comportamento existente)
            const valorEntradaNum = parseFloat(valorEntrada) || 0;
            
            if (valorEntradaNum <= 0) {
              throw new Error("Valor da entrada deve ser maior que zero.");
            }
            if (valorEntradaNum >= valorTotal) {
              throw new Error("Valor da entrada não pode ser maior ou igual ao valor total.");
            }

            const valorRestante = valorTotal - valorEntradaNum;
            const valorParcela = valorRestante / totalParcelas;

            transacoes.push({
              ...dadosBase,
              descricao: `${formData.descricao} - ENTRADA`,
              valor: valorEntradaNum,
              status: "recebido",
              data_vencimento: formData.data,
              data_pagamento: formData.data,
              numero_parcela: "ENTRADA",
              origem_tipo: 'manual',
            });

            for (let i = 1; i <= totalParcelas; i++) {
              const dataVencimentoParcela = formData.data_vencimento 
                ? calcularDataParcela(formData.data_vencimento, i - 1)
                : calcularDataParcela(formData.data, i);

              transacoes.push({
                ...dadosBase,
                descricao: `${formData.descricao} - PARCELA ${i}/${totalParcelas}`,
                valor: valorParcela,
                status: "pendente",
                data_vencimento: dataVencimentoParcela,
                data_pagamento: null,
                numero_parcela: `${i}/${totalParcelas}`,
                origem_tipo: 'manual',
              });
            }
          } else {
            // Parcelamento normal (valor dividido)
            const valorParcela = valorTotal / totalParcelas;
            
            for (let i = 1; i <= totalParcelas; i++) {
              const dataVencimentoParcela = formData.data_vencimento 
                ? calcularDataParcela(formData.data_vencimento, i - 1)
                : calcularDataParcela(formData.data, i - 1);

              transacoes.push({
                ...dadosBase,
                descricao: `${formData.descricao} - PARCELA ${i}/${totalParcelas}`,
                valor: valorParcela,
                status: "pendente",
                data_vencimento: dataVencimentoParcela,
                data_pagamento: null,
                numero_parcela: `${i}/${totalParcelas}`,
                origem_tipo: 'manual',
              });
            }
          }
        } else {
          // Transação única
          const dataVencimento = formData.data_vencimento || formData.data;
          
          transacoes.push({
            ...dadosBase,
            descricao: formData.descricao,
            valor: valorTotal,
            status: formData.status,
            data_vencimento: dataVencimento,
            data_pagamento: formData.status === "recebido" || formData.status === "pago" ? formData.data : null,
            numero_parcela: formData.numero_parcela || null,
            origem_tipo: 'manual',
          });
        }

        console.log('📝 Transações a serem inseridas:', transacoes);

        const { data: insertedData, error } = await supabase
          .from('transacoes_financeiras')
          .insert(transacoes)
          .select();

        if (error) {
          console.error('❌ Erro detalhado do Supabase:', error);
          
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

        console.log('✅ Transações inseridas com sucesso:', insertedData);

        const quantidade = transacoes.length;
        let mensagem = `${quantidade} transação(ões) registrada(s) com sucesso.`;
        
        if (ehDespesaFixa) {
          mensagem = `Despesa fixa criada: ${quantidade} lançamentos mensais de R$ ${valorTotal.toFixed(2)}.`;
        } else if (temEntrada) {
          mensagem += ` Entrada de R$ ${parseFloat(valorEntrada).toFixed(2)} já contabilizada como RECEBIDA.`;
        }

        toast({
          title: "Sucesso!",
          description: mensagem,
        });
      }

      handleClose();
      onTransactionAdded();
      
    } catch (error: any) {
      console.error('❌ Erro detalhado:', error);
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
              placeholder="Ex: Aluguel, Internet, etc"
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
              <Label htmlFor="valor">Valor (R$) *</Label>
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
              {/* 🔧 NOVO: Aviso para despesa fixa */}
              {selectedCategorias.includes("Fixo") && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <p className="text-sm text-blue-800 font-medium">
                    📌 Despesa Fixa: Serão criados <strong>{formData.total_parcelas || '?'}</strong> lançamentos mensais de <strong>R$ {formData.valor || '0,00'}</strong> (valor integral).
                  </p>
                  <p className="text-xs text-blue-600 mt-1">
                    Diferente de parcelamento, o valor não é dividido.
                  </p>
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
                <h3 className="font-medium text-sm">
                  {selectedCategorias.includes("Fixo") ? "Configuração de Despesa Fixa" : "Configuração de Parcelamento"}
                </h3>
                
                {!selectedCategorias.includes("Fixo") && (
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
                )}

                {temEntrada && !selectedCategorias.includes("Fixo") && (
                  <div className="space-y-2 pl-6">
                    <Label htmlFor="valorEntrada">Valor da Entrada (R$) *</Label>
                    <Input
                      id="valorEntrada"
                      type="number"
                      step="0.01"
                      min="0.01"
                      required={temEntrada}
                      value={valorEntrada}
                      onChange={(e) => setValorEntrada(e.target.value)}
                      placeholder="0.00"
                    />
                    <p className="text-xs text-green-600">
                      ✓ Entrada será criada com status RECEBIDO e identificador "ENTRADA"
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="total_parcelas">
                      {selectedCategorias.includes("Fixo") ? "Quantidade de Meses" : "Número de Parcelas"}
                      {isParcelasObrigatorio && <span className="text-red-500 ml-1">*</span>}
                    </Label>
                    <Input
                      id="total_parcelas"
                      type="number"
                      min="1"
                      value={formData.total_parcelas}
                      onChange={(e) => setFormData({ ...formData, total_parcelas: e.target.value })}
                      placeholder={selectedCategorias.includes("Fixo") ? "Ex: 12" : "Ex: 3"}
                      required={isParcelasObrigatorio}
                      className={isParcelasObrigatorio ? "border-blue-400 focus:border-blue-600" : ""}
                    />
                    {isParcelasObrigatorio && (
                      <p className="text-xs text-blue-600 mt-1">
                        ⚠️ Campo obrigatório para despesas fixas
                      </p>
                    )}
                    {selectedCategorias.includes("Fixo") && (
                      <p className="text-xs text-gray-500 mt-1">
                        Serão criados {formData.total_parcelas || 'X'} lançamentos mensais de R$ {formData.valor || '0,00'} cada
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="data_vencimento">
                      {selectedCategorias.includes("Fixo") ? "Data do 1º Lançamento" : "Data 1ª Parcela"}
                    </Label>
                    <Input
                      id="data_vencimento"
                      type="date"
                      value={formData.data_vencimento}
                      onChange={(e) => setFormData({ ...formData, data_vencimento: e.target.value })}
                    />
                  </div>
                </div>

                {formData.total_parcelas && parseInt(formData.total_parcelas) > 0 && (
                  <div className={`text-sm p-3 rounded border ${
                    selectedCategorias.includes("Fixo") 
                      ? "bg-blue-50 border-blue-200" 
                      : "bg-green-50 border-green-200"
                  }`}>
                    <p className={`font-medium mb-1 ${
                      selectedCategorias.includes("Fixo") ? "text-blue-800" : "text-green-800"
                    }`}>
                      📌 {selectedCategorias.includes("Fixo") ? "Resumo da Despesa Fixa:" : "Resumo do parcelamento:"}
                    </p>
                    {selectedCategorias.includes("Fixo") ? (
                      <>
                        <p className="text-blue-700">• {formData.total_parcelas} lançamentos mensais de R$ {parseFloat(formData.valor || '0').toFixed(2)}</p>
                        <p className="text-blue-700">• Total: R$ {(parseFloat(formData.valor || '0') * parseInt(formData.total_parcelas)).toFixed(2)}</p>
                        <p className="text-xs text-blue-600 mt-1">✅ Valor integral em cada mês (não parcelado)</p>
                      </>
                    ) : temEntrada ? (
                      <>
                        <p className="text-green-700">• ENTRADA: R$ {parseFloat(valorEntrada || '0').toFixed(2)} (RECEBIDO)</p>
                        <p className="text-green-700">• {formData.total_parcelas} parcelas de R$ {((parseFloat(formData.valor) - parseFloat(valorEntrada || '0')) / parseInt(formData.total_parcelas)).toFixed(2)} (PENDENTE)</p>
                        <p className="text-xs text-green-600 mt-1">Total: R$ {parseFloat(formData.valor).toFixed(2)}</p>
                      </>
                    ) : (
                      <p className="text-green-700">• {formData.total_parcelas} parcelas de R$ {(parseFloat(formData.valor) / parseInt(formData.total_parcelas)).toFixed(2)} (PENDENTE)</p>
                    )}
                  </div>
                )}
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

          {isEditing && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="data">Data</Label>
                  <Input
                    id="data"
                    type="date"
                    value={formData.data}
                    onChange={(e) => setFormData({ ...formData, data: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pendente">Pendente</SelectItem>
                      <SelectItem value="pago">Pago</SelectItem>
                      <SelectItem value="recebido">Recebido</SelectItem>
                      <SelectItem value="cancelado">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="data_vencimento_edit">Data de Vencimento</Label>
                  <Input
                    id="data_vencimento_edit"
                    type="date"
                    value={formData.data_vencimento}
                    onChange={(e) => setFormData({ ...formData, data_vencimento: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="data_pagamento_edit">Data de Pagamento</Label>
                  <Input
                    id="data_pagamento_edit"
                    type="date"
                    value={formData.data_pagamento}
                    onChange={(e) => setFormData({ ...formData, data_pagamento: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="forma_pagamento_edit">Forma de Pagamento</Label>
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
                  <Label htmlFor="conta_bancaria_edit">Conta Bancária</Label>
                  <Select
                    value={formData.conta_bancaria}
                    onValueChange={(value) => setFormData({ ...formData, conta_bancaria: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {CONTAS_BANCARIAS.map((conta) => (
                        <SelectItem key={conta} value={conta}>{conta}</SelectItem>
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