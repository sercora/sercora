#!/bin/bash

set -e

echo "Building React staging..."

cd /home/simon/sercora-staging/frontend

VITE_API_URL=/api npm run build

echo "Deploying staging files..."

sudo rsync -av --delete dist/ /var/www/sercora-staging/

echo "Restarting staging API..."

sudo systemctl restart sercora-staging-api

echo "Reloading nginx..."

sudo systemctl reload nginx

echo
echo "Staging deployment completed."
