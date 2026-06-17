#!/bin/bash

set -e

echo "Building React staging..."

cd /home/simon/sercora-staging/frontend

VITE_API_URL=/api npm run build

echo "Deploying staging files..."

sudo rsync -av --delete --exclude pdfjs/ dist/ /var/www/sercora-staging/

echo "Deploying PDF.js resources..."

sudo mkdir -p /var/www/sercora-staging/pdfjs/cmaps
sudo mkdir -p /var/www/sercora-staging/pdfjs/standard_fonts
sudo mkdir -p /var/www/sercora-staging/pdfjs/wasm
sudo rsync -a --delete node_modules/pdfjs-dist/cmaps/ /var/www/sercora-staging/pdfjs/cmaps/
sudo rsync -a --delete node_modules/pdfjs-dist/standard_fonts/ /var/www/sercora-staging/pdfjs/standard_fonts/
sudo rsync -a --delete node_modules/pdfjs-dist/wasm/ /var/www/sercora-staging/pdfjs/wasm/

echo "Restarting staging API..."

sudo systemctl restart sercora-staging-api

echo "Reloading nginx..."

sudo systemctl reload nginx

echo
echo "Staging deployment completed."
