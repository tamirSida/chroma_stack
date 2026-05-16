import heroUrl from '../../images/gameplay2.png';
import { setButtonGoogleLabel } from './icons';

export type HomeChoice = 'google' | 'email' | 'guest';

type HomeArgs = {
  firebaseEnabled: boolean;
  onChoice: (choice: HomeChoice) => void;
};

let homeEl: HTMLElement | null = null;

export const showHome = (args: HomeArgs) => {
  if (homeEl) return;
  homeEl = document.createElement('div');
  homeEl.className = 'home';

  const hero = document.createElement('img');
  hero.className = 'home-hero';
  hero.src = heroUrl;
  hero.alt = 'Chroma Stack';
  hero.draggable = false;
  homeEl.appendChild(hero);

  const tagline = document.createElement('div');
  tagline.className = 'home-tagline';
  tagline.textContent = 'Stack. Match. Chain.';
  homeEl.appendChild(tagline);

  const buttons = document.createElement('div');
  buttons.className = 'home-buttons';

  const google = document.createElement('button');
  google.className = 'btn google';
  setButtonGoogleLabel(google, 'Continue with Google');
  google.disabled = !args.firebaseEnabled;
  google.addEventListener('click', () => args.onChoice('google'));
  buttons.appendChild(google);

  const email = document.createElement('button');
  email.className = 'btn secondary';
  email.textContent = 'Sign in with email';
  email.disabled = !args.firebaseEnabled;
  email.addEventListener('click', () => args.onChoice('email'));
  buttons.appendChild(email);

  const guest = document.createElement('button');
  guest.className = 'btn ghost';
  guest.textContent = 'Play as guest';
  guest.addEventListener('click', () => args.onChoice('guest'));
  buttons.appendChild(guest);

  homeEl.appendChild(buttons);

  if (!args.firebaseEnabled) {
    const note = document.createElement('div');
    note.className = 'home-note';
    note.textContent = 'Sign-in unavailable — your scores save locally.';
    homeEl.appendChild(note);
  }

  document.body.appendChild(homeEl);
  void homeEl.offsetWidth;
  homeEl.classList.add('shown');
};

export const hideHome = () => {
  if (!homeEl) return;
  const el = homeEl;
  homeEl = null;
  el.classList.remove('shown');
  el.classList.add('exiting');
  window.setTimeout(() => el.remove(), 360);
};

export const isHomeShown = (): boolean => homeEl !== null;
