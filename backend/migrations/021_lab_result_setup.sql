-- How the lab records a result for each test, configured by the administrator.
-- Shapes (validated by the API):
--   {"type":"number","unit":"g/dL","low":12,"high":16,"criticalLow":7,"criticalHigh":20}
--   {"type":"choice","choices":[{"label":"Negative","flag":"normal"},{"label":"Positive","flag":"abnormal"}]}
--   {"type":"text"}
-- A test without a setup is recorded as free text.

alter table clinic.catalog_items add column result_setup jsonb;

alter table clinic.catalog_items add constraint catalog_items_result_setup_check check (
  result_setup is null
  or (
    item_type in ('lab_test', 'radiology')
    and jsonb_typeof(result_setup) = 'object'
    and result_setup->>'type' in ('number', 'choice', 'text')
  )
);
