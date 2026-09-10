/**
 * WhatsApp Service - Deprecated
 *
 * WhatsApp notifications are now handled via direct links on the frontend.
 * This service is kept for backward compatibility but no longer uses Meta Cloud API.
 */

async function sendWhatsAppTemplateMessage(to, templateName, message) {
  // Frontend now handles WhatsApp via direct links (wa.me)
  // This function is deprecated but kept to avoid breaking existing code
  return {
    success: true,
    message: 'WhatsApp notifications are handled by frontend via direct links',
    deprecated: true
  };
}

module.exports = { sendWhatsAppTemplateMessage };
