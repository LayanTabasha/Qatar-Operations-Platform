# Site Image Upload Deployment Notes

The backend stores uploaded site images on the server at:

```text
/var/www/qatar-operations/uploads/site-images
```

The database stores only the public URL path, for example:

```text
/uploads/site-images/generated-file.jpg
```

## Nginx Location Block

Add this inside the same `server` block that serves the Qatar Operations frontend:

```nginx
location /uploads/ {
    alias /var/www/qatar-operations/uploads/;
    try_files $uri =404;
    expires 7d;
    add_header Cache-Control "public";
}
```

Place it before the general `location /` block.

## Server Commands

Create the upload directory:

```bash
sudo mkdir -p /var/www/qatar-operations/uploads/site-images
sudo chown -R $USER:www-data /var/www/qatar-operations/uploads
sudo chmod -R 775 /var/www/qatar-operations/uploads
```

After updating Nginx:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

Restart the backend after deploying the upload route:

```bash
cd /opt/qatar-operations/app/backend
pm2 restart qatar-operations-api
```

## Verification

Upload a site image as Admin or Operations Staff, then check:

```bash
curl -I https://zdoperations.zdenergyqatar.com/uploads/site-images/YOUR_UPLOADED_FILE
```

Expected result:

```text
HTTP/2 200
```

Viewer accounts should not be able to upload site images.
