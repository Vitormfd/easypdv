import { useState, useMemo } from 'react';
import { CalendarDays, TrendingUp, DollarSign, CreditCard } from 'lucide-react';
import { getSales, getProducts } from '@/lib/store';
import { formatCurrency, paymentMethodLabels } from '@/lib/format';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import PlanGate from '@/components/PlanGate';

const COLORS = ['hsl(142, 50%, 38%)', 'hsl(35, 80%, 52%)', 'hsl(210, 60%, 50%)', 'hsl(0, 65%, 52%)', 'hsl(270, 50%, 50%)'];

export default function RelatoriosPage() {
  return (
    <PlanGate feature="relatorios">
      <RelatoriosContent />
    </PlanGate>
  );
}

function RelatoriosContent() {
  const [period, setPeriod] = useState<'today' | '7days' | '30days' | 'all'>('today');
  const sales = getSales();

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const filteredSales = useMemo(() => {
    if (period === 'all') return sales;
    let start: Date;
    if (period === 'today') start = todayStart;
    else if (period === '7days') start = new Date(now.getTime() - 7 * 86400000);
    else start = new Date(now.getTime() - 30 * 86400000);
    return sales.filter(s => new Date(s.createdAt) >= start);
  }, [sales, period]);

  const totalRevenue = filteredSales.reduce((acc, s) => acc + s.total, 0);
  const totalSalesCount = filteredSales.length;

  const products = getProducts();
  const estimatedProfit = useMemo(() => {
    let profit = 0;
    filteredSales.forEach(sale => {
      sale.items.forEach(item => {
        const p = products.find(pr => pr.id === item.productId);
        if (p) profit += (item.unitPrice - p.cost) * item.quantity;
      });
    });
    return profit;
  }, [filteredSales, products]);

  // Payment breakdown from payments array (multi-payment aware)
  const paymentBreakdown = useMemo(() => {
    const breakdown: Record<string, number> = {};
    filteredSales.forEach(s => {
      if (s.payments && s.payments.length > 0) {
        s.payments.forEach(p => {
          breakdown[p.method] = (breakdown[p.method] || 0) + p.amount;
        });
      } else {
        // Legacy single payment
        breakdown[s.paymentMethod] = (breakdown[s.paymentMethod] || 0) + s.total;
      }
    });
    return Object.entries(breakdown).map(([method, total]) => ({
      name: paymentMethodLabels[method] || method,
      value: total,
    }));
  }, [filteredSales]);

  // Revenue excluding fiado (actually received)
  const receivedRevenue = useMemo(() => {
    let received = 0;
    filteredSales.forEach(s => {
      if (s.payments && s.payments.length > 0) {
        s.payments.forEach(p => {
          if (p.method !== 'fiado') received += p.amount;
        });
      } else if (s.paymentMethod !== 'fiado') {
        received += s.total;
      }
    });
    return received;
  }, [filteredSales]);

  const topProducts = useMemo(() => {
    const productMap: Record<string, { name: string; qty: number; total: number }> = {};
    filteredSales.forEach(s => {
      s.items.filter(item => item.productId !== 'import').forEach(item => {
        if (!productMap[item.productId]) {
          productMap[item.productId] = { name: item.productName, qty: 0, total: 0 };
        }
        productMap[item.productId].qty += item.quantity;
        productMap[item.productId].total += item.subtotal;
      });
    });
    return Object.values(productMap).sort((a, b) => b.total - a.total).slice(0, 10);
  }, [filteredSales]);

  const dailyData = useMemo(() => {
    if (period === 'today') return [];
    const dayMap: Record<string, number> = {};
    filteredSales.forEach(s => {
      const d = new Date(s.createdAt);
      const key = `${d.getDate()}/${d.getMonth() + 1}`;
      dayMap[key] = (dayMap[key] || 0) + s.total;
    });
    return Object.entries(dayMap).map(([day, total]) => ({ day, total }));
  }, [filteredSales, period]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h2 className="text-2xl font-bold">Relatórios</h2>
        <div className="flex gap-2">
          <button onClick={() => setPeriod('today')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${period === 'today' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
            Hoje
          </button>
          <button onClick={() => setPeriod('7days')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${period === '7days' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
            7 Dias
          </button>
          <button onClick={() => setPeriod('30days')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${period === '30days' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
            30 Dias
          </button>
          <button onClick={() => setPeriod('all')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${period === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
            Total
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Faturamento', value: formatCurrency(totalRevenue), icon: TrendingUp, color: 'text-primary' },
          { label: 'Recebido', value: formatCurrency(receivedRevenue), icon: DollarSign, color: 'text-success' },
          { label: 'Lucro Estimado', value: formatCurrency(estimatedProfit), icon: CalendarDays, color: 'text-accent' },
          { label: 'Ticket Médio', value: formatCurrency(totalSalesCount > 0 ? totalRevenue / totalSalesCount : 0), icon: CreditCard, color: 'text-secondary' },
        ].map((kpi, i) => (
          <div key={i} className="card-pdv p-4" style={{ animationDelay: `${i * 80}ms` }}>
            <div className="flex items-center gap-2 mb-2">
              <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
              <span className="text-xs text-muted-foreground font-medium uppercase">{kpi.label}</span>
            </div>
            <p className="text-xl font-extrabold tabular-nums">{kpi.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card-pdv p-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">Por Forma de Pagamento</h3>
          {paymentBreakdown.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">Sem vendas no período</p>
          ) : (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={paymentBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {paymentBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="card-pdv p-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">Mais Vendidos</h3>
          {topProducts.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">Sem vendas no período</p>
          ) : (
            <div className="space-y-2">
              {topProducts.map((p, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="truncate flex-1">
                    <span className="text-muted-foreground mr-2">{i + 1}.</span>
                    {p.name}
                  </span>
                  <span className="font-semibold tabular-nums ml-2">{formatCurrency(p.total)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {period !== 'today' && dailyData.length > 0 && (
        <div className="card-pdv p-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">Faturamento Diário</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData}>
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `R$${v}`} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Bar dataKey="total" fill="hsl(142, 50%, 38%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
