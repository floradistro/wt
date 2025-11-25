#!/bin/bash
# Safe Migration Script for Claude Code
# This script prevents IP bans by using proper authentication and delays

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | grep -v '^$' | xargs)
fi

# Verify required variables
if [ -z "$SUPABASE_DB_PASSWORD" ]; then
    echo -e "${RED}ERROR: SUPABASE_DB_PASSWORD not set in .env${NC}"
    exit 1
fi

if [ -z "$SUPABASE_PROJECT_REF" ]; then
    echo -e "${RED}ERROR: SUPABASE_PROJECT_REF not set in .env${NC}"
    exit 1
fi

# Function to check if project is linked
check_link() {
    echo -e "${YELLOW}Checking project link...${NC}"
    if [ ! -d ".supabase" ]; then
        echo -e "${YELLOW}Project not linked. Linking now...${NC}"
        supabase link --project-ref "$SUPABASE_PROJECT_REF" --password "$SUPABASE_DB_PASSWORD"
        sleep 3
    fi
}

# Function to list migrations safely
list_migrations() {
    echo -e "${YELLOW}Fetching migration list...${NC}"
    sleep 2  # Rate limiting protection
    supabase migration list || {
        echo -e "${RED}Failed to list migrations. You may be rate limited.${NC}"
        echo -e "${YELLOW}Wait 30 seconds and try again.${NC}"
        return 1
    }
}

# Function to create migration
create_migration() {
    local name=$1
    if [ -z "$name" ]; then
        echo -e "${RED}ERROR: Migration name required${NC}"
        echo "Usage: $0 create <migration_name>"
        exit 1
    fi

    echo -e "${YELLOW}Creating migration: $name${NC}"
    supabase migration new "$name"
}

# Function to push migrations safely
push_migrations() {
    echo -e "${YELLOW}Pushing migrations to remote...${NC}"
    echo -e "${YELLOW}Using Management API (safe method)${NC}"

    sleep 2  # Rate limiting protection

    if supabase db push; then
        echo -e "${GREEN}✓ Migrations pushed successfully${NC}"
        sleep 3  # Cool down period
        list_migrations
    else
        echo -e "${RED}✗ Failed to push migrations${NC}"
        echo -e "${YELLOW}Possible causes:${NC}"
        echo "  1. Rate limited - wait 30 seconds and retry"
        echo "  2. Invalid SQL in migration"
        echo "  3. Connection issue - check your internet"
        return 1
    fi
}

# Function to check remote status
check_status() {
    echo -e "${YELLOW}Checking remote database status...${NC}"
    sleep 2

    # Use psql with connection timeout
    PGPASSWORD="$SUPABASE_DB_PASSWORD" psql \
        "postgresql://postgres:$SUPABASE_DB_PASSWORD@db.$SUPABASE_PROJECT_REF.supabase.co:5432/postgres" \
        -c "SELECT version();" \
        --set=statement_timeout=10s \
        2>/dev/null && {
        echo -e "${GREEN}✓ Database connection OK${NC}"
    } || {
        echo -e "${YELLOW}⚠ Cannot connect directly to database${NC}"
        echo "  This is normal if pooler is required"
    }
}

# Main command dispatcher
case "${1:-}" in
    "check")
        check_link
        check_status
        ;;
    "list")
        check_link
        list_migrations
        ;;
    "create")
        create_migration "$2"
        ;;
    "push")
        check_link
        push_migrations
        ;;
    "full")
        # Full workflow: check, create, push
        check_link
        create_migration "$2"
        echo -e "${YELLOW}Edit your migration file, then run:${NC}"
        echo "  $0 push"
        ;;
    *)
        echo "Safe Migration Script - Prevent IP Bans"
        echo ""
        echo "Usage:"
        echo "  $0 check              Check connection and link status"
        echo "  $0 list               List all migrations"
        echo "  $0 create <name>      Create new migration"
        echo "  $0 push               Push migrations to remote"
        echo "  $0 full <name>        Create migration (you still need to edit & push)"
        echo ""
        echo "Examples:"
        echo "  $0 check"
        echo "  $0 create add_customer_loyalty_points"
        echo "  # Edit the migration file"
        echo "  $0 push"
        exit 1
        ;;
esac
