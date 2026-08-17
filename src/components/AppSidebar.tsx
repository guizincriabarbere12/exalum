import { NavLink } from "react-router-dom";
import { LayoutDashboard, Package, Warehouse, Users, FileText, ShoppingCart, Truck, DollarSign, ChartBar as BarChart3, Settings, ClipboardList, Store, History, Boxes, ShoppingBag, Wallet, ClipboardCheck, Scissors } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";

const menuItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Produtos", url: "/produtos", icon: Package },
  { title: "Kits Acessórios", url: "/kits", icon: Boxes },
  { title: "Kits Montados", url: "/kits-montados", icon: Package },
  { title: "Estoque", url: "/estoque", icon: Warehouse },
  { title: "Sobras de Perfis", url: "/sobras-perfis", icon: Scissors },
  { title: "Clientes", url: "/clientes", icon: Users },
  
  // Novo item - Saldo de Clientes (abaixo de Clientes)
  { title: "Saldo Clientes", url: "/saldo-clientes", icon: Wallet },
  
  { title: "Orçamentos", url: "/orcamentos", icon: FileText },
  { title: "Conferência", url: "/conferencia-materiais", icon: ClipboardCheck },
  { title: "Vendas", url: "/vendas", icon: ShoppingCart },
  { title: "Pedidos", url: "/pedidos", icon: ClipboardList },
  { title: "Compras", url: "/compras", icon: ShoppingBag },
  { title: "Fornecedores", url: "/fornecedores", icon: Truck },
  { title: "Financeiro", url: "/financeiro", icon: DollarSign },
  { title: "Relatórios", url: "/relatorios", icon: BarChart3 },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border/50 p-4">
        {!collapsed && (
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent shadow-lg">
              <Package className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-sidebar-foreground tracking-tight">Exalum</h2>
              <p className="text-xs text-sidebar-foreground/60 font-medium">Manager Pro</p>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent shadow-lg">
            <Package className="h-6 w-6 text-white" />
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50 text-xs font-bold uppercase tracking-wider px-2">
            Administração
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className={({ isActive }) =>
                        isActive
                          ? "bg-gradient-to-r from-primary/20 to-accent/20 text-sidebar-foreground font-semibold border-l-4 border-primary shadow-sm"
                          : "hover:bg-sidebar-accent/70 hover:translate-x-1 transition-all duration-200"
                      }
                    >
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink
                    to="/configuracoes"
                    className={({ isActive }) =>
                      isActive
                        ? "bg-gradient-to-r from-primary/20 to-accent/20 text-sidebar-foreground font-semibold border-l-4 border-primary shadow-sm"
                        : "hover:bg-sidebar-accent/70 hover:translate-x-1 transition-all duration-200"
                    }
                  >
                    <Settings className="h-4 w-4" />
                    {!collapsed && <span>Configurações</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}