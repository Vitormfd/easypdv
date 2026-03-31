import { useState } from 'react';
import { ArrowLeft, Printer, Eye } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getPrintConfig, savePrintConfig, getSystemName, type PrintConfig } from '@/lib/store';
import { formatCurrency } from '@/lib/format';
import { toast } from 'sonner';

const sampleSale = {
  items: [
    { productName: 'Arroz 5kg', quantity: 2, unitPrice: 24.90, subtotal: 49.80 },
    { productName: 'Feijão 1kg', quantity: 3, unitPrice: 8.50, subtotal: 25.50 },
    { productName: 'Óleo de Soja', quantity: 1, unitPrice: 7.90, subtotal: 7.90 },
  ],
  total: 83.20,
  payments: [
    { method: 'dinheiro', amount: 50.00 },
    { method: 'pix', amount: 33.20 },
  ],
  customerName: 'João Silva',
  createdAt: new Date().toISOString(),
};

const paymentLabels: Record<string, string> = {
  dinheiro: 'Dinheiro', pix: 'PIX', cartao_credito: 'Cartão Crédito',
  cartao_debito: 'Cartão Débito', fiado: 'Fiado',
};

export default function ImpressaoPage() {
  const [config, setConfig] = useState<PrintConfig>(getPrintConfig());

  const update = (partial: Partial<PrintConfig>) => {
    const next = { ...config, ...partial };
    setConfig(next);
    savePrintConfig(next);
  };

  const handleSave = () => {
    savePrintConfig(config);
    toast.success('Configuração de impressão salva!');
  };

  const date = new Date(sampleSale.createdAt);
  const storeName = getSystemName();

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <Link to="/configuracoes" className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-muted transition-all">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Printer className="w-6 h-6 text-primary" /> Layout de Impressão
          </h2>
          <p className="text-sm text-muted-foreground">Configure o comprovante da impressora térmica</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Settings */}
        <div className="space-y-4">
          <div className="card-pdv p-5 space-y-4">
            <h3 className="font-bold text-lg">Opções</h3>

            <label className="flex items-center justify-between">
              <span className="text-sm font-medium">Exibir data/hora</span>
              <button onClick={() => update({ showDate: !config.showDate })}
                className={`w-12 h-7 rounded-full transition-colors relative ${config.showDate ? 'bg-primary' : 'bg-muted'}`}>
                <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-card shadow-sm transition-transform ${config.showDate ? 'left-[22px]' : 'left-0.5'}`} />
              </button>
            </label>

            <label className="flex items-center justify-between">
              <span className="text-sm font-medium">Exibir cliente</span>
              <button onClick={() => update({ showCustomer: !config.showCustomer })}
                className={`w-12 h-7 rounded-full transition-colors relative ${config.showCustomer ? 'bg-primary' : 'bg-muted'}`}>
                <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-card shadow-sm transition-transform ${config.showCustomer ? 'left-[22px]' : 'left-0.5'}`} />
              </button>
            </label>

            <label className="flex items-center justify-between">
              <span className="text-sm font-medium">Detalhar pagamentos</span>
              <button onClick={() => update({ showPaymentDetails: !config.showPaymentDetails })}
                className={`w-12 h-7 rounded-full transition-colors relative ${config.showPaymentDetails ? 'bg-primary' : 'bg-muted'}`}>
                <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-card shadow-sm transition-transform ${config.showPaymentDetails ? 'left-[22px]' : 'left-0.5'}`} />
              </button>
            </label>

            <div>
              <label className="text-sm font-medium mb-1 block">Tamanho da fonte (px)</label>
              <input type="number" className="input-pdv" min={8} max={18} value={config.fontSize}
                onChange={e => update({ fontSize: parseInt(e.target.value) || 12 })} />
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Texto extra no cabeçalho</label>
              <input className="input-pdv" value={config.headerText} placeholder="Ex: CNPJ, endereço..."
                onChange={e => update({ headerText: e.target.value })} />
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Mensagem de rodapé</label>
              <textarea className="input-pdv min-h-[80px] resize-y" value={config.footerText}
                placeholder="Ex: Obrigado pela preferência!"
                onChange={e => update({ footerText: e.target.value })} />
            </div>

            <button onClick={handleSave} className="btn-pdv-primary w-full">Salvar Configuração</button>
          </div>
        </div>

        {/* Preview */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Eye className="w-4 h-4" /> Pré-visualização do comprovante
          </div>
          <div className="bg-white text-black rounded-xl p-6 shadow-lg border border-border"
            style={{ fontFamily: "'Courier New', monospace", fontSize: `${config.fontSize}px`, lineHeight: 1.5, maxWidth: 320, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: config.fontSize + 4, fontWeight: 'bold' }}>{storeName}</div>
              {config.showDate && <div>{date.toLocaleDateString('pt-BR')} {date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>}
              {config.headerText && <div style={{ fontSize: config.fontSize - 2 }}>{config.headerText}</div>}
              <div style={{ fontSize: config.fontSize - 2 }}>Cupom não fiscal</div>
            </div>

            <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

            {sampleSale.items.map((item, i) => (
              <div key={i}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{item.productName}</span>
                  <span>{formatCurrency(item.subtotal)}</span>
                </div>
                <div style={{ fontSize: config.fontSize - 2, color: '#444', paddingLeft: 8 }}>
                  {item.quantity} x {formatCurrency(item.unitPrice)}
                </div>
              </div>
            ))}

            <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: config.fontSize + 4, fontWeight: 'bold' }}>
              <span>TOTAL</span>
              <span>{formatCurrency(sampleSale.total)}</span>
            </div>

            {config.showPaymentDetails && (
              <>
                <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
                {sampleSale.payments.map((p, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{paymentLabels[p.method] || p.method}</span>
                    <span>{formatCurrency(p.amount)}</span>
                  </div>
                ))}
              </>
            )}

            {config.showCustomer && sampleSale.customerName && (
              <>
                <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
                <div>Cliente: {sampleSale.customerName}</div>
              </>
            )}

            {config.footerText && (
              <>
                <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
                <div style={{ textAlign: 'center', fontSize: config.fontSize - 2, whiteSpace: 'pre-line' }}>
                  {config.footerText}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
