import './style.css';
import {
  initRender,
  renderBoard,
  renderTray,
  renderScore,
  renderCoins,
  renderPowers,
  flashPower,
  flashScore,
  shakeBoard,
  animateClear,
  spawnFloat,
  setNearMiss,
} from './render';
import { initInput, handleTrayPointerDown } from './input';
import {
  newGameState,
  placeOnBoard,
  canPlace,
  detectClears,
  scoreClears,
  clearCells,
  refillTray,
  findNearMiss,
  isGameOver,
} from './game';
import type { Color, GameState } from './types';
import { primeAudio, playClearSequence, playBad, setAudioEnabled, isAudioEnabled } from './audio';
import { buzz, setHapticsEnabled, isHapticsEnabled } from './haptics';
import {
  hideOverlay,
  showColorLinePicker,
  showGameOver,
  showLeaderboard,
  showSettings,
  showSignIn,
} from './ui/overlays';
import { applyPower, canUse, POWER_BY_ID, snapshotState, type PowerId } from './powers';
import { firebaseEnabled } from './firebase';
import {
  getAuthState,
  initAuth,
  onAuth,
  pushCoinsBalance,
  resetPassword,
  signInWithEmail,
  signOutAndReanon,
  updateBestScoreIfHigher,
  updatePreferences,
  upgradeWithEmail,
  upgradeWithGoogle,
} from './auth';
import { fetchLeaderboard, submitScore } from './firestore';
import { toast } from './ui/toast';

const BEST_KEY = 'cascade.best.v1';
const AUDIO_KEY = 'cascade.audio.v1';
const HAPTICS_KEY = 'cascade.haptics.v1';
const COINS_KEY = 'cascade.coins.v1';
const COIN_PER_POINT = 0.1;

let state: GameState;
let busy = false;
let lastNearLines = 0;
let gameStartBest = 0;

const loadPref = (key: string, def: boolean): boolean => {
  try {
    const v = localStorage.getItem(key);
    if (v === null) return def;
    return v === '1';
  } catch {
    return def;
  }
};

const savePref = (key: string, value: boolean) => {
  try {
    localStorage.setItem(key, value ? '1' : '0');
  } catch {
    /* no-op */
  }
};

const loadBest = (): number => {
  try {
    const v = localStorage.getItem(BEST_KEY);
    return v ? parseInt(v, 10) || 0 : 0;
  } catch {
    return 0;
  }
};

const saveBest = (best: number) => {
  try {
    localStorage.setItem(BEST_KEY, String(best));
  } catch {
    /* no-op */
  }
};

const loadCoins = (): number => {
  try {
    const v = localStorage.getItem(COINS_KEY);
    return v ? parseInt(v, 10) || 0 : 0;
  } catch {
    return 0;
  }
};

const saveCoins = (coins: number) => {
  try {
    localStorage.setItem(COINS_KEY, String(coins));
  } catch {
    /* no-op */
  }
  if (firebaseEnabled()) void pushCoinsBalance(coins).catch(() => {});
};

let coinEarnAcc = 0;
const earnCoinsFromScoreDelta = (delta: number) => {
  if (delta <= 0) return 0;
  coinEarnAcc += delta * COIN_PER_POINT;
  const whole = Math.floor(coinEarnAcc);
  if (whole <= 0) return 0;
  coinEarnAcc -= whole;
  state.coins += whole;
  saveCoins(state.coins);
  return whole;
};

const wireTray = () => {
  renderTray(state, (idx, e) => {
    if (busy) return;
    handleTrayPointerDown(idx, e);
  });
};

const wirePowers = () => {
  renderPowers(state, (id) => {
    if (busy) return;
    handlePower(id);
  });
};

const handlePower = (id: PowerId) => {
  if (!canUse(state, id)) return;
  const def = POWER_BY_ID.get(id)!;

  if (id === 'colorLine') {
    showColorLinePicker({
      onConfirm: (axis, index, color) => {
        if (!canUse(state, id)) return;
        const ok = applyPower(state, id, { axis, index, color });
        if (!ok) {
          toast(`That ${axis} has no blocks to recolor.`);
          return;
        }
        afterPowerUse(id, def.cost);
        runClearsIfAny();
      },
    });
    return;
  }

  const prevScore = state.score;
  const ok = applyPower(state, id);
  if (!ok) return;

  afterPowerUse(id, id === 'redo' ? 0 : def.cost);

  if (id === 'redo') {
    coinEarnAcc = 0;
  } else {
    void prevScore;
  }

  if (id === 'clearBoard' || id === 'shuffleBoard') {
    runClearsIfAny();
  }
};

const afterPowerUse = (id: PowerId, deducted: number) => {
  if (id !== 'redo') {
    saveCoins(state.coins);
  }
  flashPower(id);
  buzz(15);
  renderBoard(state);
  wireTray();
  renderScore(state);
  renderCoins(state, deducted === 0);
  wirePowers();
  setNearMiss(findNearMiss(state.board).cells);
};

