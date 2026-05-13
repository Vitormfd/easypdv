import { useState, useMemo } from 'react';
import { CalendarDays, TrendingUp, DollarSign, CreditCard, Package, ShoppingCart, Percent, BarChart2 } from 'lucide-react';
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
  const [period, setPeriod] = useState<'today' | '7days' | '30days' | 'all' | 'custom'>('today');
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const [customStart, setCustomStart] = useState(todayStr);
  const [customEnd, setCustomEnd] = useState(todayStr);
  const sales = getSales();

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const filteredSales = useMemo(() => {
    if (period === 'all') return sales;
    if (period === 'custom') {
      const start = new Date(customStart + 'T00:00:00');
      const end = new Date(customEnd + 'T23:59:59');
      return sales.filter(s => {
        const d = new Date(s.createdAt);
        return d >= start && d <= end;
      });
    }
    let start: Date;
    if (period === 'today') start = todayStart;
    else if (period === '7days') start = new Date(now.getTime() - 7 * 86400000);
    else start = new Date(now.getTime() - 30 * 86400000);
    return sales.filter(s => new Date(s.createdAt) >= start);
  }, [sales, period, customStart, customEnd]);

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

  const productReport = useMemo(() => {
    let revenue = 0;
    let cogs = 0;
    let totalQty = 0;
    const byProduct: Record<string, { name: string; qty: number; revenue: number; cogs: number; profit: number }> = {};
    filteredSales.forEach(sale => {
      sale.items.filter(item => item.productId !== 'import').forEach(item => {
        const p = products.find(pr => pr.id === item.productId);
        const cost = p ? p.cost * item.quantity : 0;
        revenue += item.subtotal;
        cogs += cost;
        totalQty += item.quantity;
        if (!byProduct[item.productId]) {
          byProduct[item.productId] = { name: item.productName, qty: 0, revenue: 0, cogs: 0, profit: 0 };
        }
        byProduct[item.productId].qty += item.quantity;
        byProduct[item.productId].revenue += item.subtotal;
        byProduct[item.productId].cogs += cost;
        byProduct[item.productId].profit += item.subtotal - cost;
      });
    });
    const profit = revenue - cogs;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
    const topByProfit = Object.values(byProduct).sort((a, b) => b.profit - a.profit).slice(0, 10);
    return { revenue, cogs, profit, margin, totalQty, topByProfit };
  }, [filteredSales, products]);

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
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <h2 className="text-2xl font-bold">Relatórios</h2>
          <div className="flex flex-wrap gap-2">
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
            <button onClick={() => setPeriod('custom')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${period === 'custom' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
              Personalizado
            </button>
          </div>
        </div>
        {period === 'custom' && (
          <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border">
            <CalendarDays className="w-4 h-4 text-muted-foreground" />
            <label className="text-sm text-muted-foreground">De</label>
            <input
              type="date"
              value={customStart}
              max={customEnd}
              onChange={e => setCustomStart(e.target.value)}
              className="px-3 py-1.5 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <label className="text-sm text-muted-foreground">até</label>
            <input
              type="date"
              value={customEnd}
              min={customStart}
              onChange={e => setCustomEnd(e.target.value)}
              className="px-3 py-1.5 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        )}
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

      {/* Products Report */}
      <div className="space-y-4">
        <h3 className="text-base font-bold flex items-center gap-2"><Package className="w-5 h-5 text-primary" /> Relatório de Produtos</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Faturamento', value: formatCurrency(productReport.revenue), icon: TrendingUp, color: 'text-primary' },
            { label: 'Custo das Mercadorias', value: formatCurrency(productReport.cogs), icon: ShoppingCart, color: 'text-destructive' },
            { label: 'Lucro Bruto', value: formatCurrency(productReport.profit), icon: BarChart2, color: 'text-success' },
            { label: 'Margem', value: `${productReport.margin.toFixed(1)}%`, icon: Percent, color: 'text-accent' },
          ].map((kpi, i) => (
            <div key={i} className="card-pdv p-4">
              <div className="flex items-center gap-2 mb-2">
                <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
                <span className="text-xs text-muted-foreground font-medium uppercase">{kpi.label}</span>
              </div>
              <p className="text-xl font-extrabold tabular-nums">{kpi.value}</p>
            </div>
          ))}
        </div>
        <div className="card-pdv p-4">
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">Top Produtos por Lucro</h4>
          {productReport.topByProfit.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4 text-center">Sem vendas no período</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground text-xs uppercase">
                    <th className="text-left py-2 pr-4">#</th>
                    <th className="text-left py-2 pr-4">Produto</th>
                    <th className="text-right py-2 pr-4">Qtd</th>
                    <th className="text-right py-2 pr-4">Faturamento</th>
                    <th className="text-right py-2 pr-4">Custo</th>
                    <th className="text-right py-2 pr-4">Lucro</th>
                    <th className="text-right py-2">Margem</th>
                  </tr>
                </thead>
                <tbody>
                  {productReport.topByProfit.map((p, i) => (
                    <tr key={i} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="py-2 pr-4 text-muted-foreground">{i + 1}</td>
                      <td className="py-2 pr-4 font-medium truncate max-w-[160px]">{p.name}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{p.qty}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{formatCurrency(p.revenue)}</td>
                      <td className="py-2 pr-4 text-right tabular-nums text-destructive">{formatCurrency(p.cogs)}</td>
                      <td className="py-2 pr-4 text-right tabular-nums text-success font-semibold">{formatCurrency(p.profit)}</td>
                      <td className="py-2 text-right tabular-nums">{p.revenue > 0 ? ((p.profit / p.revenue) * 100).toFixed(1) : '0.0'}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
