import { pool } from './db';
import { readFileSync } from 'fs';
import * as path from 'path';
import { Invoice, HumanCorrection } from './types';

async function loadInvoices() {
  const filePath = path.join(__dirname, '..', 'data', 'invoices_extracted.json');
  const raw = readFileSync(filePath, 'utf-8');
  const invoices: Invoice[] = JSON.parse(raw);

  for (const inv of invoices) {
    await pool.query(
      'INSERT INTO invoices (invoice_id, vendor, data) VALUES ($1, $2, $3) ON CONFLICT (invoice_id) DO NOTHING',
      [inv.invoiceId, inv.vendor, JSON.stringify(inv)]
    );
  }
}

async function loadPurchaseOrders() {
  const filePath = path.join(__dirname, '..', 'data', 'purchase_orders.json');
  const raw = readFileSync(filePath, 'utf-8');
  const pos = JSON.parse(raw);

  for (const po of pos) {
    await pool.query(
      'INSERT INTO purchase_orders (po_number, vendor, data) VALUES ($1, $2, $3) ON CONFLICT (po_number) DO NOTHING',
      [po.poNumber, po.vendor, JSON.stringify(po)]
    );
  }
}

async function loadDeliveryNotes() {
  const filePath = path.join(__dirname, '..', 'data', 'delivery_notes.json');
  const raw = readFileSync(filePath, 'utf-8');
  const dns = JSON.parse(raw);

  for (const dn of dns) {
    await pool.query(
      'INSERT INTO delivery_notes (dn_number, vendor, data) VALUES ($1, $2, $3) ON CONFLICT (dn_number) DO NOTHING',
      [dn.dnNumber, dn.vendor, JSON.stringify(dn)]
    );
  }
}

async function loadHumanCorrections() {
  const filePath = path.join(__dirname, '..', 'data', 'human_corrections.json');
  const raw = readFileSync(filePath, 'utf-8');
  const corrections: HumanCorrection[] = JSON.parse(raw);
//   console.log(corrections);
  

  for (const hc of corrections) {
    await pool.query(
      'INSERT INTO human_corrections (invoice_id, vendor, corrections, final_decision) VALUES ($1, $2, $3, $4)',
      [hc.invoiceId, hc.vendor, JSON.stringify(hc.corrections), hc.finalDecision]
    );
  }
}

async function main() {
  await loadInvoices();
  await loadPurchaseOrders();
  await loadDeliveryNotes();
  await loadHumanCorrections();
  console.log('Sample data loaded.');
  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
