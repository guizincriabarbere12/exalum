import { Fragment, useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShieldCheck, Search, RefreshCw, History, ChevronDown, ChevronRight, Bot, User, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { nomeTabela } from "@/lib/auditoriaAutomatica";

type Origem = "usuario" | "ia_crm" | "ia_claude";

interface Evento {
  id: string;
  created_at: string;
  origem: Origem;
  quem: string;
  acao: string;
  entidade: string;
  descricao: string;
  detalhes: Record<string, unknown> | null;
}

const ACAO_STYLES: Record<string, string> = {
  login: "bg-green-100 text-green-800 border-green-200",
  logout: "bg-slate-100 text-slate-700 border-slate-200",
  criar: "bg-blue-100 text-blue-800 border-blue-200",
  salvar: "bg-blue-100 text-blue-800 border-blue-200",
  atualizar: "bg-amber-100 text-amber-800 border-amber-200",
  excluir: "bg-red-100 text-red-800 border-red-200",
  aprovar: "bg-green-100 text-green-800 border-green-200",
  rejeitar: "bg-red-100 text-red-800 border-red-200",
  ajuste_estoque: "bg-purple-100 text-purple-800 border-purple-200",
  executar: "bg-indigo-100 text-indigo-800 border-indigo-200",
  erro: "bg-red-100 text-red-800 border-red-200",
};

const ORIGEM_INFO: Record<Origem, { label: string; className: string; icon: typeof User }> = {
  usuario: { label: "Usuário", className: "bg-slate-100 text-slate-800 border-slate-200", icon: User },
  ia_crm: { label: "IA do CRM", className: "bg-violet-100 text-violet-800 border-violet-200", icon: Bot },
  ia_claude: { label: "IA (Claude)", className: "bg-orange-100 text-orange-800 border-orange-200", icon: Sparkles },
};

const LIMITES = [200, 500, 1000, 3000];

const juntar = (v: unknown) => (Array.isArray(v) ? v.map(String).join(" / ") : v ? String(v) : "");

function descreverEventoCrm(tipo: string, d: Record<string, any>, lead: string): { acao: string; descricao: string } {
  switch (tipo) {
    case "classificado":
      return { acao: "classificar", descricao: `IA classificou o lead ${lead}: ${d.temperatura ?? "-"}, etapa ${d.etapa_funil ?? "-"}, score ${d.score ?? "-"}` };
    case "resposta_ia":
      return { acao: "responder", descricao: `IA respondeu ${lead}: "${juntar(d.mensagens)}"` };
    case "orcamento":
      return { acao: "criar", descricao: `IA criou o orçamento ${d.numero ?? ""} para ${lead}${d.valor_total ? ` (R$ ${Number(d.valor_total).toFixed(2)})` : ""}${d.itens ? ` — ${juntar(d.itens)}` : ""}` };
    case "handoff":
      return { acao: "transferir", descricao: `IA passou ${lead} para atendimento humano: ${d.motivo ?? ""}` };
    case "followup":
      return { acao: "followup", descricao: `IA enviou follow-up para ${lead}: "${juntar(d.mensagens)}"` };
    case "supervisao":
      return { acao: "supervisionar", descricao: `Supervisão da IA no atendimento de ${lead}: ${d.obs ?? JSON.stringify(d)}` };
    case "alerta_vendedor":
      return { acao: "alertar", descricao: `IA alertou vendedor(es) sobre ${lead}${d.reforco ? " (reforço)" : ""}` };
    case "erro":
      return { acao: "erro", descricao: `Erro da IA com ${lead}: ${d.motivo ?? JSON.stringify(d)}` };
    case "ignorado":
      return { acao: "ignorar", descricao: `IA descartou resposta para ${lead}: ${d.motivo ?? ""}` };
    default:
      return { acao: tipo, descricao: `IA (${tipo}) — ${lead}: ${JSON.stringify(d).slice(0, 200)}` };
  }
}

function formatarValor(v: unknown): string {
  if (v === null || v === undefined || v === "") return "vazio";
  return typeof v === "string" ? v : JSON.stringify(v);
}

function Detalhes({ detalhes }: { detalhes: Record<string, unknown> }) {
  const alteracoes = detalhes.alteracoes as Record<string, { de?: unknown; para?: unknown }> | undefined;
  const resto = Object.fromEntries(Object.entries(detalhes).filter(([k]) => k !== "alteracoes"));
  return (
    <div className="space-y-3 text-xs">
      {alteracoes && Object.keys(alteracoes).length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full border rounded">
            <thead className="bg-muted/50">
              <tr><th className="text-left p-2">Campo</th><th className="text-left p-2">Antes</th><th className="text-left p-2">Depois</th></tr>
            </thead>
            <tbody>
              {Object.entries(alteracoes).map(([campo, mudanca]) => (
                <tr key={campo} className="border-t">
                  <td className="p-2 font-medium">{campo}</td>
                  <td className="p-2 text-red-700 break-all">{mudanca && "de" in mudanca ? formatarValor(mudanca.de) : "—"}</td>
                  <td className="p-2 text-green-700 break-all">{formatarValor(mudanca?.para)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {Object.keys(resto).length > 0 && (
        <pre className="bg-muted/40 rounded p-3 whitespace-pre-wrap break-all max-h-80 overflow-auto">{JSON.stringify(resto, null, 2)}</pre>
      )}
    </div>
  );
}

export default function Auditoria() {
  const { isAdmin } = useAuth();
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [entidadeFilter, setEntidadeFilter] = useState("todas");
  const [origemFilter, setOrigemFilter] = useState<"todas" | Origem>("todas");
  const [limite, setLimite] = useState(500);
  const [aberto, setAberto] = useState<string | null>(null);

  useEffect(() => {
    if (isAdmin) fetchEventos();
  }, [isAdmin, limite]);

  const fetchEventos = async () => {
    setLoading(true);
    try {
      const [logsRes, crmRes] = await Promise.all([
        (supabase as any)
          .from("audit_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(limite),
        (supabase as any)
          .from("crm_lead_eventos")
          .select("id, lead_id, tipo, detalhe, created_at")
          .order("created_at", { ascending: false })
          .limit(limite),
      ]);
      if (logsRes.error) throw logsRes.error;

      const doSistema: Evento[] = (logsRes.data || []).map((l: any) => {
        const meta = (l.metadados || l.detalhes || null) as Record<string, unknown> | null;
        const ehClaude = meta?.origem === "ia_claude";
        return {
          id: `log-${l.id}`,
          created_at: l.created_at,
          origem: ehClaude ? "ia_claude" : "usuario",
          quem: ehClaude ? "IA (Claude)" : l.user_email || "-",
          acao: l.acao || "-",
          entidade: l.entidade || l.tabela || "-",
          descricao: l.descricao || "-",
          detalhes: meta,
        };
      });

      let daIa: Evento[] = [];
      if (!crmRes.error && crmRes.data?.length) {
        const leadIds = [...new Set(crmRes.data.map((e: any) => e.lead_id).filter(Boolean))] as string[];
        const leads: Record<string, string> = {};
        for (let i = 0; i < leadIds.length; i += 200) {
          const { data } = await (supabase as any)
            .from("crm_leads")
            .select("id, nome_contato, numero_cliente")
            .in("id", leadIds.slice(i, i + 200));
          (data || []).forEach((ld: any) => { leads[ld.id] = ld.nome_contato || ld.numero_cliente || "lead"; });
        }
        daIa = crmRes.data.map((e: any) => {
          const lead = leads[e.lead_id] || "lead";
          const { acao, descricao } = descreverEventoCrm(e.tipo, e.detalhe || {}, lead);
          return {
            id: `crm-${e.id}`,
            created_at: e.created_at,
            origem: "ia_crm" as Origem,
            quem: "IA do CRM",
            acao,
            entidade: "crm",
            descricao,
            detalhes: { tipo: e.tipo, lead, ...(e.detalhe || {}) },
          };
        });
      }

      setEventos([...doSistema, ...daIa].sort((a, b) => b.created_at.localeCompare(a.created_at)));
    } catch (error: any) {
      toast({ title: "Erro ao carregar auditoria", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const entidades = useMemo(() => [...new Set(eventos.map((e) => e.entidade))].sort(), [eventos]);
  const nomeEntidade = (e: string) => (e === "crm" ? "CRM" : nomeTabela(e));

  const eventosFiltrados = eventos.filter((ev) => {
    if (origemFilter !== "todas" && ev.origem !== origemFilter) return false;
    if (entidadeFilter !== "todas" && ev.entidade !== entidadeFilter) return false;
    const termo = searchTerm.toLowerCase();
    return (
      !termo ||
      ev.quem.toLowerCase().includes(termo) ||
      ev.acao.toLowerCase().includes(termo) ||
      nomeEntidade(ev.entidade).toLowerCase().includes(termo) ||
      ev.descricao.toLowerCase().includes(termo)
    );
  });

  if (!isAdmin) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Card>
          <CardContent className="p-12 text-center">
            <ShieldCheck className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-semibold mb-2">Área Restrita</h3>
            <p className="text-muted-foreground">Apenas administradores podem visualizar o log de auditoria.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-3">
            <History className="h-7 w-7 sm:h-8 sm:w-8 text-primary shrink-0" /> Auditoria
          </h2>
          <p className="text-muted-foreground mt-1">Tudo que acontece no sistema: ações dos usuários, da IA do CRM e correções feitas pela IA</p>
        </div>
        <Button variant="outline" onClick={fetchEventos} disabled={loading} className="w-full sm:w-auto">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por usuário, ação, tela ou descrição..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={origemFilter} onValueChange={(v) => setOrigemFilter(v as "todas" | Origem)}>
            <SelectTrigger className="w-full lg:w-[180px]"><SelectValue placeholder="Origem" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as origens</SelectItem>
              <SelectItem value="usuario">Usuários</SelectItem>
              <SelectItem value="ia_crm">IA do CRM</SelectItem>
              <SelectItem value="ia_claude">IA (Claude)</SelectItem>
            </SelectContent>
          </Select>
          <Select value={entidadeFilter} onValueChange={setEntidadeFilter}>
            <SelectTrigger className="w-full lg:w-[220px]"><SelectValue placeholder="Entidade" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as entidades</SelectItem>
              {entidades.map((ent) => (
                <SelectItem key={ent} value={ent}>{nomeEntidade(ent)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(limite)} onValueChange={(v) => setLimite(Number(v))}>
            <SelectTrigger className="w-full lg:w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {LIMITES.map((n) => (
                <SelectItem key={n} value={String(n)}>Últimos {n} de cada</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">Carregando auditoria...</div>
          ) : eventosFiltrados.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">Nenhum registro encontrado.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8" />
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Quem</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead>Entidade</TableHead>
                    <TableHead>Descrição</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {eventosFiltrados.map((ev) => {
                    const info = ORIGEM_INFO[ev.origem];
                    const Icone = info.icon;
                    const expandido = aberto === ev.id;
                    const temDetalhes = !!ev.detalhes && Object.keys(ev.detalhes).length > 0;
                    return (
                      <Fragment key={ev.id}>
                        <TableRow
                          className={temDetalhes ? "cursor-pointer" : undefined}
                          onClick={() => temDetalhes && setAberto(expandido ? null : ev.id)}
                        >
                          <TableCell className="px-2">
                            {temDetalhes && (expandido ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />)}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm">{new Date(ev.created_at).toLocaleString("pt-BR")}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`gap-1 whitespace-nowrap ${info.className}`}>
                              <Icone className="h-3 w-3" /> {info.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">{ev.quem}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={ACAO_STYLES[ev.acao] || "bg-gray-100 text-gray-800 border-gray-200"}>
                              {ev.acao}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm whitespace-nowrap">{nomeEntidade(ev.entidade)}</TableCell>
                          <TableCell className={`text-sm text-muted-foreground max-w-xl ${expandido ? "whitespace-normal" : "truncate"}`}>
                            {ev.descricao}
                          </TableCell>
                        </TableRow>
                        {expandido && ev.detalhes && (
                          <TableRow className="bg-muted/20 hover:bg-muted/20">
                            <TableCell colSpan={7} className="p-4">
                              <Detalhes detalhes={ev.detalhes} />
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
