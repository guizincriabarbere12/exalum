import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShieldCheck, Search, RefreshCw, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface AuditLog {
  id: string;
  user_email: string | null;
  acao: string;
  entidade: string;
  entidade_id: string | null;
  descricao: string | null;
  created_at: string;
}

const ACAO_STYLES: Record<string, string> = {
  login: "bg-green-100 text-green-800 border-green-200",
  logout: "bg-slate-100 text-slate-700 border-slate-200",
  criar: "bg-blue-100 text-blue-800 border-blue-200",
  atualizar: "bg-amber-100 text-amber-800 border-amber-200",
  excluir: "bg-red-100 text-red-800 border-red-200",
  aprovar: "bg-green-100 text-green-800 border-green-200",
  rejeitar: "bg-red-100 text-red-800 border-red-200",
  ajuste_estoque: "bg-purple-100 text-purple-800 border-purple-200",
};

const LIMIT = 100;

export default function Auditoria() {
  const { isAdmin } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [entidadeFilter, setEntidadeFilter] = useState("todas");
  const [entidades, setEntidades] = useState<string[]>([]);

  useEffect(() => {
    if (isAdmin) fetchLogs();
  }, [isAdmin]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("id, user_email, acao, entidade, entidade_id, descricao, created_at")
        .order("created_at", { ascending: false })
        .limit(LIMIT);

      if (error) throw error;
      setLogs(data || []);
      setEntidades([...new Set((data || []).map(l => l.entidade))].sort());
    } catch (error: any) {
      toast({ title: "Erro ao carregar logs", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const logsFiltrados = logs.filter(log => {
    const matchEntidade = entidadeFilter === "todas" || log.entidade === entidadeFilter;
    const termo = searchTerm.toLowerCase();
    const matchBusca =
      !termo ||
      log.user_email?.toLowerCase().includes(termo) ||
      log.acao.toLowerCase().includes(termo) ||
      log.entidade.toLowerCase().includes(termo) ||
      log.descricao?.toLowerCase().includes(termo);
    return matchEntidade && matchBusca;
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
          <p className="text-muted-foreground mt-1">Histórico de ações realizadas no sistema (últimos {LIMIT} eventos)</p>
        </div>
        <Button variant="outline" onClick={fetchLogs} disabled={loading} className="w-full sm:w-auto">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por usuário, ação, entidade ou descrição..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={entidadeFilter} onValueChange={setEntidadeFilter}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Entidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as entidades</SelectItem>
              {entidades.map(ent => (
                <SelectItem key={ent} value={ent}>
                  {ent}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">Carregando logs...</div>
          ) : logsFiltrados.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">Nenhum registro encontrado.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead>Entidade</TableHead>
                    <TableHead>Descrição</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logsFiltrados.map(log => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {new Date(log.created_at).toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell className="text-sm">{log.user_email || "-"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={ACAO_STYLES[log.acao] || "bg-gray-100 text-gray-800 border-gray-200"}>
                          {log.acao}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{log.entidade}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-md truncate">{log.descricao || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
