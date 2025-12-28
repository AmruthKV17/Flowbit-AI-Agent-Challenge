export interface InvoiceFields {
  invoiceNumber: string;
  invoiceDate: string;
  serviceDate: string | null;
  currency: string | null;
  poNumber?: string | null;
  netTotal: number;
  taxRate: number;
  taxTotal: number;
  grossTotal: number;
  lineItems: Array<{
    sku: string | null;
    description?: string | null;
    qty: number;
    unitPrice: number;
  }>;
}

export interface Invoice {
  invoiceId: string;
  vendor: string;
  fields: InvoiceFields;
  confidence: number;
  rawText: string;
}

export interface HumanCorrection {
  invoiceId: string;
  vendor: string;
  corrections: Array<{
    field: string;
    from: any;
    to: any;
    reason: string;
  }>;
  finalDecision: 'approved' | 'rejected';
}
