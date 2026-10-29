// Módulo AlumIA: monta esquadrias pelos modelos de corte do catálogo e mostra
// quais perfis faltam no estoque (em barras) para produzir.
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Ruler, Plus, Trash2, RefreshCw, CircleCheck as CheckCircle, CircleAlert as AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  MODELOS, CORTE_PADRAO, FOLGA, calcularMateriais, cruzarComEstoque,
  type EsquadriaMontar, type ProdutoEstoque,
} from "@/lib/esquadria";

const SISTEMAS = [...new Set(MODELOS.map((m) => m.sistema))];
const QUALQUER_COR = "__qualquer__";

const novaEsquadria = (modeloId = MODELOS[0]?.id || ""): EsquadriaMontar => ({ modeloId, largura: 1200, altura: 1000, quantidade: 1 });

export default function AlumiaEsquadria() {
  const [esquadrias, setEsquadrias] = useState<EsquadriaMontar[]>([novaEsquadria()]);
  const [cor, setCor] = useState(QUALQUER_COR);
  const [barra, setBarra] = useState(CORTE_PADRAO.barra);
  const [produtos, setProdutos] = useState<ProdutoEstoque[]>([]);
  const [carregando, setCarregando] = useState(true);

  const carregarEstoque = async () => {
    try {
      setCarregando(true);
      const { data, error } = await supabase
        .from("produtos")
        .select("id, codigo, cor, unidade, estoque, comprimento_barra, peso_kg_m")
        .eq("ativo", true)
        .gt("comprimento_barra", 0)
        .range(0, 4999);
      if (error) throw error;
      // tipos gerados do Supabase estão desatualizados (não têm estoque/cor/comprimento_barra)
      setProdutos((data || []) as unknown as ProdutoEstoque[]);
    } catch (error: any) {
      toast({ title: "Erro ao carregar o estoque", description: error.message, variant: "destructive" });
    } finally { setCarregando(false); }
  };

  useEffect(() => { carregarEstoque(); }, []);

  const alterar = (idx: number, patch: Partial<EsquadriaMontar>) =>
    setEsquadrias((lista) => lista.map((e, k) => (k === idx ? { ...e, ...patch } : e)));

  const materiais = useMemo(() => calcularMateriais(esquadrias, { ...CORTE_PADRAO, barra }), [esquadrias, barra]);
  const situacao = useMemo(
    () => cruzarComEstoque(materiais.perfis, produtos, cor === QUALQUER_COR ? "" : cor),
    [materiais.perfis, produtos, cor],
  );

  // cores que aparecem nos perfis desta montagem (para o filtro de cor)
  const cores = useMemo(() => {
    const todas = new Set<string>();
    cruzarComEstoque(materiais.perfis, produtos, "").forEach((s) => s.produtos.forEach((p) => todas.add(p.cor)));
    return [...todas].sort();
  }, [materiais.perfis, produtos]);

  const faltando = situacao.filter((s) => s.falta > 0);
  const semCadastro = situacao.filter((s) => s.produtos.length === 0);

  return (
    <div className="space-y-6">
      <div>
        <Badge variant="outline" className="mb-2">AlumIA</Badge>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Ruler className="h-6 w-6 text-primary" />Montar esquadria</h1>
        <p className="text-muted-foreground text-sm">
          Escolha o modelo e as medidas do vão: o sistema calcula os cortes de cada perfil, quantas barras são precisas e quanto falta no estoque.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Esquadrias</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {esquadrias.map((e, idx) => {
            const modelo = MODELOS.find((m) => m.id === e.modeloId);
            return (
              <div key={idx} className="grid gap-3 md:grid-cols-[180px_1fr_110px_110px_80px_auto] items-end border rounded-lg p-3">
                <div className="space-y-1">
                  <Label>Linha</Label>
                  <Select value={modelo?.sistema} onValueChange={(s) => alterar(idx, { modeloId: MODELOS.find((m) => m.sistema === s)?.id || "", variaveis: undefined })}>
                    <SelectTrigger><SelectValue placeholder="Linha" /></SelectTrigger>
                    <SelectContent>{SISTEMAS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Modelo</Label>
                  <Select value={e.modeloId} onValueChange={(v) => alterar(idx, { modeloId: v, variaveis: undefined })}>
                    <SelectTrigger><SelectValue placeholder="Modelo" /></SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {MODELOS.filter((m) => m.sistema === modelo?.sistema).map((m) => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label>Largura (mm)</Label><Input type="number" min={1} value={e.largura} onChange={(ev) => alterar(idx, { largura: parseInt(ev.target.value) || 0 })} /></div>
                <div className="space-y-1"><Label>Altura (mm)</Label><Input type="number" min={1} value={e.altura} onChange={(ev) => alterar(idx, { altura: parseInt(ev.target.value) || 0 })} /></div>
                <div className="space-y-1"><Label>Qtd</Label><Input type="number" min={1} value={e.quantidade} onChange={(ev) => alterar(idx, { quantidade: parseInt(ev.target.value) || 0 })} /></div>
                <Button type="button" variant="ghost" size="sm" className="h-10 w-10 p-0 text-red-600" disabled={esquadrias.length === 1}
                  onClick={() => setEsquadrias((lista) => lista.filter((_, k) => k !== idx))} title="Remover esquadria"><Trash2 className="h-4 w-4" /></Button>
                {modelo?.variaveis?.map((v) => (
                  <div key={v.nome} className="space-y-1 md:col-span-2">
                    <Label>{v.descricao} ({v.nome}, mm)</Label>
                    <Input type="number" value={e.variaveis?.[v.nome] ?? v.padrao}
                      onChange={(ev) => alterar(idx, { variaveis: { ...e.variaveis, [v.nome]: parseFloat(ev.target.value) || 0 } })} />
                  </div>
                ))}
              </div>
            );
          })}
          <div className="flex flex-wrap items-end gap-4">
            <Button type="button" variant="outline" onClick={() => setEsquadrias((lista) => [...lista, novaEsquadria(lista[lista.length - 1]?.modeloId)])}>
              <Plus className="h-4 w-4 mr-2" />Adicionar esquadria
            </Button>
            <div className="space-y-1">
              <Label>Cor do perfil</Label>
              <Select value={cor} onValueChange={setCor}>
                <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  <SelectItem value={QUALQUER_COR}>Qualquer cor</SelectItem>
                  {cores.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Barra (mm)</Label><Input type="number" className="w-[110px]" value={barra} onChange={(ev) => setBarra(parseInt(ev.target.value) || CORTE_PADRAO.barra)} /></div>
            <Button type="button" variant="ghost" onClick={carregarEstoque} disabled={carregando}><RefreshCw className={`h-4 w-4 mr-2 ${carregando ? "animate-spin" : ""}`} />Atualizar estoque</Button>
          </div>
          <p className="text-xs text-muted-foreground">Medidas do vão; o corte desconta {FOLGA.largura} mm na largura e {FOLGA.altura} mm na altura (folga do contorno). Modelos do catálogo Hydro – confira as cotas na revisão vigente.</p>
        </CardContent>
      </Card>

      {situacao.length > 0 && (
        <div className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${faltando.length ? "border-red-200 bg-red-50 text-red-800" : "border-green-200 bg-green-50 text-green-800"}`}>
          {faltando.length
            ? <><AlertCircle className="h-5 w-5" />Faltam {faltando.length} {faltando.length === 1 ? "perfil" : "perfis"} ({faltando.reduce((s, f) => s + f.falta, 0)} barras){cor !== QUALQUER_COR ? ` na cor ${cor}` : ""} para montar.</>
            : <><CheckCircle className="h-5 w-5" />Tem todos os perfis em estoque{cor !== QUALQUER_COR ? ` na cor ${cor}` : ""} para montar.</>}
        </div>
      )}

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Perfis</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Perfil</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Cortes</TableHead>
              <TableHead className="text-right">Barras precisas</TableHead>
              <TableHead className="text-right">Em estoque</TableHead>
              <TableHead className="text-right">Falta</TableHead>
              <TableHead>No estoque (todas as cores)</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {situacao.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Informe o modelo e as medidas.</TableCell></TableRow>
              ) : situacao.map((s) => {
                const cortes = Object.entries(s.pecas.reduce<Record<number, number>>((acc, p) => ({ ...acc, [p.comprimento]: (acc[p.comprimento] || 0) + 1 }), {}))
                  .sort(([a], [b]) => Number(b) - Number(a));
                return (
                  <TableRow key={s.codigo}>
                    <TableCell className="font-mono font-medium">{s.codigo}</TableCell>
                    <TableCell className="text-sm">{s.descricao}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{cortes.map(([mm, n]) => `${n}× ${mm} mm`).join(", ")}</TableCell>
                    <TableCell className="text-right font-medium">{s.barras}</TableCell>
                    <TableCell className="text-right">{s.produtos.length ? s.emEstoque : "—"}</TableCell>
                    <TableCell className="text-right">
                      {s.falta > 0 ? <Badge variant="destructive">{s.falta}</Badge> : <Badge className="bg-green-600 hover:bg-green-600">OK</Badge>}
                    </TableCell>
                    <TableCell className="text-xs">
                      {s.produtos.length === 0
                        ? <span className="text-amber-700">Não cadastrado no estoque</span>
                        : s.produtos.map((p) => (
                          <div key={p.produto.id} className={p.naCor ? "font-medium" : "text-muted-foreground"}>
                            {p.produto.codigo.trim()} · {p.cor}: {p.barras} {p.barras === 1 ? "barra" : "barras"}
                          </div>
                        ))}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {semCadastro.length > 0 && (
        <p className="text-xs text-amber-700">
          {semCadastro.length} {semCadastro.length === 1 ? "perfil não foi encontrado" : "perfis não foram encontrados"} no cadastro de produtos pelo código ({semCadastro.map((s) => s.codigo).join(", ")}) – entram como falta.
        </p>
      )}

      {materiais.componentes.length > 0 && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Componentes do modelo</CardTitle></CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Código</TableHead><TableHead>Descrição</TableHead><TableHead className="text-right">Qtd</TableHead></TableRow></TableHeader>
              <TableBody>
                {materiais.componentes.map((c) => (
                  <TableRow key={c.codigo || c.descricao}>
                    <TableCell className="font-mono text-sm">{c.codigo}</TableCell>
                    <TableCell className="text-sm">{c.descricao}</TableCell>
                    <TableCell className="text-right">{c.unidade === "m" ? `${c.qtd.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} m` : c.qtd}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {materiais.erros.length > 0 && (
        <div className="text-xs text-red-700 space-y-1">{materiais.erros.map((e, i) => <div key={i}>{e}</div>)}</div>
      )}
    </div>
  );
}
