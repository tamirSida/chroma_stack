let enabled = true;

export const setHapticsEnabled = (v: boolean) => {
  enabled = v;
};

export const isHapticsEnabled = () => enabled;

const supported = () => 'vibrate' in navigator && typeof navigator.vibrate === 'function';

export const buzz = (pattern: number | number[]) => {
  if (!enabled) return;
  if (!supported()) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* no-op */
  }
};
