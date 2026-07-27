# Secure User Management Deployment

## Local Laptop

```bash
git status
git add .
git commit -m "Add secure user management and complete site image upload"
git push
```

## Production Server

```bash
cd /var/www/qatar-operations/source
git status
git pull
```

```bash
cd backend
npm install
npm run migrate
pm2 restart qatar-operations-backend --update-env
pm2 status
```

```bash
curl -i http://127.0.0.1:3000/api/v1/health
curl -i https://zdoperations.zdenergyqatar.com/api/v1/health
```

Production `.env` must keep:

```text
TRUST_PROXY=1
COOKIE_SECURE=true
COOKIE_SAME_SITE=lax
SITE_IMAGE_UPLOAD_ROOT=/var/www/qatar-operations/uploads/site-images
```

## Create the Supervisor Admin

Use a real strong temporary password when running this command. Do not commit it.

```bash
cd /var/www/qatar-operations/source/backend
npm run user:create-admin -- --name="Supervisor Name" --email="supervisor@example.com" --password="StrongPassword1"
```

## Confirm Account Roles

This query does not show password hashes:

```bash
psql "$DATABASE_URL" -c "SELECT users.full_name, users.email, roles.name AS role, users.is_active FROM users JOIN roles ON roles.id = users.role_id ORDER BY users.full_name;"
```

## Verify Site Image Uploads

Check uploaded files:

```bash
sudo ls -lah /var/www/qatar-operations/uploads/site-images
```

Check saved public paths:

```bash
psql "$DATABASE_URL" -c "SELECT name, image_path FROM sites ORDER BY name;"
```

Check PM2 logs for upload requests:

```bash
pm2 logs qatar-operations-backend --lines 100
```

Check a public image URL:

```bash
curl -I https://zdoperations.zdenergyqatar.com/uploads/site-images/YOUR_UPLOADED_FILE.webp
```

## Frontend Files

The production Nginx frontend directory should contain the root static files:

```text
/var/www/qatar-operations/frontend
```

Copy from the repository root:

```bash
cd /var/www/qatar-operations/source
sudo rsync -a --delete index.html styles.css app.js js assets /var/www/qatar-operations/frontend/
sudo nginx -t
sudo systemctl reload nginx
```
