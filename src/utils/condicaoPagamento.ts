// Condicao de pagamento digitada livremente.
//
// Antes os dias vinham de listas fixas (dropdown): "28/56", "0/28/56", "TEC",
// "GMF"... Agora o usuario digita os dias separados por espaco ("28 56",
// "0 28 56"). Estas funcoes normalizam esse texto para o MESMO formato com
// barras usado antes ("28/56", "0/28/56"), para nao quebrar orcamentos, PDFs e
// compras ja salvos no banco.

// "28 56" | "28/56" | "0 28 56" | "28-56" -> "28/56" | "0/28/56"
export function normalizarCondicao(texto: string | null | undefined): string {
  const nums = String(texto ?? "").match(/\d+/g);
  if (!nums) return "";
  return nums.map((n) => String(parseInt(n, 10))).join("/");
}

// Lista de dias apos o faturamento. "0/28/56" -> [0, 28, 56].
export function diasCondicao(texto: string | null | undefined): number[] {
  return normalizarCondicao(texto)
    .split("/")
    .filter((p) => p !== "")
    .map((n) => parseInt(n, 10))
    .filter((n) => Number.isFinite(n) && n >= 0);
}

// Texto legivel calculado a partir dos dias.
export function descricaoCondicao(texto: string | null | undefined): string {
  const dias = diasCondicao(texto);
  if (dias.length === 0) return "";
  return dias
    .map((d, i) => (d === 0 ? `${i + 1}ª à vista` : `${i + 1}ª em ${d} dias`))
    .join(", ");
}