const runClearsIfAny = () => {
  const result = detectClears(state.board);
  if (result.cells.size === 0) {
    wirePowers();
    return;
  }
  state.combo += 1;
  const prevBest = state.best;
  const points = scoreClears(result, state.combo);
  state.score += points;
  earnCoinsFromScoreDelta(points);
  if (state.score > state.best) {
    state.best = state.score;
    saveBest(state.best);
  }
  const colorMap = new Map<string, Color>();
  for (const key of result.cells) {
    const [rr, cc] = key.split(',').map(Number) as [number, number];
    const cell = state.board[rr]![cc];
    if (cell) colorMap.set(key, cell.color);
  }
  const steps = Math.min(
    8,
    1 + result.fullRows.length + result.fullCols.length + result.monoLines,
  );
  playClearSequence(steps);
  buzz(state.combo >= 3 || result.monoLines > 0 ? [20, 30, 20] : 10);
  spawnFloat(state.combo, result.monoLines);
  if (state.combo >= 3 || result.monoLines > 0) shakeBoard();

  busy = true;
  const finalizeClear = animateClear(result.cells, colorMap);
  window.setTimeout(() => {
    clearCells(state.board, result.cells);
    renderBoard(state);
    finalizeClear();
    renderScore(state);
    renderCoins(state, true);
    wirePowers();
    busy = false;
    afterTurn();
  }, 220);
  void prevBest;
};

const commitPlace = (idx: number, r: number, c: number) => {
  if (busy) return;
  const piece = state.tray[idx];
  if (!piece) return;
  if (!canPlace(state.board, piece, r, c)) return;

  snapshotState(state);

  placeOnBoard(state.board, piece, r, c);
  state.tray[idx] = null;
  renderBoard(state);
  wireTray();
  wirePowers();

  const result = detectClears(state.board);

  if (result.cells.size > 0) {
    state.combo += 1;
    const points = scoreClears(result, state.combo);
    state.score += points;
    earnCoinsFromScoreDelta(points);
    if (state.score > state.best) {
      state.best = state.score;
      saveBest(state.best);
    }

    const colorMap = new Map<string, Color>();
    for (const key of result.cells) {
      const [rr, cc] = key.split(',').map(Number) as [number, number];
      const cell = state.board[rr]![cc];
      if (cell) colorMap.set(key, cell.color);
    }

    const steps = Math.min(
      8,
      1 + result.fullRows.length + result.fullCols.length + result.monoLines,
    );
    playClearSequence(steps);
    buzz(state.combo >= 3 || result.monoLines > 0 ? [20, 30, 20] : 10);
    spawnFloat(state.combo, result.monoLines);
    if (state.combo >= 3 || result.monoLines > 0) shakeBoard();

    busy = true;
    const finalizeClear = animateClear(result.cells, colorMap);

    window.setTimeout(() => {
      clearCells(state.board, result.cells);
      renderBoard(state);
      finalizeClear();
      renderScore(state);
      renderCoins(state, true);
      wirePowers();
      busy = false;
      afterTurn();
    }, 220);
  } else {
    state.combo = 1;
    renderScore(state);
    flashScore();
    playBad();
    wirePowers();
    afterTurn();
  }
};

const afterTurn = () => {
  refillTray(state);
  wireTray();
  const nm = findNearMiss(state.board);
  setNearMiss(nm.cells);
  lastNearLines = nm.nearLines;

  if (isGameOver(state)) {
    const finalScore = state.score;
    const best = state.best;
    const beatBest = best > gameStartBest;
    void handleGameOverSubmit(finalScore, beatBest);
    presentGameOver(finalScore, best, lastNearLines, beatBest);
  }
};

const handleGameOverSubmit = async (finalScore: number, beatBest: boolean) => {
  if (!firebaseEnabled()) return;
  const { user, profile } = getAuthState();
  if (!user || !profile) return;
  if (finalScore <= 0) return;
  if (beatBest) {
    await updateBestScoreIfHigher(finalScore).catch(() => {});
  }
  await submitScore(user.uid, profile.displayName, finalScore).catch(() => {});
};

const presentGameOver = (
  finalScore: number,
  best: number,
  nearLines: number,
  beatBest: boolean,
) => {
  const { user } = getAuthState();
  const showSaveCta = firebaseEnabled() && !!user && user.isAnonymous && beatBest;
  showGameOver({
    score: finalScore,
    best,
    nearLines,
    isNewBest: beatBest,
    showSaveCta,
    onRestart: restart,
    onSignInGoogle: () => {
      void (async () => {
        try {
          await upgradeWithGoogle();
          toast('Signed in. Your score is saved.');
        } catch (err) {
          toast(humanError(err));
        }
      })();
    },
    onSignInEmail: () => openSignIn('signup'),
  });
};

const restart = () => {
  const carriedBest = state?.best ?? loadBest();
  const carriedCoins = state?.coins ?? loadCoins();
  state = newGameState(carriedBest, carriedCoins);
  state.combo = 1;
  gameStartBest = state.best;
  busy = false;
  coinEarnAcc = 0;
  renderBoard(state);
  renderScore(state);
  renderCoins(state);
  wireTray();
  wirePowers();
  setNearMiss(findNearMiss(state.board).cells);
};

