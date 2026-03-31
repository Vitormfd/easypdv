export function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('pt-BR');
}

export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleString('pt-BR');
}

export const paymentMethodLabels: Record<string, string> = {
  dinheiro: 'Dinheiro',
  pix: 'PIX',
  cartao: 'Cartão',
  cartao_credito: 'Cartão Crédito',
  cartao_debito: 'Cartão Débito',
  fiado: 'Fiado',
};

export const unitLabels: Record<string, string> = {
  un: 'Unidade',
  kg: 'Kg',
  lt: 'Litro',
};
