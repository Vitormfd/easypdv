import { ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ShoppingCart, Package, Users, BarChart3, Menu, X, Trophy, ShoppingBasket, Settings2, Archive, FileText, CalendarClock, LogOut } from 'lucide-react';
import { getSystemName } from '@/lib/store';
import { useAuth } from '@/hooks/useAuth';

const navItems = [
  { to: '/', label: 'Caixa', icon: ShoppingCart },
  { to: '/estoque', label: 'Estoque', icon: Package },
  { to: '/clientes', label: 'Clientes', icon: Users },
  { to: '/extrato', label: 'Extrato', icon: FileText },
  { to: '/validade', label: 'Validade', icon: CalendarClock },
  { to: '/ranking', label: 'Ranking', icon: Trophy },
  { to: '/reposicao', label: 'Reposição', icon: ShoppingBasket },
  { to: '/relatorios', label: 'Relatórios', icon: BarChart3 },
  { to: '/caixas', label: 'Caixas', icon: Archive },
];

export default function Layout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-card border-b border-border px-4 py-3 flex items-center justify-between sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
            <ShoppingCart className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight">{getSystemName()}</h1>
            <p className="text-xs text-muted-foreground leading-tight">Sistema de Vendas</p>
          </div>
        </div>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {navItems.map(item => {
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
          <button onClick={() => navigate('/configuracoes')} className={`ml-1 w-9 h-9 rounded-lg flex items-center justify-center transition-all ${location.pathname === '/configuracoes' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`} title="Configurações">
            <Settings2 className="w-4 h-4" />
          </button>
          <button onClick={handleLogout} className="ml-1 w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted transition-all" title="Sair">
            <LogOut className="w-4 h-4" />
          </button>
        </nav>

        {/* Mobile menu button */}
        <div className="md:hidden flex items-center gap-1">
          <button onClick={() => navigate('/configuracoes')} className="w-10 h-10 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted">
            <Settings2 className="w-5 h-5" />
          </button>
          <button onClick={handleLogout} className="w-10 h-10 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted">
            <LogOut className="w-5 h-5" />
          </button>
          <button onClick={() => setMenuOpen(!menuOpen)} className="w-10 h-10 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted">
            {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </header>

      {/* Mobile nav */}
      {menuOpen && (
        <div className="md:hidden bg-card border-b border-border animate-fade-in">
          <nav className="flex flex-col p-2 gap-1">
            {navItems.map(item => {
              const active = location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium transition-all ${
                    active
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      )}

      {/* Content */}
      <main className="flex-1 p-4 md:p-6 max-w-7xl mx-auto w-full">
        {children}
      </main>
    </div>
  );
}
