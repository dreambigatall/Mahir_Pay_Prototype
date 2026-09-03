create unique index visits_one_active_per_patient_uidx on clinic.visits (patient_id)
where status not in ('completed', 'billed', 'cancelled');
