#!/bin/sh
set -e
cd "$(dirname "$0")"
npx esbuild src/main.jsx --bundle --format=iife --jsx-factory=React.createElement --jsx-fragment=React.Fragment \
  --alias:react=./src/react-shim.js --alias:react-dom/client=./src/react-dom-shim.js --target=chrome110 --minify-syntax --outfile=dist/app.js --log-level=warning
node assemble.mjs
