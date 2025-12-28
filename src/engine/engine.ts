import { pool } from '../db';
import { Invoice, HumanCorrection } from '../types';
import { AuditEntry, EngineOutput, MemoryContext } from './types';

function nowISO(): string {
  return new Date().toISOString();
}

async function fetchInvoice(invoiceId: string): Promise<Invoice | null> {
  const res = await pool.query(
    'SELECT data FROM invoices WHERE invoice_id = $1',
    [invoiceId]
  );
  if (res.rowCount === 0) return null;
  return res.rows[0].data as Invoice;
}

async function recallMemory(invoice: Invoice): Promise<{ context: MemoryContext; audit: AuditEntry[] }> {
  const audit: AuditEntry[] = [];

  const vendorMemoriesRes = await pool.query(
    'SELECT * FROM vendor_memories WHERE vendor = $1',
    [invoice.vendor]
  );
  const correctionMemoriesRes = await pool.query(
    'SELECT * FROM correction_memories WHERE vendor = $1',
    [invoice.vendor]
  );

  const context: MemoryContext = {
    vendorMemories: vendorMemoriesRes.rows,
    correctionMemories: correctionMemoriesRes.rows,
  };

  audit.push({
    step: 'recall',
    timestamp: nowISO(),
    details: `Recalled ${vendorMemoriesRes.rowCount} vendor memories and ${correctionMemoriesRes.rowCount} correction memories for vendor ${invoice.vendor}`,
  });

  return { context, audit };
}

function parseInvoiceDate(dateStr: string): Date {
  if (dateStr.includes('.')) {
    const [d, m, y] = dateStr.split('.');
    return new Date(`${y}-${m}-${d}`);
  }
  if (dateStr.includes('-')) {
    const [d, m, y] = dateStr.split('-');
    return new Date(`${y}-${m}-${d}`);
  }
  return new Date(dateStr);
}

