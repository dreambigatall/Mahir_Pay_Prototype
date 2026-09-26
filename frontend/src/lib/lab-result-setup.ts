/**
 * How the lab records a result for a test. Configured per test by the administrator
 * (Admin → Catalog) and stored on the catalog item as `result_setup`.
 */
export type ResultFlag = "normal" | "abnormal" | "critical";
export type ResultChoice = { label: string; flag: ResultFlag };

export type ResultSetup =
  | { type: "number"; unit?: string; low?: number; high?: number; criticalLow?: number; criticalHigh?: number }
  | { type: "choice"; choices: ResultChoice[] }
  | { type: "text" };

export type SetupType = ResultSetup["type"];

/** Accepts whatever the API returned and keeps only a well-formed setup. */
export function parseResultSetup(raw: unknown): ResultSetup | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  if (value.type === "text") return { type: "text" };
  if (value.type === "choice" && Array.isArray(value.choices)) {
    const choices = value.choices
      .filter((choice): choice is ResultChoice =>
        Boolean(choice) && typeof (choice as ResultChoice).label === "string" && ["normal", "abnormal", "critical"].includes((choice as ResultChoice).flag))
      .map((choice) => ({ label: choice.label, flag: choice.flag }));
    return choices.length >= 2 ? { type: "choice", choices } : null;
  }
  if (value.type === "number") {
    const num = (key: string) => (typeof value[key] === "number" ? (value[key] as number) : undefined);
    return {
      type: "number",
      unit: typeof value.unit === "string" && value.unit ? value.unit : undefined,
      low: num("low"),
      high: num("high"),
      criticalLow: num("criticalLow"),
      criticalHigh: num("criticalHigh"),
    };
  }
  return null;
}

/** "12 – 16 g/dL", "Below 5.6 mmol/L", "Above 3" — the normal range in plain words. */
export function describeRange(setup: Extract<ResultSetup, { type: "number" }>): string {
  const unit = setup.unit ? ` ${setup.unit}` : "";
  if (setup.low !== undefined && setup.high !== undefined) return `${setup.low} – ${setup.high}${unit}`;
  if (setup.high !== undefined) return `Below ${setup.high}${unit}`;
  if (setup.low !== undefined) return `Above ${setup.low}${unit}`;
  return "";
}

/** Where a number falls: flag plus low/high direction for the arrow. */
export function evaluateNumber(
  value: number,
  setup: Extract<ResultSetup, { type: "number" }>,
): { flag: ResultFlag; direction: "low" | "high" | null } {
  if (setup.criticalLow !== undefined && value < setup.criticalLow) return { flag: "critical", direction: "low" };
  if (setup.criticalHigh !== undefined && value > setup.criticalHigh) return { flag: "critical", direction: "high" };
  if (setup.low !== undefined && value < setup.low) return { flag: "abnormal", direction: "low" };
  if (setup.high !== undefined && value > setup.high) return { flag: "abnormal", direction: "high" };
  return { flag: "normal", direction: null };
}

