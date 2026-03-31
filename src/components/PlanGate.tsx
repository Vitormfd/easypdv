import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Lock, ArrowRight } from 'lucide-react';
import { canAccess, getRequiredPlan } from '@/lib/plans';

interface PlanGateProps {
  feature: 'whatsapp' | 'debtHighlight' | 'relatorios' | 'extrato' | 'ranking' | 'backup' | 'monthlyReport';
  children: ReactNode;
  /** If true, renders inline blocked message instead of replacing a full page */
  inline?: boolean;
}

export default function PlanGate({ feature, children, inline }: PlanGateProps) {
  if (canAccess(feature)) return <>{children}</>;

  const required = getRequiredPlan(feature);

  if (inline) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border">
        <Lock className="w-4 h-4 text-muted-foreground shrink-0" />
        <span className="text-sm text-muted-foreground">Disponível no plano {required.badge} {required.name}</span>
        <Link to="/planos" className="text-xs text-primary font-medium hover:underline ml-auto flex items-center gap-1">
          Upgrade <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <Lock className="w-8 h-8 text-muted-foreground" />
      </div>
      <h2 className="text-xl font-bold mb-2">Funcionalidade Bloqueada</h2>
      <p className="text-muted-foreground mb-1">Disponível apenas no plano {required.badge} <strong>{required.name}</strong> ou superior.</p>
      <p className="text-sm text-muted-foreground mb-6">Faça upgrade para desbloquear esta funcionalidade.</p>
      <Link
        to="/planos"
        className="px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:opacity-90 transition-all flex items-center gap-2"
      >
        Ver Planos <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  );
}
