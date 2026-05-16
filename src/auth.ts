import {
  EmailAuthProvider,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  deleteUser,
  linkWithCredential,
  linkWithPopup,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInAnonymously,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { firebaseEnabled, getAuthOrNull } from './firebase';
import {
  defaultPreferences,
  ensureProfile,
  loadProfile,
  mergeProfilesInto,
  saveProfile,
  type Preferences,
  type UserProfile,
} from './firestore';

export type AuthState = {
  user: User | null;
  profile: UserProfile | null;
  isReady: boolean;
};

let state: AuthState = { user: null, profile: null, isReady: false };
const listeners = new Set<(s: AuthState) => void>();

const emit = () => {
  for (const fn of listeners) fn(state);
};

export const onAuth = (fn: (s: AuthState) => void): (() => void) => {
  listeners.add(fn);
  fn(state);
  return () => listeners.delete(fn);
};

export const getAuthState = (): AuthState => state;

const randomTag = () => {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 4; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
};

const deriveDisplayName = (user: User): string => {
  if (user.isAnonymous) return `Player-${randomTag()}`;
  if (user.displayName) return user.displayName;
  if (user.email) return user.email.split('@')[0] ?? 'Player';
  return 'Player';
};

const refreshProfile = async (user: User): Promise<UserProfile> => {
  let profile = await loadProfile(user.uid);
  if (!profile) {
    profile = await ensureProfile(user.uid, {
      displayName: deriveDisplayName(user),
      email: user.email,
      isAnonymous: user.isAnonymous,
    });
  }
  if (user.displayName && user.displayName !== profile.displayName) {
    profile.displayName = user.displayName;
    await saveProfile(user.uid, { displayName: user.displayName });
  }
  return profile;
};

export const initAuth = async (): Promise<void> => {
  const auth = getAuthOrNull();
  if (!firebaseEnabled() || !auth) {
    state = { user: null, profile: null, isReady: true };
    emit();
    return;
  }

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      try {
        await signInAnonymously(auth);
      } catch {
        state = { user: null, profile: null, isReady: true };
        emit();
      }
      return;
    }
    try {
      const profile = await refreshProfile(user);
      state = { user, profile, isReady: true };
    } catch {
      state = { user, profile: null, isReady: true };
    }
    emit();
  });
};

const snapshotAnon = (user: User): {
  uid: string;
  bestScore: number;
  preferences: Preferences;
  displayName: string;
} => {
  const profile = state.profile;
  return {
    uid: user.uid,
    bestScore: profile?.bestScore ?? 0,
    preferences: profile?.preferences ?? defaultPreferences(),
    displayName: profile?.displayName ?? deriveDisplayName(user),
  };
};

const tryDeleteAnon = async (user: User) => {
  if (!user.isAnonymous) return;
  try {
    await deleteUser(user);
  } catch {
    /* leave orphan; not critical */
  }
};

export const upgradeWithGoogle = async (): Promise<void> => {
  const auth = getAuthOrNull();
  if (!auth) throw new Error('Auth unavailable.');
  const current = auth.currentUser;
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  if (current && current.isAnonymous) {
    const snapshot = snapshotAnon(current);
    try {
      const cred = await linkWithPopup(current, provider);
      const newName = cred.user.displayName ?? snapshot.displayName;
      await saveProfile(cred.user.uid, {
        displayName: newName,
        email: cred.user.email,
        isAnonymous: false,
      });
      if (cred.user.displayName && cred.user.displayName !== newName) {
        await updateProfile(cred.user, { displayName: newName });
      }
      return;
    } catch (err) {
      if (!(err && typeof err === 'object' && 'code' in err)) throw err;
      const code = (err as { code: string }).code;
      if (code !== 'auth/credential-already-in-use' && code !== 'auth/email-already-in-use') {
        throw err;
      }
      const credential = GoogleAuthProvider.credentialFromError(err as never);
      if (!credential) throw err;
      await tryDeleteAnon(current);
      const swapped = await signInWithCredential(auth, credential);
      await mergeProfilesInto(swapped.user.uid, snapshot);
    }
    return;
  }

  if (current && !current.isAnonymous) {
    await signOut(auth);
  }
  await signInWithPopup(auth, provider);
};

export const upgradeWithEmail = async (email: string, password: string): Promise<void> => {
  const auth = getAuthOrNull();
  if (!auth) throw new Error('Auth unavailable.');
  const current = auth.currentUser;

  if (current && current.isAnonymous) {
    const snapshot = snapshotAnon(current);
    const cred = EmailAuthProvider.credential(email, password);
    try {
      const linked = await linkWithCredential(current, cred);
      const dn = email.split('@')[0] ?? 'Player';
      await updateProfile(linked.user, { displayName: dn });
      await saveProfile(linked.user.uid, {
        displayName: dn,
        email: linked.user.email,
        isAnonymous: false,
      });
      try {
        await sendEmailVerification(linked.user);
      } catch {
        /* non-fatal */
      }
      return;
    } catch (err) {
      const code =
        err && typeof err === 'object' && 'code' in err ? (err as { code: string }).code : '';
      if (code !== 'auth/email-already-in-use' && code !== 'auth/credential-already-in-use') {
        throw err;
      }
      await tryDeleteAnon(current);
      const swapped = await signInWithEmailAndPassword(auth, email, password);
      await mergeProfilesInto(swapped.user.uid, snapshot);
      return;
    }
  }

  const fresh = await createUserWithEmailAndPassword(auth, email, password);
  const dn = email.split('@')[0] ?? 'Player';
  await updateProfile(fresh.user, { displayName: dn });
  await saveProfile(fresh.user.uid, {
    displayName: dn,
    email: fresh.user.email,
    isAnonymous: false,
  });
  try {
    await sendEmailVerification(fresh.user);
  } catch {
    /* non-fatal */
  }
};

export const signInWithEmail = async (email: string, password: string): Promise<void> => {
  const auth = getAuthOrNull();
  if (!auth) throw new Error('Auth unavailable.');
  const current = auth.currentUser;

  if (current && current.isAnonymous) {
    const snapshot = snapshotAnon(current);
    await tryDeleteAnon(current);
    const swapped = await signInWithEmailAndPassword(auth, email, password);
    await mergeProfilesInto(swapped.user.uid, snapshot);
    return;
  }

  await signInWithEmailAndPassword(auth, email, password);
};

export const resetPassword = async (email: string): Promise<void> => {
  const auth = getAuthOrNull();
  if (!auth) throw new Error('Auth unavailable.');
  await sendPasswordResetEmail(auth, email);
};

export const signOutAndReanon = async (): Promise<void> => {
  const auth = getAuthOrNull();
  if (!auth) return;
  await signOut(auth);
  try {
    await signInAnonymously(auth);
  } catch {
    /* listener will retry */
  }
};

export const updatePreferences = async (patch: Partial<Preferences>): Promise<void> => {
  const user = state.user;
  const profile = state.profile;
  if (!user || !profile) return;
  const next: Preferences = { ...profile.preferences, ...patch };
  state = { ...state, profile: { ...profile, preferences: next } };
  emit();
  try {
    await saveProfile(user.uid, { preferences: next });
  } catch {
    /* no-op; local change still in memory */
  }
};

export const updateBestScoreIfHigher = async (score: number): Promise<void> => {
  const user = state.user;
  const profile = state.profile;
  if (!user || !profile) return;
  if (score <= profile.bestScore) return;
  state = { ...state, profile: { ...profile, bestScore: score } };
  emit();
  try {
    await saveProfile(user.uid, { bestScore: score });
  } catch {
    /* no-op */
  }
};
