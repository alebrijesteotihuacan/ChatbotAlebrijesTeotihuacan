// Webhook de Meta WhatsApp - Placeholder inicial
// Implementacion completa en Fase 2

const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN;

module.exports = async function handler(req, res) {
  // GET: Verificacion del webhook por Meta
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('[webhook] Verificacion OK');
      return res.status(200).send(challenge);
    }
    return res.status(403).send('Forbidden');
  }

  // POST: Recepcion de mensajes (placeholder)
  if (req.method === 'POST') {
    console.log('[webhook] Mensaje recibido:', JSON.stringify(req.body, null, 2));
    return res.status(200).json({ status: 'received' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
