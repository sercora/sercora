#!/bin/bash

set -e

echo "Building React..."

cd ~/sercora/frontend

npm run build

echo "Deploying files..."

sudo rsync -av --delete dist/ /var/www/sercora/

echo "Restarting API..."

sudo systemctl restart sercora-api

echo "Reloading nginx..."

sudo systemctl reload nginx

echo
echo "Deployment completed."
