// Formas de pagamento fixas do sistema (controlam regras de parcelamento e crédito de cliente).
export const FORMAS_PAGAMENTO_PADRAO: Record<string, string> = {
  avista: "À Vista",
  boleto: "Boleto",
  credito: "Cartão de Crédito",
  debito: "Cartão de Débito",
  credito_cliente: "Cliente com Crédito",
};

// Populado em runtime por useFormasPagamentoCustom() para resolver o nome das formas
// de pagamento adicionais cadastradas em Configurações, sem precisar passar a lista
// por parâmetro em cada uma das dezenas de chamadas de getFormaPagamentoLabel.
export const formasPagamentoCustomCache = new Map<string, string>();

export function getFormaPagamentoLabel(forma: string): string {
  if (!forma) return forma;
  if (FORMAS_PAGAMENTO_PADRAO[forma]) return FORMAS_PAGAMENTO_PADRAO[forma];
  return formasPagamentoCustomCache.get(forma) || forma;
}
