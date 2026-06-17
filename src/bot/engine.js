const { supabaseAdmin } = require('../lib/supabase');

/**
 * Motor de reglas del chatbot.
 *
 * En esta fase (2.2) solo persiste el mensaje y responde OK.
 * La logica completa de flujos (menu, catalogo, FAQ, takeover) se
 * implementa en la fase 2.3.
 *
 * @param {Object} messageData - Mensaje parseado del webhook
 * @param {string} messageData.from - Numero de telefono del remitente
 * @param {string} messageData.messageId - WhatsApp message ID
 * @param {string} messageData.text - Texto del mensaje (o null)
 * @param {string} messageData.buttonId - ID del boton (si es interactive)
 * @param {string} messageData.buttonTitle - Titulo del boton
 * @param {string} messageData.listId - ID de la lista (si es interactive)
 * @param {string} messageData.listTitle - Titulo de la lista
 * @param {string} messageData.contactName - Nombre del contacto
 * @param {string} messageData.timestamp - Timestamp de Meta
 */
async function processIncomingMessage(messageData) {
  const { from, messageId, text, buttonId, listId, contactName } = messageData;

  if (!from) {
    console.warn('[bot-engine] Mensaje sin telefono, ignorando');
    return { handled: false, reason: 'no_phone' };
  }

  try {
    const { data: contact, error: contactError } = await supabaseAdmin
      .from('contacts')
      .upsert(
        { phone: from, ...(contactName && { name: contactName }) },
        { onConflict: 'phone' }
      )
      .select()
      .single();

    if (contactError) throw contactError;

    let { data: conversation, error: convError } = await supabaseAdmin
      .from('conversations')
      .select('*')
      .eq('contact_id', contact.id)
      .eq('status', 'active')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (convError) throw convError;

    if (!conversation) {
      const { data: newConv, error: createError } = await supabaseAdmin
        .from('conversations')
        .insert({
          contact_id: contact.id,
          phone: from,
          status: 'active',
          bot_active: true
        })
        .select()
        .single();

      if (createError) throw createError;
      conversation = newConv;
    }

    const messageContent = text || buttonId || listId || '(sin contenido)';
    const messageType = text ? 'text' : (buttonId ? 'interactive' : (listId ? 'interactive' : 'text'));

    const { data: savedMessage, error: msgError } = await supabaseAdmin
      .from('messages')
      .insert({
        conversation_id: conversation.id,
        wa_id: messageId || null,
        direction: 'inbound',
        content: messageContent,
        type: messageType,
        sent_by: 'bot',
        metadata: {
          button_id: buttonId || null,
          button_title: messageData.buttonTitle || null,
          list_id: listId || null,
          list_title: messageData.listTitle || null,
          raw_timestamp: messageData.timestamp || null
        }
      })
      .select()
      .single();

    if (msgError) throw msgError;

    await supabaseAdmin
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversation.id);

    console.log(`[bot-engine] Mensaje guardado de ${from}: "${messageContent.substring(0, 50)}"`);

    return {
      handled: true,
      conversation_id: conversation.id,
      contact_id: contact.id,
      bot_active: conversation.bot_active,
      message_id: savedMessage.id
    };
  } catch (error) {
    console.error('[bot-engine] Error procesando mensaje:', error);
    return { handled: false, error: error.message };
  }
}

module.exports = { processIncomingMessage };