const onDragStart = () => {
  primeAudio();
};

const humanError = (err: unknown): string => {
  if (err && typeof err === 'object' && 'message' in err) {
    return String((err as { message: string }).message) || 'Something went wrong.';
  }
  return 'Something went wrong.';
};

const userLabel = (): { label: string; isAnonymous: boolean } => {
  if (!firebaseEnabled()) return { label: 'Guest (offline)', isAnonymous: true };
  const { user, profile } = getAuthState();
  if (!user) return { label: 'Connecting…', isAnonymous: true };
  const label = profile?.displayName || (user.isAnonymous ? 'Guest' : 'Player');
  return { label, isAnonymous: user.isAnonymous };
};

const openSettings = () => {
  hideOverlay();
  const { label, isAnonymous } = userLabel();
  showSettings({
    audio: isAudioEnabled(),
    haptics: isHapticsEnabled(),
    userLabel: label,
    isAnonymous,
    onToggleAudio: (v) => {
      setAudioEnabled(v);
      savePref(AUDIO_KEY, v);
      if (firebaseEnabled()) void updatePreferences({ sound: v }).catch(() => {});
    },
    onToggleHaptics: (v) => {
      setHapticsEnabled(v);
      savePref(HAPTICS_KEY, v);
      if (firebaseEnabled()) void updatePreferences({ haptics: v }).catch(() => {});
    },
    onSignIn: () => openSignIn('signup'),
    onSignOut: () => {
      void signOutAndReanon();
      toast('Signed out. Playing as guest.');
    },
  });
};

const openSignIn = (mode: 'signin' | 'signup') => {
  if (!firebaseEnabled()) {
    toast('Sign-in isn\'t configured yet.');
    return;
  }
  hideOverlay();
  showSignIn({
    initialMode: mode,
    onGoogle: async () => {
      await upgradeWithGoogle();
      toast('Signed in. Welcome!');
    },
    onEmailSignUp: async (email, password) => {
      await upgradeWithEmail(email, password);
      toast('Account created. Verification email sent.');
    },
    onEmailSignIn: async (email, password) => {
      await signInWithEmail(email, password);
      toast('Welcome back!');
    },
    onPasswordReset: async (email) => {
      await resetPassword(email);
    },
  });
};

const openLeaderboard = () => {
  hideOverlay();
  if (!firebaseEnabled()) {
    toast('Leaderboard isn\'t configured yet.');
    return;
  }
  const { user } = getAuthState();
  showLeaderboard({
    initialScope: 'today',
    fetcher: (scope) => fetchLeaderboard(scope, user?.uid ?? null, state.best),
  });
};

const syncFromAuth = () => {
  const { profile, isReady } = getAuthState();
  if (!isReady || !profile) return;
  let needsBestPush = false;
  let needsCoinsPush = false;
  if (profile.bestScore > state.best) {
    state.best = profile.bestScore;
    saveBest(state.best);
    renderScore(state);
  } else if (state.best > profile.bestScore) {
    needsBestPush = true;
  }
  if (profile.coins > state.coins) {
    state.coins = profile.coins;
    try { localStorage.setItem(COINS_KEY, String(state.coins)); } catch { /* */ }
    renderCoins(state);
    wirePowers();
  } else if (state.coins > profile.coins) {
    needsCoinsPush = true;
  }
  if (profile.preferences.sound !== isAudioEnabled()) {
    setAudioEnabled(profile.preferences.sound);
    savePref(AUDIO_KEY, profile.preferences.sound);
  }
  if (profile.preferences.haptics !== isHapticsEnabled()) {
    setHapticsEnabled(profile.preferences.haptics);
    savePref(HAPTICS_KEY, profile.preferences.haptics);
  }
  if (needsBestPush) {
    void updateBestScoreIfHigher(state.best).catch(() => {});
  }
  if (needsCoinsPush) {
    void pushCoinsBalance(state.coins).catch(() => {});
  }
};

const boot = () => {
  initRender();
  setAudioEnabled(loadPref(AUDIO_KEY, true));
  setHapticsEnabled(loadPref(HAPTICS_KEY, true));
  state = newGameState(loadBest(), loadCoins());
  gameStartBest = state.best;
  renderBoard(state);
  renderScore(state);
  renderCoins(state);
  wireTray();
  wirePowers();
  initInput(() => state, commitPlace, onDragStart);
  setNearMiss(findNearMiss(state.board).cells);

  document.getElementById('btn-settings')?.addEventListener('click', openSettings);
  document.getElementById('btn-leaderboard')?.addEventListener('click', openLeaderboard);

  document.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener(
    'touchmove',
    (e) => {
      if (e.touches.length > 1) e.preventDefault();
    },
    { passive: false },
  );

  if (firebaseEnabled()) {
    onAuth(() => syncFromAuth());
    void initAuth();
  }
};

boot();
