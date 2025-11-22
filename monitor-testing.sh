#!/bin/bash
# Real-time monitoring script for iPad testing
# Run this while user performs tests on iPad

set -e

# Load environment
source .env

DB_HOST="db.zwcwrwctomlnvyswovhb.supabase.co"
DB_PORT="5432"
DB_USER="postgres"
DB_NAME="postgres"

echo "🔍 Monitoring DEV Database: ${DB_HOST}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Function to run query
query() {
    PGPASSWORD="${SUPABASE_DB_PASSWORD}" psql \
        -h ${DB_HOST} \
        -p ${DB_PORT} \
        -U ${DB_USER} \
        -d ${DB_NAME} \
        -c "$1"
}

# Main monitoring loop
while true; do
    clear
    echo "🔍 ATOMIC OPERATIONS MONITOR - $(date '+%H:%M:%S')"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""

    # Recent Inventory Adjustments
    echo "📦 RECENT INVENTORY ADJUSTMENTS (Last 5):"
    query "
    SELECT
        id,
        LEFT(product_id::TEXT, 8) || '...' as product,
        adjustment_type,
        quantity_change,
        quantity_after,
        reason,
        to_char(created_at, 'HH24:MI:SS') as time
    FROM inventory_adjustments
    ORDER BY created_at DESC
    LIMIT 5;
    " 2>/dev/null || echo "❌ Error fetching adjustments"

    echo ""

    # Recent Purchase Orders
    echo "📋 RECENT PURCHASE ORDERS (Last 5):"
    query "
    SELECT
        po_number,
        po_type,
        status,
        total_amount,
        to_char(created_at, 'HH24:MI:SS') as time,
        CASE WHEN idempotency_key IS NOT NULL THEN '✅' ELSE '❌' END as has_idem_key
    FROM purchase_orders
    ORDER BY created_at DESC
    LIMIT 5;
    " 2>/dev/null || echo "❌ Error fetching POs"

    echo ""

    # Active Inventory Holds
    echo "🔒 ACTIVE INVENTORY HOLDS:"
    query "
    SELECT
        LEFT(order_id::TEXT, 8) || '...' as order,
        LEFT(product_id::TEXT, 8) || '...' as product,
        quantity,
        to_char(expires_at, 'HH24:MI:SS') as expires,
        CASE
            WHEN expires_at > NOW() THEN '✅ Active'
            ELSE '⏰ Expired'
        END as status
    FROM inventory_holds
    WHERE released_at IS NULL
    ORDER BY created_at DESC
    LIMIT 5;
    " 2>/dev/null || echo "✅ No active holds"

    echo ""

    # Recent Orders
    echo "🛒 RECENT ORDERS (Last 5):"
    query "
    SELECT
        order_number,
        status,
        payment_status,
        payment_method,
        total_amount,
        to_char(created_at, 'HH24:MI:SS') as time
    FROM orders
    ORDER BY created_at DESC
    LIMIT 5;
    " 2>/dev/null || echo "❌ Error fetching orders"

    echo ""

    # Product Audit Trail
    echo "📝 RECENT PRODUCT CHANGES (Last 5):"
    query "
    SELECT
        change_type,
        field_name,
        old_value::TEXT as old_val,
        new_value::TEXT as new_val,
        to_char(changed_at, 'HH24:MI:SS') as time
    FROM product_audit
    ORDER BY changed_at DESC
    LIMIT 5;
    " 2>/dev/null || echo "✅ No recent changes"

    echo ""

    # Reconciliation Queue Status
    echo "🔄 RECONCILIATION QUEUES:"
    query "
    SELECT
        'Inventory' as queue,
        COUNT(*) as unresolved
    FROM inventory_reconciliation_queue
    WHERE resolved = FALSE
    UNION ALL
    SELECT
        'Adjustments' as queue,
        COUNT(*) as unresolved
    FROM adjustment_reconciliation_queue
    WHERE resolved = FALSE
    UNION ALL
    SELECT
        'Purchase Orders' as queue,
        COUNT(*) as unresolved
    FROM po_reconciliation_queue
    WHERE resolved = FALSE;
    " 2>/dev/null || echo "❌ Error checking queues"

    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Press Ctrl+C to stop monitoring | Refreshing every 3 seconds..."

    sleep 3
done
