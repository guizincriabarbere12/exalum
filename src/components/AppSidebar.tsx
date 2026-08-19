import { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard, Package, Warehouse, Users, FileText, ShoppingCart, Truck,
  DollarSign, ChartBar as BarChart3, Settings, ClipboardList, Store, History,
  Boxes, ShoppingBag, Wallet, UserCheck, PaintBucket, Building2, ArrowLeftRight,
  ChevronDown, ChevronRight, Landmark, CreditCard, ArrowDownCircle, ArrowUpCircle,
  Send, FileSpreadsheet, Percent, Receipt, ClipboardCheck, BarChart3 as BarChartIcon,
  Hammer, ShieldCheck, PackageCheck, FileCheck,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useCompanyConfig } from "@/hooks/useCompanyConfig";
import { usePermissions } from "@/hooks/usePermissions";
import { cn } from "@/lib/utils";
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";

const menuItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, modulo: "dashboard" },
  { title: "Produtos", url: "/produtos", icon: Package, modulo: "produtos" },
  { title: "Kits Acessórios", url: "/kits", icon: Boxes, modulo: "kits" },
  { title: "Kits Montados", url: "/kits-montados", icon: Package, modulo: "kits-montados" },
  { title: "Estoque", url: "/estoque", icon: Warehouse, modulo: "estoque" },
  { title: "Ord. Produção", url: "/ordens-producao", icon: PaintBucket, modulo: "ordens-producao" },
  { title: "Filiais", url: "/filiais", icon: Building2, modulo: "filiais" },
  { title: "Transferências", url: "/transferencias-estoque", icon: ArrowLeftRight, modulo: "transferencias-estoque" },
  { title: "Clientes", url: "/clientes", icon: Users, modulo: "clientes" },
  { title: "Saldo Clientes", url: "/saldo-clientes", icon: Wallet, modulo: "saldo-clientes" },
  { title: "Orçamentos", url: "/orcamentos", icon: FileText, modulo: "orcamentos" },
  { title: "Vendas", url: "/vendas", icon: ShoppingCart, modulo: "vendas" },
  { title: "Pedidos", url: "/pedidos", icon: ClipboardList, modulo: "pedidos" },
  { title: "Requisições", url: "/requisicoes-material", icon: Hammer, modulo: "requisicoes-material" },
  { title: "Conferência", url: "/conferencia-materiais", icon: PackageCheck, modulo: "conferencia-materiais" },
  { title: "Compras", url: "/compras", icon: ShoppingBag, modulo: "compras" },
  { title: "Fornecedores", url: "/fornecedores", icon: Truck, modulo: "fornecedores" },
  { title: "Vendedores", url: "/vendedores", icon: UserCheck, modulo: "vendedores" },
];

