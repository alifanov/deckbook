#!/bin/sh
set -e
# ponytail: db push, не миграции — владелец один, схема и есть источник правды
./node_modules/.bin/prisma db push
exec ./node_modules/.bin/next start --port "${PORT:-3000}"
