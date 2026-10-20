#!/bin/bash
set -e
echo "Resetting database dev..."
cd "$(dirname "$0")/../../backend"
npx prisma migrate reset --force
echo "Done!"
