# ghost-mail-templates

Customize what Ghost's emails look like — **all of them**, not just the newsletter — without forking Ghost, without abandoning Mailgun, without losing native analytics or paywall handling.

This is a tiny **Docker patch**: a Dockerfile that builds `FROM ghost:6` and copies your edited template files over the originals inside the image. Ghost still renders and sends through its normal pipeline (Mailgun for bulk, configured SMTP for transactional) — only the HTML changes.

## Why this exists

Ghost's admin panel (Settings → Newsletters) covers colors, fonts, and a few toggles for the newsletter only. Transactional emails (magic links, password resets, staff invites), staff notifications (signups, donations, milestones), and the member welcome email shell are entirely uneditable from the UI.

The official advice for editing those is "fork Ghost, modify, self-host." For a self-hoster running the official Docker image that's overkill: you only want to swap a handful of `.hbs` / `.html` files, not maintain a fork.

This repo is the minimal version of that: **one Dockerfile, four directories of templates you can edit.**

## What gets overridden

The official `ghost:6` image (verified against version `6.32.0`) ships email templates in four separate places. Each cluster is mirrored as its own folder under `docker-patch/templates/`:

| Folder | What it covers | Sends when… | In-image destination |
|---|---|---|---|
| `templates/newsletter/` | Bulk newsletter to subscribers | A post is published with "Email to subscribers" enabled | `core/server/services/email-service/email-templates/` |
| `templates/system/` | Magic links, password resets, staff invites, "send test email" button | A user signs in / requests reset / is invited / admin tests SMTP | `core/server/services/mail/templates/` |
| `templates/staff-notifications/` | Admin-facing alerts: new signup, donation, gift, milestone, paid started, paid cancellation, recommendation | A member event happens that staff opted to receive notifications for | `core/server/services/staff/email-templates/` |
| `templates/member-welcome/` | Welcome email wrapper shown after signup | A member signs up (free or paid) | `core/server/services/member-welcome-emails/email-templates/` |

All files were copied directly from a running `ghost:6` container — they match what your image actually loads, byte-for-byte.

`/var/lib/ghost/current` is a symlink to `/var/lib/ghost/versions/<X.Y.Z>` created by `ghost install`. `COPY` instructions targeting `current/...` resolve through the symlink to the active version, so the override survives version bumps as long as upstream paths don't move.

## Repo layout

```
ghost-mail-templates/
├── README.md                              ← you are here
└── docker-patch/
    ├── Dockerfile                         FROM ghost:6 + 4 COPY blocks (any are optional)
    ├── docker-compose.snippet.yml         drop-in replacement for your `ghost:` block
    └── templates/
        ├── newsletter/
        │   ├── template.hbs
        │   └── partials/{feedback-button,latest-posts,paywall,styles}.hbs
        ├── system/
        │   ├── newsletter.html            (the transactional wrapper, NOT the bulk newsletter)
        │   ├── welcome.html
        │   ├── reset-password.html
        │   ├── invite-user.html
        │   ├── invite-user-by-api-key.html
        │   ├── test.html
        │   └── raw/                       source files used to regenerate the inlined HTML
        ├── staff-notifications/
        │   ├── new-free-signup.hbs            (+ .txt.js plain-text twin for each)
        │   ├── new-paid-started.hbs
        │   ├── new-paid-cancellation.hbs
        │   ├── donation.hbs
        │   ├── gift.hbs
        │   ├── new-gift-subscription.hbs
        │   ├── new-milestone-received.hbs
        │   ├── recommendation-received.hbs
        │   └── partials/{preview,styles}.hbs
        └── member-welcome/
            └── wrapper.hbs
```

## Quick start

### 1. Vendor this folder into your deploy repo

Drop `ghost-mail-templates/` next to your `docker-compose.yml` (or anywhere reachable by a relative path).

### 2. Add bind-mounts to your `ghost:` service (recommended)

Keep `image: ghost:6` and overlay the four template directories as read-only volumes. No image build, no Dockerfile needed.

