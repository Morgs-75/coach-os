#!/usr/bin/env tsx
// AFCD Release 3 download: https://www.foodstandards.gov.au/science-data/monitoringnutrients/ausnut/fooddetails
// Usage: npx tsx scripts/seed-afcd.ts <path-to-AFCD-Release3.xlsx>
//        OR: npm run seed-afcd -- <path-to-AFCD-Release3.xlsx>
//
// Required env vars in .env.local:
//   SUPABASE_URL=https://ntqdmgvxirswnjlnwopq.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY=<service role key, not anon key>

import { config } from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import ExcelJS from 'exceljs';
import { createClient } from '@supabase/supabase-js';

// Load .env.local from the apps/trainer-web directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, '..', '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BATCH_SIZE = 500;

interface FoodItemRow {
  afcd_food_id: string | null;
  food_name: string;
  food_group: string | null;
  energy_kcal: number | null;
  protein_g: number | null;
  fat_g: number | null;
  carb_g: number | null;
  fibre_g: number | null;
}

/**
 * Parse a cell value to a float, treating empty/N/dash as null.
 */
function parseNumeric(value: ExcelJS.CellValue): number | null {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  if (str === '' || str === 'N' || str === '-' || str === '\u2013' || str === '\u2014') return null;
  const n = parseFloat(str);
  return isNaN(n) ? null : n;
}

/**
 * Parse a cell value to a string, returning null if empty.
 */
function parseString(value: ExcelJS.CellValue): string | null {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  return str === '' ? null : str;
}

/**
 * Find a column index (1-based) from the header row by partial case-insensitive match.
 * Returns -1 if not found.
 */
