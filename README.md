# MedTravia Backend

Express and PostgreSQL API for treatment inquiries, durable Brevo admin notifications, and JWT-protected administration. Public and admin resource identifiers are UUIDs.

## Local setup

1. Copy `.env.example` values into `.env` and replace every placeholder.
2. Apply migrations with `npm run db:migrate`.
3. Create or rotate the admin account with `npm run admin:seed`.
4. Start the API with `npm run dev`.

For production, use a supported Node release (20.19+, 22.12+, or 24+), set `NODE_ENV=production`, use HTTPS, configure an exact proxy hop count in `TRUST_PROXY`, configure only real frontend origins in `CORS_ORIGIN`, and run `npm run db:migrate:deploy` before starting the new application version. Never use `TRUST_PROXY=true`.

The migration that introduces UUIDs changes existing inquiry and administrator IDs. Existing admin access tokens contain the old identifier and must be replaced by signing in again after deployment. Deploy the migration and application together during a maintenance window.

The Brevo sender email must be verified in the Brevo account. `BREVO_API_KEY` is an API v3 key, not the SMTP password. Multiple admin notification recipients can be supplied as a comma-separated `ADMIN_NOTIFICATION_EMAIL` value.

## Public API

`POST /api/inquiries` stores an inquiry and returns without waiting for Brevo. A durable worker claims pending notifications, recovers expired claims, and retries failures with exponential backoff. Production requests must send a unique `Idempotency-Key` header (a UUID is recommended) so a client retry cannot create another inquiry. Reusing a key with different request data returns HTTP 409.

## Admin API

- `POST /api/admin/auth/login` with `{ "email": "...", "password": "..." }`
- `GET /api/admin/me`
- `GET /api/admin/inquiries?limit=20&cursor=&search=&from=YYYY-MM-DD&to=YYYY-MM-DD`
- `GET /api/admin/inquiries/:id`
- `POST /api/admin/inquiries/:id/resend-notification`

Send the login token on protected requests as `Authorization: Bearer <token>`. JWT access tokens expire according to `JWT_EXPIRES_IN` and should only be sent over HTTPS.

Cursor pagination is preferred for large datasets. Use `pagination.nextCursor` as the next request's `cursor`. The legacy `page` parameter remains available for compatibility but is capped at 1,000.

## Secret rotation

`.env.example` contains placeholders only. If a real database URL or Brevo API key was ever committed or shared in that file, rotate the database password and Brevo key in their provider dashboards before deploying. Updating this repository does not invalidate already exposed credentials.