```diff
 services:
   ghost:
     image: ghost:6
     restart: always
     volumes:
       - ghost:/var/lib/ghost/content
+      - ./ghost-mail-templates/docker-patch/templates/newsletter:/var/lib/ghost/current/core/server/services/email-service/email-templates:ro
+      - ./ghost-mail-templates/docker-patch/templates/system:/var/lib/ghost/current/core/server/services/mail/templates:ro
+      - ./ghost-mail-templates/docker-patch/templates/staff-notifications:/var/lib/ghost/current/core/server/services/staff/email-templates:ro
+      - ./ghost-mail-templates/docker-patch/templates/member-welcome:/var/lib/ghost/current/core/server/services/member-welcome-emails/email-templates:ro
```

Comment out any of the four lines to keep Ghost's defaults for that email category. Mailgun env vars, MySQL, Traefik labels, Tinybird analytics — untouched. Ghost's runtime is identical; only the HTML it generates is different.

A complete annotated example is at [`docker-patch/docker-compose.snippet.yml`](docker-patch/docker-compose.snippet.yml).

### 2b. Alternative: build a custom image

If you'd rather ship a self-contained image (e.g. push to a registry, run on multiple hosts without sharing the templates folder), use the Dockerfile instead:

```diff
 services:
   ghost:
-    image: ghost:6
+    build:
+      context: ./ghost-mail-templates/docker-patch
```

The Dockerfile in `docker-patch/` does the same `COPY` work the bind-mounts do, baked into the image. For Dokploy with git-based deploys, the bind-mount approach is simpler and faster.

### 3. Edit only what you want to change

You don't have to override all four categories — comment out the `COPY` blocks in the Dockerfile for any you want to leave default. Partial coverage works fine.

For pure visual changes:

- **Newsletter look** → `templates/newsletter/partials/styles.hbs`
- **Staff notifications look** → `templates/staff-notifications/partials/styles.hbs`
- **Transactional / member-welcome look** → those are inlined HTML; edit the `<style>` blocks directly inside each `.html` / `wrapper.hbs` file

For structural changes, edit the corresponding `.hbs` / `.html`.

### 4. Rebuild and test

```bash
docker compose up -d --build ghost
```

Test surfaces in Ghost admin:
- **Newsletter**: Settings → Newsletters → Send test email
- **Transactional / system**: Settings → Email → "Send test email" button (covers the `test.html` template). Magic-link template is exercised by signing out and signing back in via email.
- **Staff notifications**: Settings → Staff → toggle email notifications, then trigger the event (e.g. sign up a test member to fire `new-free-signup`)
- **Member welcome**: sign up a test member; the wrapper renders around the welcome content configured in the tier

## What's safe to edit

| Edit freely | Preserve as-is |
|---|---|
| Anything inside `<style>` blocks | `{{{html}}}`, `{{{post.html}}}` (the post body — removing it produces empty emails) |
| Wrapper layout, section order, copy text | `{{members.unsubscribe_url}}` (legally required in newsletters) |
| The "Powered by Ghost" footer block | `{{members.subscriptions.0.cancel_url}}` (paid-tier link) |
| `latest-posts.hbs` markup and styling | The hidden preheader span (controls inbox preview text) |
| `feedback-button.hbs` (or remove the partial entirely) | `{{resetLink}}` / `{{magicLink}}` / `{{inviteUrl}}` in transactional templates — these ARE the email |
| Staff notification copy and layout | `<table>`-based layout primitives — email clients require them |

## CSS gotchas (email rendering)

Email is not the modern web. Keep this in mind:

- No `flex`, `grid`, or CSS variables in production. Outlook/desktop clients silently drop them.
- Use `<table>` for layout, not `<div>` floats.
- Inline-friendly properties only. Ghost's renderer inlines styles automatically — but unsupported rules get inlined too, then ignored.
- Test in Litmus / Email on Acid before celebrating, or at minimum: Gmail web, Gmail iOS, Apple Mail, Outlook.
- `@media (prefers-color-scheme: dark)` works in some clients but Gmail strips it; design dark-mode-friendly defaults instead of relying on it.

## On the `system/raw/` directory

