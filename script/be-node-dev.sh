#!/bin/sh
set -e

if [ ! -d node_modules ] || [ -z "$(ls -A node_modules 2>/dev/null)" ]; then
  npm install
fi

npx prisma generate
npm run db:push
npm run start:dev
