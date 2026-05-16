let toastEl: HTMLElement | null = null;
let hideTimer: number | null = null;

const ensure = (): HTMLElement => {
  if (toastEl) return toastEl;
  toastEl = document.createElement('div');
  toastEl.className = 'toast';
  document.body.appendChild(toastEl);
  return toastEl;
};

export const toast = (message: string, durationMs = 2400) => {
  const el = ensure();
  el.textContent = message;
  el.classList.add('shown');
  if (hideTimer !== null) window.clearTimeout(hideTimer);
  hideTimer = window.setTimeout(() => {
    el.classList.remove('shown');
    hideTimer = null;
  }, durationMs);
};
