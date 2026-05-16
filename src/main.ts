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
  spawnHype,
  spawnComboLoss,
  setNearMiss,
  showTargetingBar,
  hideTargetingBar,
  type TargetingState,
} from './render';
import { initInput, handleTrayPointerDown } from './input';
import {
  newGameState,
  newVrCounter,
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
import {
  isAudioEnabled,
  playBad,
  playClearSequence,
  playGameOver,
  playMono,
  playPlace,
  playPower,
  primeAudio,
  setAudioEnabled,
} from './audio';
import { buzz, setHapticsEnabled, isHapticsEnabled } from './haptics';
import { isBgmEnabled, primeBgmIfWanted, setBgmCombo, setBgmEnabled, stopBgm } from './bgm';
import {
  hideOverlay,
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
import { hideHome, showHome, type HomeChoice } from './ui/home';

const BEST_KEY = 'cascade.best.v1';
const AUDIO_KEY = 'cascade.audio.v1';
const HAPTICS_KEY = 'cascade.haptics.v1';
const BGM_KEY = 'cascade.bgm.v1';
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
    if (paintTargeting) return;
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
    enterPaintTargeting();
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

let paintTargeting: TargetingState | null = null;

const enterPaintTargeting = () => {
  if (!canUse(state, 'colorLine')) return;
  paintTargeting = { axis: 'row', color: 'r' };
  showTargetingBar(paintTargeting, {
    onAxisChange: (axis) => {
      if (paintTargeting) paintTargeting.axis = axis;
    },
    onColorChange: (color) => {
      if (paintTargeting) paintTargeting.color = color;
    },
    onCancel: () => exitPaintTargeting(),
  });
};

const exitPaintTargeting = () => {
  paintTargeting = null;
  hideTargetingBar();
};

const handleBoardCellTap = (r: number, c: number) => {
  if (!paintTargeting) return;
  if (!canUse(state, 'colorLine')) {
    exitPaintTargeting();
    return;
  }
  const { axis, color } = paintTargeting;
  const ok = applyPower(state, 'colorLine', { axis, index: axis === 'row' ? r : c, color });
  if (!ok) {
    toast(`That ${axis} has no blocks to recolor.`);
    return;
  }
  const def = POWER_BY_ID.get('colorLine')!;
  exitPaintTargeting();
  afterPowerUse('colorLine', def.cost);
  runClearsIfAny();
};

const afterPowerUse = (id: PowerId, deducted: number) => {
  if (id !== 'redo') {
    saveCoins(state.coins);
  }
  flashPower(id);
  buzz(15);
  playPower();
  renderBoard(state);
  wireTray();
  renderScore(state);
  renderCoins(state, deducted === 0);
  wirePowers();
  setNearMiss(findNearMiss(state.board).cells);
};

const processClear = (
  result: { cells: Set<string>; fullRows: number[]; fullCols: number[]; monoLines: number },
): { isCross: boolean; isSurge: boolean; isDryPity: boolean; isNearMissPity: boolean } => {
  const isDryPity = state.placementsSinceLastClear >= 7;
  const isNearMissPity = state.nearMissStreak >= 3;

  state.combo += 1;
  setBgmCombo(state.combo);

  const isCross = result.fullRows.length >= 2 && result.fullCols.length >= 2;
  state.vrCounter -= 1;
  let isSurge = false;
  if (state.vrCounter <= 0) {
    isSurge = true;
    state.vrCounter = newVrCounter();
  }

  let points = scoreClears(result, state.combo);
  if (isCross) points *= 2;
  if (isDryPity) points *= 2;
  if (isSurge) points *= 3;
  if (isNearMissPity) points += 75;
  points = Math.round(points);

  state.score += points;
  earnCoinsFromScoreDelta(points);
  state.placementsSinceLastClear = 0;
  state.nearMissStreak = 0;

  if (state.score > state.best) {
    state.best = state.score;
    saveBest(state.best);
  }

  return { isCross, isSurge, isDryPity, isNearMissPity };
};

const runClearsIfAny = () => {
  const result = detectClears(state.board);
  if (result.cells.size === 0) {
    wirePowers();
    return;
  }
  const flags = processClear(result);

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
  playClearSequence(steps, state.combo);
  if (result.monoLines > 0) playMono(state.combo, 0.08);
  buzz(state.combo >= 3 || result.monoLines > 0 || flags.isSurge || flags.isCross ? [20, 30, 20] : 10);
  spawnFloat(state.combo, result.monoLines);
  spawnBonusHype(flags);
  if (state.combo >= 3 || result.monoLines > 0 || flags.isCross || flags.isSurge) shakeBoard();

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
};

const spawnBonusHype = (flags: {
  isCross: boolean;
  isSurge: boolean;
  isDryPity: boolean;
  isNearMissPity: boolean;
}) => {
  if (flags.isCross) {
    spawnHype('CASCADE!', 'var(--c-r)');
  } else if (flags.isSurge) {
    spawnHype('SURGE × 3', 'var(--c-y)');
  } else if (flags.isDryPity) {
    spawnHype('COMEBACK!', 'var(--accent)');
  } else if (flags.isNearMissPity) {
    spawnHype('+75', 'var(--c-g)');
  }
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
  playPlace();

  const result = detectClears(state.board);

  if (result.cells.size > 0) {
    const flags = processClear(result);

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
    playClearSequence(steps, state.combo);
    if (result.monoLines > 0) playMono(state.combo, 0.08);
    buzz(state.combo >= 3 || result.monoLines > 0 || flags.isCross || flags.isSurge ? [20, 30, 20] : 10);
    spawnFloat(state.combo, result.monoLines);
    spawnBonusHype(flags);
    if (state.combo >= 3 || result.monoLines > 0 || flags.isCross || flags.isSurge) shakeBoard();

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
    state.placementsSinceLastClear += 1;
    if (state.combo >= 3) {
      spawnComboLoss(state.combo);
      state.combosBroken += 1;
    }
    state.combo = 1;
    setBgmCombo(1);
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

  if (nm.nearLines > 0) {
    state.nearMissStreak += 1;
  } else {
    state.nearMissStreak = 0;
  }

  if (isGameOver(state)) {
    const finalScore = state.score;
    const best = state.best;
    const beatBest = best > gameStartBest;
    void handleGameOverSubmit(finalScore, beatBest);
    presentGameOver(finalScore, best, lastNearLines, state.combosBroken, beatBest);
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
  combosBroken: number,
  beatBest: boolean,
) => {
  stopBgm();
  playGameOver();
  const { user } = getAuthState();
  const showSaveCta = firebaseEnabled() && !!user && user.isAnonymous && beatBest;
  showGameOver({
    score: finalScore,
    best,
    nearLines,
    combosBroken,
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
  setBgmCombo(1);
  primeBgmIfWanted();
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
  primeBgmIfWanted();
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
    bgm: isBgmEnabled(),
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
    onToggleBgm: (v) => {
      setBgmEnabled(v);
      savePref(BGM_KEY, v);
      if (firebaseEnabled()) void updatePreferences({ bgm: v }).catch(() => {});
    },
    onSignIn: () => openSignIn('signup'),
    onSignOut: () => {
      void signOutAndReanon();
      toast('Signed out. Playing as guest.');
    },
  });
};

const openSignIn = (mode: 'signin' | 'signup', onAfterSuccess?: () => void) => {
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
      onAfterSuccess?.();
    },
    onEmailSignUp: async (email, password) => {
      await upgradeWithEmail(email, password);
      toast('Account created. Verification email sent.');
      onAfterSuccess?.();
    },
    onEmailSignIn: async (email, password) => {
      await signInWithEmail(email, password);
      toast('Welcome back!');
      onAfterSuccess?.();
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
  if (profile.preferences.bgm !== isBgmEnabled()) {
    setBgmEnabled(profile.preferences.bgm);
    savePref(BGM_KEY, profile.preferences.bgm);
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
  setBgmEnabled(loadPref(BGM_KEY, false));
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

  document.getElementById('board')?.addEventListener('click', (e) => {
    if (!paintTargeting) return;
    const cell = (e.target as HTMLElement | null)?.closest<HTMLElement>('.cell');
    if (!cell) return;
    const r = Number(cell.dataset['r']);
    const c = Number(cell.dataset['c']);
    if (Number.isNaN(r) || Number.isNaN(c)) return;
    handleBoardCellTap(r, c);
  });

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

  void presentHomeIfNeeded();
};

const waitForAuthReady = (timeoutMs: number): Promise<void> =>
  new Promise<void>((resolve) => {
    let done = false;
    let unsubscribe: (() => void) | null = null;
    const finish = () => {
      if (done) return;
      done = true;
      unsubscribe?.();
      window.clearTimeout(to);
      resolve();
    };
    unsubscribe = onAuth((s) => {
      if (s.isReady) finish();
    });
    const to = window.setTimeout(finish, timeoutMs);
  });

const presentHomeIfNeeded = async () => {
  if (!firebaseEnabled()) {
    showHome({ firebaseEnabled: false, onChoice: handleHomeChoice });
    return;
  }

  await waitForAuthReady(900);
  const { user, profile } = getAuthState();
  if (user && !user.isAnonymous) {
    const name = profile?.displayName || user.displayName || 'back';
    toast(`Welcome back, ${name}`);
    return;
  }

  showHome({ firebaseEnabled: true, onChoice: handleHomeChoice });
};

const startGame = () => {
  primeAudio();
  primeBgmIfWanted();
  hideHome();
};

const handleHomeChoice = (choice: HomeChoice) => {
  if (choice === 'guest') {
    startGame();
    return;
  }
  if (choice === 'google') {
    if (!firebaseEnabled()) {
      toast('Sign-in isn\'t configured yet.');
      return;
    }
    primeAudio();
    void (async () => {
      try {
        await upgradeWithGoogle();
        toast('Signed in. Welcome!');
        startGame();
      } catch (err) {
        toast(humanError(err));
      }
    })();
    return;
  }
  if (choice === 'email') {
    if (!firebaseEnabled()) {
      toast('Sign-in isn\'t configured yet.');
      return;
    }
    openSignIn('signup', () => startGame());
  }
};

boot();