/** Parses "5.4", "5,4" or " 5.4 " into a number; null when it isn't one. */
export function parseNumber(text: string): number | null {
  const cleaned = text.trim().replace(",", ".");
  if (!cleaned || !/^-?\d*\.?\d+$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

// ---------- editor draft (strings, so half-typed numbers like "12." work) ----------

export type SetupDraft = {
  type: SetupType;
  unit: string;
  low: string;
  high: string;
  criticalLow: string;
  criticalHigh: string;
  choices: ResultChoice[];
};

const DEFAULT_CHOICES: ResultChoice[] = [
  { label: "Negative", flag: "normal" },
  { label: "Positive", flag: "abnormal" },
];

export function draftFromSetup(setup: ResultSetup | null): SetupDraft {
  const base: SetupDraft = { type: "text", unit: "", low: "", high: "", criticalLow: "", criticalHigh: "", choices: DEFAULT_CHOICES };
  if (!setup) return base;
  if (setup.type === "number") {
    const str = (value?: number) => (value === undefined ? "" : String(value));
    return { ...base, type: "number", unit: setup.unit ?? "", low: str(setup.low), high: str(setup.high), criticalLow: str(setup.criticalLow), criticalHigh: str(setup.criticalHigh) };
  }
  if (setup.type === "choice") return { ...base, type: "choice", choices: setup.choices.map((choice) => ({ ...choice })) };
  return base;
}

/** Turns the editor draft into a setup to save, or a plain-language problem to show. */
export function setupFromDraft(draft: SetupDraft): { setup: ResultSetup | null; error: string | null } {
  if (draft.type === "text") return { setup: { type: "text" }, error: null };

  if (draft.type === "choice") {
    const choices = draft.choices.map((choice) => ({ ...choice, label: choice.label.trim() })).filter((choice) => choice.label);
    if (choices.length < 2) return { setup: null, error: "Add at least two answers for the lab to choose from." };
    const labels = choices.map((choice) => choice.label.toLowerCase());
    if (new Set(labels).size !== labels.length) return { setup: null, error: "Each answer must be different." };
    return { setup: { type: "choice", choices }, error: null };
  }

  const fields = { low: draft.low, high: draft.high, criticalLow: draft.criticalLow, criticalHigh: draft.criticalHigh };
  const parsed: Record<string, number | undefined> = {};
  for (const [key, text] of Object.entries(fields)) {
    if (!text.trim()) continue;
    const value = parseNumber(text);
    if (value === null) return { setup: null, error: "Normal and critical limits must be numbers, e.g. 12 or 5.6." };
    parsed[key] = value;
  }
  const { low, high, criticalLow, criticalHigh } = parsed;
  if (low !== undefined && high !== undefined && low > high) return { setup: null, error: "The lowest normal value must be below the highest." };
  if (criticalLow !== undefined && low !== undefined && criticalLow > low) return { setup: null, error: "“Critical below” must be lower than the normal range." };
  if (criticalHigh !== undefined && high !== undefined && criticalHigh < high) return { setup: null, error: "“Critical above” must be higher than the normal range." };
  return {
    setup: { type: "number", unit: draft.unit.trim() || undefined, low, high, criticalLow, criticalHigh },
    error: null,
  };
}

// ---------- starter setups, suggested by test name (the admin can change anything) ----------

const posNeg = (positive = "Positive", negative = "Negative"): ResultSetup => ({
  type: "choice",
  choices: [
    { label: negative, flag: "normal" },
    { label: positive, flag: "abnormal" },
  ],
});

const STARTERS: Array<{ match: RegExp; setup: ResultSetup }> = [
  { match: /widal/i, setup: { type: "choice", choices: [{ label: "Below 1:80", flag: "normal" }, { label: "1:80", flag: "normal" }, { label: "1:160", flag: "abnormal" }, { label: "1:320 or higher", flag: "abnormal" }] } },
  { match: /malaria|\bmps\b|\bb\/?f(ilm)?\b/i, setup: { type: "choice", choices: [{ label: "Negative", flag: "normal" }, { label: "Positive (+)", flag: "abnormal" }, { label: "Positive (++)", flag: "abnormal" }, { label: "Positive (+++)", flag: "abnormal" }] } },
  { match: /\bhiv\b|retro/i, setup: { type: "choice", choices: [{ label: "Non-reactive", flag: "normal" }, { label: "Reactive", flag: "abnormal" }, { label: "Indeterminate", flag: "abnormal" }] } },
  { match: /vdrl|syphilis|\brpr\b/i, setup: posNeg("Reactive", "Non-reactive") },
  { match: /pregnan|\bhcg\b|\bupt\b/i, setup: posNeg() },
  { match: /hbsag|hepatitis\s*b/i, setup: posNeg() },
  { match: /\bhcv\b|hepatitis\s*c/i, setup: posNeg() },
  { match: /typhoid/i, setup: posNeg() },
  { match: /sickl/i, setup: posNeg() },
  { match: /h\.?\s*pylori/i, setup: posNeg() },
  { match: /blood\s*group|abo/i, setup: { type: "choice", choices: ["A+", "A−", "B+", "B−", "AB+", "AB−", "O+", "O−"].map((label) => ({ label, flag: "normal" as const })) } },
  { match: /fasting.*(sugar|glucose)|\bfbs\b/i, setup: { type: "number", unit: "mmol/L", low: 3.9, high: 5.6, criticalLow: 2.8, criticalHigh: 22 } },
  { match: /random.*(sugar|glucose)|\brbs\b/i, setup: { type: "number", unit: "mmol/L", low: 3.9, high: 7.8, criticalLow: 2.8, criticalHigh: 22 } },
  { match: /sugar|glucose/i, setup: { type: "number", unit: "mmol/L", low: 3.9, high: 7.8, criticalLow: 2.8, criticalHigh: 22 } },
  { match: /ha?emoglobin|\bhb\b|\bhgb\b/i, setup: { type: "number", unit: "g/dL", low: 12, high: 16, criticalLow: 7, criticalHigh: 20 } },
  { match: /\bpcv\b|ha?ematocrit/i, setup: { type: "number", unit: "%", low: 36, high: 50, criticalLow: 20, criticalHigh: 60 } },
  { match: /\besr\b/i, setup: { type: "number", unit: "mm/hr", low: 0, high: 20 } },
  { match: /\bwbc\b|white\s*(blood\s*)?cell/i, setup: { type: "number", unit: "×10⁹/L", low: 4, high: 11, criticalLow: 2, criticalHigh: 30 } },
  { match: /platelet/i, setup: { type: "number", unit: "×10⁹/L", low: 150, high: 400, criticalLow: 50, criticalHigh: 1000 } },
  { match: /urinalysis|urine\s*r|stool|microscopy|culture|full\s*blood|\bfbc\b|\bcbc\b/i, setup: { type: "text" } },
];

/** A starting setup for common tests, matched by name. Always shown to the admin before saving. */
export function suggestSetup(testName: string): ResultSetup | null {
  const name = testName.trim();
  if (name.length < 2) return null;
  return STARTERS.find((starter) => starter.match.test(name))?.setup ?? null;
}

/** One-line summary: "Number · 12 – 16 g/dL", "Choice · Negative / Positive (+) / …", "Written result". */
export function summarizeSetup(setup: ResultSetup | null): string {
  if (!setup || setup.type === "text") return "Written result";
  if (setup.type === "choice") return `Choice · ${setup.choices.map((choice) => choice.label).join(" / ")}`;
  const range = describeRange(setup);
  return range ? `Number · ${range}` : `Number${setup.unit ? ` · ${setup.unit}` : ""}`;
}

export function sameSetup(a: ResultSetup | null, b: ResultSetup | null): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
