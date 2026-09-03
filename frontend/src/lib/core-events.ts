export const CORE_DATA_CHANGED_EVENT = "mahir:core-data-changed";

export function announceCoreDataChanged(): void {
  window.dispatchEvent(new Event(CORE_DATA_CHANGED_EVENT));
}
