type CloseHandler = () => void;

let overlayEl: HTMLElement | null = null;
let onClose: CloseHandler | null = null;
let keyHandler: ((e: KeyboardEvent) => void) | null = null;

const ensureOverlay = (): HTMLElement => {
  if (overlayEl) return overlayEl;
  overlayEl = document.createElement('div');
  overlayEl.className = 'overlay';
  document.body.appendChild(overlayEl);
  overlayEl.addEventListener('click', (e) => {
    if (e.target === overlayEl) {
      hideOverlay();
    }
  });
  return overlayEl;
};

export const hideOverlay = () => {
  if (!overlayEl) return;
  overlayEl.classList.remove('shown');
  if (keyHandler) {
    window.removeEventListener('keydown', keyHandler);
    keyHandler = null;
  }
  const cb = onClose;
  onClose = null;
  if (cb) cb();
};

export const isOverlayOpen = () => !!overlayEl && overlayEl.classList.contains('shown');

type GameOverArgs = {
  score: number;
  best: number;
  nearLines: number;
  isNewBest: boolean;
  showSaveCta: boolean;
  onRestart: () => void;
  onSignInGoogle: () => void;
  onSignInEmail: () => void;
};

export const showGameOver = (args: GameOverArgs) => {
  const overlay = ensureOverlay();
  overlay.innerHTML = '';

  const card = document.createElement('div');
  card.className = 'card';

  const title = document.createElement('h2');
  title.textContent = args.isNewBest ? 'New Best!' : 'Game Over';
  card.appendChild(title);

  const final = document.createElement('div');
  final.className = 'final-score';
  final.textContent = String(args.score);
  card.appendChild(final);

  const bestLine = document.createElement('div');
  bestLine.className = 'best-line';
  bestLine.textContent = `Best ${args.best}`;
  card.appendChild(bestLine);

  const nearMiss = document.createElement('div');
  nearMiss.className = 'near-miss-line';
  if (args.nearLines > 0) {
    nearMiss.textContent = `So close — you were 1 cell away from clearing ${args.nearLines} more line${args.nearLines === 1 ? '' : 's'}.`;
  }
  card.appendChild(nearMiss);

  const restart = () => {
    hideOverlay();
    args.onRestart();
  };

  const playBtn = document.createElement('button');
  playBtn.className = 'btn';
  playBtn.textContent = 'Play Again';
  playBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    restart();
  });
  card.appendChild(playBtn);

  if (args.showSaveCta) {
    const cta = document.createElement('div');
    cta.className = 'save-cta';

    const label = document.createElement('div');
    label.className = 'save-label';
    label.textContent = '💾  Save your high score';
    cta.appendChild(label);

    const row = document.createElement('div');
    row.className = 'btn-row';

    const google = document.createElement('button');
    google.className = 'btn google';
    google.textContent = 'Continue with Google';
    google.addEventListener('click', (e) => {
      e.stopPropagation();
      args.onSignInGoogle();
    });
    row.appendChild(google);

    const email = document.createElement('button');
    email.className = 'btn secondary';
    email.textContent = 'Sign up with email';
    email.addEventListener('click', (e) => {
      e.stopPropagation();
      args.onSignInEmail();
    });
    row.appendChild(email);

    cta.appendChild(row);
    card.appendChild(cta);
  }

  card.addEventListener('click', () => restart());

  overlay.appendChild(card);
  overlay.classList.add('shown');

  onClose = null;
  keyHandler = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      restart();
    }
  };
  window.addEventListener('keydown', keyHandler);
};

type SettingsArgs = {
  audio: boolean;
  haptics: boolean;
  bgm: boolean;
  userLabel: string;
  isAnonymous: boolean;
  onToggleAudio: (v: boolean) => void;
  onToggleHaptics: (v: boolean) => void;
  onToggleBgm: (v: boolean) => void;
  onSignIn: () => void;
  onSignOut: () => void;
};

