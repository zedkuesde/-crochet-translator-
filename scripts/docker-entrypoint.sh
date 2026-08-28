#!/bin/sh
set -e

mkdir -p /app/data

./node_modules/.bin/prisma migrate deploy

exec node server.js
