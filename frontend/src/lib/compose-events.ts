export const COMPOSE_OPEN_EVENT = "compose:open";
export const SEARCH_OPEN_EVENT = "search:open";

export function openCompose() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(COMPOSE_OPEN_EVENT));
}

export function openSearch() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SEARCH_OPEN_EVENT));
}
