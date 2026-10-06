# LifeLedger — Microsoft Household Budget Benchmark

Status: BENCHMARK RECORDED
Date: 2026-10-06

## Benchmark source

Microsoft Support, “Manage your household budget in Excel” — current guidance for Excel for Microsoft 365 and Excel for Microsoft 365 for Mac.

https://support.microsoft.com/en-us/excel/manage-your-household-budget-in-excel

Microsoft describes a household budget as a way to summarize what is earned against what is spent, plan for short- and long-term goals, track monthly income and expenses, compare projected costs with actual costs, and categorize fixed, variable and discretionary spending. It also calls out extras such as subscriptions and the need to monitor variable expenses.

## Security benchmark

Microsoft Support, “Protection and security in Excel”.

https://support.microsoft.com/en-us/excel/protection-and-security-in-excel

https://support.microsoft.com/en-au/excel/get-started/protect-an-excel-file

Microsoft distinguishes file-level encryption from workbook/worksheet protection. Worksheet protection is not intended as a security feature. Excel supports file-level password encryption for preventing unauthorized opening of a protected file.

## LifeLedger comparison

| Capability | Microsoft / Excel benchmark | LifeLedger 1.5 direction | Assessment |
|---|---|---|---|
| Household income vs spending | Core household-budget purpose | Core Dashboard / Grid / Plan model | MATCH |
| Monthly budget | Explicit monthly budget tracking | Budgets + Annual Grid | MATCH |
| Projected vs actual | Explicitly recommended | Budget vs actual + projects | MATCH / EXTENDED |
| Fixed expenses | Explicit category concept | Obligations + recurring expenses | MATCH |
| Variable expenses | Explicit category concept | Essentials + variable categories + cadence | EXTENDED |
| Discretionary expenses | Explicit category concept | Lifestyle / occasions categories | MATCH |
| Subscriptions / extras | Explicitly called out | Subscription category + recurring income | MATCH |
| Savings / goals | Short- and long-term goals | Savings category + projects + Plan | EXTENDED |
| Home/remodel budgeting | Supported by Excel templates/workflows | Projects with line items and actuals | EXTENDED |
| Household contributors | Spreadsheet can represent contributors manually | Named household members + attribution + split chart | EXTENDED |
| Irregular income | Can be entered as income | Income subtypes distinguish arrears, overtime, dividends, asset sales, benefits, rent and remittances | EXTENDED |
| Non-monthly fixed costs | Monthly tracking is recommended | Cadence detection prevents false monthly overage alerts | EXTENDED |
| Year-over-year review | Spreadsheet analysis is possible | Built-in comparison | EXTENDED |
| Data-health / coverage disclosure | Manual in a spreadsheet | Built-in integrity score and coverage disclosure | EXTENDED |
| Local account | Not inherent to ordinary spreadsheet use | Local account + Guest mode | LIFELEDGER SECURITY LAYER |
| Protected view | Not inherently provided by a workbook view | Protected/Restricted presentation layer | LIFELEDGER SECURITY LAYER |
| Admin step-up | Password/file protection provides stronger access, but not this exact UI pattern | Separate Admin key for private data | LIFELEDGER SECURITY LAYER |
| File-level encryption | Excel supports Encrypt with Password | LifeLedger currently encrypts Restricted private-record envelope, not the entire normal ledger | GAP / WORK IN PROGRESS |
| Encrypted backup | Excel can preserve encrypted workbook files | Encrypted LifeLedger backup still required | GAP / NEXT |

## Acceptance principle

LifeLedger should not claim superiority merely because it has more features. The benchmark is satisfied only when:

1. the ordinary budgeting mental model remains understandable to a household user;
2. the major Microsoft budgeting workflows can be completed without forcing users into bespoke project logic;
3. added analytics do not silently alter the underlying financial meaning;
4. stronger privacy layers are additive and understandable rather than mandatory for every ordinary action;
5. security claims are limited to protections that are actually implemented and independently tested.

## Current gap register

### G1 — whole-ledger at-rest protection

The current 1.5 foundation protects the new Restricted private-record envelope. The existing ordinary ledger remains local application state and is not yet converted into a password-encrypted whole-ledger file/envelope.

### G2 — encrypted backup

Plain JSON/CSV remains available for interoperability. A first-class encrypted backup/restore workflow is still required.

### G3 — account recovery

The local model intentionally has no cloud account recovery. A user-facing recovery/export strategy must be defined before broad release.

### G4 — richer account roles

The data model supports profiles, but the current UI establishes one primary local user plus Guest/Admin step-up. Multiple household login profiles and per-user permissions remain future work.

## Validation requirement

Every future release should be checked against this benchmark plus the independent household scenario suite. Passing internal regression tests alone is not sufficient evidence of product readiness.
