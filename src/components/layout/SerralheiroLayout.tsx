import { NavLink, useNavigate } from "react-router-dom";
import { Hammer, ClipboardList, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/hooks/useAuth";
import { useCompanyConfig } from "@/hooks/useCompanyConfig";
import { logActivity } from "@/lib/auditLog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface SerralheiroLayoutProps {
  children: React.ReactNode;
}

export function SerralheiroLayout({ children }: SerralheiroLayoutProps) {
  const { signOut } = useAuth();
  const { nomeEmpresa, logoUrl } = useCompanyConfig();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logActivity({ acao: "logout", entidade: "auth" });
    await signOut();
    toast.success("Logout realizado com sucesso!");
    navigate("/auth", { replace: true });
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 dark:from-background dark:via-background dark:to-background">
      <header className="sticky top-0 z-10 flex h-14 sm:h-16 items-center justify-between border-b border-border/50 bg-background/80 backdrop-blur-xl px-3 sm:px-6 shadow-sm">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {logoUrl ? (
            <img src={logoUrl} alt={nomeEmpresa} className="h-8 w-8 shrink-0 rounded-lg object-contain" />
          ) : (
            <div className="h-8 w-8 shrink-0 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-md">
              <span className="text-white font-bold text-sm">{nomeEmpresa.charAt(0).toUpperCase()}</span>
            </div>
          )}
          <h1 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent truncate">
            {nomeEmpresa}
          </h1>
        </div>
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <ThemeToggle />
          <Button variant="ghost" size="icon" onClick={handleLogout} title="Sair" className="hover:bg-destructive/10 hover:text-destructive transition-colors">
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <nav className="flex items-center gap-1 border-b border-border/50 bg-background/60 px-3 sm:px-6 overflow-x-auto">
        <NavLink
          to="/serralheiro/pedido"
          className={({ isActive }) =>
            cn(
              "flex items-center gap-2 px-3 sm:px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors",
              isActive ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            )
          }
        >
          <Hammer className="h-4 w-4" />
          Fazer Pedido
        </NavLink>
        <NavLink
          to="/serralheiro/meus-pedidos"
          className={({ isActive }) =>
            cn(
              "flex items-center gap-2 px-3 sm:px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors",
              isActive ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            )
          }
        >
          <ClipboardList className="h-4 w-4" />
          Meus Pedidos
        </NavLink>
      </nav>

      <main className="flex-1 p-3 sm:p-6 animate-fade-in overflow-x-hidden">{children}</main>
    </div>
  );
}
