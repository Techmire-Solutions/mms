# Accounting policy applicability — reviewed 2026-09-24

Framework-neutral, **advisory** design guidance. The sources below establish their own scope; they do not make MMS compliant or apply every framework to a madrasa. Recheck official amendments, local endorsement, entity eligibility, reporting-period start date, and early adoption before a framework-specific implementation.

## Policy decisions to record

| Decision | Consequence for implementation |
|---|---|
| Entity and jurisdiction | Applicable regulator, charity/company rules, tax and e-invoicing obligations, retention and legal holds. No universal retention duration or tax rate. |
| Framework/version and adoption date | Recognition, measurement, statement names, disclosures, transition and comparatives. Do not mix full IFRS and IFRS for SMEs selectively. |
| Cash/accrual basis | Invoice date, collection date, service period, and recognition date may differ. Keep the chosen basis explicit in reports. |
| Functional currency and precision | Currency scales, rounding, FX source/date, remeasurement, realized/unrealized gains, and presentation translation. |
| Nonprofit fund conditions | Donor restriction, refund/performance obligations, endowment principal, release/transfer evidence, and permitted spending. |
| Approval and materiality policy | Review roles, delegated limits, override evidence, correction/restatement route; materiality is not permission to accept unbalanced books. |

## Conditional recognition guidance

- **Fees and services:** under an applicable accrual model, consider what service was earned in the reporting period; cash received in advance may be a liability. Scholarships, discounts, refunds, arrears, bad debts, and fee waivers need explicit policies and source links. IFRS 15's customer-contract model depends on satisfied performance obligations; it is not automatically the model for donations. [IFRS 15](https://www.ifrs.org/issued-standards/list-of-standards/ifrs-15-revenue-from-contracts-with-customers/)
- **Expenses and assets:** distinguish purchases, settlement, accruals, prepayments, inventory, and capital assets. Where relevant, record capitalization threshold, useful life/depreciation, impairment, disposal, payroll deductions, and withholding under the adopted framework. Obtain policy rather than deriving recognition from a bank-feed category.
- **Restricted donations/grants:** separate donor restrictions from internal designations and from conditions that create a present refund/performance obligation. Restrictions alone do not universally imply deferred income. Model fund/project/grant dimensions, eligible costs, releases, transfers, and allocation evidence when in scope. Prevent restricted funds being spent as unrestricted cash merely because they share a bank account. CC8 is an England-and-Wales controls reference, not a global recognition standard. [Charity Commission CC8](https://www.gov.uk/government/publications/internal-financial-controls-for-charities-cc8/internal-financial-controls-for-charities)
- **Zakat, sadaqah, and waqf:** record the governing instrument, donor terms, ownership/agency arrangement, beneficiary criteria, and approved religious/accounting policy. Preserve waqf corpus versus distributable returns and fund restrictions where applicable. Do not invent a universal zakat rate, eligibility rule, or automatic classification from a transaction label. AAOIFI lists FAS 37 for waqf institutions and FAS 39 for zakah; use only where the entity has adopted or is required to apply them. [AAOIFI standards](https://aaoifi.com/accounting-standards-2/?lang=en)
- **Foreign currencies:** identify functional currency and retain transaction amount/currency, rate source/date, and functional amount. Handle monetary balances, settlement differences, and presentation translation according to the adopted framework. Lack of exchangeability requires explicit policy; a missing rate must not become zero or silently reuse today's rate. [IAS 21](https://www.ifrs.org/issued-standards/list-of-standards/ias-21-the-effects-of-changes-in-foreign-exchange-rates/)
- **Errors and estimates:** preserve original journals and traceable corrections, but determine whether a comparative restatement or prospective estimate change is required separately. Do not let a software period lock substitute for the accountant's reporting decision. [IAS 8](https://www.ifrs.org/issued-standards/list-of-standards/ias-8-basis-of-preparation-of-financial-statements/)

## 2026 versus future-effective changes

| Source | Verified position | Use in MMS |
|---|---|---|
| [IFRS 18](https://www.ifrs.org/issued-standards/list-of-standards/ifrs-18-presentation-and-disclosure-in-financial-statements/) | Replaces IAS 1; effective for annual periods beginning on/after 2027-01-01; earlier application permitted. | In 2026, assess adoption and comparative transition. Plan versioned presentation mappings, subtotals, aggregation/disaggregation, and applicable management-defined performance measure disclosures; do not label every 2026 statement IFRS 18-compliant. |
| [Third-edition IFRS for SMEs](https://www.ifrs.org/issued-standards/ifrs-for-smes/) | Issued February 2025; effective for periods beginning on/after 2027-01-01; early adoption permitted. | Confirm entity eligibility and jurisdiction. Keep the applicable edition explicit; the revised revenue model is not automatically mandatory in 2026. |
| [IAS 7](https://www.ifrs.org/issued-standards/list-of-standards/ias-7-statement-of-cash-flows/) | Separates operating/investing/financing cash flows and excludes noncash investing/financing transactions from cash flows. IFRS 18 also amends the indirect-method starting point and interest/dividend classification. | Apply the cash-flow rules matching the entity's adopted version; see the reporting reference for engineering checks. |

No framework was selected for this repository-wide skill refresh. Country tax rates, digital-invoice schemas, filing calendars, retention years, and statutory statement templates remain conditional and should be researched for the requested jurisdiction at implementation time.

## Governance, auditability, and automation

Advisory controls: proportionate segregation of duties; documented authorization limits; independent bank reconciliation review; periodic access and bank-mandate review; reconciliation of control accounts; exception aging; evidence of approvals and overrides. CC8 supports regular reconciliation and independent review within its jurisdiction. A small team may need documented compensating review; do not assert segregation exists when every action uses the same account.

AI/OCR may propose coding, duplicate candidates, matches, or explanations. Treat source documents as untrusted data, preserve provenance and confidence, verify amounts/IDs deterministically, and require review proportionate to the configured policy. Do not let model output authorize a payment, change bank details, or bypass posting controls. These are MMS design recommendations informed by the voluntary NIST framework, not accounting-standard mandates. [NIST AI RMF](https://www.nist.gov/itl/ai-risk-management-framework)

Privacy, legal retention, and audit integrity need a joint policy. Minimize personal data at capture; restrict access and retain required financial evidence. Before erasure/crypto-shredding, resolve legal obligations and holds, key scope, recoverability, and copies/backups. A shared tenant key could destroy unrelated records. Encryption or a hash chain alone does not prove anonymity, non-repudiation, legal compliance, or an unaltered original. [ICO erasure limitations](https://ico.org.uk/for-the-public/your-right-to-get-your-data-deleted/)

## Technical sources and their limits

- [PostgreSQL 16 numeric types](https://www.postgresql.org/docs/16/datatype-numeric.html): exact decimal storage/calculation; floating-point types are inexact. This does not validate JavaScript conversions or establish a currency's scale.
- [PostgreSQL 16 isolation](https://www.postgresql.org/docs/16/transaction-iso.html) and [locking](https://www.postgresql.org/docs/16/explicit-locking.html): read committed can observe changing state; explicit and advisory locks have different scopes. Advisory locks are cooperative; every relevant writer must follow the protocol.
- [PCI SSC on sensitive authentication data](https://www.pcisecuritystandards.org/faqs/1533/): post-authorization retention is prohibited even when encrypted. MMS's recommendation to avoid collecting PAN/CVV is stricter product-scope guidance, not a claim that PCI forbids all PAN storage.

The linked publisher pages were checked on the date above. Revalidate them for later work; an exposure draft, staff discussion, or future-effective standard is not a current mandatory requirement.
