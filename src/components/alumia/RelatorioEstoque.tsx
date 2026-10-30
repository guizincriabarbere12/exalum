// Relatório do módulo AlumIA: para cada modelo de porta/janela, quantas dá para
// montar com o estoque (com e sem baguete) e o que falta para montar.
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { FileDown, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { downloadPDF } from "@/utils/pdfGenerator";
import { gerarPDFRelatorioEsquadrias } from "@/utils/pdfRelatorioEsquadrias";
import {
  MODELOS, CORTE_PADRAO, TIPOS_MODELO, tipoModelo, relatorioEstoque, calcularMateriais, cruzarComEstoque,
  type LinhaRelatorio, type ProdutoEstoque, type TipoModelo,
} from "@/lib/esquadria";

const TODAS = "__todas__";
const SISTEMAS = [...new Set(MODELOS.map((m) => m.sistema))];

interface Props {
  produtos: ProdutoEstoque[];
  barra: number;
}

export function RelatorioEstoque({ produtos, barra }: Props) {
  const [cor, setCor] = useState(TODAS);
  const [linha, setLinha] = useState(TODAS);
  const [tipo, setTipo] = useState<TipoModelo | typeof TODAS>(TODAS);
  const [desejado, setDesejado] = useState(1);
  const [medidas, setMedidas] = useState(() =>
    Object.fromEntries(TIPOS_MODELO.map((t) => [t.id, { largura: t.largura, altura: t.altura }])) as Record<TipoModelo, { largura: number; altura: number }>,
  );
  const [calculado, setCalculado] = useState<LinhaRelatorio[] | null>(null);
  const [mostrarSemCadastro, setMostrarSemCadastro] = useState(false);
  const resultado = calculado && (mostrarSemCadastro ? calculado : calculado.filter((l) => !l.semCadastro));
  const ocultos = calculado ? calculado.filter((l) => l.semCadastro) : [];
  const [gerando, setGerando] = useState(false);

  // cores em que existem perfis destes modelos no estoque
  const cores = useMemo(() => {
    const todas = new Set<string>();
    for (const m of MODELOS) {
      const t = TIPOS_MODELO.find((x) => x.id === tipoModelo(m))!;
      const perfis = calcularMateriais([{ modeloId: m.id, largura: t.largura, altura: t.altura, quantidade: 1 }]).perfis;
      cruzarComEstoque(perfis, produtos, "").forEach((s) => s.produtos.forEach((p) => todas.add(p.cor)));
    }
    return [...todas].sort();
  }, [produtos]);

  const corEscolhida = cor === TODAS ? "" : cor;
  const modelosFiltrados = MODELOS.filter((m) => (linha === TODAS || m.sistema === linha) && (tipo === TODAS || tipoModelo(m) === tipo));

  const gerar = () => {
    setGerando(true);
    // deixa o React pintar o "gerando" antes do cálculo pesado
    setTimeout(() => {
      setCalculado(relatorioEstoque(modelosFiltrados, produtos, corEscolhida, medidas, Math.max(1, desejado), { ...CORTE_PADRAO, barra }));
      setGerando(false);
    }, 20);
  };

  const baixarPDF = async () => {
    if (!resultado) return;
    const { data: config } = await supabase.from("configuracoes").select("*").limit(1).maybeSingle();
    const blob = gerarPDFRelatorioEsquadrias(resultado, {
      empresa: (config as { nome_empresa?: string } | null)?.nome_empresa,
      cor: corEscolhida,
      desejado: Math.max(1, desejado),
      barra,
    });
    downloadPDF(blob, `relatorio-montagem-${corEscolhida || "todas-cores"}-${new Date().toISOString().split("T")[0]}.pdf`);
    toast({ title: "Relatório gerado", description: "PDF baixado." });
  };

  const versoes = resultado?.flatMap((l) => l.versoes.map((v) => ({ l, v }))) ?? [];
  const montaveis = versoes.filter(({ v }) => v.capacidade.maximo > 0).length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Relatório do que dá para montar</CardTitle>
          <p className="text-xs text-muted-foreground">
            Roda todos os modelos de porta e janela (com e sem baguete) contra o estoque atual, nas medidas padrão de cada tipo.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <Label>Cor do perfil</Label>
              <Select value={cor} onValueChange={setCor}>
                <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  <SelectItem value={TODAS}>Todas (soma)</SelectItem>
                  {cores.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Linha</Label>
              <Select value={linha} onValueChange={setLinha}>
                <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODAS}>Todas as linhas</SelectItem>
                  {SISTEMAS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as TipoModelo | typeof TODAS)}>
                <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODAS}>Portas e janelas</SelectItem>
                  {TIPOS_MODELO.map((t) => <SelectItem key={t.id} value={t.id}>{t.rotulo}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Falta p/ montar (un)</Label>
              <Input type="number" min={1} className="w-[110px]" value={desejado} onChange={(e) => setDesejado(parseInt(e.target.value) || 1)} />
            </div>
            <label className="flex items-center gap-2 text-sm h-10">
              <Checkbox checked={mostrarSemCadastro} onCheckedChange={(v) => setMostrarSemCadastro(v === true)} />
              Mostrar modelos sem nenhum perfil cadastrado
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {TIPOS_MODELO.map((t) => (
              <div key={t.id} className="border rounded-lg p-2 space-y-1">
                <Label className="text-xs">{t.rotulo} (L × H mm)</Label>
                <div className="flex gap-1">
                  <Input type="number" className="h-8" value={medidas[t.id].largura}
                    onChange={(e) => setMedidas((m) => ({ ...m, [t.id]: { ...m[t.id], largura: parseInt(e.target.value) || 0 } }))} />
                  <Input type="number" className="h-8" value={medidas[t.id].altura}
                    onChange={(e) => setMedidas((m) => ({ ...m, [t.id]: { ...m[t.id], altura: parseInt(e.target.value) || 0 } }))} />
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={gerar} disabled={gerando || produtos.length === 0}>
              <Play className="h-4 w-4 mr-2" />{gerando ? "Calculando..." : `Gerar relatório (${modelosFiltrados.length} modelos)`}
            </Button>
            <Button variant="outline" onClick={baixarPDF} disabled={!resultado || gerando}>
              <FileDown className="h-4 w-4 mr-2" />Baixar PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      {resultado && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {montaveis} de {versoes.length} modelos/versões dá para montar{corEscolhida ? ` na cor ${corEscolhida}` : ""}
            </CardTitle>
            {!mostrarSemCadastro && ocultos.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {ocultos.length} {ocultos.length === 1 ? "modelo oculto" : "modelos ocultos"} sem nenhum perfil no cadastro ({[...new Set(ocultos.map((l) => l.modelo.sistema))].join(", ")}).
              </p>
            )}
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Modelo</TableHead>
                <TableHead>Versão</TableHead>
                <TableHead className="text-center">Dá p/ montar</TableHead>
                <TableHead>Acaba primeiro</TableHead>
                <TableHead>Falta p/ montar {Math.max(1, desejado)}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {versoes.map(({ l, v }) => (
                  <TableRow key={`${l.modelo.id}-${v.semBaguete}`}>
                    <TableCell className="text-sm">
                      <div className="font-medium">{l.modelo.nome}</div>
                      <div className="text-xs text-muted-foreground">{l.modelo.sistema} · {l.largura} × {l.altura} mm</div>
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">{l.versoes.length > 1 ? (v.semBaguete ? "Sem baguete" : "Com baguete") : "Única"}</TableCell>
                    <TableCell className="text-center">
                      <Badge className={v.capacidade.maximo > 0 ? "bg-green-600 hover:bg-green-600" : "bg-red-600 hover:bg-red-600"}>
                        {v.capacidade.maximo >= 500 ? "500+" : v.capacidade.maximo}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{v.capacidade.limitante || "—"}</TableCell>
                    <TableCell className="text-xs">
                      {v.faltas.length === 0
                        ? <span className="text-green-700">nada</span>
                        : v.faltas.map((f) => (
                          <div key={f.codigo}>
                            <span className="font-mono">{f.codigo}</span>: {f.falta} {f.falta === 1 ? "barra" : "barras"}
                            {f.produtos.length === 0 ? <span className="text-amber-700"> (sem cadastro)</span>
                              : !f.produtos.some((p) => p.naCor) ? <span className="text-amber-700"> (sem a cor)</span> : null}
                          </div>
                        ))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
