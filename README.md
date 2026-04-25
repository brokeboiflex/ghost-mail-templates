# ghost-mail-templates

Customize what Ghost's newsletter emails look like — without forking Ghost, without abandoning Mailgun, without losing native analytics or paywall handling.

This is a tiny **Docker patch**: a Dockerfile that builds `FROM ghost:6` and copies your edited Handlebars templates over the originals inside the image. Ghost still renders and sends through Mailgun exactly as before — only the HTML changes.

## Why this exists

Ghost's newsletter design panel (Settings → Newsletters) covers colors, fonts, header/footer text, and a few toggles. That is everything Ghost Pro users get.

Anything beyond that — restructuring the layout, removing the "Powered by Ghost" badge, custom CSS rules, custom HTML around the post body — requires editing files baked into Ghost core. The official advice is "fork Ghost, modify, self-host." For a self-hoster running the official Docker image, that's overkill: you only want to swap a handful of `.hbs` files, not maintain a fork.

This repo is the minimal version of that: **one Dockerfile, four files you can edit.**

## What gets overridden

The official `ghost:6` image (verified against version `6.32.0`) ships these newsletter templates:

```
/var/lib/ghost/current/core/server/services/email-service/email-templates/
├── template.hbs                  ← main wrapper
└── partials/
    ├── feedback-button.hbs       ← reaction buttons (like / dislike / etc.)
    ├── latest-posts.hbs          ← "keep reading" block at the bottom
    ├── paywall.hbs               ← cutoff for paid-only content
    └── styles.hbs                ← all email CSS (~1200 lines)
```

`/var/lib/ghost/current` is a symlink to `/var/lib/ghost/versions/<X.Y.Z>` created by `ghost install`. Bind-mounts and `COPY` instructions targeted at `current/...` resolve through the symlink to the active version, so the override survives version bumps as long as the upstream paths don't move.

