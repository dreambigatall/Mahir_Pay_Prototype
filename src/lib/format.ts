export function formatMoney(amount: number) {
  return `GHS ${amount.toFixed(2)}`;
}

export function ageFromDob(dob: string) {
  const birth = new Date(dob);
  const now = new Date("2026-08-18");
  let age = now.getFullYear() - birth.getFullYear();
  const month = now.getMonth() - birth.getMonth();
  if (month < 0 || (month === 0 && now.getDate() < birth.getDate())) age -= 1;
  return age;
}

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function invoiceTotal(lineItems: { amount: number }[], discount = 0) {
  return lineItems.reduce((sum, item) => sum + item.amount, 0) - discount;
}

/** Clinic demo clock — matches seeded operational dates. */
export const CLINIC_TODAY = "2026-08-19";

export function addDaysISO(iso: string, days: number) {
  const date = new Date(`${iso}T12:00:00`);
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatShortDate(iso: string) {
  const date = new Date(`${iso}T12:00:00`);
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}