export const showSettings = (args: SettingsArgs) => {
  const overlay = ensureOverlay();
  overlay.innerHTML = '';

  const card = document.createElement('div');
  card.className = 'card';
  card.style.textAlign = 'left';
  card.addEventListener('click', (e) => e.stopPropagation());

  const close = document.createElement('button');
  close.className = 'close-btn';
  close.setAttribute('aria-label', 'Close');
  close.textContent = '×';
  close.addEventListener('click', hideOverlay);
  card.appendChild(close);

  const title = document.createElement('h2');
  title.textContent = 'Settings';
  title.style.textAlign = 'center';
  card.appendChild(title);

  const account = document.createElement('div');
  account.style.padding = '12px 0';
  account.style.textAlign = 'center';
  const label = document.createElement('div');
  label.className = 'muted';
  label.textContent = args.isAnonymous ? 'Playing as guest' : 'Signed in as';
  account.appendChild(label);
  const name = document.createElement('div');
  name.style.fontWeight = '700';
  name.style.marginTop = '4px';
  name.textContent = args.userLabel;
  account.appendChild(name);
  card.appendChild(account);

  const mkToggle = (text: string, on: boolean, onChange: (v: boolean) => void) => {
    const row = document.createElement('div');
    row.className = 'row-toggle';
    const txt = document.createElement('div');
    txt.textContent = text;
    row.appendChild(txt);
    const sw = document.createElement('div');
    sw.className = `switch${on ? ' on' : ''}`;
    sw.setAttribute('role', 'switch');
    sw.setAttribute('aria-checked', on ? 'true' : 'false');
    sw.addEventListener('click', () => {
      const next = !sw.classList.contains('on');
      sw.classList.toggle('on', next);
      sw.setAttribute('aria-checked', next ? 'true' : 'false');
      onChange(next);
    });
    row.appendChild(sw);
    return row;
  };

  card.appendChild(mkToggle('Sound', args.audio, args.onToggleAudio));
  card.appendChild(mkToggle('Music', args.bgm, args.onToggleBgm));
  card.appendChild(mkToggle('Haptics', args.haptics, args.onToggleHaptics));

  const actions = document.createElement('div');
  actions.className = 'btn-row';
  actions.style.marginTop = '16px';

  if (args.isAnonymous) {
    const signIn = document.createElement('button');
    signIn.className = 'btn';
    signIn.textContent = 'Sign in / Sign up';
    signIn.addEventListener('click', () => {
      hideOverlay();
      args.onSignIn();
    });
    actions.appendChild(signIn);
  } else {
    const signOut = document.createElement('button');
    signOut.className = 'btn secondary';
    signOut.textContent = 'Sign out';
    signOut.addEventListener('click', () => {
      args.onSignOut();
      hideOverlay();
    });
    actions.appendChild(signOut);
  }

  card.appendChild(actions);
  overlay.appendChild(card);
  overlay.classList.add('shown');

  keyHandler = (e) => {
    if (e.key === 'Escape') hideOverlay();
  };
  window.addEventListener('keydown', keyHandler);
};

export type LeaderboardEntry = {
  uid: string;
  displayName: string;
  score: number;
};

export type LeaderboardData = {
  scope: 'today' | 'alltime';
  entries: LeaderboardEntry[];
  myRank: number | null;
  myScore: number;
  totalCount: number | null;
  myUid: string | null;
};

type LeaderboardArgs = {
  initialScope: 'today' | 'alltime';
  fetcher: (scope: 'today' | 'alltime') => Promise<LeaderboardData>;
};

