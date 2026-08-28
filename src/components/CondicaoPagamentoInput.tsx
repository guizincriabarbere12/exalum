import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { normalizarCondicao, descricaoCondicao, diasCondicao } from "@/utils/condicaoPagamento";

interface CondicaoPagamentoInputProps {
  value: string;
  onChange: (valorNormalizado: string) => void;
  placeholder?: string;
  id?: string;
  disabled?: boolean;
}

// Campo de texto para digitar a condicao de pagamento como dias separados por
// espaco (ex.: "28 56", "0 28 56"). Ao sair do campo, normaliza para o formato
// com barras ("28/56") e repassa ao pai. Mostra uma previa legivel enquanto
// digita.
export function CondicaoPagamentoInput({
  value,
  onChange,
  placeholder,
  id,
  disabled,
}: CondicaoPagamentoInputProps) {
  const [raw, setRaw] = useState(value ?? "");

  useEffect(() => {
    setRaw(value ?? "");
  }, [value]);

  const confirmar = () => {
    const normalizado = normalizarCondicao(raw);
    setRaw(normalizado);
    if (normalizado !== value) onChange(normalizado);
  };

  const previa = descricaoCondicao(raw);
  const qtd = diasCondicao(raw).length;

  return (
    <div className="space-y-1">
      <Input
        id={id}
        value={raw}
        disabled={disabled}
        inputMode="numeric"
        placeholder={placeholder ?? "Ex: 28 56  (use 0 no inicio p/ entrada hoje)"}
        onChange={(e) => setRaw(e.target.value)}
        onBlur={confirmar}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            confirmar();
          }
        }}
      />
      {previa && (
        <p className="text-xs text-muted-foreground">
          {qtd} {qtd === 1 ? "parcela" : "parcelas"}: {previa}
        </p>
      )}
    </div>
  );
}
