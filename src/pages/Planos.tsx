import { useState } from 'react';
import { ArrowLeft, Check, X, Crown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { plans, getCurrentPlan, setCurrentPlan, type PlanId } from '@/lib/plans';
import { formatCurrency } from '@/lib/format';
import { toast } from 'sonner';

const allFeatures = [
  { key: 'caixa', label: 'Controle de caixa', plans: ['basico', 'completo', 'pro'] },
  { key: 'clientes', label: 'Cadastro de clientes', plans: ['basico', 'completo', 'pro'] },
  { key: 'fiado', label: 'Controle de fiado', plans: ['basico', 'completo', 'pro'] },
  { key: 'pagamentos', label: 'Registro de pagamentos', plans: ['basico', 'completo', 'pro'] },
  { key: 'saldo', label: 'Saldo devedor por cliente', plans: ['basico', 'completo', 'pro'] },
  { key: 'whatsapp', label: 'Cobrança via WhatsApp', plans: ['completo', 'pro'] },
  { key: 'devedores', label: 'Lista de devedores com destaque', plans: ['completo', 'pro'] },
  { key: 'relatorios', label: 'Relatórios completos', plans: ['completo', 'pro'] },
  { key: 'extrato', label: 'Extrato detalhado', plans: ['completo', 'pro'] },
  { key: 'ranking', label: 'Ranking de produtos', plans: ['completo', 'pro'] },
  { key: 'backup', label: 'Backup automático', plans: ['pro'] },
  { key: 'relMensal', label: 'Relatório mensal automático', plans: ['pro'] },
  { key: 'whatsRel', label: 'Envio de relatório via WhatsApp', plans: ['pro'] },
];

export default function PlanosPage() {
  const [currentPlan, setCurrentPlanState] = useState(getCurrentPlan());

  const handleUpgrade = (planId: PlanId) => {
    setCurrentPlan(planId);
    setCurrentPlanState(planId);
    toast.success(`Plano alterado para ${plans.find(p => p.id === planId)?.name}!`);
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <Link to="/configuracoes" className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-muted transition-all">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Crown className="w-6 h-6 text-primary" /> Planos
          </h2>
          <p className="text-sm text-muted-foreground">Escolha o plano ideal para seu negócio</p>
        </div>
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {plans.map(plan => {
          const isCurrent = currentPlan === plan.id;
          const isPopular = plan.id === 'completo';
          return (
            <div
              key={plan.id}
              className={`relative rounded-2xl border-2 p-6 transition-all ${
                isCurrent ? 'border-primary ring-2 ring-primary/20 bg-primary/5' : 'border-border hover:border-muted-foreground/30'
              } ${isPopular ? 'md:scale-105 md:shadow-lg' : ''}`}
            >
              {isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full">
                  Mais Popular
                </div>
              )}
              {isCurrent && (
                <div className="absolute top-3 right-3 bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5 rounded-full">
                  Atual
                </div>
              )}

              <div className="text-center mb-4">
                <span className="text-3xl">{plan.badge}</span>
                <h3 className="text-xl font-bold mt-1">{plan.name}</h3>
                <div className="mt-2">
                  <span className="text-3xl font-extrabold">{formatCurrency(plan.price)}</span>
                  <span className="text-muted-foreground text-sm">/mês</span>
                </div>
              </div>

              <ul className="space-y-2 mb-6">
                {plan.features.map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              {isCurrent ? (
                <button disabled className="w-full py-2.5 rounded-xl bg-muted text-muted-foreground font-semibold text-sm cursor-default">
                  Plano Atual
                </button>
              ) : (
                <button
                  onClick={() => handleUpgrade(plan.id)}
                  className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-all"
                >
                  {plans.indexOf(plans.find(p => p.id === currentPlan)!) > plans.indexOf(plan) ? 'Mudar para este' : 'Fazer Upgrade'}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Feature comparison table */}
      <div className="card-pdv overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="font-bold text-lg">Comparação de funcionalidades</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-3 font-semibold">Funcionalidade</th>
                {plans.map(p => (
                  <th key={p.id} className="text-center p-3 font-semibold">
                    {p.badge} {p.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allFeatures.map(feat => (
                <tr key={feat.key} className="border-b border-border/50 last:border-0">
                  <td className="p-3">{feat.label}</td>
                  {plans.map(p => (
                    <td key={p.id} className="text-center p-3">
                      {feat.plans.includes(p.id) ? (
                        <Check className="w-4 h-4 text-green-500 mx-auto" />
                      ) : (
                        <X className="w-4 h-4 text-muted-foreground/40 mx-auto" />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
