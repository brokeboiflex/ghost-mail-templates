# integration

Custom mailer service that **replaces** Ghost's newsletter send. Ghost fires a `post.published` webhook → this service fetches the post + member list via Ghost Admin API → renders your Handlebars template → sends through Mailgun's batch API.

Use this only if `docker-patch/` isn't enough.

## What this gives up vs docker-patch

- Ghost admin won't show "X emails sent / Y opened" for these posts.
- Open/click tracking pixels: you have to inject them yourself (Mailgun does it server-side if you enable per-domain tracking, but member-level attribution back to Ghost is gone).
- Paywall / tier-gated content: you reimplement the cutoff logic.
- Unsubscribe link: you wire it to a route that calls Ghost Admin API to remove the member from the newsletter, OR use Mailgun's unsubscribe header (less integrated).

## Setup

### 1. Generate a Ghost Admin API key

Ghost admin → Settings → Integrations → Add custom integration → "Mail Service". Copy the **Admin API Key** (`id:secret` form).

### 2. Get Mailgun credentials

Mailgun dashboard → API Keys → "Private API key". Note your sending domain.

### 3. Configure the service

Copy `.env.example` to `.env` and fill in. Build & run:

```bash
docker compose -f docker-compose.snippet.yml up -d --build
```

Or fold the `mailer` block into your main compose.

### 4. Add the webhook in Ghost

Ghost admin → Settings → Integrations → your custom integration → Add webhook:
- Event: `Post published`
- URL: `https://yourdomain.com/webhook/post-published` (route it via Traefik to this service)
- Secret: same value as `WEBHOOK_SECRET` in `.env`

### 5. Disable Ghost's native send

When publishing a post, **uncheck "Email to subscribers"**. The webhook service handles delivery instead.

(Or: create a dedicated newsletter in Ghost with zero subscribers, so Ghost's send is a no-op.)

## Files

```
integration/
├── Dockerfile
├── package.json
├── .env.example
├── docker-compose.snippet.yml
└── src/
    ├── server.js          # Express webhook receiver + signature verify
    ├── ghost.js           # Ghost Admin API client (fetch members + post)
    ├── mailer.js          # Mailgun batch send
    └── templates/
        └── newsletter.hbs # YOUR custom template
```

## Editing the template

`src/templates/newsletter.hbs` is plain Handlebars. Available variables:

```
{{post.title}}
{{post.feature_image}}
{{post.excerpt}}
{{post.html}}              # full rendered post body
{{post.url}}               # canonical URL on your site
{{post.published_at}}
{{member.name}}
{{member.email}}
{{member.uuid}}            # for personalized URLs
{{site.title}}
{{site.url}}
{{unsubscribe_url}}        # required link in every email
```

Add more by editing `src/server.js` where it builds the render context.

## Why you'd actually want this

Real reasons:
- Per-segment templates (free vs paid get genuinely different layouts, not just paywall cutoffs)
- Multi-language sends from one post
- Embedded dynamic content (latest products, personalized recommendations)
- Drip sequences keyed off member metadata

If your reason is just "make the email look better" — close this folder, use `docker-patch/`.
