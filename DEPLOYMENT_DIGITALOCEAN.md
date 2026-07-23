# Qatar Operations Platform DigitalOcean Deployment Guide

This guide prepares the current plain HTML/CSS/JavaScript frontend and Node.js/Express backend for a DigitalOcean Ubuntu VPS.

Do not commit real passwords, JWT secrets, database credentials, SSH keys, or `.env` files.

## Production Architecture

- Nginx serves the frontend static files.
- Nginx proxies `/api` to the backend on `127.0.0.1:3000`.
- The frontend uses same-origin API calls in production: `https://YOUR_DOMAIN_HERE/api/v1`.
- The backend runs with PM2.
- PostgreSQL runs on the VPS.
- Auth uses JWT in HTTP-only cookies.

## Values You Must Obtain First

- DigitalOcean VPS public IP address.
- SSH access to the VPS.
- Domain name or subdomain to use.
- Namecheap account access for DNS.
- Strong PostgreSQL password.
- Long random `JWT_SECRET`, at least 32 characters.
- Temporary production admin email and password.

## 1. Point Namecheap DNS

In Namecheap DNS, create:

```text
Type: A
Host: @
Value: YOUR_DIGITALOCEAN_SERVER_IP
TTL: Automatic
```

Optional `www` record:

```text
Type: A
Host: www
Value: YOUR_DIGITALOCEAN_SERVER_IP
TTL: Automatic
```

Wait for DNS to propagate before running Certbot.

## 2. Connect to the VPS

```bash
ssh root@YOUR_DIGITALOCEAN_SERVER_IP
```

## 3. Update Ubuntu

```bash
apt update
apt upgrade -y
apt install -y curl git ufw nginx postgresql postgresql-contrib
```

## 4. Install Node.js

Use a current LTS version:

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs
node -v
npm -v
```

## 5. Install PM2

```bash
npm install -g pm2
pm2 -v
```

## 6. Create PostgreSQL Database and User

Replace placeholders before running:

```bash
sudo -u postgres psql
```

Inside `psql`:

```sql
CREATE DATABASE qatar_operations;
CREATE USER qatar_ops_user WITH PASSWORD 'CHANGE_ME_STRONG_DATABASE_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE qatar_operations TO qatar_ops_user;
\c qatar_operations
GRANT ALL ON SCHEMA public TO qatar_ops_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO qatar_ops_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO qatar_ops_user;
\q
```

## 7. Clone the Repository

```bash
mkdir -p /opt/qatar-operations
git clone YOUR_REPOSITORY_URL /opt/qatar-operations/app
cd /opt/qatar-operations/app
```

## 8. Configure Backend Environment

```bash
cd /opt/qatar-operations/app/backend
cp .env.example .env
nano .env
```

Production `.env` must use your real values:

```text
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://qatar_ops_user:CHANGE_ME_STRONG_DATABASE_PASSWORD@localhost:5432/qatar_operations
DATABASE_SSL=false
FRONTEND_ORIGIN=https://YOUR_DOMAIN_HERE
LOG_LEVEL=info
TRUST_PROXY=true
JWT_SECRET=CHANGE_ME_LONG_RANDOM_SECRET_AT_LEAST_32_CHARACTERS
JWT_EXPIRES_IN=8h
AUTH_COOKIE_NAME=qatar_ops_token
COOKIE_SECURE=true
COOKIE_SAME_SITE=lax
ADMIN_NAME=Zeeda Energy Admin
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=CHANGE_ME_TEMPORARY_ADMIN_PASSWORD
```

Never commit this `.env` file.

## 9. Install Backend Dependencies

```bash
cd /opt/qatar-operations/app/backend
npm ci --omit=dev
```

## 10. Run Migrations and Seeds

```bash
npm run migrate
npm run seed
npm run seed:admin
```

`npm run seed` is repeat-safe. It inserts or updates roles, sample sites, and sample chargers without duplicating them.

After the admin is created, remove `ADMIN_PASSWORD` from production `.env` or replace it with a non-usable placeholder.

## 11. Start Backend with PM2

```bash
cd /opt/qatar-operations/app/backend
pm2 start ecosystem.config.cjs --env production
pm2 save
pm2 startup systemd
```

Run the command printed by `pm2 startup systemd`.

Useful PM2 commands:

```bash
pm2 status
pm2 logs qatar-operations-api
pm2 restart qatar-operations-api
pm2 reload qatar-operations-api
```

## 12. Publish Frontend Files

```bash
mkdir -p /var/www/qatar-operations/frontend
cd /opt/qatar-operations/app
rsync -a --delete index.html styles.css app.js js assets /var/www/qatar-operations/frontend/
chown -R www-data:www-data /var/www/qatar-operations/frontend
```

## 13. Configure Nginx

Copy the example config:

```bash
cp /opt/qatar-operations/app/deploy/nginx/qatar-operations.conf /etc/nginx/sites-available/qatar-operations
nano /etc/nginx/sites-available/qatar-operations
```

Replace:

```text
YOUR_DOMAIN_HERE
```

Enable the site:

```bash
ln -s /etc/nginx/sites-available/qatar-operations /etc/nginx/sites-enabled/qatar-operations
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
```

## 14. Configure Firewall

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
ufw status
```

Do not expose PostgreSQL publicly.

## 15. Enable HTTPS with Certbot

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d YOUR_DOMAIN_HERE -d www.YOUR_DOMAIN_HERE
systemctl reload nginx
```

Certbot will update Nginx for HTTPS. Confirm certificates renew automatically:

```bash
certbot renew --dry-run
```

## 16. Production Health Checks

Backend health through Nginx:

```bash
curl -i https://YOUR_DOMAIN_HERE/api/health
```

Expected JSON:

```json
{"success":true,"status":"ok","service":"Qatar Operations API"}
```

Local backend health on the VPS:

```bash
curl -i http://127.0.0.1:3000/api/health
```

Frontend:

```bash
curl -I https://YOUR_DOMAIN_HERE
```

## 17. Restart Procedure

```bash
pm2 restart qatar-operations-api
systemctl reload nginx
```

## 18. Update Procedure

```bash
cd /opt/qatar-operations/app
git pull
cd backend
npm ci --omit=dev
npm run migrate
npm run seed
pm2 reload qatar-operations-api
cd /opt/qatar-operations/app
rsync -a --delete index.html styles.css app.js js assets /var/www/qatar-operations/frontend/
systemctl reload nginx
```

## Production Notes

- `FRONTEND_ORIGIN` must exactly match the deployed HTTPS site origin.
- `COOKIE_SECURE=true` is required in production.
- `TRUST_PROXY=true` is required in production behind Nginx.
- `COOKIE_SAME_SITE=lax` is suitable when frontend and API share the same domain.
- Keep the backend bound to port `3000` locally on the VPS; expose only Nginx ports `80` and `443`.
