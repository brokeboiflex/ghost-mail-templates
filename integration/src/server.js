const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const express = require('express');
const Handlebars = require('handlebars');

const { getPost, getNewsletterMembers } = require('./ghost');
const { sendBatch } = require('./mailer');

const app = express();
const PORT = process.env.PORT || 3000;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const SITE_URL = process.env.SITE_URL;
const SITE_TITLE = process.env.SITE_TITLE;

const templateSrc = fs.readFileSync(
  path.join(__dirname, 'templates', 'newsletter.hbs'),
  'utf8'
);
const render = Handlebars.compile(templateSrc);

app.use(express.json({
  verify: (req, _res, buf) => { req.rawBody = buf; },
  limit: '5mb',
}));

function verifySignature(req) {
  const header = req.get('x-ghost-signature');
  if (!header || !WEBHOOK_SECRET) return false;
  const match = /sha256=([a-f0-9]+)/i.exec(header);
  if (!match) return false;
  const expected = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(req.rawBody)
    .digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(match[1]));
  } catch {
    return false;
  }
}

app.get('/health', (_req, res) => res.json({ ok: true }));

app.post('/webhook/post-published', async (req, res) => {
  if (!verifySignature(req)) return res.status(401).send('bad signature');

  const incoming = req.body && req.body.post && req.body.post.current;
  if (!incoming || !incoming.id) return res.status(400).send('no post id');

  res.status(202).send('queued');

  try {
    const post = await getPost(incoming.id);
    const members = await getNewsletterMembers();
    if (!members.length) return;

    const subject = post.email_subject || post.title;

    await sendBatch({
      subject,
      recipients: members,
      renderForMember: (m) => render({
        post,
        member: { name: m.name, email: m.email, uuid: m.uuid },
        site: { title: SITE_TITLE, url: SITE_URL },
        unsubscribe_url: `${SITE_URL}/unsubscribe?uuid=${m.uuid}`,
      }),
    });

    console.log(`sent "${subject}" to ${members.length} members`);
  } catch (err) {
    console.error('send failed:', err);
  }
});

app.listen(PORT, () => console.log(`mailer listening on ${PORT}`));
