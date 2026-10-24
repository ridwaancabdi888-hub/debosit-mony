const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

type KeyboardEventLike = Pick<KeyboardEvent, "key" | "shiftKey" | "preventDefault">;

/** Keep Tab navigation inside an open modal panel. */
export function containDialogFocus(
  event: KeyboardEventLike,
  panel: HTMLElement,
  activeElement: Element | null,
): boolean {
  if (event.key !== "Tab") return false;

  const focusable = Array.from(
    panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter(
    (element) =>
      !element.hidden && element.getAttribute("aria-hidden") !== "true",
  );

  if (focusable.length === 0) {
    event.preventDefault();
    panel.focus();
    return true;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const focusIsOutside = !panel.contains(activeElement);

  if (event.shiftKey && (activeElement === first || focusIsOutside)) {
    event.preventDefault();
    last.focus();
    return true;
  }

  if (!event.shiftKey && (activeElement === last || focusIsOutside)) {
    event.preventDefault();
    first.focus();
    return true;
  }

  return false;
}