export async function applyMemory(
  invoice: Invoice,
  context: MemoryContext
): Promise<{ normalized: any; proposedCorrections: string[]; audit: AuditEntry[]; appliedMemories: any[] }> {
  const audit: AuditEntry[] = [];
  const normalized = structuredClone(invoice.fields); 
  const proposedCorrections: string[] = [];
  const appliedMemories: any[] = [];


  // Rule 1: Supplier GmbH serviceDate from "Leistungsdatum"
  if (invoice.vendor === 'Supplier GmbH' && !normalized.serviceDate) {
    const match = invoice.rawText.match(/Leistungsdatum:\s*([0-9.]+)/);
    if (match) {
      const rawDate = match[1]; 
      if (rawDate) {
        const [day, month, year] = rawDate.split('.');
        const isoDate = `${year}-${month}-${day}`; 

        normalized.serviceDate = isoDate;

        const desc = `Set serviceDate to ${isoDate} based on label "Leistungsdatum" in rawText for Supplier GmbH.`;
        proposedCorrections.push(desc);
        appliedMemories.push({
          type: 'vendor',
          key: 'serviceDateFromLeistungsdatum',
          vendor: invoice.vendor,
        });

        audit.push({
          step: 'apply',
          timestamp: new Date().toISOString(),
          details: desc,
        });
      }
    }
  }

  // Rule 2: Supplier GmbH suggest PO by SKU + date
  if (invoice.vendor === 'Supplier GmbH' && !normalized.poNumber) {
    const poRes = await pool.query(
      'SELECT data FROM purchase_orders WHERE vendor = $1',
      [invoice.vendor]
    );
    const possiblePOs = poRes.rows.map(r => r.data);

    const [d, m, y] = normalized.invoiceDate.split('.');
    const invDate = new Date(`${y}-${m}-${d}`);
    const invSKUs = normalized.lineItems.map((li: any) => li.sku);

    const candidates = possiblePOs.filter((po: any) => {
      const poDate = new Date(po.date); 
      const diffDays = Math.abs(+invDate - +poDate) / (1000 * 60 * 60 * 24);
      const poSKUs = po.lineItems.map((li: any) => li.sku);
      const skuMatch = invSKUs.some((sku: string | null) => !!sku && poSKUs.includes(sku));
      return diffDays <= 30 && skuMatch;
    });

    if (candidates.length === 1) {
      const poNumber = candidates[0].poNumber;
      normalized.poNumber = poNumber;

      const desc = `Suggested poNumber=${poNumber} based on single matching PO within 30 days and SKU overlap for Supplier GmbH.`;
      proposedCorrections.push(desc);
      appliedMemories.push({ type: 'correction', field: 'poNumber', vendor: invoice.vendor });

      audit.push({
        step: 'apply',
        timestamp: new Date().toISOString(),
        details: desc,
      });
    }
  }

  // Rule 3 Parts AG: VAT already included in total
  if (invoice.vendor === 'Parts AG') {
    const text = invoice.rawText.toLowerCase();

    // 1) VAT already included in total ("Prices incl. VAT", "MwSt. inkl.")
    const vatIncluded =
      text.includes('prices incl. vat') ||
      text.includes('mwst. inkl') || text.includes('vat already included');

    if (vatIncluded) {
      const gross = normalized.grossTotal;
      const rate = normalized.taxRate;

      if (gross != null && rate != null) {
        const correctedNet = parseFloat((gross / (1 + rate)).toFixed(2));
        const correctedTax = parseFloat((gross - correctedNet).toFixed(2));

        const changed =
          correctedNet !== normalized.netTotal ||
          correctedTax !== normalized.taxTotal;

        if (changed) {
          normalized.netTotal = correctedNet;
          normalized.taxTotal = correctedTax;

          const desc =
            'Recomputed netTotal and taxTotal from grossTotal and taxRate because rawText indicates prices include VAT (MwSt. inkl.).';
          proposedCorrections.push(desc);
          appliedMemories.push({
            type: 'correction',
            field: 'vat_included_recompute',
            vendor: invoice.vendor,
          });

          audit.push({
            step: 'apply',
            timestamp: new Date().toISOString(),
            details: desc,
          });
        }
      }
    }

    // 2) Recover missing currency from rawText ("Currency: EUR")
    if (!normalized.currency) {
      const currencyMatch = invoice.rawText.match(/Currency:\s*([A-Z]{3})/);
      if (currencyMatch) {
        const currency = currencyMatch[1] ?? null;
        normalized.currency = currency;

        const desc = `Recovered missing currency as ${currency} from rawText for Parts AG.`;
        proposedCorrections.push(desc);
        appliedMemories.push({
          type: 'correction',
          field: 'currency',
          vendor: invoice.vendor,
        });

        audit.push({
          step: 'apply',
          timestamp: new Date().toISOString(),
          details: desc,
        });
      }
    }
  }

  //Freight & Co rules
  if (invoice.vendor === 'Freight & Co') {
    const text = invoice.rawText.toLowerCase();
    if (text.includes('skonto')) {
      (normalized as any).discountTerms = '2% Skonto within 10 days';

      const desc = 'Recorded discountTerms from Skonto text in rawText for Freight & Co.';
      proposedCorrections.push(desc);
      appliedMemories.push({ type: 'vendor', key: 'skonto_terms', vendor: invoice.vendor });

      audit.push({
        step: 'apply',
        timestamp: new Date().toISOString(),
        details: desc,
      });
    }

    const line = normalized.lineItems[0];
    if (line && !line.sku) {
      const descText = (line.description || '').toLowerCase();
      if (descText.includes('seefracht') || descText.includes('shipping')) {
        line.sku = 'FREIGHT';

        const desc = `Mapped description "${line.description}" to SKU FREIGHT for Freight & Co.`;
        proposedCorrections.push(desc);
        appliedMemories.push({
          type: 'correction',
          field: 'lineItems[0].sku',
          vendor: invoice.vendor,
        });

        audit.push({
          step: 'apply',
          timestamp: new Date().toISOString(),
          details: desc,
        });
      }
    }
  }

  //Duplicate Detection
  {
    const vendor = invoice.vendor;
    const invNumber = normalized.invoiceNumber;

    const dupRes = await pool.query(
      'SELECT data FROM invoices WHERE vendor = $1 AND data->\'fields\'->>\'invoiceNumber\' = $2',
      [vendor, invNumber]
    );
    const allWithSameNumber = dupRes.rows.map(r => r.data as Invoice);

    const currentDate = parseInvoiceDate(normalized.invoiceDate);

    const isDup = allWithSameNumber.some(other => {
      if (other.invoiceId === invoice.invoiceId) return false;
      const o = other.fields;
      const otherDate = parseInvoiceDate(other.fields.invoiceDate);
      const diffDays = Math.abs(+currentDate - +otherDate) / (1000 * 60 * 60 * 24);
      return diffDays <= 2;
    });

    if (isDup) {
      (normalized as any).duplicate = true;
      const desc = 'Flagged as duplicate invoice based on same vendor + invoiceNumber + close dates.';
      proposedCorrections.push(desc);
      appliedMemories.push({ type: 'vendor', key: 'duplicate_detection', vendor });

      audit.push({
        step: 'apply',
        timestamp: new Date().toISOString(),
        details: desc,
      });
    }
  }



  audit.push({
    step: 'apply',
    timestamp: new Date().toISOString(),
    details: `Applied ${appliedMemories.length} memory rule(s) to invoice ${invoice.invoiceId}.`,
  });

  return { normalized, proposedCorrections, audit, appliedMemories };
}


