import { Invoice } from '../types';

export type AuditStep = 'recall' | 'apply' | 'decide' | 'learn';

export interface AuditEntry {
  step: AuditStep;
  timestamp: string;
  details: string;
}

export interface EngineOutput {
  normalizedInvoice: any;
  proposedCorrections: string[];
  requiresHumanReview: boolean;
  reasoning: string;
  confidenceScore: number;
  memoryUpdates: string[];
  auditTrail: AuditEntry[];
}

export interface MemoryContext {
  vendorMemories: any[];
  correctionMemories: any[];
  // you can add resolution info later if needed
}