The templates in `docker-patch/templates/` were pulled directly from [TryGhost/Ghost main](https://github.com/TryGhost/Ghost/tree/main/ghost/core/core/server/services/email-service/email-templates) and diffed against a running `ghost:6` container (6.32.0) — they match byte-for-byte.

## Repo layout

```
ghost-mail-templates/
├── README.md                          ← you are here
└── docker-patch/
    ├── Dockerfile                     FROM ghost:6 + COPY edited templates
    ├── docker-compose.snippet.yml     drop-in replacement for your `ghost:` block
    └── templates/                     ← edit these
        ├── template.hbs
        └── partials/{feedback-button,latest-posts,paywall,styles}.hbs
```

## Quick start

### 1. Vendor this folder into your deploy repo

Drop `ghost-mail-templates/` next to your `docker-compose.yml` (or anywhere reachable by a relative path).

### 2. Switch your `ghost:` service from `image:` to `build:`

In your existing compose:

```diff
 services:
   ghost:
-    image: ghost:6
+    build:
+      context: ./ghost-mail-templates/docker-patch
     restart: always
     environment:
       # ...everything else stays exactly as it is
```

Everything else — Mailgun env vars, MySQL, Traefik labels, Tinybird analytics — is untouched. Ghost's runtime behavior is identical; only the HTML it generates for newsletter emails is different.

A complete annotated example matching the Pravda compose is at [`docker-patch/docker-compose.snippet.yml`](docker-patch/docker-compose.snippet.yml).

### 3. Edit the templates

For pure visual changes (colors, fonts, spacing, button styling), `docker-patch/templates/partials/styles.hbs` is where 95% of edits go. The rules are inlined into elements at render time, so this file is plain CSS in `<style>` blocks.

For structural changes (rearranging sections, dropping the Ghost badge, adding a custom block), edit `docker-patch/templates/template.hbs`.

### 4. Rebuild and test

```
docker compose up -d --build ghost
```

Then in Ghost admin: **Settings → Newsletters → [your newsletter] → Send test email**. Mailgun delivers, the inbox shows your patched template. Iterate.

## What's safe to edit

| Edit freely | Preserve as-is |
|---|---|
| Anything inside `<style>` blocks in `styles.hbs` | `{{{html}}}` (the post body — removing it produces empty emails) |
| Wrapper layout, section order in `template.hbs` | `{{members.unsubscribe_url}}` (legally required) |
| The "Powered by Ghost" footer block | `{{members.subscriptions.0.cancel_url}}` (paid-tier link) |
| `latest-posts.hbs` markup and styling | The hidden preheader span (controls inbox preview text) |
| `feedback-button.hbs` (or remove the partial entirely) | `<table>`-based layout primitives — email clients require them |

## CSS gotchas (email rendering)

Email is not the modern web. Keep this in mind in `styles.hbs`:

- No `flex`, `grid`, or CSS variables in production. Outlook/desktop clients silently drop them.
- Use `<table>` for layout, not `<div>` floats.
- Inline-friendly properties only. Ghost's renderer inlines styles automatically — but unsupported rules get inlined too, then ignored.
- Test in Litmus / Email on Acid before celebrating, or at minimum: Gmail web, Gmail iOS, Apple Mail, Outlook.
- `@media (prefers-color-scheme: dark)` works in some clients but Gmail strips it; design dark-mode-friendly defaults instead of relying on it.

## Maintenance: Ghost version upgrades

Each time you bump the base image (e.g. `FROM ghost:6` pulls 6.33.0):

```bash
# 1. Pull the upstream version of each template
TAG=v6.33.0
for f in template.hbs partials/feedback-button.hbs partials/latest-posts.hbs \
         partials/paywall.hbs partials/styles.hbs; do
  curl -sSL "https://raw.githubusercontent.com/TryGhost/Ghost/$TAG/ghost/core/core/server/services/email-service/email-templates/$f" \
    -o "/tmp/upstream-$(basename $f)"
done

# 2. Diff against your patched copies
diff /tmp/upstream-template.hbs docker-patch/templates/template.hbs
diff /tmp/upstream-styles.hbs docker-patch/templates/partials/styles.hbs
# ...etc
```

Most upgrades touch nothing in these files. When they do, manually merge upstream changes into your patched version (new `{{newsletter.foo}}` variables, accessibility tweaks, etc.).

If you forget this step entirely, your patched template still works — you just miss out on whatever upstream improved.

## Known limits

This patch covers **newsletter emails only** — the HTML that goes out when you publish a post with "Email to subscribers" enabled.

It does **not** touch:

- **Transactional emails** (signup magic link, password reset, member confirmation, staff invites). Those live elsewhere in Ghost core (`core/server/services/mail/`) and use different templates.
- **Mailgun's wrapping** (open-tracking pixel, click-rewriting). Those are added server-side by Mailgun after Ghost hands over the rendered HTML — disable per-domain in your Mailgun dashboard if unwanted.
- **Subject line and preview text logic** — those come from the post itself in Ghost admin.

Extending the same pattern to transactional emails is straightforward: add another `COPY` to the Dockerfile pointing at `core/server/services/mail/`. PRs welcome.

## Why not other approaches?

- **Theme `newsletter.hbs` file**: Ghost themes can't override email templates. The newsletter render path doesn't consult the active theme.
- **Mailgun template editing**: Mailgun's template feature only applies if a sender uses its template API. Ghost sends pre-rendered HTML, so dashboard templates are bypassed.
- **Webhook-based replacement** (e.g. Ghosler): works, but disables Ghost's native send and you reimplement open tracking, paywall logic, unsubscribe handling, and admin analytics. Use it only if you need behavior Ghost won't do — not for restyling.
- **Forking Ghost**: same end result as this patch, but you maintain a fork forever. This Dockerfile is the lazy, correct version.

## Sources

- [Ghost newsletter templates source — TryGhost/Ghost](https://github.com/TryGhost/Ghost/tree/main/ghost/core/core/server/services/email-service/email-templates)
- [Official Ghost Docker image — docker-library/ghost](https://github.com/docker-library/ghost)
- [Ghost Docker Hub](https://hub.docker.com/_/ghost/)
- [Ghost newsletter design settings — official docs](https://ghost.org/help/email-design/)
- [Forum: How to customize the newsletter email template HTML](https://forum.ghost.org/t/how-to-customize-the-newsletter-email-template-html/49949)

## License

The Handlebars files in `docker-patch/templates/` are copies of Ghost's templates and remain under Ghost's MIT license. Everything else in this repo is MIT.
