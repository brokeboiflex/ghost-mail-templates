# docker-patch

The override layer. See the [root README](../README.md) for the full picture: which email categories exist, what each one does, quick start, gotchas, and the version-upgrade workflow.

## Files

- `Dockerfile` — `FROM ghost:6` + four `COPY` blocks (one per email category, comment any out)
- `docker-compose.snippet.yml` — drop-in replacement for the `ghost:` block in your compose
- `templates/newsletter/` — bulk newsletter (post → subscribers)
- `templates/system/` — magic links, password resets, staff invites, "send test email"
- `templates/staff-notifications/` — admin alerts (signups, donations, milestones, etc.)
- `templates/member-welcome/` — welcome email wrapper after signup

## Editing rule of thumb

| You want to… | Edit |
|---|---|
| Restyle the newsletter | `templates/newsletter/partials/styles.hbs` |
| Restructure the newsletter | `templates/newsletter/template.hbs` |
| Restyle staff notifications | `templates/staff-notifications/partials/styles.hbs` |
| Change a transactional email (e.g. magic link) | `templates/system/<name>.html` (inlined HTML, edit `<style>` block directly) |
| Change the member welcome wrapper | `templates/member-welcome/wrapper.hbs` |

## Selective overrides

Don't want to override all four? Comment out the corresponding `COPY` block in the `Dockerfile`. Ghost falls back to its built-in templates for any category you don't override.
