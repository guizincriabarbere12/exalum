import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Bell, User, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useCompanyConfig } from "@/hooks/useCompanyConfig";
import { useNavigate, Navigate } from "react-router-dom";
import { toast } from "sonner";
import { logActivity } from "@/lib/auditLog";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { signOut, isAdmin, isSerralheiro } = useAuth();
  const { nomeEmpresa, logoUrl } = useCompanyConfig();
  const navigate = useNavigate();

  if (isSerralheiro) {
    return <Navigate to="/serralheiro/pedido" replace />;
  }

  const handleLogout = async () => {
    await logActivity({ acao: "logout", entidade: "auth" });
    await signOut();
    toast.success("Logout realizado com sucesso!");
    navigate("/auth", { replace: true });
  };
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 dark:from-background dark:via-background dark:to-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <header className="sticky top-0 z-10 flex h-14 sm:h-16 items-center justify-between border-b border-border/50 bg-background/80 backdrop-blur-xl px-3 sm:px-6 shadow-sm">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <SidebarTrigger />
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                {logoUrl ? (
                  <img src={logoUrl} alt={nomeEmpresa} className="h-8 w-8 shrink-0 rounded-lg object-contain" />
                ) : (
                  <div className="h-8 w-8 shrink-0 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-md">
                    <span className="text-white font-bold text-sm">{nomeEmpresa.charAt(0).toUpperCase()}</span>
                  </div>
                )}
                <h1 className="hidden sm:block text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent truncate">
                  {nomeEmpresa} Manager
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              {isAdmin && (
                <span className="hidden sm:inline-block px-3 py-1 bg-gradient-to-r from-primary/10 to-accent/10 text-primary text-xs font-bold rounded-full border border-primary/20">
                  ADMIN
                </span>
              )}
              <ThemeToggle />
              <Button variant="ghost" size="icon" className="relative hover:bg-primary/5 transition-colors">
                <Bell className="h-5 w-5" />
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-destructive animate-pulse" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/perfil")}
                title="Meu Perfil"
                className="hidden sm:inline-flex hover:bg-primary/5 transition-colors"
              >
                <User className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" onClick={handleLogout} title="Sair" className="hover:bg-destructive/10 hover:text-destructive transition-colors">
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </header>
          <main className="flex-1 p-3 sm:p-6 animate-fade-in overflow-x-hidden">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