`templates/system/` contains pre-inlined HTML that Ghost loads at runtime. The `raw/` subdirectory is the un-inlined source that Ghost's build tooling uses to *generate* the inlined versions. **You only need to edit the inlined files** (the ones at the top level of `system/`) — the `raw/` files are there for completeness but aren't loaded by Ghost in this build path. If you want to use the raw source as your editing format, you'll need to inline the CSS yourself before placing the result in `templates/system/<name>.html`. For most edits, edit the inlined version directly.

## Maintenance: Ghost version upgrades

Each time you bump the base image (e.g. `FROM ghost:6` pulls 6.33.0):

```bash
# 1. Spin up the new version and copy upstream templates to a temp dir
ID=$(docker create ghost:6)
docker cp "$ID:/var/lib/ghost/current/core/server/services/email-service/email-templates" /tmp/upstream-newsletter
docker cp "$ID:/var/lib/ghost/current/core/server/services/mail/templates" /tmp/upstream-system
docker cp "$ID:/var/lib/ghost/current/core/server/services/staff/email-templates" /tmp/upstream-staff
docker cp "$ID:/var/lib/ghost/current/core/server/services/member-welcome-emails/email-templates" /tmp/upstream-welcome
docker rm "$ID"

# 2. Diff against your patched copies
diff -r /tmp/upstream-newsletter docker-patch/templates/newsletter
diff -r /tmp/upstream-system     docker-patch/templates/system
diff -r /tmp/upstream-staff      docker-patch/templates/staff-notifications
diff -r /tmp/upstream-welcome    docker-patch/templates/member-welcome
```

Most upgrades touch nothing in these files. When they do, manually merge upstream changes into your patched version (new variables, accessibility tweaks, etc.).

If you forget this step entirely, your patched template still works — you just miss out on whatever upstream improved.

## Known limits

- **Mailgun's wrapping** (open-tracking pixel, click-rewriting) is added server-side by Mailgun *after* Ghost hands over the rendered HTML. Disable per-domain in your Mailgun dashboard if unwanted.
- **Subject lines and preview text** for newsletters come from the post itself in Ghost admin (post settings → Email → Subject), not from these templates.
- **Email body content of welcome emails** is configured per-tier in Ghost admin; only the *wrapper* around it lives in `member-welcome/wrapper.hbs`.
- Ghost may add new email types in future versions. If a new category appears, add another folder + `COPY` block.

## Why not other approaches?

- **Theme `newsletter.hbs` file**: Ghost themes can't override email templates. The newsletter render path doesn't consult the active theme.
- **Mailgun template editing**: Mailgun's template feature only applies if a sender uses its template API. Ghost sends pre-rendered HTML, so dashboard templates are bypassed.
- **Webhook-based replacement** (e.g. Ghosler): works, but disables Ghost's native send and you reimplement open tracking, paywall logic, unsubscribe handling, and admin analytics. Use it only if you need behavior Ghost won't do — not for restyling.
- **Forking Ghost**: same end result as this patch, but you maintain a fork forever. This Dockerfile is the lazy, correct version.

## Sources

- [Ghost newsletter templates source — TryGhost/Ghost](https://github.com/TryGhost/Ghost/tree/main/ghost/core/core/server/services/email-service/email-templates)
- [Ghost transactional mail templates — TryGhost/Ghost](https://github.com/TryGhost/Ghost/tree/main/ghost/core/core/server/services/mail/templates)
- [Ghost staff notification templates — TryGhost/Ghost](https://github.com/TryGhost/Ghost/tree/main/ghost/core/core/server/services/staff/email-templates)
- [Ghost member-welcome wrapper — TryGhost/Ghost](https://github.com/TryGhost/Ghost/tree/main/ghost/core/core/server/services/member-welcome-emails/email-templates)
- [Official Ghost Docker image — docker-library/ghost](https://github.com/docker-library/ghost)
- [Ghost newsletter design settings — official docs](https://ghost.org/help/email-design/)

## License

Template files in `docker-patch/templates/` are copies of Ghost's templates and remain under Ghost's MIT license. Everything else in this repo is MIT.
