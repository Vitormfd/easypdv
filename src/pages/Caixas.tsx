import { useEffect, useState } from 'react';
import { Archive, CheckCircle, AlertTriangle, Clock, Download } from 'lucide-react';
import { getCashRegisters } from '@/lib/store';
import { formatCurrency, formatDateTime } from '@/lib/format';
import { downloadRegisterBackup } from '@/lib/plans';
import { toast } from 'sonner';

export default function CaixasPage() {
  const [registers, setRegisters] = useState(() =>
    getCashRegisters().sort((a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime())
  );

  useEffect(() => {
    const reload = () => {
      setRegisters(getCashRegisters().sort((a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime()));
    };

    const handleDataUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<{ key?: string }>;
      if (customEvent.detail?.key === 'pdv_cash_registers') {
        reload();
      }
    };

    reload();
    window.addEventListener('pdv:data-updated', handleDataUpdated as EventListener);
    return () => window.removeEventListener('pdv:data-updated', handleDataUpdated as EventListener);
  }, []);

  const handleBackup = (r: typeof registers[0]) => {
    try {
      downloadRegisterBackup(r);
      toast.success('Backup do caixa salvo!');
    } catch {
      toast.error('Erro ao gerar backup');
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-2">
        <Archive className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-bold">Histórico de Caixas</h2>
        <span className="text-sm text-muted-foreground">({registers.length})</span>
      </div>

      {registers.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">
          <Archive className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Nenhum caixa registrado ainda</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Data</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Status</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Inicial</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Vendas</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Dinheiro</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground">PIX</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Cartão</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Fiado</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Contado</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Diferença</th>
                <th className="text-center px-4 py-3 font-semibold text-muted-foreground">Backup</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {registers.map(r => (
                <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium">{formatDateTime(r.openedAt)}</p>
                    {r.closedAt && <p className="text-xs text-muted-foreground">até {formatDateTime(r.closedAt)}</p>}
                  </td>
                  <td className="px-4 py-3">
                    {r.status === 'open' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-semibold">
                        <Clock className="w-3 h-3" /> Aberto
                      </span>
                    ) : r.difference != null && r.difference === 0 ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-success/10 text-success text-xs font-semibold">
                        <CheckCircle className="w-3 h-3" /> OK
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-destructive/10 text-destructive text-xs font-semibold">
                        <AlertTriangle className="w-3 h-3" /> Diferença
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(r.openingAmount)}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium">{formatCurrency(r.totalSales)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(r.totalDinheiro)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(r.totalPix)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(r.totalCartao)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-warning">{formatCurrency(r.totalFiado)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {r.closingAmount != null ? formatCurrency(r.closingAmount) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {r.difference != null ? (
                      <span className={`font-bold ${r.difference === 0 ? 'text-success' : 'text-destructive'}`}>
                        {r.difference > 0 ? '+' : ''}{formatCurrency(r.difference)}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleBackup(r)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-all active:scale-95"
                      title="Baixar backup deste caixa"
                    >
                      <Download className="w-3.5 h-3.5" /> Excel
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
