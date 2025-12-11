import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  "https://uaednwpxursknmwdeejn.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhZWRud3B4dXJza25td2RlZWpuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDk5NzIzMywiZXhwIjoyMDc2NTczMjMzfQ.l0NvBbS2JQWPObtWeVD2M2LD866A2tgLmModARYNnbI"
);

console.log("=== DEEP DATA INCONSISTENCY ANALYSIS ===\n");

const { data: allOrders } = await supabase
  .from("orders")
  .select("id, order_number, status, fulfillment_status, order_type, created_at, customers(first_name, last_name)")
  .order("created_at", { ascending: false });

// Find inconsistencies
const completed_but_unfulfilled = allOrders.filter(o =>
  o.status === "completed" && o.fulfillment_status === "unfulfilled"
);

const shipped_but_unfulfilled = allOrders.filter(o =>
  (o.status === "shipped" || o.status === "delivered") && o.fulfillment_status === "unfulfilled"
);

console.log("1. STATUS vs FULFILLMENT_STATUS MISMATCHES:");
console.log("   - Completed but fulfillment_status=unfulfilled:", completed_but_unfulfilled.length);
console.log("   - Shipped/Delivered but fulfillment_status=unfulfilled:", shipped_but_unfulfilled.length);

// Show some examples
console.log("\n   Examples of completed but unfulfilled:");
completed_but_unfulfilled.slice(0, 5).forEach(o => {
  const name = o.customers ? `${o.customers.first_name} ${o.customers.last_name || ""}`.trim() : "Guest";
  console.log(`     ${o.order_number} | ${name} | type=${o.order_type}`);
});

// Check today orders
const today = new Date();
today.setHours(0, 0, 0, 0);
const todayOrders = allOrders.filter(o => new Date(o.created_at) >= today);

console.log(`\n2. TODAY'S ORDERS (${todayOrders.length}):`);
todayOrders.forEach(o => {
  const name = o.customers ? `${o.customers.first_name} ${o.customers.last_name || ""}`.trim() : "Guest";
  const flag = (o.status === "completed" && o.fulfillment_status !== "fulfilled") ? " ⚠️ MISMATCH" : "";
  console.log(`   ${o.order_number} | ${name} | status=${o.status} | fulfillment=${o.fulfillment_status}${flag}`);
});

// Jones Hunter specifically
console.log("\n3. JONES HUNTER SEARCH:");
const jonesHunter = allOrders.filter(o => {
  const name = o.customers ? `${o.customers.first_name} ${o.customers.last_name || ""}`.toLowerCase() : "";
  return name === "jones hunter";
});

if (jonesHunter.length > 0) {
  console.log(`   Found ${jonesHunter.length} orders for "Jones Hunter":`);
  jonesHunter.forEach(o => {
    console.log(`\n   Order: ${o.order_number}`);
    console.log(`   ID: ${o.id}`);
    console.log(`   Status: ${o.status}`);
    console.log(`   Fulfillment: ${o.fulfillment_status}`);
    console.log(`   Type: ${o.order_type}`);
    console.log(`   Created: ${o.created_at}`);
  });
} else {
  console.log("   No exact 'Jones Hunter' found. Checking partial matches...");
  const partial = allOrders.filter(o => {
    const name = o.customers ? `${o.customers.first_name} ${o.customers.last_name || ""}`.toLowerCase() : "";
    return name.includes("jones hunter") || (name.includes("jones") && name.includes("hunter"));
  });
  partial.slice(0, 5).forEach(o => {
    const name = o.customers ? `${o.customers.first_name} ${o.customers.last_name || ""}`.trim() : "Guest";
    console.log(`   ${name} | ${o.order_number} | status=${o.status} | fulfillment=${o.fulfillment_status}`);
  });
}

// Check what's causing the display issue
console.log("\n4. FULFILLMENT BOARD LOGIC SIMULATION:");
console.log("   Orders appear in 'Done Today' if status is: completed, delivered, shipped, in_transit, cancelled");
console.log("   Orders appear in 'Action Needed' if status is NOT one of the above\n");

const fulfillmentOrders = todayOrders.filter(o => o.order_type === "pickup" || o.order_type === "shipping");
fulfillmentOrders.forEach(o => {
  const name = o.customers ? `${o.customers.first_name} ${o.customers.last_name || ""}`.trim() : "Guest";
  const isDone = ["completed", "delivered", "shipped", "in_transit", "cancelled"].includes(o.status);
  const section = isDone ? "Done Today" : "ACTION NEEDED";
  console.log(`   ${name} | ${o.order_number}`);
  console.log(`      status=${o.status} → Section: ${section}`);
  console.log(`      fulfillment_status=${o.fulfillment_status}`);
});

// Summary
console.log("\n=== SUMMARY ===");
console.log(`Total orders: ${allOrders.length}`);
console.log(`Orders with status/fulfillment mismatch: ${completed_but_unfulfilled.length + shipped_but_unfulfilled.length}`);
console.log(`This is ${((completed_but_unfulfilled.length / allOrders.length) * 100).toFixed(1)}% of all orders`);
