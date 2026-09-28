#!/bin/bash
set -e
cd "$(dirname "$0")"
./node_modules/.bin/esbuild src/host.js --bundle --platform=browser --format=iife --outfile=public/host.bundle.js
./node_modules/.bin/esbuild src/sandbox.js --bundle --platform=browser --format=iife --outfile=sandbox-origin/sandbox.bundle.js
./node_modules/.bin/esbuild src/view-app.js --bundle --platform=browser --format=iife --outfile=sandbox-origin/view-app.bundle.js
echo "build ok"
