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
