import { useState, useEffect, useMemo } from 'react';
import { AlertTriangle, CheckCircle2, ShoppingBasket, RotateCcw } from 'lucide-react';
import { getProducts } from '@/lib/store';
import { getRestockSuggestions, getPurchasedItems, togglePurchased, clearPurchased, type RestockSuggestion } from '@/lib/restock';
import { formatCurrency } from '@/lib/format';
import { toast } from 'sonner';

export default function ReposicaoPage() {
  const [suggestions, setSuggestions] = useState<RestockSuggestion[]>([]);
  const [purchased, setPurchased] = useState<string[]>([]);
  const [visibleCount, setVisibleCount] = useState(50);

  const reload = () => {
    setSuggestions(getRestockSuggestions(getProducts()));
    setPurchased(getPurchasedItems());
  };

  useEffect(() => { reload(); }, []);

  const pending = useMemo(() => suggestions.filter(s => !purchased.includes(s.product.id)), [suggestions, purchased]);
  const done = useMemo(() => suggestions.filter(s => purchased.includes(s.product.id)), [suggestions, purchased]);

  const handleToggle = (productId: string) => {
    togglePurchased(productId);
    setPurchased(getPurchasedItems());
  };

  const handleClear = () => {
    clearPurchased();
    setPurchased([]);
    toast.success('Lista de comprados limpa');
  };


  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <ShoppingBasket className="w-6 h-6 text-accent" /> Sugestão de Reposição
          </h2>
          <p className="text-sm text-muted-foreground">Baseado na média de vendas dos últimos 30 dias</p>
        </div>
        {done.length > 0 && (
          <button onClick={handleClear} className="btn-pdv-outline !text-sm !py-2 !px-4">
            <RotateCcw className="w-4 h-4" /> Limpar Comprados
          </button>
        )}
      </div>

      {suggestions.length === 0 ? (
        <div className="card-pdv p-12 text-center text-muted-foreground">
          <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Todos os produtos estão com estoque adequado</p>
        </div>
      ) : (
        <>
          {/* Pending */}
          {pending.length > 0 && (
            <div className="card-pdv divide-y divide-border">
              {pending.slice(0, visibleCount).map(s => (
                <button
                  key={s.product.id}
                  onClick={() => handleToggle(s.product.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
                >
                  <div className={`w-3 h-3 rounded-full flex-shrink-0 ${s.critical ? 'bg-destructive animate-pulse' : 'bg-warning'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{s.product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Estoque: {s.product.stock} {s.product.unit} •
                      Média: {s.avgDailySales.toFixed(1)}/dia •
                      {s.critical ? (
                        <span className="text-destructive font-semibold"> Acaba em {s.daysUntilOut} dia(s)!</span>
                      ) : (
                        <span> Acaba em ~{s.daysUntilOut} dias</span>
                      )}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold">Comprar: {s.suggestedQty} {s.product.unit}</p>
                    <p className="text-xs text-muted-foreground">~{formatCurrency(s.suggestedQty * s.product.cost)}</p>
                  </div>
                </button>
              ))}
              {visibleCount < pending.length && (
                <div className="p-3 text-center">
                  <button onClick={() => setVisibleCount(c => c + 50)} className="text-sm text-primary font-medium hover:underline">
                    Mostrar mais ({pending.length - visibleCount} restantes)
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Done */}
          {done.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Comprados</h3>
              <div className="card-pdv divide-y divide-border opacity-60">
                {done.map(s => (
                  <button
                    key={s.product.id}
                    onClick={() => handleToggle(s.product.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
                  >
                    <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0" />
                    <span className="font-medium line-through truncate">{s.product.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
