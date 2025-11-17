#!/bin/bash
# Quick database query script
# Usage: ./db-query.sh "SELECT * FROM table;"

set -e

# Load environment variables from .env
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

# If no query provided, show usage
if [ -z "$1" ]; then
    echo "Usage: ./db-query.sh \"SQL QUERY\""
    echo "Example: ./db-query.sh \"SELECT * FROM orders LIMIT 5;\""
    exit 1
fi

# Run the query
PGPASSWORD="${SUPABASE_DB_PASSWORD}" psql \
  -h db.uaednwpxursknmwdeejn.supabase.co \
  -p 5432 \
  -U postgres \
  -d postgres \
  -c "$1"
