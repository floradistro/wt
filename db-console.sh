#!/bin/bash
# Interactive Supabase Database Console
# Opens a psql session to your Supabase database

set -e

# Load environment variables
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

echo "Connecting to Supabase Database..."
echo "Host: db.uaednwpxursknmwdeejn.supabase.co"
echo "Database: postgres"
echo ""

PGPASSWORD="$SUPABASE_DB_PASSWORD" psql \
  -h db.uaednwpxursknmwdeejn.supabase.co \
  -p 5432 \
  -U postgres \
  -d postgres
