# Admin bootstrap

Initial platform admins:

- `info@bb24.in`
- `bigbrand24@gmail.com`

Before the first trusted seed run, set `SEED_ADMIN_PASSWORD` in the server environment to the temporary password documented in `BOOTSTRAP_ADMIN_CREDENTIALS.txt`. Do not commit that credential to Git. Change both admin passwords immediately after the first successful login. The seed script creates/updates these admin users and attaches them to the four initial businesses:

- GS Ayurvedic
- Rudraaye
- Vedixam
- Grendexherbs

After deployment, administrators can create client accounts from `/admin`. A generated temporary password is displayed once to the signed-in admin. Password resets generate a new temporary password and do not persist the plaintext password.

For production, configure Supabase Auth email/password and custom SMTP so reset and verification emails work.
