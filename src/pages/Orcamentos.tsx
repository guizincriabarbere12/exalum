// @ts-nocheck - Temporary fix until Supabase types are regenerated
import { lazy, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { FileText, Loader as Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const AddOrcamentoDialog = lazy(() => import("@/components/orcamentos/AddOrcamentoDialog"));

export default function Orcamentos() {
  const { isAdmin } = useAuth();

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6 animate-fade-in">
      <div className="bg-primary/10 rounded-full p-6">
        <FileText className="h-16 w-16 text-primary" />
      </div>
      
      <div className="text-center space-y-4">
        <h2 className="text-3xl font-bold text-foreground">Orçamentos</h2>
        <p className="text-muted-foreground max-w-md">
          Crie e gerencie os orçamentos da sua empresa de forma simples e rápida.
        </p>
      </div>

      {isAdmin ? (
        <Suspense fallback={<Button disabled><Loader2 className="h-4 w-4 mr-2 animate-spin" />Carregando...</Button>}>
          <AddOrcamentoDialog onOrcamentoAdded={() => {}} />
        </Suspense>
      ) : (
        <p className="text-sm text-muted-foreground">
          Você não tem permissão para criar orçamentos.
        </p>
      )}
    </div>
  );
}