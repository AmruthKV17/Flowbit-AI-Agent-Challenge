# 🧠 Invoice Memory Engine

> **A self-learning automation layer that gets smarter with every invoice.**

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=nodedotjs&logoColor=white)](https://nodejs.org/)

---

## 📖 Overview

The **Invoice Memory Engine** wraps standard invoice extraction pipelines with a cognitive layer. Instead of treating every document as a blank slate, this engine implements a **four-stage memory cycle** to persist human corrections and vendor-specific patterns.

The system moves beyond simple rules by implementing a dynamic feedback loop:
`Recall` ➔ `Apply` ➔ `Decide` ➔ `Learn`

---

## 🏗 Core Data Model

The architecture relies on a robust relational model to bridge raw data with learned intelligence.

| Component | Description |
| :--- | :--- |
| **📄 Invoices** | Extracted headers, line items, vendor details, and raw OCR text. |
| **📦 Purchase Orders** | PO numbers, dates, and line items for validation and matching. |
| **🚚 Delivery Notes** | Supporting documents to triangulate SKUs and quantities. |
| **✍️ Human Corrections** | The "Ground Truth"—actual fixes applied by humans. |
| **🧠 Vendor Memories** | High-level rules (VAT behavior, payment terms) linked to specific vendors. |
| **🎯 Correction Memories** | Granular field patterns (e.g., *"Map 'Leistungsdatum' to ServiceDate"*). |
| **📊 Resolution Memories** | Reliability tracking (approvals vs. rejections) to adjust confidence. |
| **📜 Audit Trail** | A complete, append-only log of the engine's cognitive process. |

---

## 🔄 The Memory Workflow

For every invoice, the engine executes a deterministic cognitive cycle:

### 1. 🧠 Recall
*Fetch context.*
The system queries the `vendor_memories` and `correction_memories` tables, retrieving rules relevant to the specific Vendor ID and invoice context (raw text keywords, related POs).

### 2. ⚙️ Apply
*Execute heuristics.*
Memories are applied to the raw data to generate a **Normalized Invoice**:
*   **Field Mapping:** Translates raw labels (e.g., *"Leistungsdatum"*) into standard schema fields.
*   **Financial Math:** Reconstructs VAT/Net/Gross amounts and infers currency symbols.
*   **Smart Matching:** Links Invoices to POs using fuzzy SKU matching and date proximity.
*   **Term Extraction:** Identifies *"Skonto"* (discounts) and standardizes freight line items.
*   **Safety Check:** Instantly flags potential duplicates.

### 3. ⚖️ Decide
*Evaluate confidence.*
The engine calculates a `confidenceScore` and determines if human intervention is needed (`requiresHumanReview`).
*   **Baseline:** Starts with OCR extractor confidence.
*   **Boost:** +Points for every successfully applied memory.
*   **Verdict:** If confidence is high and no conflicts exist ➔ **Auto-Approve**.

### 4. 🎓 Learn
*Close the loop.*
Post-processing, the engine compares its prediction against the **Human Correction**.
*   ✅ **Success:** Reinforce the memory (Increment confidence).
*   ❌ **Failure:** Correct the memory.

---

## 🧠 Decision Logic

The "Brain" of the operation balances automation with safety using a weighted scoring system:

Final Confidence = Base Confidence + Memory Boosts
                 = invoice.confidence + (appliedRules × 0.05) + (highConfMemories × 0.03)
                 
Decision:
  IF confidence ≥ 0.9 → AUTO-APPROVE (no human review)
  IF confidence < 0.9 → FLAG FOR REVIEW (ask human)
  
---

## 🚀 Demonstrated Behavior

The system proves its value through a distinct "Training vs. Inference" evolution.

### Phase 1: Training (Seeding) 🌱
*   **Input:** Initial batch of raw invoices.
*   **Action:** Human operators provide corrections (e.g., mapping dates, fixing VAT).
*   **Result:** The engine "seeds" its memory banks, learning that *Supplier GmbH* puts dates in the footer and *Parts AG* always includes VAT.

### Phase 2: Automation (Harvesting) ⚡
*   **Input:** New invoices from the same vendors.
*   **Action:** The engine runs **Recall**.
*   **Result:**
    *   Service dates are auto-filled.
    *   POs are automatically linked.
    *   Confidence scores skyrocket.
    *   **Human Review is skipped.**

---

## ⚡ Quick Start

### 1. Installation

npm install


### 2. Configuration
Ensure your PostgreSQL database is running and the connection requirement details is set in your `.env` file.

### 3. Seed Data
Load the sample dataset (invoices, POs, and corrections).

npm run load_data


### 4. Run
Watch the engine learn and improve in real-time.

npx ts-node src/demo.ts


