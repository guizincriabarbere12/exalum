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
    const body = await req.json();

    if (body?.event !== 'messages.upsert') {
      return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
    }

    const remoteJid: string | undefined = body?.data?.key?.remoteJid;
    const vendedorId: string | undefined = body?.instance;
    const fromMe: boolean = !!body?.data?.key?.fromMe;
    const msg = body?.data?.message;
    const nomeContato: string | undefined = body?.data?.pushName;

    const texto: string | undefined = msg?.conversation ?? msg?.extendedTextMessage?.text;

    // mensagens de midia (audio/imagem/video/documento) vem com um campo
    // <tipo>Message no objeto message, e o base64 decodificado (quando
    // webhookBase64 esta ligado na instancia) fica em message.base64
    const tiposMidia: Record<string, 'audio' | 'imagem' | 'video' | 'documento'> = {
      audioMessage: 'audio',
      imageMessage: 'imagem',
      videoMessage: 'video',
      documentMessage: 'documento',
    };
    const chaveMidia = Object.keys(tiposMidia).find((k) => msg?.[k]);
    const tipoMidia = chaveMidia ? tiposMidia[chaveMidia] : null;
    let midiaBase64: string | undefined = msg?.base64;
    // so o tipo base (ex: "audio/ogg"), sem os parametros de codec - alguns
    // navegadores nao tocam o audio se a data URI vier com "; codecs=opus"
    const mimetype: string | undefined = chaveMidia ? msg?.[chaveMidia]?.mimetype?.split(';')[0]?.trim() : undefined;

    if (!remoteJid || !vendedorId || fromMe || !remoteJid.endsWith('@s.whatsapp.net')) {
      return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
    }
    if (!texto && !tipoMidia) {
      // tipo de mensagem que ainda nao sabemos tratar (figurinha, localizacao, etc)
      return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
    }

    // o Evolution tem um bug conhecido onde o base64 as vezes nao vem
    // embutido no proprio payload do webhook mesmo com webhookBase64 ligado -
    // nesse caso busca direto na API usando o id da mensagem
    const messageId: string | undefined = body?.data?.key?.id;
    if (tipoMidia && !midiaBase64 && messageId) {
      try {
        const baseUrl = Deno.env.get('EVOLUTION_API_URL')!;
        const apiKey = Deno.env.get('EVOLUTION_API_KEY')!;
        const resposta = await fetch(`${baseUrl}/chat/getBase64FromMediaMessage/${vendedorId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: apiKey },
          body: JSON.stringify({ message: { key: { id: messageId } }, convertToMp4: false }),
        });
        const dadosMidia = await resposta.json().catch(() => null);
        midiaBase64 = dadosMidia?.base64 ?? dadosMidia?.media?.base64;
      } catch (erro) {
        console.error('Erro ao buscar base64 da midia:', erro);
      }
    }

    const numero = remoteJid.replace('@s.whatsapp.net', '');

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const rotulos: Record<string, string> = { audio: 'Áudio', imagem: 'Imagem', video: 'Vídeo', documento: 'Documento' };
    await supabaseAdmin.from('crm_mensagens').insert({
      vendedor_id: vendedorId,
      numero_cliente: numero,
      nome_contato: nomeContato || null,
      papel: 'cliente',
      tipo: tipoMidia || 'texto',
      mensagem: texto || `[${rotulos[tipoMidia!]}]`,
      midia_base64: midiaBase64 ? `data:${mimetype || 'application/octet-stream'};base64,${midiaBase64}` : null,
    });

    return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
  } catch (error) {
    console.error('Erro no webhook do CRM WhatsApp:', error);
    return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
  }
});
