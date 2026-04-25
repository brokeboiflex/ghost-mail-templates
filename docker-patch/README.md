# docker-patch

Custom Ghost image that overrides the newsletter email templates. Ghost still sends through Mailgun — only the HTML changes.

## Files

```
docker-patch/
├── Dockerfile
├── docker-compose.snippet.yml   # how to wire this into the parent compose
└── templates/
    ├── template.hbs             # main newsletter wrapper — EDIT THIS
    └── partials/
        ├── feedback-button.hbs  # like/dislike/comment buttons
        ├── latest-posts.hbs     # "keep reading" block
        ├── paywall.hbs          # paid-content cutoff
        └── styles.hbs           # all email CSS — EDIT FOR BRANDING
```

The files in `templates/` are unmodified copies of Ghost 6 upstream. Edit them in place.

## How to use

1. Drop this folder into your Dokploy repo (or a sibling repo Dokploy can see).
2. In your existing `docker-compose.yml`, replace
   ```yaml
   ghost:
     image: ghost:6
   ```
   with
   ```yaml
   ghost:
     build:
       context: ./ghost-mail-templates/docker-patch
   ```
   (adjust path to wherever this folder ends up relative to your compose file).
3. Edit `templates/template.hbs` and `templates/partials/styles.hbs` to taste.
4. Redeploy in Dokploy. Ghost sends a test email → done.

See `docker-compose.snippet.yml` for a copy-pasteable example based on your current compose.

## What to actually edit

- **`partials/styles.hbs`** — almost all visual changes live here. Colors, fonts, spacing, button styles. Email CSS only — keep it inline-friendly, no flexbox/grid.
- **`template.hbs`** — structural changes. Add a section, reorder, drop the "Powered by Ghost" badge, etc.
- **`partials/latest-posts.hbs`** — change how the "keep reading" block looks.
- **`partials/feedback-button.hbs`** — change/remove the reaction buttons.

## Don't break these

- `{{{html}}}` — the post body. Removing this means empty emails.
- `{{members.unsubscribe_url}}` — unsubscribe link. Required for CAN-SPAM/Mailgun.
- `{{members.subscriptions.0.cancel_url}}` and the subscription box — needed for paid tiers.
- The hidden preheader text node — controls preview text in inbox lists.

## On Ghost upgrades

When you bump `FROM ghost:6` to a new minor (e.g. 6.5 → 6.6), check the upstream diff:

```bash
curl -sSL https://raw.githubusercontent.com/TryGhost/Ghost/v6.6.0/ghost/core/core/server/services/email-service/email-templates/template.hbs \
  | diff - templates/template.hbs
```

Merge any upstream changes you care about into your version. Usually nothing changes; occasionally a new variable like `{{newsletter.something_new}}` appears.

## Testing

In Ghost admin → Settings → Newsletters → your newsletter → "Send test email". Hits Mailgun with your patched template. Iterate.

## Limits

- The wrapper Mailgun applies (open-tracking pixel, click rewriting) is not in this template — it's injected by Mailgun. You can't remove it from here.
- Transactional emails (magic links, password resets, member confirmations) use *different* templates living elsewhere in Ghost core. This patch does not touch them. If you need those, add another `COPY` for `core/server/services/mail/` templates.
