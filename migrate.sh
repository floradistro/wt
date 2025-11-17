#!/bin/bash
# Supabase Migration Script - Uses direct database connection
# Usage: ./migrate.sh <migration-file.sql>

set -e

# Load environment variables
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

MIGRATION_FILE="$1"

if [ -z "$MIGRATION_FILE" ]; then
    echo "Usage: ./migrate.sh <migration-file.sql>"
    echo ""
    echo "Or run SQL directly:"
    echo "  PGPASSWORD=\"\$SUPABASE_DB_PASSWORD\" psql \\"
    echo "    -h db.uaednwpxursknmwdeejn.supabase.co \\"
    echo "    -p 5432 \\"
    echo "    -U postgres \\"
    echo "    -d postgres"
    exit 1
fi

if [ ! -f "$MIGRATION_FILE" ]; then
    echo "Error: Migration file '$MIGRATION_FILE' not found"
    exit 1
fi

echo "Running migration: $MIGRATION_FILE"
echo "Database: db.uaednwpxursknmwdeejn.supabase.co"
echo ""

# Try port 5432 (direct) first, fallback to 6543 (pooler)
if PGPASSWORD="$SUPABASE_DB_PASSWORD" psql \
  -h db.uaednwpxursknmwdeejn.supabase.co \
  -p 5432 \
  -U postgres \
  -d postgres \
  -f "$MIGRATION_FILE" 2>&1; then
  echo ""
  echo "✓ Migration completed successfully (direct connection)"
else
  echo ""
  echo "⚠ Direct connection failed, trying pooler (port 6543)..."
  PGPASSWORD="$SUPABASE_DB_PASSWORD" psql \
    -h db.uaednwpxursknmwdeejn.supabase.co \
    -p 6543 \
    -U postgres \
    -d postgres \
    -f "$MIGRATION_FILE"
  echo ""
  echo "✓ Migration completed successfully (pooler connection)"
fi
