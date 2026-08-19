import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "./components/layout/AppLayout";
import { SerralheiroLayout } from "./components/layout/SerralheiroLayout";
import Dashboard from "./pages/Dashboard";
import Produtos from "./pages/Produtos";
import Kits from "./pages/Kits";
import KitsMontados from "./pages/KitsMontados";
import Estoque from "./pages/Estoque";
import Clientes from "./pages/Clientes";
import Orcamentos from "./pages/Orcamentos";
import Vendas from "./pages/Vendas";
import Fornecedores from "./pages/Fornecedores";
import Financeiro from "./pages/Financeiro";
import Relatorios from "./pages/Relatorios";
import Pedidos from "./pages/Pedidos";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import Configuracoes from "./pages/Configuracoes";
import CatalogoCliente from "./pages/CatalogoCliente";
import Carrinho from "./pages/Carrinho";
import MeusPedidos from "./pages/MeusPedidos";
import CatalogoPublico from "./pages/CatalogoPublico";
import Compras from "./pages/Compras";
import SaldoClientes from "./pages/SaldoClientes";
import Vendedores from "./pages/Vendedores";
import OrdensProducao from "./pages/OrdensProducao";
import Filiais from "./pages/Filiais";
import TransferenciasEstoque from "./pages/TransferenciasEstoque";
import FinanceiroSub from "./pages/FinanceiroSub";
import Perfil from "./pages/Perfil";
import Auditoria from "./pages/Auditoria";
import Permissoes from "./pages/Permissoes";
import ConferenciaMateriais from "./pages/ConferenciaMateriais";
import ConfiguracaoFiscal from "./pages/ConfiguracaoFiscal";
import PedidoSerralheiro from "./pages/PedidoSerralheiro";
import MeusPedidosSerralheiro from "./pages/MeusPedidosSerralheiro";
import RequisicoesMateriais from "./pages/RequisicoesMateriais";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}

function RootRedirect() {
  const { user, loading, isSerralheiro } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <Navigate to={isSerralheiro ? "/serralheiro/pedido" : "/dashboard"} replace />;
}

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="exalum-theme">
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/" element={<RootRedirect />} />
          <Route path="/catalogo-publico" element={<CatalogoPublico />} />
          
          {/* Rotas Protegidas */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Dashboard />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/produtos"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Produtos />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/kits"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Kits />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/kits-montados"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <KitsMontados />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/estoque"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Estoque />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/clientes"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Clientes />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          
          {/* Nova Rota para Saldo de Clientes - Adicionada aqui */}
          <Route
            path="/saldo-clientes"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <SaldoClientes />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/orcamentos"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Orcamentos />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/vendas"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Vendas />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/pedidos"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Pedidos />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/compras"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Compras />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/fornecedores"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Fornecedores />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/vendedores"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Vendedores />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/financeiro"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Financeiro />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/financeiro/caixas-bancos"
            element={<ProtectedRoute><AppLayout><FinanceiroSub /></AppLayout></ProtectedRoute>}
          />
          <Route
            path="/financeiro/contas-pagar"
            element={<ProtectedRoute><AppLayout><FinanceiroSub /></AppLayout></ProtectedRoute>}
          />
          <Route
            path="/financeiro/contas-receber"
            element={<ProtectedRoute><AppLayout><FinanceiroSub /></AppLayout></ProtectedRoute>}
          />
          <Route
            path="/financeiro/remessas-retornos"
            element={<ProtectedRoute><AppLayout><FinanceiroSub /></AppLayout></ProtectedRoute>}
          />
          <Route
            path="/financeiro/ficha-financeira"
            element={<ProtectedRoute><AppLayout><FinanceiroSub /></AppLayout></ProtectedRoute>}
          />
          <Route
            path="/financeiro/comissoes"
            element={<ProtectedRoute><AppLayout><FinanceiroSub /></AppLayout></ProtectedRoute>}
          />
          <Route
            path="/financeiro/controle-caixa"
            element={<ProtectedRoute><AppLayout><FinanceiroSub /></AppLayout></ProtectedRoute>}
          />
          <Route
            path="/financeiro/faturamento-agrupado"
            element={<ProtectedRoute><AppLayout><FinanceiroSub /></AppLayout></ProtectedRoute>}
          />
          <Route
            path="/financeiro/relatorios"
            element={<ProtectedRoute><AppLayout><FinanceiroSub /></AppLayout></ProtectedRoute>}
          />
          <Route
            path="/relatorios"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Relatorios />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/configuracoes"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Configuracoes />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          
          {/* Rotas para Clientes */}
          <Route
            path="/catalogo-cliente"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <CatalogoCliente />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/carrinho"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Carrinho />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/meus-pedidos"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <MeusPedidos />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/ordens-producao"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <OrdensProducao />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/filiais"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Filiais />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/transferencias-estoque"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <TransferenciasEstoque />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/perfil"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Perfil />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/auditoria"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Auditoria />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/conferencia-materiais"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <ConferenciaMateriais />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/configuracao-fiscal"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <ConfiguracaoFiscal />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/permissoes"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Permissoes />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/requisicoes-material"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <RequisicoesMateriais />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          {/* Área do Serralheiro */}
          <Route
            path="/serralheiro/pedido"
            element={
              <ProtectedRoute>
                <SerralheiroLayout>
                  <PedidoSerralheiro />
                </SerralheiroLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/serralheiro/meus-pedidos"
            element={
              <ProtectedRoute>
                <SerralheiroLayout>
                  <MeusPedidosSerralheiro />
                </SerralheiroLayout>
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<NotFound />} />
        </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;