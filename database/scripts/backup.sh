#!/bin/bash
set -e
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
docker exec doan_postgres pg_dump -U doan_user -d doan_db > "backup_${TIMESTAMP}.sql"
echo "Backup saved to backup_${TIMESTAMP}.sql"
