const formData = require('form-data');
const Mailgun = require('mailgun.js');

const mg = new Mailgun(formData).client({
  username: 'api',
  key: process.env.MAILGUN_API_KEY,
});

const DOMAIN = process.env.MAILGUN_DOMAIN;
const FROM = process.env.MAILGUN_FROM;

// Mailgun batch send: one API call delivers personalized copies to up to 1000 recipients.
// `recipientVariables` is keyed by email; each entry is the per-recipient render context.
async function sendBatch({ subject, recipients, renderForMember }) {
  const chunks = [];
  for (let i = 0; i < recipients.length; i += 1000) chunks.push(recipients.slice(i, i + 1000));

  for (const chunk of chunks) {
    const recipientVariables = {};
    const tos = [];
    let html = '';
    for (const m of chunk) {
      const rendered = renderForMember(m);
      if (!html) html = rendered;
      tos.push(m.email);
      recipientVariables[m.email] = { name: m.name || '', uuid: m.uuid };
    }

    await mg.messages.create(DOMAIN, {
      from: FROM,
      to: tos,
      subject,
      html,
      'recipient-variables': JSON.stringify(recipientVariables),
    });
  }
}

module.exports = { sendBatch };
