-- Fix gerar_numero_orcamento function to handle large numbers
CREATE OR REPLACE FUNCTION gerar_numero_orcamento()
RETURNS text AS $$
DECLARE
    proximo_numero bigint;
BEGIN
    -- Get the highest numeric portion from existing orcamentos
    -- Use bigint instead of integer to handle large numbers
    SELECT COALESCE(
        MAX(
            CASE 
                WHEN NULLIF(regexp_replace(numero, '[^0-9]', '', 'g'), '') ~ '^[0-9]+$' 
                THEN NULLIF(regexp_replace(numero, '[0-9]', '', 'g'), regexp_replace(numero, '[^0-9]', '', 'g'))::bigint
                ELSE NULL
            END
        ), 0
    ) + 1
    INTO proximo_numero
    FROM public.orcamentos
    WHERE numero ~ '^ORC-[0-9]+$';

    RETURN 'ORC-' || LPAD(proximo_numero::text, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- Alternative: simpler approach using a sequence-like pattern
-- Reset with a cleaner approach
CREATE OR REPLACE FUNCTION gerar_numero_orcamento()
RETURNS text AS $$
DECLARE
    ultimo_numero integer;
    proximo_numero integer;
BEGIN
    -- Only look at numbers matching the pattern ORC-NNNN
    SELECT MAX(
        CASE 
            WHEN numero ~ '^ORC-[0-9]{4,}$' 
            THEN SUBSTRING(numero FROM 5)::integer
            ELSE NULL
        END
    ) INTO ultimo_numero
    FROM public.orcamentos;

    proximo_numero := COALESCE(ultimo_numero, 0) + 1;

    RETURN 'ORC-' || LPAD(proximo_numero::text, 4, '0');
END;
$$ LANGUAGE plpgsql;