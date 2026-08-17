import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Bell, User, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { signOut, isAdmin } = useAuth();

  const handleLogout = async () => {
    await signOut();
    toast.success("Logout realizado com sucesso!");
  };
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-border/50 bg-white/80 backdrop-blur-xl px-6 shadow-sm">
            <div className="flex items-center gap-4">
              <SidebarTrigger />
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-md">
                  <span className="text-white font-bold text-sm">E</span>
                </div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Exalum Manager</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isAdmin && (
                <span className="px-3 py-1 bg-gradient-to-r from-primary/10 to-accent/10 text-primary text-xs font-bold rounded-full border border-primary/20">
                  ADMIN
                </span>
              )}
              <Button variant="ghost" size="icon" className="relative hover:bg-primary/5 transition-colors">
                <Bell className="h-5 w-5" />
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-destructive animate-pulse" />
              </Button>
              <Button variant="ghost" size="icon" className="hover:bg-primary/5 transition-colors">
                <User className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" onClick={handleLogout} title="Sair" className="hover:bg-destructive/10 hover:text-destructive transition-colors">
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </header>
          <main className="flex-1 p-6 animate-fade-in">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
