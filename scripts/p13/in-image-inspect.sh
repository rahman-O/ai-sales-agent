#!/bin/sh
echo "=== find forbidden dirs ==="
find node_modules -type d \( -name prisma -o -name mysql2 -o -name deepmerge-ts \) 2>/dev/null | head -n 50 || true
echo "=== top-level existence ==="
node -e "const fs=require('fs'); const bad=['prisma','mysql2','deepmerge-ts'].filter(d=>fs.existsSync('node_modules/'+d)); console.log(JSON.stringify({topLevelForbidden:bad})); if(bad.length) process.exit(2)"
echo "=== npm ls ==="
npm ls prisma mysql2 deepmerge-ts --all 2>&1 | head -n 40 || true
echo "=== artifact files ==="
ls -la apps/*/dist/main.js prisma/generated/client/client.ts 2>/dev/null || ls -la apps/*/dist/main.js
echo "INSPECT_OK"
