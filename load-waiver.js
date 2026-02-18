/**
 * Load waiver template from Waiver.md into the database
 *
 * Usage: node load-waiver.js
 *
 * You'll need your Supabase credentials:
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY (or anon key)
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Read the waiver content
const waiverPath = path.join(__dirname, 'Waiver.md');
const waiverContent = fs.readFileSync(waiverPath, 'utf-8');

console.log('✓ Loaded waiver content from Waiver.md');
console.log(`  Length: ${waiverContent.length} characters\n`);

// Prompt for Supabase credentials
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function main() {
  console.log('Enter your Supabase credentials:');
  console.log('(You can find these in your Supabase project settings)\n');

  const supabaseUrl = await question('Supabase URL (https://xxx.supabase.co): ');
  const supabaseKey = await question('Supabase Service Role Key (or anon key): ');
  const orgId = await question('Organization ID (UUID from orgs table): ');

  rl.close();

  console.log('\nConnecting to Supabase...');

  // Use fetch to update the database
  const url = `${supabaseUrl}/rest/v1/orgs?id=eq.${orgId}`;

  try {
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        waiver_template: waiverContent
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HTTP ${response.status}: ${error}`);
    }

    const data = await response.json();

    if (data.length === 0) {
      throw new Error('No organization found with that ID. Please check the org_id.');
    }

    console.log('\n✓ Successfully loaded waiver template into database!');
    console.log(`  Organization: ${data[0].name}`);
    console.log('\nYou can now edit the waiver in Settings → Waiver Template section');

  } catch (error) {
    console.error('\n✗ Error:', error.message);
    console.log('\nTroubleshooting:');
    console.log('1. Make sure your Supabase URL is correct');
    console.log('2. Use the Service Role Key (not anon key) for write access');
    console.log('3. Verify the organization ID exists in your orgs table');
    process.exit(1);
  }
}

main();
