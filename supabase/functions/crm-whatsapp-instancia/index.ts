import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

async function chamarEvolution(caminho: string, opcoes: RequestInit = {}) {
  const baseUrl = Deno.env.get('EVOLUTION_API_URL')!;
  const apiKey = Deno.env.get('EVOLUTION_API_KEY')!;
  const resposta = await fetch(`${baseUrl}${caminho}`, {
    ...opcoes,
    headers: { 'Content-Type': 'application/json', apikey: apiKey, ...opcoes.headers },
  });
  const dados = await resposta.json().catch(() => null);
  if (!resposta.ok) {
    throw new Error(dados?.message?.[0] || dados?.response?.message?.[0] || `Evolution API retornou ${resposta.status}`);
  }
  return dados;
}

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

    const url = new URL(req.url);
    let vendedorIdAlvo = url.searchParams.get('vendedorId');
    let body: any = {};
    if (req.method === 'POST') {
      body = await req.json().catch(() => ({}));
      vendedorIdAlvo = vendedorIdAlvo || body.vendedorId || null;
    }

    const { data: meuVendedor } = await supabaseAdmin.from('vendedores').select('id').eq('user_id', user.id).maybeSingle();

    if (vendedorIdAlvo && vendedorIdAlvo !== meuVendedor?.id) {
      // pedindo pra conectar/ver o WhatsApp de outra pessoa - só admin pode
      const { data: papel } = await supabaseAdmin.from('user_roles').select('role').eq('user_id', user.id).maybeSingle();
      if (papel?.role !== 'admin') throw new Error('Só administradores podem gerenciar o WhatsApp de outros vendedores');
    }

    const vendedorId = vendedorIdAlvo || meuVendedor?.id;
    if (!vendedorId) throw new Error('Usuário não é um vendedor cadastrado e nenhum vendedorId foi informado');

    if (req.method === 'GET') {
      let estado = 'desconhecido';
      try {
        const dados = await chamarEvolution(`/instance/connectionState/${vendedorId}`);
        estado = dados?.instance?.state ?? dados?.state ?? 'desconhecido';
      } catch {
        // instancia ainda nao existe - segue desconhecido
      }
      return new Response(JSON.stringify({ estado }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // POST - cria/reconecta a instancia e retorna o QR code
    try {
      await chamarEvolution('/instance/create', {
        method: 'POST',
        body: JSON.stringify({ instanceName: vendedorId, qrcode: true, integration: 'WHATSAPP-BAILEYS' }),
      });
    } catch (erro) {
      const msg = (erro as Error).message.toLowerCase();
      if (!msg.includes('already') && !msg.includes('já')) throw erro;
    }

    const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/crm-whatsapp-webhook`;
    await chamarEvolution(`/webhook/set/${vendedorId}`, {
      method: 'POST',
      body: JSON.stringify({
        webhook: { url: webhookUrl, enabled: true, webhookByEvents: false, webhookBase64: true, events: ['MESSAGES_UPSERT'] },
      }),
    }).catch(() => {});

    const qr = await chamarEvolution(`/instance/connect/${vendedorId}`);
    const qrcodeBase64 = qr?.base64 ?? qr?.qrcode?.base64 ?? null;

    return new Response(JSON.stringify({ qrcodeBase64 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ erro: (error as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
