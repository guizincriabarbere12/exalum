import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Não autenticado');
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) throw new Error('Não autorizado');

    const { vendedorId, numero, texto } = await req.json();
    if (!vendedorId || !numero || !texto) throw new Error('vendedorId, numero e texto são obrigatórios');

    const baseUrl = Deno.env.get('EVOLUTION_API_URL')!;
    const apiKey = Deno.env.get('EVOLUTION_API_KEY')!;

    const resposta = await fetch(`${baseUrl}/message/sendText/${vendedorId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: apiKey },
      body: JSON.stringify({ number: numero, text: texto }),
    });
    const dadosEnvio = await resposta.json().catch(() => null);
    if (!resposta.ok) {
      throw new Error(dadosEnvio?.message?.[0] || dadosEnvio?.response?.message?.[0] || `Evolution API retornou ${resposta.status}`);
    }

    await supabaseAdmin.from('crm_mensagens').insert({
      vendedor_id: vendedorId,
      numero_cliente: numero,
      papel: 'vendedor',
      mensagem: texto,
    });

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ erro: (error as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
