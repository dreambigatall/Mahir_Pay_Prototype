alter table clinic.diagnostic_results
  drop constraint diagnostic_results_correction_check,
  add constraint diagnostic_results_correction_check check (
    (corrected_from_id is null and correction_reason is null)
    or (corrected_from_id is not null and correction_reason is not null and btrim(correction_reason) <> '')
  );

alter table clinic.invoices
  drop constraint invoices_discount_approval_check,
  add constraint invoices_discount_approval_check check (
    (discount_amount = 0 and discount_approved_by is null and discount_reason is null)
    or (discount_amount > 0 and discount_approved_by is not null
      and discount_reason is not null and btrim(discount_reason) <> '')
  ),
  drop constraint invoices_void_check,
  add constraint invoices_void_check check (
    (status <> 'void' and voided_by is null and voided_at is null and void_reason is null)
    or (status = 'void' and voided_by is not null and voided_at is not null
      and void_reason is not null and btrim(void_reason) <> '')
  );

alter table clinic.payments
  drop constraint payments_reversal_check,
  add constraint payments_reversal_check check (
    (status <> 'reversed' and reversed_by is null and reversed_at is null and reversal_reason is null)
    or (status = 'reversed' and reversed_by is not null and reversed_at is not null
      and reversal_reason is not null and btrim(reversal_reason) <> '')
  );
