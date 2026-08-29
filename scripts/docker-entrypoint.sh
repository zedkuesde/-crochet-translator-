#!/bin/sh
set -e

mkdir -p /app/data
chown -R nextjs:nodejs /app/data

cd /app

# Invoke the Prisma CLI via Node (no reliance on node_modules/.bin symlinks).
# CLI lives in /opt/prisma from the dedicated prisma-cli image stage.
su-exec nextjs node /opt/prisma/node_modules/prisma/build/index.js migrate deploy

exec su-exec nextjs node server.js
