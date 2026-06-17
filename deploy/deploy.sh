#!/bin/bash

set -e

echo "Building React..."

cd ~/sercora/frontend

VITE_API_URL=https://api.serco.pro npm run build

echo "Deploying files..."

sudo rsync -av --delete dist/ /var/www/sercora/

echo "Deploying PDF.js resources..."

sudo mkdir -p /var/www/sercora/pdfjs/cmaps
sudo mkdir -p /var/www/sercora/pdfjs/standard_fonts
sudo mkdir -p /var/www/sercora/pdfjs/wasm
sudo rsync -a --delete node_modules/pdfjs-dist/cmaps/ /var/www/sercora/pdfjs/cmaps/
sudo rsync -a --delete node_modules/pdfjs-dist/standard_fonts/ /var/www/sercora/pdfjs/standard_fonts/
sudo rsync -a --delete node_modules/pdfjs-dist/wasm/ /var/www/sercora/pdfjs/wasm/

echo "Restarting API..."

sudo systemctl restart sercora-api

echo "Reloading nginx..."

sudo systemctl reload nginx

echo
echo "Deployment completed."
