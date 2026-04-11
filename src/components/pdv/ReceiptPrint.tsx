import { forwardRef } from 'react';
import type { Sale, PaymentEntry } from '@/types/pdv';
import { formatCurrency } from '@/lib/format';
import { paymentMethodLabels } from '@/lib/format';
import { getPrintConfig, getSystemName, getEffectiveSalePayments, getEffectiveSaleTotal } from '@/lib/store';

interface Props {
  sale: Sale;
  marketName?: string;
}

const ReceiptPrint = forwardRef<HTMLDivElement, Props>(({ sale, marketName }, ref) => {
  const config = getPrintConfig();
  const name = marketName || getSystemName();
  const date = new Date(sale.createdAt);
  const dateStr = date.toLocaleDateString('pt-BR');
  const timeStr = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const effectivePayments = getEffectiveSalePayments(sale);
  const effectiveTotal = getEffectiveSaleTotal(sale);

  return (
    <div ref={ref} className="receipt-print" style={{ display: 'none' }}>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .receipt-print, .receipt-print * { visibility: visible !important; }
          .receipt-print {
            display: block !important;
            position: fixed !important;
            left: 0; top: 0;
            width: 80mm;
            font-family: 'Courier New', monospace;
            font-size: ${config.fontSize}px;
            line-height: 1.4;
            color: #000;
            background: #fff;
            padding: 4mm;
          }
        }
        .receipt-print .r-header { text-align: center; margin-bottom: 8px; }
        .receipt-print .r-title { font-size: 16px; font-weight: bold; }
        .receipt-print .r-line { border-top: 1px dashed #000; margin: 6px 0; }
        .receipt-print .r-row { display: flex; justify-content: space-between; }
        .receipt-print .r-item-name { font-size: 11px; }
        .receipt-print .r-item-detail { font-size: 10px; color: #444; padding-left: 8px; }
        .receipt-print .r-total { font-size: 16px; font-weight: bold; text-align: right; }
        .receipt-print .r-footer { text-align: center; font-size: 10px; margin-top: 8px; }
      `}</style>

      <div className="r-header">
        <div className="r-title">{name}</div>
        {config.showDate && <div>{dateStr} {timeStr}</div>}
        {config.headerText && <div style={{ fontSize: '10px' }}>{config.headerText}</div>}
        <div style={{ fontSize: '10px' }}>Cupom não fiscal</div>
      </div>

      <div className="r-line" />

      {sale.items.map((item, i) => (
        <div key={i}>
          <div className="r-row">
            <span className="r-item-name">{item.productName}</span>
            <span>{formatCurrency(item.subtotal)}</span>
          </div>
          <div className="r-item-detail">
            {item.quantity} x {formatCurrency(item.unitPrice)}
          </div>
        </div>
      ))}

      <div className="r-line" />

      <div className="r-row r-total">
        <span>TOTAL</span>
        <span>{formatCurrency(effectiveTotal)}</span>
      </div>

      <div className="r-line" />

      {config.showPaymentDetails && (
        <div style={{ fontSize: '11px' }}>
          {(effectivePayments.length ? effectivePayments : [{ method: sale.paymentMethod, amount: sale.total }] as PaymentEntry[]).map((p, i) => (
            <div key={i} className="r-row">
              <span>{paymentMethodLabels[p.method]}</span>
              <span>{formatCurrency(p.amount)}</span>
            </div>
          ))}
        </div>
      )}

      {config.showCustomer && sale.customerName && (
        <>
          <div className="r-line" />
          <div style={{ fontSize: '11px' }}>Cliente: {sale.customerName}</div>
        </>
      )}

      <div className="r-line" />
      <div className="r-footer" style={{ whiteSpace: 'pre-line' }}>
        {config.footerText}
      </div>
    </div>
  );
});

ReceiptPrint.displayName = 'ReceiptPrint';

export default ReceiptPrint;

export function printReceipt(receiptRef: React.RefObject<HTMLDivElement | null>) {
  if (!receiptRef.current) return;
  receiptRef.current.style.display = 'block';
  window.print();
  setTimeout(() => {
    if (receiptRef.current) receiptRef.current.style.display = 'none';
  }, 500);
}
