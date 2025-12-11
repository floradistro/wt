import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://uaednwpxursknmwdeejn.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhZWRud3B4dXJza25td2RlZWpuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDk5NzIzMywiZXhwIjoyMDc2NTczMjMzfQ.l0NvBbS2JQWPObtWeVD2M2LD866A2tgLmModARYNnbI'
);

async function analyzeEmails() {
  console.log('Fetching all customers...\n');

  // Fetch ALL customers using pagination (Supabase has a 1000 row default limit)
  let allCustomers = [];
  let offset = 0;
  const batchSize = 1000;

  while (true) {
    const { data: batch, error } = await supabase
      .from('customers')
      .select('id, email, phone, first_name, last_name, is_active, total_spent, total_orders, created_at')
      .range(offset, offset + batchSize - 1);

    if (error) {
      console.error('Error fetching customers:', error.message);
      return;
    }

    if (!batch || batch.length === 0) break;

    allCustomers = allCustomers.concat(batch);
    console.log(`Fetched ${allCustomers.length} customers...`);

    if (batch.length < batchSize) break;
    offset += batchSize;
  }

  const customers = allCustomers;
  console.log(`\nTotal customers fetched: ${customers.length}\n`);

  // Categorize emails
  const categories = {
    noEmail: [],
    walkIn: [],
    alpineiq: [],
    phoneLocal: [],     // @phone.local - phone-only customers
    alpineLocal: [],    // @alpine.local - Alpine sync placeholders
    posLocal: [],       // @pos.local - POS walk-ins
    placeholder: [],
    suspicious: [],
    realEmails: []
  };

  // Patterns for placeholder/fake emails
  const placeholderPatterns = [
    /@walk-in\.local$/i,
    /@walkin\.local$/i,
    /^walkin/i,
    /alpineiq/i,
    /@alpine\.local$/i,       // Alpine placeholder emails
    /@phone\.local$/i,        // Phone-only customers (no real email)
    /@pos\.local$/i,          // POS walk-in customers
    /placeholder/i,
    /test@test/i,
    /fake@/i,
    /noemail/i,
    /none@/i,
    /na@/i,
    /n\/a@/i,
    /unknown@/i,
    /customer@/i,
    /guest@/i,
    /anonymous/i,
    /@example\.(com|org|net)$/i,
    /@test\.(com|org|net)$/i,
    /^no\.?email/i,
    /^notprovided/i,
    /dummy/i,
    /filler/i
  ];

  // Additional suspicious patterns (less certain)
  const suspiciousPatterns = [
    /^[a-z]{1,2}@/i,           // Very short local part like "a@gmail.com"
    /@deleted\./i,
    /\.deleted$/i,
    /^deleted_/i,
    /^temp/i
  ];

  for (const customer of customers) {
    const email = customer.email?.trim().toLowerCase();

    if (!email) {
      categories.noEmail.push(customer);
      continue;
    }

    // Check for walk-in emails
    if (/@walk-?in\.local$/i.test(email)) {
      categories.walkIn.push(customer);
      continue;
    }

    // Check for phone.local (phone-only customers)
    if (/@phone\.local$/i.test(email)) {
      categories.phoneLocal.push(customer);
      continue;
    }

    // Check for alpine.local (Alpine sync placeholders)
    if (/@alpine\.local$/i.test(email)) {
      categories.alpineLocal.push(customer);
      continue;
    }

    // Check for pos.local (POS walk-ins)
    if (/@pos\.local$/i.test(email)) {
      categories.posLocal.push(customer);
      continue;
    }

    // Check for alpineiq
    if (/alpineiq/i.test(email)) {
      categories.alpineiq.push(customer);
      continue;
    }

    // Check for other placeholder patterns
    let isPlaceholder = false;
    for (const pattern of placeholderPatterns) {
      if (pattern.test(email)) {
        categories.placeholder.push(customer);
        isPlaceholder = true;
        break;
      }
    }
    if (isPlaceholder) continue;

    // Check for suspicious patterns
    let isSuspicious = false;
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(email)) {
        categories.suspicious.push(customer);
        isSuspicious = true;
        break;
      }
    }
    if (isSuspicious) continue;

    // Otherwise, likely a real email
    categories.realEmails.push(customer);
  }

  // Print summary
  console.log('═'.repeat(60));
  console.log('          CUSTOMER EMAIL QUALITY ANALYSIS');
  console.log('═'.repeat(60));

  const total = customers.length;
  const activeCustomers = customers.filter(c => c.is_active !== false);

  console.log(`\n📊 TOTAL CUSTOMERS: ${total}`);
  console.log(`   Active: ${activeCustomers.length}`);
  console.log(`   Inactive/Deleted: ${total - activeCustomers.length}`);

  console.log('\n' + '─'.repeat(60));
  console.log('📧 EMAIL BREAKDOWN:');
  console.log('─'.repeat(60));

  const formatCount = (arr, label) => {
    const pct = ((arr.length / total) * 100).toFixed(1);
    return `${label.padEnd(25)} ${String(arr.length).padStart(6)}  (${pct}%)`;
  };

  console.log(`\n❌ PLACEHOLDER/FAKE EMAILS:`);
  console.log(`   ${formatCount(categories.noEmail, 'No email (null)')}`);
  console.log(`   ${formatCount(categories.walkIn, 'Walk-in (@walk-in.local)')}`);
  console.log(`   ${formatCount(categories.phoneLocal, 'Phone-only (@phone.local)')}`);
  console.log(`   ${formatCount(categories.alpineLocal, 'Alpine sync (@alpine.local)')}`);
  console.log(`   ${formatCount(categories.posLocal, 'POS walk-in (@pos.local)')}`);
  console.log(`   ${formatCount(categories.alpineiq, 'AlpineIQ placeholders')}`);
  console.log(`   ${formatCount(categories.placeholder, 'Other placeholders')}`);
  console.log(`   ${formatCount(categories.suspicious, 'Suspicious/deleted')}`);

  const totalFake = categories.noEmail.length + categories.walkIn.length +
                   categories.phoneLocal.length + categories.alpineLocal.length +
                   categories.posLocal.length + categories.alpineiq.length +
                   categories.placeholder.length + categories.suspicious.length;
  const fakePct = ((totalFake / total) * 100).toFixed(1);

  console.log(`\n   ${'TOTAL PLACEHOLDER/FAKE'.padEnd(25)} ${String(totalFake).padStart(6)}  (${fakePct}%)`);

  console.log(`\n✅ REAL EMAILS:`);
  console.log(`   ${formatCount(categories.realEmails, 'Valid customer emails')}`);
  const realPct = ((categories.realEmails.length / total) * 100).toFixed(1);

  console.log('\n' + '─'.repeat(60));
  console.log('📈 SUMMARY:');
  console.log('─'.repeat(60));
  console.log(`\n   Real, contactable emails:     ${categories.realEmails.length} (${realPct}%)`);
  console.log(`   Placeholder/fake/missing:     ${totalFake} (${fakePct}%)`);

  // Show some sample emails from each category
  console.log('\n' + '─'.repeat(60));
  console.log('🔍 SAMPLE EMAILS BY CATEGORY:');
  console.log('─'.repeat(60));

  const showSamples = (arr, label, limit = 10) => {
    if (arr.length === 0) return;
    console.log(`\n${label} (showing ${Math.min(limit, arr.length)} of ${arr.length}):`);
    for (const c of arr.slice(0, limit)) {
      const name = `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Unknown';
      console.log(`   ${c.email || '(no email)'} - ${name}`);
    }
  };

  showSamples(categories.phoneLocal, '📱 Phone-only (@phone.local)');
  showSamples(categories.alpineLocal, '🏔️  Alpine sync (@alpine.local)');
  showSamples(categories.walkIn, '🚶 Walk-in locals (@walk-in.local)');
  showSamples(categories.posLocal, '🏪 POS walk-ins (@pos.local)');
  showSamples(categories.alpineiq, '🏷️  AlpineIQ placeholders');
  showSamples(categories.placeholder, '📋 Other placeholders');
  showSamples(categories.suspicious, '⚠️  Suspicious/deleted');
  showSamples(categories.noEmail, '❌ No email at all');

  // Show domain breakdown for real emails
  console.log('\n' + '─'.repeat(60));
  console.log('📬 TOP EMAIL DOMAINS (Real Emails):');
  console.log('─'.repeat(60));

  const domains = {};
  for (const c of categories.realEmails) {
    const domain = c.email.split('@')[1];
    domains[domain] = (domains[domain] || 0) + 1;
  }

  const sortedDomains = Object.entries(domains)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);

  console.log();
  for (const [domain, count] of sortedDomains) {
    const pct = ((count / categories.realEmails.length) * 100).toFixed(1);
    console.log(`   ${domain.padEnd(30)} ${String(count).padStart(5)}  (${pct}%)`);
  }

  // Value analysis - are real email customers more valuable?
  console.log('\n' + '─'.repeat(60));
  console.log('💰 VALUE ANALYSIS:');
  console.log('─'.repeat(60));

  const calcStats = (arr) => {
    if (!arr || arr.length === 0) return { avgSpent: 0, avgOrders: 0, totalSpent: 0, totalOrders: 0, count: 0 };
    const totalSpent = arr.reduce((sum, c) => sum + (c.total_spent || 0), 0);
    const totalOrders = arr.reduce((sum, c) => sum + (c.total_orders || 0), 0);
    return {
      avgSpent: totalSpent / arr.length,
      avgOrders: totalOrders / arr.length,
      totalSpent,
      totalOrders,
      count: arr.length
    };
  };

  const realStats = calcStats(categories.realEmails);
  const phoneStats = calcStats(categories.phoneLocal);
  const alpineLocalStats = calcStats(categories.alpineLocal);
  const walkInStats = calcStats(categories.walkIn);
  const noEmailStats = calcStats(categories.noEmail);

  // Combine all placeholder stats
  const allPlaceholders = [
    ...categories.noEmail,
    ...categories.walkIn,
    ...categories.phoneLocal,
    ...categories.alpineLocal,
    ...categories.posLocal,
    ...categories.alpineiq,
    ...categories.placeholder,
    ...categories.suspicious
  ];
  const placeholderStats = calcStats(allPlaceholders);

  const formatStat = (label, stats) => {
    if (stats.count === 0) return null;
    return `   ${label.padEnd(26)} $${stats.avgSpent.toFixed(2).padStart(8)}    ${stats.avgOrders.toFixed(1).padStart(6)}       $${stats.totalSpent.toFixed(0)}`;
  };

  console.log('\n   Category                    Avg Spent    Avg Orders   Total Revenue');
  console.log('   ' + '─'.repeat(60));
  const lines = [
    formatStat('Real Emails', realStats),
    formatStat('Phone-only (@phone.local)', phoneStats),
    formatStat('Alpine sync (@alpine.local)', alpineLocalStats),
    formatStat('Walk-in Customers', walkInStats),
    formatStat('No Email', noEmailStats),
  ].filter(Boolean);
  lines.forEach(l => console.log(l));

  console.log('   ' + '─'.repeat(60));
  console.log(formatStat('ALL PLACEHOLDERS COMBINED', placeholderStats));

  console.log('\n' + '═'.repeat(60));
}

analyzeEmails().catch(console.error);
