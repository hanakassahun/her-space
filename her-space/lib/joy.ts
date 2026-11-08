export function showJoyLine(message: string) {
  window.dispatchEvent(new CustomEvent("her-space:joy", { detail: message }));
}
