// @ts-nocheck - Temporary fix until Supabase types are regenerated
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileCheck, Save, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { logActivity } from "@/lib/auditLog";

interface DadosFiscais {
  id: string;
  cnpj: string | null;
  inscricao_estadual: string | null;
  crt: number | null;
  logradouro: string | null;
  numero_endereco: string | null;
  bairro: string | null;
  municipio: string | null;
  codigo_municipio_ibge: string | null;
  uf: string | null;
  cep: string | null;
  serie_nfe: number;
  proximo_numero_nfe: number;
  nfe_ambiente: "homologacao" | "producao";
}

export default function ConfiguracaoFiscal() {
  const { isAdmin } = useAuth();
  const [dados, setDados] = useState<DadosFiscais | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchDados();
  }, []);

  const fetchDados = async () => {
    try {
      const { data, error } = await supabase
        .from("configuracoes")
        .select(
          "id, cnpj, inscricao_estadual, crt, logradouro, numero_endereco, bairro, municipio, codigo_municipio_ibge, uf, cep, serie_nfe, proximo_numero_nfe, nfe_ambiente"
        )
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (data) setDados(data);
    } catch (error: any) {
      toast({ title: "Erro ao carregar dados fiscais", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!dados) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("configuracoes")
        .update({
          inscricao_estadual: dados.inscricao_estadual,
          crt: dados.crt,
          logradouro: dados.logradouro,
          numero_endereco: dados.numero_endereco,
          bairro: dados.bairro,
          municipio: dados.municipio,
          codigo_municipio_ibge: dados.codigo_municipio_ibge,
          uf: dados.uf,
          cep: dados.cep,
          serie_nfe: dados.serie_nfe,
          proximo_numero_nfe: dados.proximo_numero_nfe,
          nfe_ambiente: dados.nfe_ambiente,
        })
        .eq("id", dados.id);

      if (error) throw error;

      await logActivity({
        acao: "atualizar",
        entidade: "configuracao_fiscal",
        entidadeId: dados.id,
        descricao: "Atualizou os dados fiscais da empresa para emissão de NF-e",
      });

      toast({ title: "Dados fiscais salvos" });
    } catch (error: any) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Carregando...</div>;
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
        <FileCheck className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Acesso restrito</h2>
        <p className="text-muted-foreground max-w-sm">Apenas administradores podem configurar os dados fiscais.</p>
      </div>
    );
  }

  if (!dados) {
    return <div className="text-center py-8 text-muted-foreground">Nenhuma configuração de empresa encontrada.</div>;
  }

  const camposObrigatoriosFaltando = [
    !dados.inscricao_estadual && "Inscrição Estadual",
    !dados.logradouro && "Logradouro",
    !dados.numero_endereco && "Número",
    !dados.bairro && "Bairro",
    !dados.municipio && "Município",
    !dados.codigo_municipio_ibge && "Código IBGE do município",
    !dados.uf && "UF",
    !dados.cep && "CEP",
  ].filter(Boolean);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Configuração Fiscal</h2>
        <p className="text-muted-foreground">Dados do emitente exigidos pela SEFAZ para emitir NF-e</p>
      </div>

      {camposObrigatoriosFaltando.length > 0 && (
        <Card className="border-amber-500/40 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-amber-800 dark:text-amber-400">Faltam dados obrigatórios</p>
              <p className="text-sm text-amber-700 dark:text-amber-500">
                Sem isso a NF-e não pode ser emitida: {camposObrigatoriosFaltando.join(", ")}.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Ambiente de emissão</CardTitle>
          <CardDescription>Comece em homologação (notas de teste, sem validade fiscal) até validar tudo</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Badge variant={dados.nfe_ambiente === "producao" ? "destructive" : "secondary"}>
              {dados.nfe_ambiente === "producao" ? "PRODUÇÃO (notas reais)" : "HOMOLOGAÇÃO (testes)"}
            </Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Ambiente</Label>
              <Select
                value={dados.nfe_ambiente}
                onValueChange={(value) => setDados({ ...dados, nfe_ambiente: value as "homologacao" | "producao" })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="homologacao">Homologação (teste)</SelectItem>
                  <SelectItem value="producao">Produção (real)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Regime Tributário (CRT)</Label>
              <Select
                value={String(dados.crt ?? "")}
                onValueChange={(value) => setDados({ ...dados, crt: Number(value) })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 - Simples Nacional</SelectItem>
                  <SelectItem value="3">3 - Regime Normal (Lucro Presumido/Real)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Série da NF-e</Label>
              <Input
                type="number"
                value={dados.serie_nfe}
                onChange={(e) => setDados({ ...dados, serie_nfe: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Próximo número de NF-e</Label>
              <Input
                type="number"
                value={dados.proximo_numero_nfe}
                onChange={(e) => setDados({ ...dados, proximo_numero_nfe: Number(e.target.value) })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dados do emitente</CardTitle>
          <CardDescription>CNPJ já vem de Configurações gerais — aqui só o que falta pra nota fiscal</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>CNPJ (somente leitura, edite em Configurações gerais)</Label>
            <Input value={dados.cnpj || ""} disabled />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Inscrição Estadual *</Label>
              <Input
                value={dados.inscricao_estadual || ""}
                onChange={(e) => setDados({ ...dados, inscricao_estadual: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>CEP *</Label>
              <Input value={dados.cep || ""} onChange={(e) => setDados({ ...dados, cep: e.target.value })} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Logradouro (rua/avenida) *</Label>
              <Input
                value={dados.logradouro || ""}
                onChange={(e) => setDados({ ...dados, logradouro: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Número *</Label>
              <Input
                value={dados.numero_endereco || ""}
                onChange={(e) => setDados({ ...dados, numero_endereco: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Bairro *</Label>
              <Input value={dados.bairro || ""} onChange={(e) => setDados({ ...dados, bairro: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Município *</Label>
              <Input
                value={dados.municipio || ""}
                onChange={(e) => setDados({ ...dados, municipio: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>UF *</Label>
              <Input
                value={dados.uf || ""}
                maxLength={2}
                onChange={(e) => setDados({ ...dados, uf: e.target.value.toUpperCase() })}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Código do município no IBGE (7 dígitos) *</Label>
              <Input
                value={dados.codigo_municipio_ibge || ""}
                onChange={(e) => setDados({ ...dados, codigo_municipio_ibge: e.target.value })}
                placeholder="Ex: 2304400 (Fortaleza)"
              />
              <p className="text-xs text-muted-foreground">
                Consulte em{" "}
                <a
                  href="https://www.ibge.gov.br/explica/codigos-dos-municipios.php"
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  ibge.gov.br
                </a>{" "}
                pelo nome do município — é diferente do CEP.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving} size="lg">
        <Save className="h-4 w-4 mr-2" />
        {saving ? "Salvando..." : "Salvar Dados Fiscais"}
      </Button>
    </div>
  );
}