export const showLeaderboard = (args: LeaderboardArgs) => {
  const overlay = ensureOverlay();
  overlay.innerHTML = '';

  const card = document.createElement('div');
  card.className = 'card';
  card.style.textAlign = 'left';
  card.addEventListener('click', (e) => e.stopPropagation());

  const close = document.createElement('button');
  close.className = 'close-btn';
  close.setAttribute('aria-label', 'Close');
  close.textContent = '×';
  close.addEventListener('click', hideOverlay);
  card.appendChild(close);

  const title = document.createElement('h2');
  title.textContent = 'Leaderboard';
  title.style.textAlign = 'center';
  card.appendChild(title);

  const tabs = document.createElement('div');
  tabs.className = 'tabs';
  const tabToday = document.createElement('button');
  tabToday.className = 'tab';
  tabToday.textContent = 'Today';
  const tabAll = document.createElement('button');
  tabAll.className = 'tab';
  tabAll.textContent = 'All-time';
  tabs.appendChild(tabToday);
  tabs.appendChild(tabAll);
  card.appendChild(tabs);

  const list = document.createElement('div');
  list.className = 'leaderboard-list';
  card.appendChild(list);

  const youRank = document.createElement('div');
  youRank.className = 'you-rank';
  youRank.style.display = 'none';
  card.appendChild(youRank);

  let currentScope: 'today' | 'alltime' = args.initialScope;

  const render = async (scope: 'today' | 'alltime') => {
    currentScope = scope;
    tabToday.classList.toggle('active', scope === 'today');
    tabAll.classList.toggle('active', scope === 'alltime');
    list.innerHTML = '<div class="lb-empty">Loading…</div>';
    youRank.style.display = 'none';

    try {
      const data = await args.fetcher(scope);
      if (currentScope !== scope) return;
      list.innerHTML = '';
      if (data.entries.length === 0) {
        list.innerHTML = '<div class="lb-empty">No scores yet — be the first!</div>';
      } else {
        let inTop = false;
        data.entries.forEach((entry, i) => {
          const row = document.createElement('div');
          row.className = 'lb-row';
          if (entry.uid === data.myUid) {
            row.classList.add('me');
            inTop = true;
          }
          const rank = document.createElement('div');
          rank.className = 'lb-rank';
          rank.textContent = `${i + 1}`;
          const name = document.createElement('div');
          name.className = 'lb-name';
          name.textContent = entry.displayName || 'Player';
          const score = document.createElement('div');
          score.className = 'lb-score';
          score.textContent = entry.score.toLocaleString();
          row.appendChild(rank);
          row.appendChild(name);
          row.appendChild(score);
          list.appendChild(row);
        });

        if (!inTop && data.myRank != null && data.myScore > 0) {
          const pct =
            data.totalCount && data.totalCount > 0
              ? Math.max(1, Math.round((data.myRank / data.totalCount) * 100))
              : null;
          youRank.textContent =
            pct != null
              ? `You: #${data.myRank}  •  top ${pct}%  •  ${data.myScore.toLocaleString()}`
              : `You: #${data.myRank}  •  ${data.myScore.toLocaleString()}`;
          youRank.style.display = 'block';
        }
      }
    } catch {
      list.innerHTML = '<div class="lb-empty">Couldn\'t load scores. Try again later.</div>';
    }
  };

  tabToday.addEventListener('click', () => render('today'));
  tabAll.addEventListener('click', () => render('alltime'));

  overlay.appendChild(card);
  overlay.classList.add('shown');

  keyHandler = (e) => {
    if (e.key === 'Escape') hideOverlay();
  };
  window.addEventListener('keydown', keyHandler);

  void render(currentScope);
};

type SignInArgs = {
  initialMode?: 'signin' | 'signup';
  onGoogle: () => Promise<void>;
  onEmailSignUp: (email: string, password: string) => Promise<void>;
  onEmailSignIn: (email: string, password: string) => Promise<void>;
  onPasswordReset: (email: string) => Promise<void>;
};