function findColumn(
  headerRow: ExcelJS.Row,
  patterns: string[],
  excludePatterns: string[] = []
): number {
  let colIndex = -1;
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const cellText = String(cell.value || '').toLowerCase();
    const matches = patterns.some((p) => cellText.includes(p.toLowerCase()));
    const excluded = excludePatterns.some((p) => cellText.includes(p.toLowerCase()));
    if (matches && !excluded && colIndex === -1) {
      colIndex = colNumber;
    }
  });
  return colIndex;
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Usage: npx tsx scripts/seed-afcd.ts <path-to-AFCD.xlsx>');
    console.error('');
    console.error('Download AFCD Release 3 from:');
    console.error('  https://www.foodstandards.gov.au/science-data/monitoringnutrients/ausnut/fooddetails');
    process.exit(1);
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing required environment variables.');
    console.error('Add these to apps/trainer-web/.env.local:');
    console.error('  SUPABASE_URL=https://ntqdmgvxirswnjlnwopq.supabase.co');
    console.error('  SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>');
    process.exit(1);
  }

  console.log('Connecting to Supabase:', SUPABASE_URL);
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // Clear existing food items before re-seeding to avoid stale data from previous runs
  console.log('Clearing existing food_items...');
  const { error: deleteError } = await supabase.from('food_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (deleteError) { console.error('Failed to clear food_items:', deleteError.message); process.exit(1); }
  console.log('Cleared.');

  console.log('Loading Excel file:', filePath);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  // Find the right worksheet — supports AUSNUT 2023, AFCD R3, and legacy formats
  let worksheet: ExcelJS.Worksheet | undefined;
  const targetSheetPatterns = [
    'food nutrient profile',
    'nutrient profile',
    'food details',
    'food detail',
    'all solids',
    'per 100g',
    'solids & liquids',
    'solids and liquids',
  ];

  workbook.eachSheet((sheet) => {
    if (!worksheet) {
      const name = sheet.name.toLowerCase();
      if (targetSheetPatterns.some((p) => name.includes(p))) {
        worksheet = sheet;
      }
    }
  });

  // Fall back to first sheet
  if (!worksheet) {
    worksheet = workbook.worksheets[0];
    console.log(`No target sheet found by name — using first sheet: "${worksheet.name}"`);
  } else {
    console.log(`Using worksheet: "${worksheet.name}"`);
  }

  // Detect header row — scan first 5 rows for "food name" column
  let headerRowNumber = 1;
  for (let r = 1; r <= 5; r++) {
    const candidate = worksheet.getRow(r);
    let found = false;
    candidate.eachCell({ includeEmpty: false }, (cell) => {
      if (String(cell.value || '').toLowerCase().includes('food name')) found = true;
    });
    if (found) { headerRowNumber = r; break; }
  }
  console.log(`Header row detected at row ${headerRowNumber}`);
  const headerRow = worksheet.getRow(headerRowNumber);

  // Detect column positions
  const colFoodId = findColumn(headerRow, ['public food key', 'food id', 'public_food_key']);
  const colFoodName = findColumn(headerRow, ['food name', 'food_name']);
  const colFoodGroup = findColumn(headerRow, ['classification', 'food group', 'food_group', 'category']);

  // Energy: prefer "with dietary fibre (kcal)", fall back to "without dietary fibre (kcal)"
  // AFCD uses kJ by default; kcal columns are separate
  let colEnergyKcal = findColumn(headerRow, ['energy with dietary fibre', 'energy, with dietary fibre'], ['kj']);
  if (colEnergyKcal === -1) {
    colEnergyKcal = findColumn(headerRow, ['energy without dietary fibre', 'energy, without dietary fibre'], ['kj']);
  }
  if (colEnergyKcal === -1) {
    // Try any kcal/kilocalorie column
    colEnergyKcal = findColumn(headerRow, ['kcal', 'kilocalorie', 'energy (kcal)']);
  }
  // If still not found, try kJ and convert (1 kcal = 4.184 kJ)
  let convertKjToKcal = false;
  if (colEnergyKcal === -1) {
    colEnergyKcal = findColumn(headerRow, ['energy with dietary fibre', 'energy, with dietary fibre', 'energy (kj)', 'energy_kj'], []);
    if (colEnergyKcal !== -1) {
      convertKjToKcal = true;
      console.log('No kcal column found — will convert kJ to kcal (÷ 4.184)');
    }
  }

  const colProtein = findColumn(headerRow, ['protein']);
  const colFat = findColumn(headerRow, ['fat, total', 'total fat', 'fat_total', 'fat (total)'], ['saturated', 'trans', 'mono', 'poly']);
  if (colFat === -1) {
    // Broader search if specific "total" not found
  }
  // Prefer "without sugar alcohols" over "with sugar alcohols" (AUSNUT 2023)
  let colCarb = findColumn(headerRow, ['carbohydrate'], ['fructose', 'glucose', 'sucrose', 'lactose', 'maltose', 'starch', 'sugars', 'fibre', 'with sugar alcohol']);
  if (colCarb === -1) {
    colCarb = findColumn(headerRow, ['carbohydrate'], ['fructose', 'glucose', 'sucrose', 'lactose', 'maltose', 'starch', 'sugars', 'fibre']);
  }
  const colFibre = findColumn(headerRow, ['dietary fibre', 'fibre, total', 'fiber, total', 'total dietary fibre', 'fibre_total'], ['energy']);

  console.log('\nColumn mapping:');
  console.log(`  Food ID:     col ${colFoodId}`);
  console.log(`  Food Name:   col ${colFoodName}`);
  console.log(`  Food Group:  col ${colFoodGroup}`);
  console.log(`  Energy kcal: col ${colEnergyKcal}${convertKjToKcal ? ' (converting from kJ)' : ''}`);
  console.log(`  Protein:     col ${colProtein}`);
  console.log(`  Fat:         col ${colFat}`);
  console.log(`  Carb:        col ${colCarb}`);
  console.log(`  Fibre:       col ${colFibre}`);

  if (colFoodName === -1) {
    console.error('\nCould not detect Food Name column. Printing header row for debugging:');
    headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      console.error(`  Col ${colNumber}: "${cell.value}"`);
    });
    process.exit(1);
  }

  // Process rows
  const rows: FoodItemRow[] = [];
  let skippedRows = 0;

  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber <= headerRowNumber) return; // skip title rows + header

    const foodName = parseString(row.getCell(colFoodName).value);
    if (!foodName) {
      skippedRows++;
      return;
    }

    let energyRaw = colEnergyKcal !== -1 ? parseNumeric(row.getCell(colEnergyKcal).value) : null;
    if (energyRaw !== null && convertKjToKcal) {
      energyRaw = Math.round((energyRaw / 4.184) * 100) / 100;
    }

    rows.push({
      afcd_food_id: colFoodId !== -1 ? parseString(row.getCell(colFoodId).value) : null,
      food_name: foodName,
      food_group: colFoodGroup !== -1 ? parseString(row.getCell(colFoodGroup).value) : null,
      energy_kcal: energyRaw,
      protein_g: colProtein !== -1 ? parseNumeric(row.getCell(colProtein).value) : null,
      fat_g: colFat !== -1 ? parseNumeric(row.getCell(colFat).value) : null,
      carb_g: colCarb !== -1 ? parseNumeric(row.getCell(colCarb).value) : null,
      fibre_g: colFibre !== -1 ? parseNumeric(row.getCell(colFibre).value) : null,
    });
  });

  console.log(`\nParsed ${rows.length} food rows (skipped ${skippedRows} empty rows)`);

  if (rows.length === 0) {
    console.error('No rows found — check column detection above and verify the correct worksheet is being read.');
    process.exit(1);
  }

  // Sample the first 3 rows for sanity check
  console.log('\nSample rows (first 3):');
  rows.slice(0, 3).forEach((r, i) => {
    console.log(`  [${i + 1}] ${r.food_name} | group: ${r.food_group} | kcal: ${r.energy_kcal} | P: ${r.protein_g}g F: ${r.fat_g}g C: ${r.carb_g}g`);
  });

  // Batch upsert
  const totalBatches = Math.ceil(rows.length / BATCH_SIZE);
  let totalUpserted = 0;

  console.log(`\nUpserting ${rows.length} rows in ${totalBatches} batches of ${BATCH_SIZE}...`);

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1;

    const { error } = await supabase
      .from('food_items')
      .upsert(batch, { onConflict: 'afcd_food_id' });

    if (error) {
      console.error(`\nBatch ${batchNumber}/${totalBatches} FAILED:`, error.message);
      console.error('First row in failed batch:', JSON.stringify(batch[0], null, 2));
      process.exit(1);
    }

    totalUpserted += batch.length;
    console.log(`  Batch ${batchNumber}/${totalBatches} inserted (${batch.length} rows)`);
  }

  // Final count in DB
  const { count, error: countError } = await supabase
    .from('food_items')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    console.error('\nWarning: Could not fetch final count:', countError.message);
  }

  console.log('\n--- Seed complete ---');
  console.log(`  Rows processed from Excel:  ${totalUpserted}`);
  console.log(`  Total rows in food_items:   ${count ?? 'unknown'}`);
  console.log('\nRe-running this script is safe — upsert on afcd_food_id prevents duplicates.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
