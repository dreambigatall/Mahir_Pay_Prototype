# Phase 3: Diagnostics, pharmacy, and billing

This phase connects the encounter workflow to diagnostics, medication, inventory, invoicing, and payments. Supabase remains the hosted PostgreSQL provider only.

## Flow

```text
Open encounter
  ├─ diagnostic order → lab queue → result → verification → doctor review
  └─ prescription → invoice → payment → pharmacy queue → dispensing

Encounter signing → invoice issuance → partial/full payment → visit completion
```

## Guarantees

- Catalog names and prices are copied into prescription and invoice lines.
- Money uses `numeric(12,2)`; request validation rejects sub-cent values.
- Inventory uses three-decimal quantities, cannot become negative, and records movements.
- Dispensing locks stock records in deterministic order and supports partial fulfillment.
- Invoice rows are locked during payments, preventing concurrent overpayment.
- Prescriptions cannot be dispensed before full payment.
- Encounters cannot be signed while diagnostic orders remain unresolved.
- Deferred invoice checks require all diagnostic and prescribed-drug charges.
- Clinical, inventory, billing, and payment actions are audit logged.

## API groups

- `/api/v1/catalog`: search/create/update items and adjust tracked drug inventory.
- `/api/v1/diagnostics`: order tests, manage the worklist, enter/verify results, and review orders.
- `/api/v1/pharmacy`: create prescriptions, view the paid worklist, and dispense medication.
- `/api/v1/billing`: issue invoices, view balances/receipts, and collect partial or full payments.

Important permissions include `catalog.read`, `catalog.manage`, `inventory.manage`,
`diagnostic.order`, `diagnostic.worklist`, `diagnostic.result.enter`,
`diagnostic.result.verify`, `prescription.create`, `medication.dispense`,
`billing.read`, `invoice.issue`, `payment.collect`, and `discount.approve`.

Migrations `008` through `012` implement this phase and add the pharmacist role.
Configure `DATABASE_URL`, then run `npm run migrate` before using these endpoints.
