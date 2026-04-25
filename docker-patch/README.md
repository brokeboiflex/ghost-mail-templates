# docker-patch

The override layer. See the [root README](../README.md) for context, quick start, and version-upgrade workflow.

## Files

- `Dockerfile` — `FROM ghost:6` + two `COPY` instructions
- `docker-compose.snippet.yml` — drop-in replacement for the `ghost:` block in your compose
- `templates/template.hbs` — main newsletter wrapper (edit this for structural changes)
- `templates/partials/styles.hbs` — all email CSS (edit this for visual changes — 95% of work goes here)
- `templates/partials/{feedback-button,latest-posts,paywall}.hbs` — opt-in sections

## Editing rule of thumb

**Visual change?** → `templates/partials/styles.hbs`
**Structural change?** → `templates/template.hbs`
**Remove a section entirely?** → either delete the `{{> partials/foo}}` line in `template.hbs`, or replace the partial's body with empty content.

See the root README for what to preserve, CSS gotchas, and maintenance on Ghost upgrades.
