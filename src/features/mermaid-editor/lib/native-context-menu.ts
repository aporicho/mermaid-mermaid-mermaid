export function preventNativeContextMenu(event: { preventDefault(): void }) {
  event.preventDefault();
}
