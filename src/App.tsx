import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import Layout from "@/components/Layout";
import { PrivateRoute } from "@/components/PrivateRoute";
import PDV from "./pages/PDV";
import Estoque from "./pages/Estoque";
import Clientes from "./pages/Clientes";
import Ranking from "./pages/Ranking";
import Reposicao from "./pages/Reposicao";
import Relatorios from "./pages/Relatorios";
import Caixas from "./pages/Caixas";
import ExtratoCliente from "./pages/ExtratoCliente";
import Validade from "./pages/Validade";
import Configuracoes from "./pages/Configuracoes";
import Impressao from "./pages/Impressao";
import Planos from "./pages/Planos";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import { initTheme } from "./lib/themes";

initTheme();

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <HashRouter>
        <Routes>
          {/* Rotas públicas (sem layout) */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          {/* Rotas privadas (com layout e proteção) */}
          <Route
            path="/*"
            element={
              <PrivateRoute>
                <Layout>
                  <Routes>
                    <Route path="/" element={<PDV />} />
                    <Route path="/estoque" element={<Estoque />} />
                    <Route path="/clientes" element={<Clientes />} />
                    <Route path="/extrato" element={<ExtratoCliente />} />
                    <Route path="/validade" element={<Validade />} />
                    <Route path="/ranking" element={<Ranking />} />
                    <Route path="/reposicao" element={<Reposicao />} />
                    <Route path="/caixas" element={<Caixas />} />
                    <Route path="/configuracoes" element={<Configuracoes />} />
                    <Route path="/impressao" element={<Impressao />} />
                    <Route path="/planos" element={<Planos />} />
                    <Route path="/relatorios" element={<Relatorios />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Layout>
              </PrivateRoute>
            }
          />
        </Routes>
      </HashRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