export const showSignIn = (args: SignInArgs) => {
  const overlay = ensureOverlay();
  overlay.innerHTML = '';

  const card = document.createElement('div');
  card.className = 'card';
  card.style.textAlign = 'left';
  card.addEventListener('click', (e) => e.stopPropagation());

  const close = document.createElement('button');
  close.className = 'close-btn';
  close.setAttribute('aria-label', 'Close');
  close.textContent = '×';
  close.addEventListener('click', hideOverlay);
  card.appendChild(close);

  let mode: 'signin' | 'signup' = args.initialMode ?? 'signup';

  const title = document.createElement('h2');
  title.style.textAlign = 'center';
  card.appendChild(title);

  const subtitle = document.createElement('div');
  subtitle.className = 'muted';
  subtitle.style.textAlign = 'center';
  subtitle.style.marginBottom = '14px';
  card.appendChild(subtitle);

  const googleBtn = document.createElement('button');
  googleBtn.className = 'btn google';
  googleBtn.textContent = 'Continue with Google';
  googleBtn.style.marginBottom = '10px';
  card.appendChild(googleBtn);

  const divider = document.createElement('div');
  divider.className = 'muted';
  divider.style.textAlign = 'center';
  divider.style.margin = '8px 0';
  divider.textContent = 'or';
  card.appendChild(divider);

  const errorEl = document.createElement('div');
  errorEl.className = 'error';
  card.appendChild(errorEl);

  const email = document.createElement('input');
  email.className = 'field';
  email.type = 'email';
  email.placeholder = 'Email';
  email.autocomplete = 'email';
  email.inputMode = 'email';
  email.autocapitalize = 'none';
  card.appendChild(email);

  const password = document.createElement('input');
  password.className = 'field';
  password.type = 'password';
  password.placeholder = 'Password';
  password.autocomplete = 'current-password';
  card.appendChild(password);

  const submit = document.createElement('button');
  submit.className = 'btn';
  card.appendChild(submit);

  const forgot = document.createElement('button');
  forgot.className = 'link';
  forgot.style.textAlign = 'left';
  forgot.textContent = 'Forgot password?';
  card.appendChild(forgot);

  const toggleMode = document.createElement('button');
  toggleMode.className = 'link';
  toggleMode.style.textAlign = 'left';
  card.appendChild(toggleMode);

  const setMode = (m: 'signin' | 'signup') => {
    mode = m;
    if (m === 'signup') {
      title.textContent = 'Create account';
      subtitle.textContent = 'Save your scores across devices';
      submit.textContent = 'Sign up';
      password.autocomplete = 'new-password';
      toggleMode.textContent = 'Have an account? Sign in';
    } else {
      title.textContent = 'Welcome back';
      subtitle.textContent = 'Sign in to sync your progress';
      submit.textContent = 'Sign in';
      password.autocomplete = 'current-password';
      toggleMode.textContent = 'New here? Create an account';
    }
    errorEl.textContent = '';
  };
  setMode(mode);

  toggleMode.addEventListener('click', (e) => {
    e.preventDefault();
    setMode(mode === 'signup' ? 'signin' : 'signup');
  });

  const setBusy = (b: boolean) => {
    submit.disabled = b;
    googleBtn.disabled = b;
    toggleMode.disabled = b;
    forgot.disabled = b;
  };

  googleBtn.addEventListener('click', async () => {
    errorEl.textContent = '';
    setBusy(true);
    try {
      await args.onGoogle();
      hideOverlay();
    } catch (err) {
      errorEl.textContent = humanError(err);
    } finally {
      setBusy(false);
    }
  });

  submit.addEventListener('click', async () => {
    errorEl.textContent = '';
    if (!email.value || !password.value) {
      errorEl.textContent = 'Email and password required.';
      return;
    }
    if (password.value.length < 6) {
      errorEl.textContent = 'Password must be at least 6 characters.';
      return;
    }
    setBusy(true);
    try {
      if (mode === 'signup') {
        await args.onEmailSignUp(email.value, password.value);
      } else {
        await args.onEmailSignIn(email.value, password.value);
      }
      hideOverlay();
    } catch (err) {
      errorEl.textContent = humanError(err);
    } finally {
      setBusy(false);
    }
  });

  forgot.addEventListener('click', async (e) => {
    e.preventDefault();
    errorEl.textContent = '';
    if (!email.value) {
      errorEl.textContent = 'Enter your email above first.';
      return;
    }
    setBusy(true);
    try {
      await args.onPasswordReset(email.value);
      errorEl.style.color = 'var(--accent)';
      errorEl.textContent = 'Reset link sent. Check your inbox.';
      window.setTimeout(() => (errorEl.style.color = ''), 4000);
    } catch (err) {
      errorEl.textContent = humanError(err);
    } finally {
      setBusy(false);
    }
  });

  overlay.appendChild(card);
  overlay.classList.add('shown');

  keyHandler = (e) => {
    if (e.key === 'Escape') hideOverlay();
    if (e.key === 'Enter' && (e.target === email || e.target === password)) {
      e.preventDefault();
      submit.click();
    }
  };
  window.addEventListener('keydown', keyHandler);

  setTimeout(() => email.focus(), 100);
};

const humanError = (err: unknown): string => {
  const msg = err && typeof err === 'object' && 'code' in err ? String((err as { code: string }).code) : '';
  switch (msg) {
    case 'auth/email-already-in-use':
      return 'That email is already registered. Try signing in.';
    case 'auth/invalid-email':
      return 'That email doesn\'t look right.';
    case 'auth/weak-password':
      return 'Password is too weak.';
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Wrong email or password.';
    case 'auth/user-not-found':
      return 'No account with that email.';
    case 'auth/popup-closed-by-user':
      return 'Sign-in cancelled.';
    case 'auth/popup-blocked':
      return 'Pop-up blocked. Tap the button again to retry.';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Try again in a minute.';
    default:
      if (err instanceof Error) return err.message;
      return 'Something went wrong.';
  }
};

