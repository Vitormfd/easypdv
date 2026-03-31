import { useState } from 'react';
import { Lock, Unlock, DollarSign, Smartphone, CreditCard, BookOpen, Clock, Eye, EyeOff, Download } from 'lucide-react';
import { getOpenCashRegister, getOpenRegisterTotals, openCashRegister, closeCashRegister, isBackupOnCloseEnabled } from '@/lib/store';
import { formatCurrency } from '@/lib/format';
import { toast } from 'sonner';
import { downloadBackup } from '@/lib/plans';

interface Props {
  refreshKey: number;
  onStatusChange: () => void;
  hideValues: boolean;
  onToggleHideValues: () => void;
}

export default function CashRegisterBar({ refreshKey, onStatusChange, hideValues, onToggleHideValues }: Props) {
  const [showOpen, setShowOpen] = useState(false);
  const [showClose, setShowClose] = useState(false);
  const [openingAmount, setOpeningAmount] = useState('');
  const [closingAmount, setClosingAmount] = useState('');
  const [showBackupPrompt, setShowBackupPrompt] = useState(false);

  const mask = (val: string) => hideValues ? '••••' : val;
  const register = getOpenCashRegister();
  const totals = getOpenRegisterTotals();

  const handleOpen = () => {
    const amount = parseFloat(openingAmount) || 0;
    if (amount < 0) { toast.error('Valor inválido'); return; }
    openCashRegister(amount);
    toast.success('Caixa aberto com sucesso!');
    setShowOpen(false);
    setOpeningAmount('');
    onStatusChange();
  };

  const handleClose = () => {
    const amount = parseFloat(closingAmount);
    if (isNaN(amount) || amount < 0) { toast.error('Informe o valor contado'); return; }
    const result = closeCashRegister(amount);

    setShowClose(false);
    setClosingAmount('');

    if (result.difference === 0) {
      toast.success('Caixa fechado — tudo certo! ✓');
    } else {
      toast.warning(`Caixa fechado com diferença de ${formatCurrency(result.difference!)}`);
    }

    if (isBackupOnCloseEnabled()) {
      setShowBackupPrompt(true);
    } else {
      onStatusChange();
    }
  };

  const handleBackup = () => {
    try {
      downloadBackup();
      toast.success('Backup salvo em planilha Excel!');
    } catch {
      toast.error('Erro ao gerar backup');
    }
    setShowBackupPrompt(false);
    setTimeout(onStatusChange, 120);
  };

  const skipBackup = () => {
    setShowBackupPrompt(false);
    onStatusChange();
  };

  if (!register) {
    return (
      <>
        <div className="flex items-center justify-between p-4 rounded-xl border-2 border-dashed border-warning/40 bg-warning/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-warning/15 flex items-center justify-center">
              <Lock className="w-5 h-5 text-warning" />
            </div>
            <div>
              <p className="font-bold text-sm">Caixa Fechado</p>
              <p className="text-xs text-muted-foreground">Abra o caixa para iniciar as vendas</p>
            </div>
          </div>
          <button
            onClick={() => setShowOpen(true)}
            className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-all active:scale-95"
          >
            Abrir Caixa
          </button>
        </div>

        {showOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowOpen(false)}>
            <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm animate-fade-in-up p-6 space-y-4" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-bold">Abrir Caixa</h3>
              <p className="text-sm text-muted-foreground">Informe o valor em dinheiro no caixa.</p>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Valor Inicial (R$)</label>
                <input
                  type="number"
                  value={openingAmount}
                  onChange={e => setOpeningAmount(e.target.value)}
                  placeholder="0.00"
                  className="mt-1 w-full text-2xl font-bold text-center bg-background border border-border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-ring tabular-nums"
                  min={0}
                  step={0.01}
                  autoFocus
                />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowOpen(false)} className="flex-1 px-4 py-3 rounded-xl border border-border font-medium text-sm hover:bg-muted transition-all">
                  Cancelar
                </button>
                <button onClick={handleOpen} className="flex-1 px-4 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-all active:scale-[0.98]">
                  Confirmar Abertura
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  const openTime = new Date(register.openedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const expectedCash = totals ? +(register.openingAmount + totals.totalDinheiro).toFixed(2) : register.openingAmount;

  return (
    <>
      <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center">
              <Unlock className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-bold text-sm flex items-center gap-1.5">
                Caixa Aberto
                <span className="inline-block w-2 h-2 rounded-full bg-success animate-pulse" />
              </p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" /> Aberto às {openTime} • Inicial: {mask(formatCurrency(register.openingAmount))}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onToggleHideValues}
              className="w-9 h-9 rounded-xl border border-border flex items-center justify-center text-muted-foreground hover:bg-muted transition-all active:scale-95"
              title={hideValues ? 'Mostrar valores' : 'Ocultar valores'}
            >
              {hideValues ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setShowClose(true)}
              className="px-4 py-2 rounded-xl border border-destructive/30 text-destructive font-semibold text-sm hover:bg-destructive/10 transition-all active:scale-95"
            >
              Fechar Caixa
            </button>
          </div>
        </div>

        {totals && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <div className="flex items-center gap-2 p-2 rounded-lg bg-card">
              <DollarSign className="w-4 h-4 text-success" />
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-semibold">Dinheiro</p>
                <p className="text-sm font-bold tabular-nums">{mask(formatCurrency(totals.totalDinheiro))}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-card">
              <Smartphone className="w-4 h-4 text-accent" />
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-semibold">PIX</p>
                <p className="text-sm font-bold tabular-nums">{mask(formatCurrency(totals.totalPix))}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-card">
              <CreditCard className="w-4 h-4 text-foreground" />
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-semibold">Cartão</p>
                <p className="text-sm font-bold tabular-nums">{mask(formatCurrency(totals.totalCartao))}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-card">
              <BookOpen className="w-4 h-4 text-warning" />
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-semibold">Fiado</p>
                <p className="text-sm font-bold tabular-nums">{mask(formatCurrency(totals.totalFiado))}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-card">
              <DollarSign className="w-4 h-4 text-primary" />
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-semibold">Total</p>
                <p className="text-sm font-bold tabular-nums">{mask(formatCurrency(totals.totalSales))}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {showClose && totals && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowClose(false)}>
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md animate-fade-in-up p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold">Fechar Caixa</h3>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-1.5">
                <span className="text-muted-foreground">Valor inicial</span>
                <span className="font-medium tabular-nums">{formatCurrency(register.openingAmount)}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-muted-foreground">Vendas ({totals.salesCount})</span>
                <span className="font-medium tabular-nums">{formatCurrency(totals.totalSales)}</span>
              </div>
              <div className="border-t border-border pt-2 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Dinheiro</span>
                  <span className="tabular-nums">{formatCurrency(totals.totalDinheiro)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">PIX</span>
                  <span className="tabular-nums">{formatCurrency(totals.totalPix)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Cartão</span>
                  <span className="tabular-nums">{formatCurrency(totals.totalCartao)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Fiado (pendente)</span>
                  <span className="tabular-nums text-warning">{formatCurrency(totals.totalFiado)}</span>
                </div>
              </div>
              <div className="flex justify-between py-2 border-t border-border">
                <span className="font-semibold">Esperado em caixa (dinheiro)</span>
                <span className="font-bold tabular-nums text-primary">{formatCurrency(expectedCash)}</span>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Valor contado (R$)</label>
              <input
                type="number"
                value={closingAmount}
                onChange={e => setClosingAmount(e.target.value)}
                placeholder={expectedCash.toFixed(2)}
                className="mt-1 w-full text-2xl font-bold text-center bg-background border border-border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-ring tabular-nums"
                min={0}
                step={0.01}
                autoFocus
              />
            </div>

            {closingAmount && (
              <div className={`p-3 rounded-lg text-sm font-semibold text-center ${
                parseFloat(closingAmount) === expectedCash
                  ? 'bg-success/10 text-success'
                  : 'bg-destructive/10 text-destructive'
              }`}>
                {parseFloat(closingAmount) === expectedCash
                  ? '✓ Caixa OK — valores conferem!'
                  : `Diferença: ${formatCurrency((parseFloat(closingAmount) || 0) - expectedCash)}`
                }
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={() => setShowClose(false)} className="flex-1 px-4 py-3 rounded-xl border border-border font-medium text-sm hover:bg-muted transition-all">
                Cancelar
              </button>
              <button onClick={handleClose} className="flex-1 px-4 py-3 rounded-xl bg-destructive text-destructive-foreground font-bold text-sm hover:bg-destructive/90 transition-all active:scale-[0.98]">
                Confirmar Fechamento
              </button>
            </div>
          </div>
        </div>
      )}

      {showBackupPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm animate-fade-in-up p-6 space-y-4">
            <div className="text-center">
              <Download className="w-12 h-12 mx-auto text-primary mb-3" />
              <h3 className="text-lg font-bold">Salvar backup deste fechamento?</h3>
              <p className="text-sm text-muted-foreground mt-1">Exportar vendas e dados do caixa em planilha Excel (.xlsx)</p>
            </div>
            <div className="flex gap-2">
              <button onClick={skipBackup} className="flex-1 px-4 py-3 rounded-xl border border-border font-medium text-sm hover:bg-muted transition-all">
                Não salvar
              </button>
              <button onClick={handleBackup} className="flex-1 px-4 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-all active:scale-[0.98]">
                <Download className="w-4 h-4 inline mr-1" /> Salvar Backup
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
