FROM ghost:6

# Override Ghost's built-in newsletter email templates.
# Path inside the image: /var/lib/ghost/current/core/server/services/email-service/email-templates/
# `current` is a symlink to the active Ghost version directory.

COPY templates/template.hbs \
     /var/lib/ghost/current/core/server/services/email-service/email-templates/template.hbs

COPY templates/partials/ \
     /var/lib/ghost/current/core/server/services/email-service/email-templates/partials/