const financeiroSubItems = [
  { title: "Gestão Financeira", url: "/financeiro", icon: DollarSign },
  { title: "Caixas e Bancos", url: "/financeiro/caixas-bancos", icon: Landmark },
  { title: "Contas a Pagar", url: "/financeiro/contas-pagar", icon: ArrowDownCircle },
  { title: "Contas a Receber", url: "/financeiro/contas-receber", icon: ArrowUpCircle },
  { title: "Remessas e Retornos", url: "/financeiro/remessas-retornos", icon: Send },
  { title: "Ficha Financeira", url: "/financeiro/ficha-financeira", icon: FileSpreadsheet },
  { title: "Comissões", url: "/financeiro/comissoes", icon: Percent },
  { title: "Controle de Caixa", url: "/financeiro/controle-caixa", icon: Receipt },
  { title: "Faturamento Agrupado", url: "/financeiro/faturamento-agrupado", icon: ClipboardCheck },
  { title: "Relatórios Financeiros", url: "/financeiro/relatorios", icon: BarChartIcon },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const [financeiroOpen, setFinanceiroOpen] = useState(true);
  const { nomeEmpresa, logoUrl } = useCompanyConfig();
  const { isAdmin } = useAuth();
  const { canAccess, podeGerenciarPermissoes } = usePermissions();

  const menuItemsVisiveis = menuItems.filter((item) => canAccess(item.modulo));

  const LogoBadge = () => (
    <div
      className={cn(
        "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-lg",
        !logoUrl && "bg-gradient-to-br from-primary to-accent",
      )}
    >
      {logoUrl ? (
        <img src={logoUrl} alt={nomeEmpresa} className="h-full w-full object-contain rounded-xl" />
      ) : (
        <Package className="h-6 w-6 text-white" />
      )}
    </div>
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border/50 p-4">
        {!collapsed && (
          <div className="flex items-center gap-3">
            <LogoBadge />
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-sidebar-foreground tracking-tight truncate">{nomeEmpresa}</h2>
              <p className="text-xs text-sidebar-foreground/60 font-medium">Manager Pro</p>
            </div>
          </div>
        )}
        {collapsed && <LogoBadge />}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50 text-xs font-bold uppercase tracking-wider px-2">
            Administração
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItemsVisiveis.map((item) => (
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

              {/* Financeiro com sub-itens */}
              {canAccess("financeiro") && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => setFinanceiroOpen(!financeiroOpen)}
                    className="hover:bg-sidebar-accent/70 hover:translate-x-1 transition-all duration-200 cursor-pointer"
                  >
                    <DollarSign className="h-4 w-4" />
                    {!collapsed && (
                      <>
                        <span>Financeiro</span>
                        <span className="ml-auto">
                          {financeiroOpen ? (
                            <ChevronDown className="h-4 w-4 text-sidebar-foreground/50" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-sidebar-foreground/50" />
                          )}
                        </span>
                      </>
                    )}
                  </SidebarMenuButton>
                  {!collapsed && financeiroOpen && (
                    <SidebarMenuSub>
                      {financeiroSubItems.map((sub) => (
                        <SidebarMenuSubItem key={sub.title}>
                          <SidebarMenuSubButton asChild>
                            <NavLink
                              to={sub.url}
                              className={({ isActive }) =>
                                isActive
                                  ? "bg-primary/15 text-sidebar-foreground font-medium border-l-2 border-primary"
                                  : "hover:bg-sidebar-accent/70 transition-all duration-200"
                              }
                            >
                              <sub.icon className="h-3.5 w-3.5" />
                              <span className="text-sm">{sub.title}</span>
                            </NavLink>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  )}
                </SidebarMenuItem>
              )}

              {canAccess("relatorios") && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to="/relatorios"
                      className={({ isActive }) =>
                        isActive
                          ? "bg-gradient-to-r from-primary/20 to-accent/20 text-sidebar-foreground font-semibold border-l-4 border-primary shadow-sm"
                          : "hover:bg-sidebar-accent/70 hover:translate-x-1 transition-all duration-200"
                      }
                    >
                      <BarChart3 className="h-4 w-4" />
                      {!collapsed && <span>Relatórios</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {isAdmin && canAccess("auditoria") && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to="/auditoria"
                      className={({ isActive }) =>
                        isActive
                          ? "bg-gradient-to-r from-primary/20 to-accent/20 text-sidebar-foreground font-semibold border-l-4 border-primary shadow-sm"
                          : "hover:bg-sidebar-accent/70 hover:translate-x-1 transition-all duration-200"
                      }
                    >
                      <History className="h-4 w-4" />
                      {!collapsed && <span>Auditoria</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              {podeGerenciarPermissoes && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to="/permissoes"
                      className={({ isActive }) =>
                        isActive
                          ? "bg-gradient-to-r from-primary/20 to-accent/20 text-sidebar-foreground font-semibold border-l-4 border-primary shadow-sm"
                          : "hover:bg-sidebar-accent/70 hover:translate-x-1 transition-all duration-200"
                      }
                    >
                      <ShieldCheck className="h-4 w-4" />
                      {!collapsed && <span>Permissões</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              {isAdmin && canAccess("configuracao-fiscal") && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to="/configuracao-fiscal"
                      className={({ isActive }) =>
                        isActive
                          ? "bg-gradient-to-r from-primary/20 to-accent/20 text-sidebar-foreground font-semibold border-l-4 border-primary shadow-sm"
                          : "hover:bg-sidebar-accent/70 hover:translate-x-1 transition-all duration-200"
                      }
                    >
                      <FileCheck className="h-4 w-4" />
                      {!collapsed && <span>Configuração Fiscal</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              {canAccess("configuracoes") && (
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
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
