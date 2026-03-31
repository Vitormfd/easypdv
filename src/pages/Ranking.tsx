import { useState, useMemo } from 'react';
import { Trophy, BarChart3, List } from 'lucide-react';
import { getSales } from '@/lib/store';
import { formatCurrency } from '@/lib/format';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import PlanGate from '@/components/PlanGate';

type Period = 'today' | 'week' | 'month';

const periodLabels: Record<Period, string> = {
  today: 'Hoje',
  week: 'Semana',
  month: 'Mês',
};

export default function RankingPage() {
  return (
    <PlanGate feature="ranking">
      <RankingContent />
    </PlanGate>
  );
}

function RankingContent() {
  const [period, setPeriod] = useState<Period>('month');
  const [viewMode, setViewMode] = useState<'list' | 'chart'>('list');
  const sales = getSales();

  const periodStart = useMemo(() => {
    const now = new Date();
    if (period === 'today') return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (period === 'week') {
      const d = new Date(now);
      d.setDate(d.getDate() - d.getDay());
      d.setHours(0, 0, 0, 0);
      return d;
    }
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }, [period]);

  const topProducts = useMemo(() => {
    const filtered = sales.filter(s => new Date(s.createdAt) >= periodStart);
    const map: Record<string, { name: string; qty: number; total: number }> = {};
    filtered.forEach(s => {
      s.items.filter(item => item.productId !== 'import').forEach(item => {
        if (!map[item.productId]) map[item.productId] = { name: item.productName, qty: 0, total: 0 };
        map[item.productId].qty += item.quantity;
        map[item.productId].total += item.subtotal;
      });
    });
    return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 10);
  }, [sales, periodStart]);

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Trophy className="w-6 h-6 text-secondary" /> Produtos Mais Vendidos
          </h2>
          <p className="text-sm text-muted-foreground">Top 10 do período</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setViewMode(viewMode === 'list' ? 'chart' : 'list')} className="w-10 h-10 rounded-lg border border-border flex items-center justify-center hover:bg-muted transition-all active:scale-95" title="Alternar visualização">
            {viewMode === 'list' ? <BarChart3 className="w-4 h-4" /> : <List className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Period filter */}
      <div className="flex gap-2">
        {(Object.keys(periodLabels) as Period[]).map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all active:scale-95 ${
              period === p ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            {periodLabels[p]}
          </button>
        ))}
      </div>

      {topProducts.length === 0 ? (
        <div className="card-pdv p-12 text-center text-muted-foreground">
          Nenhuma venda no período selecionado
        </div>
      ) : viewMode === 'list' ? (
        <div className="card-pdv divide-y divide-border">
          {topProducts.map((p, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                i === 0 ? 'bg-secondary text-secondary-foreground' : i < 3 ? 'bg-muted text-foreground' : 'bg-muted/50 text-muted-foreground'
              }`}>
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{p.name}</p>
                <p className="text-xs text-muted-foreground">{p.qty} vendido(s)</p>
              </div>
              <span className="font-bold tabular-nums">{formatCurrency(p.total)}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="card-pdv p-4">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topProducts} layout="vertical" margin={{ left: 80 }}>
                <XAxis type="number" tickFormatter={v => `R$${v}`} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={80} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Bar dataKey="total" fill="hsl(35, 80%, 52%)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
