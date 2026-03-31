import { utils, writeFile } from 'xlsx';
import type { Product, Customer } from '@/types/pdv';
import { getCustomerDebt } from '@/lib/store';

export function exportProductsToExcel(products: Product[]) {
  const data = products.map(p => ({
    'Nome': p.name,
    'Código': p.code,
    'Cód. Barras': p.barcode || '',
    'Unidade': p.unit,
    'Preço Venda': p.price,
    'Custo': p.cost,
    'Estoque': p.stock,
    'Estoque Mínimo': p.minStock,
    'Validade': p.expiryDate || '',
  }));

  const ws = utils.json_to_sheet(data);
  ws['!cols'] = [
    { wch: 30 }, { wch: 12 }, { wch: 16 }, { wch: 10 },
    { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 14 }, { wch: 12 },
  ];
  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, 'Produtos');
  writeFile(wb, `Produtos_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export function exportCustomersToExcel(customers: Customer[]) {
  const data = customers.map(c => ({
    'Nome': c.name,
    'Telefone': c.phone,
    'Endereço': c.address || '',
    'CPF/CNPJ': c.cpf || '',
    'Observações': c.notes || '',
    'Limite de Crédito': c.creditLimit || 0,
    'Limite Mensal': c.monthlyLimit || 0,
    'Dívida Atual': getCustomerDebt(c.id),
    'Status': c.status === 'active' ? 'Ativo' : 'Bloqueado',
  }));

  const ws = utils.json_to_sheet(data);
  ws['!cols'] = [
    { wch: 30 }, { wch: 16 }, { wch: 30 }, { wch: 16 },
    { wch: 25 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 10 },
  ];
  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, 'Clientes');
  writeFile(wb, `Clientes_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
