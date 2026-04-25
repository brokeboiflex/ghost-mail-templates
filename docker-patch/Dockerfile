FROM ghost:6

# Override Ghost's email templates. All paths verified in ghost:6 (6.32.0).
# /var/lib/ghost/current is a symlink to /var/lib/ghost/versions/<version>.
#
# Comment out any block below if you don't want to override that category.

# 1. Newsletter — bulk send when publishing a post with "Email to subscribers"
COPY templates/newsletter/ \
     /var/lib/ghost/current/core/server/services/email-service/email-templates/

# 2. System / transactional — magic link, password reset, staff invites, test email
COPY templates/system/ \
     /var/lib/ghost/current/core/server/services/mail/templates/

# 3. Staff notifications — admin alerts: signups, donations, milestones, paid cancellations, etc.
COPY templates/staff-notifications/ \
     /var/lib/ghost/current/core/server/services/staff/email-templates/

# 4. Member welcome wrapper — the "Welcome to {site}" email shell after signup
COPY templates/member-welcome/ \
     /var/lib/ghost/current/core/server/services/member-welcome-emails/email-templates/
