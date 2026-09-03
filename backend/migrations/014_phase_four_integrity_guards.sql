alter table clinic.treatment_courses
  drop constraint treatment_courses_cancellation_check,
  add constraint treatment_courses_cancellation_check check (
    (status <> 'cancelled' and cancelled_at is null and cancelled_by is null and cancellation_reason is null)
    or (status = 'cancelled' and cancelled_at is not null and cancelled_by is not null
      and btrim(coalesce(cancellation_reason, '')) <> '')
  );

alter table clinic.treatment_course_doses
  drop constraint treatment_course_doses_checkin_check,
  drop constraint treatment_course_doses_missed_check,
  add constraint treatment_course_doses_checkin_check check (
    (status in ('checked_in', 'given') and visit_id is not null and checked_in_by is not null and checked_in_at is not null)
    or (status not in ('checked_in', 'given') and visit_id is null and checked_in_by is null and checked_in_at is null)
  ),
  add constraint treatment_course_doses_missed_check check (
    (status = 'missed' and btrim(coalesce(missed_reason, '')) <> '')
    or (status <> 'missed' and missed_reason is null)
  );

alter table clinic.referrals
  drop constraint referrals_destination_check,
  drop constraint referrals_cancellation_check,
  add constraint referrals_destination_check check (
    (destination_type = 'department' and btrim(coalesce(to_department, '')) <> '' and to_branch is null and external_provider is null)
    or (destination_type = 'branch' and btrim(coalesce(to_branch, '')) <> '' and to_department is null and external_provider is null)
    or (destination_type = 'external' and btrim(coalesce(external_provider, '')) <> '' and to_department is null and to_branch is null)
  ),
  add constraint referrals_cancellation_check check (
    (status <> 'cancelled' and cancelled_at is null and cancellation_reason is null)
    or (status = 'cancelled' and cancelled_at is not null and btrim(coalesce(cancellation_reason, '')) <> '')
  );

