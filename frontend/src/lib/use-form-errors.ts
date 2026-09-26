"use client";

import { useCallback, useMemo, useState } from "react";

import { ApiError } from "@/lib/api/client";

/** A rule returns an error message, or nothing when the value is fine. */
export type FieldRule<T> = (value: T[keyof T], values: T) => string | undefined | false | null;
export type FieldRules<T> = Partial<Record<keyof T & string, FieldRule<T>>>;

type ApiFieldErrors = { fieldErrors?: Record<string, string[] | undefined>; formErrors?: string[] };

/**
 * Per-field validation for clinic forms.
 * - Errors show after a field loses focus (touch) or after the first submit attempt.
 * - `validateAll()` runs every rule and returns true when the form can be sent.
 * - `applyApiError()` maps the backend's VALIDATION_ERROR details onto fields and
 *   returns a message for the summary banner.
 */
export function useFormErrors<T extends Record<string, unknown>>(values: T, rules: FieldRules<T>) {
  const [touched, setTouched] = useState<Partial<Record<string, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState<Partial<Record<string, string>>>({});
  const [formError, setFormError] = useState("");

  const clientErrors = useMemo(() => {
    const next: Partial<Record<string, string>> = {};
    for (const [name, rule] of Object.entries(rules) as Array<[string, FieldRule<T> | undefined]>) {
      const message = rule?.(values[name as keyof T], values);
      if (message) next[name] = message;
    }
    return next;
  }, [rules, values]);

  /** Error to show under a field right now (respects touched/submitted). */
  const errorFor = useCallback((name: keyof T & string): string | undefined => {
    if (serverErrors[name]) return serverErrors[name];
    if (!submitted && !touched[name]) return undefined;
    return clientErrors[name];
  }, [clientErrors, serverErrors, submitted, touched]);

  const touch = useCallback((name: keyof T & string) => {
    setTouched((current) => (current[name] ? current : { ...current, [name]: true }));
    setServerErrors((current) => {
      if (!current[name]) return current;
      const next = { ...current };
      delete next[name];
      return next;
    });
  }, []);

  const validateAll = useCallback((): boolean => {
    setSubmitted(true);
    setServerErrors({});
    setFormError("");
    return Object.keys(clientErrors).length === 0;
  }, [clientErrors]);

  /**
   * Show an API failure on the form. `fieldMap` translates backend names (e.g. "firstName")
   * to form field names when they differ.
   */
  const applyApiError = useCallback((caught: unknown, fallback: string, fieldMap: Partial<Record<string, keyof T & string>> = {}) => {
    if (caught instanceof ApiError) {
      const details = caught.details as ApiFieldErrors | undefined;
      const mapped: Partial<Record<string, string>> = {};
      for (const [backendName, messages] of Object.entries(details?.fieldErrors ?? {})) {
        const message = messages?.[0];
        if (message) mapped[fieldMap[backendName] ?? backendName] = message;
      }
      setServerErrors(mapped);
      const general = details?.formErrors?.[0];
      setFormError(Object.keys(mapped).length ? general ?? "Please correct the highlighted fields." : general ?? caught.message);
      return;
    }
    setFormError(fallback);
  }, []);

  const reset = useCallback(() => {
    setTouched({});
    setSubmitted(false);
    setServerErrors({});
    setFormError("");
  }, []);

  /** Every error currently visible, in rule order — for the summary banner. */
  const visibleErrors = useMemo(() => {
    const names = new Set([...Object.keys(rules), ...Object.keys(serverErrors)]);
    return [...names]
      .map((name) => ({ name, message: errorFor(name as keyof T & string) }))
      .filter((entry): entry is { name: string; message: string } => Boolean(entry.message));
  }, [errorFor, rules, serverErrors]);

  return { errorFor, touch, validateAll, applyApiError, reset, formError, setFormError, visibleErrors, submitted };
}

/** Common rules. */
export const rules = {
  required: (label: string) => (value: unknown) =>
    (typeof value === "string" ? value.trim() === "" : value === undefined || value === null) ? `${label} is required` : undefined,
  phone: (value: unknown) => {
    const digits = String(value ?? "").replace(/[^\d]/g, "");
    if (!digits) return "Phone number is required";
    return digits.length < 9 || digits.length > 15 ? "Enter a valid phone number (9–15 digits)" : undefined;
  },
  positiveAmount: (label: string) => (value: unknown) => {
    const amount = Number(value);
    return !Number.isFinite(amount) || amount <= 0 ? `${label} must be greater than zero` : undefined;
  },
};