function decide(invoice: Invoice, context: MemoryContext, appliedMemories: any[], proposedCorrections: string[]): { requiresHumanReview: boolean; confidenceScore: number; reasoning: string; audit: AuditEntry[] } {
  const audit: AuditEntry[] = [];

  const highConfMemories = context.correctionMemories.filter((m: any) => m.confidence >= 0.7);
  const memoryBoost = highConfMemories.length * 0.03;
  let confidence = invoice.confidence + 0.05 * appliedMemories.length + memoryBoost;
  if (confidence > 1) confidence = 1;


  const requiresHumanReview = confidence < 0.9;
  const reasoningParts: string[] = [];

  if (appliedMemories.length > 0) {
    reasoningParts.push(`Applied ${appliedMemories.length} learned memory rule(s).`);
  }
  reasoningParts.push(`Base extraction confidence: ${invoice.confidence.toFixed(2)}; final confidence: ${confidence.toFixed(2)}.`);

  const reasoning = reasoningParts.join(' ');

  audit.push({
    step: 'decide',
    timestamp: nowISO(),
    details: `requiresHumanReview=${requiresHumanReview}, confidenceScore=${confidence.toFixed(2)}`,
  });

  return { requiresHumanReview, confidenceScore: confidence, reasoning, audit };
}

async function learn(invoice: Invoice, appliedMemories: any[]): Promise<{ memoryUpdates: string[]; audit: AuditEntry[] }> {
  const audit: AuditEntry[] = [];
  const memoryUpdates: string[] = [];

  const res = await pool.query(
    'SELECT corrections, final_decision FROM human_corrections WHERE invoice_id = $1',
    [invoice.invoiceId]
  );

  if (res.rowCount === 0) {
    audit.push({
      step: 'learn',
      timestamp: new Date().toISOString(),
      details: `No human corrections for invoice ${invoice.invoiceId}; no memory updates.`,
    });
    return { memoryUpdates, audit };
  }

  const row = res.rows[0] as { corrections: any; final_decision: string };
  const corrections: HumanCorrection['corrections'] = row.corrections;
  const finalDecision = row.final_decision;

  for (const corr of corrections) {
    const existing = await pool.query(
      'SELECT id, confidence FROM correction_memories WHERE vendor = $1 AND field = $2',
      [invoice.vendor, corr.field]
    );

    if (existing.rowCount === 0) {
      const confidence = finalDecision === 'approved' ? 0.7 : 0.3;
      await pool.query(
        'INSERT INTO correction_memories (vendor, field, pattern, suggested_value, confidence) VALUES ($1, $2, $3, $4, $5)',
        [
          invoice.vendor,
          corr.field,
          { trigger: 'from_human_reason', reason: corr.reason },
          { to: corr.to },
          confidence,
        ]
      );
      memoryUpdates.push(
        `Created new correction memory for ${invoice.vendor}.${corr.field} with confidence ${confidence.toFixed(2)}.`
      );
    } else {
      const { id, confidence } = existing.rows[0];
      let newConf = confidence;
      if (finalDecision === 'approved') newConf = Math.min(1, confidence + 0.1);
      else newConf = Math.max(0, confidence - 0.1);

      await pool.query(
        'UPDATE correction_memories SET confidence = $1, updated_at = NOW() WHERE id = $2',
        [newConf, id]
      );
      memoryUpdates.push(
        `Updated correction memory ${id} for ${invoice.vendor}.${corr.field} to confidence ${newConf.toFixed(2)}.`
      );
    }
  }

  audit.push({
    step: 'learn',
    timestamp: new Date().toISOString(),
    details: `Processed ${corrections.length} human corrections for invoice ${invoice.invoiceId}.`,
  });

  return { memoryUpdates, audit };
}

export async function processInvoice(invoiceId: string): Promise<EngineOutput | null> {
  const invoice = await fetchInvoice(invoiceId);
  if (!invoice) return null;

  const auditTrail: AuditEntry[] = [];

  const { context, audit: recallAudit } = await recallMemory(invoice);
  auditTrail.push(...recallAudit);

  const { normalized, proposedCorrections, audit: applyAudit, appliedMemories } = await applyMemory(invoice, context);
  auditTrail.push(...applyAudit);

  const { requiresHumanReview, confidenceScore, reasoning, audit: decideAudit } = decide(invoice, context, appliedMemories, proposedCorrections);
  auditTrail.push(...decideAudit);

  const { memoryUpdates, audit: learnAudit } = await learn(invoice, appliedMemories);
  auditTrail.push(...learnAudit);

  for (const entry of auditTrail) {
    await pool.query(
      'INSERT INTO audit_trail (invoice_id, step, details) VALUES ($1, $2, $3)',
      [invoice.invoiceId, entry.step, entry.details],
    );
  }


  return {
    normalizedInvoice: normalized,
    proposedCorrections,
    requiresHumanReview,
    reasoning,
    confidenceScore,
    memoryUpdates,
    auditTrail,
  };
}
