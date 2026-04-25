# ghost-mail-templates

Two ways to control what Pravda's emails look like, without giving up Mailgun.

## TL;DR

| | docker-patch | integration |
|---|---|---|
| Effort to set up | low | medium |
| Effort to maintain | low (re-diff on Ghost upgrade) | medium (keep service deployed) |
| Keeps Ghost newsletter UX | yes | **no** — disables Ghost's send |
| Keeps Mailgun analytics in Ghost admin | yes | no |
| Works with members/tiers/paywall logic | yes (Ghost handles it) | you reimplement it |
| Footprint | one extra Docker build | extra service + Ghost Admin API key |
| Best for | restyling/rebranding existing emails | fundamentally different email flow |

**Recommendation:** start with `docker-patch/`. Move to `integration/` only if you need behavior Ghost won't do (e.g., a totally different layout per segment, embedded products, drip sequences).

## Approach 1 — `docker-patch/`

Build a custom Ghost image FROM `ghost:6` that copies your modified `template.hbs` (and partials) over the originals at `/var/lib/ghost/current/core/server/services/email-service/email-templates/`. Ghost still renders and sends through Mailgun exactly as before — only the HTML changes.

Pros: single Dockerfile, lives in your existing deploy pipeline, all Ghost features keep working.
Cons: every Ghost upgrade you should diff upstream `template.hbs` against your version (5 min job).

See `docker-patch/README.md`.

## Approach 2 — `integration/`

A tiny Node service that:
1. Receives Ghost's `post.published` webhook
2. Pulls post HTML and member list via Ghost Admin API
3. Renders a fully custom Handlebars template
4. Sends via Mailgun's batch API directly

You disable Ghost's native newsletter on the post (publish without "Email to subscribers"), or use a tier that doesn't get newsletters.

Pros: total HTML freedom, can do things Ghost can't (custom segments, A/B subjects, multi-language splits).
Cons: you reimplement open/click tracking, paywall HTML, member-management links, unsubscribe — Ghost will not show these emails in its admin.

See `integration/README.md`.

## Pick one

If the goal is "make our newsletter look on-brand" → docker-patch.
If the goal is "Ghost's newsletter system is fundamentally not what we want" → integration.

Don't run both for the same emails.
