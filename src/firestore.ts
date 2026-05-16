import {
  collection,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { getDbOrNull } from './firebase';
import type { LeaderboardEntry, LeaderboardData } from './ui/overlays';

export type Preferences = { sound: boolean; haptics: boolean; bgm: boolean };

export type UserProfile = {
  displayName: string;
  email: string | null;
  isAnonymous: boolean;
  preferences: Preferences;
  bestScore: number;
  coins: number;
};

export const defaultPreferences = (): Preferences => ({ sound: true, haptics: true, bgm: false });

const SCORE_CAP = 1_000_000;

export const todayKey = (d = new Date()): string => {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const loadProfile = async (uid: string): Promise<UserProfile | null> => {
  const db = getDbOrNull();
  if (!db) return null;
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    displayName: data['displayName'] ?? 'Player',
    email: data['email'] ?? null,
    isAnonymous: !!data['isAnonymous'],
    preferences: {
      sound: data['preferences']?.sound ?? true,
      haptics: data['preferences']?.haptics ?? true,
      bgm: data['preferences']?.bgm ?? false,
    },
    bestScore: data['bestScore'] ?? 0,
    coins: data['coins'] ?? 0,
  };
};

export const saveProfile = async (uid: string, patch: Partial<UserProfile>): Promise<void> => {
  const db = getDbOrNull();
  if (!db) return;
  const ref = doc(db, 'users', uid);
  const payload: Record<string, unknown> = { ...patch, updatedAt: serverTimestamp() };
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    payload['createdAt'] = serverTimestamp();
  }
  await setDoc(ref, payload, { merge: true });
};

export const ensureProfile = async (
  uid: string,
  defaults: { displayName: string; email: string | null; isAnonymous: boolean },
): Promise<UserProfile> => {
  const existing = await loadProfile(uid);
  if (existing) return existing;
  const profile: UserProfile = {
    displayName: defaults.displayName,
    email: defaults.email,
    isAnonymous: defaults.isAnonymous,
    preferences: defaultPreferences(),
    bestScore: 0,
    coins: 0,
  };
  await saveProfile(uid, profile);
  return profile;
};

export const mergeProfilesInto = async (
  targetUid: string,
  source: {
    uid: string;
    bestScore: number;
    coins: number;
    preferences: Preferences;
    displayName: string;
  },
): Promise<UserProfile> => {
  const db = getDbOrNull();
  if (!db) {
    return {
      displayName: source.displayName,
      email: null,
      isAnonymous: false,
      preferences: source.preferences,
      bestScore: source.bestScore,
      coins: source.coins,
    };
  }
  return runTransaction(db, async (tx) => {
    const targetRef = doc(db, 'users', targetUid);
    const targetSnap = await tx.get(targetRef);
    if (!targetSnap.exists()) {
      const merged: UserProfile = {
        displayName: source.displayName,
        email: null,
        isAnonymous: false,
        preferences: source.preferences,
        bestScore: source.bestScore,
        coins: source.coins,
      };
      tx.set(targetRef, {
        ...merged,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return merged;
    }
    const data = targetSnap.data();
    const existingBest: number = data['bestScore'] ?? 0;
    const existingCoins: number = data['coins'] ?? 0;
    const existingPrefs: Preferences = {
      sound: data['preferences']?.sound ?? true,
      haptics: data['preferences']?.haptics ?? true,
      bgm: data['preferences']?.bgm ?? false,
    };
    const mergedBest = Math.max(existingBest, source.bestScore);
    const mergedCoins = Math.max(existingCoins, source.coins);
    const merged: UserProfile = {
      displayName: data['displayName'] ?? source.displayName,
      email: data['email'] ?? null,
      isAnonymous: false,
      preferences: existingPrefs,
      bestScore: mergedBest,
      coins: mergedCoins,
    };
    tx.update(targetRef, {
      bestScore: mergedBest,
      coins: mergedCoins,
      isAnonymous: false,
      updatedAt: serverTimestamp(),
    });
    return merged;
  });
};

export const submitScore = async (
  uid: string,
  displayName: string,
  score: number,
): Promise<void> => {
  const db = getDbOrNull();
  if (!db) return;
  if (!Number.isFinite(score) || score <= 0 || score > SCORE_CAP) return;
  const intScore = Math.floor(score);
  const day = todayKey();

  const alltimeRef = doc(db, 'leaderboard_alltime', uid);
  const alltimeSnap = await getDoc(alltimeRef);
  if (!alltimeSnap.exists()) {
    await setDoc(alltimeRef, {
      uid,
      displayName,
      score: intScore,
      day,
      achievedAt: serverTimestamp(),
    });
  } else if (intScore > (alltimeSnap.data()['score'] ?? 0)) {
    await setDoc(
      alltimeRef,
      { score: intScore, displayName, day, achievedAt: serverTimestamp() },
      { merge: true },
    );
  }

  const dailyRef = doc(db, 'leaderboard_daily', uid);
  const dailySnap = await getDoc(dailyRef);
  const prevDaily = dailySnap.exists() ? dailySnap.data() : null;
  const sameDay = prevDaily && prevDaily['day'] === day;
  const dailyBeats = !sameDay || intScore > (prevDaily?.['score'] ?? 0);
  if (!dailySnap.exists()) {
    await setDoc(dailyRef, {
      uid,
      displayName,
      score: intScore,
      day,
      achievedAt: serverTimestamp(),
    });
  } else if (dailyBeats) {
    await setDoc(
      dailyRef,
      { score: intScore, displayName, day, achievedAt: serverTimestamp() },
      { merge: true },
    );
  }
};

const fetchTop = async (
  scope: 'today' | 'alltime',
  n: number,
): Promise<LeaderboardEntry[]> => {
  const db = getDbOrNull();
  if (!db) return [];
  const collName = scope === 'today' ? 'leaderboard_daily' : 'leaderboard_alltime';
  const ref = collection(db, collName);
  const q =
    scope === 'today'
      ? query(ref, where('day', '==', todayKey()), orderBy('score', 'desc'), limit(n))
      : query(ref, orderBy('score', 'desc'), limit(n));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      uid: data['uid'] ?? d.id,
      displayName: data['displayName'] ?? 'Player',
      score: data['score'] ?? 0,
    };
  });
};

const fetchMyRank = async (
  scope: 'today' | 'alltime',
  score: number,
): Promise<{ rank: number | null; total: number | null }> => {
  const db = getDbOrNull();
  if (!db || score <= 0) return { rank: null, total: null };
  try {
    const collName = scope === 'today' ? 'leaderboard_daily' : 'leaderboard_alltime';
    const ref = collection(db, collName);
    const greaterQ =
      scope === 'today'
        ? query(ref, where('day', '==', todayKey()), where('score', '>', score))
        : query(ref, where('score', '>', score));
    const totalQ =
      scope === 'today' ? query(ref, where('day', '==', todayKey())) : query(ref);
    const [g, t] = await Promise.all([
      getCountFromServer(greaterQ),
      getCountFromServer(totalQ),
    ]);
    return { rank: g.data().count + 1, total: t.data().count };
  } catch {
    return { rank: null, total: null };
  }
};

export const fetchLeaderboard = async (
  scope: 'today' | 'alltime',
  myUid: string | null,
  myScore: number,
): Promise<LeaderboardData> => {
  const entries = await fetchTop(scope, 50);
  const inTop = !!entries.find((e) => e.uid === myUid);
  let rankInfo: { rank: number | null; total: number | null } = { rank: null, total: null };
  if (!inTop && myScore > 0) {
    rankInfo = await fetchMyRank(scope, myScore);
  }
  return {
    scope,
    entries,
    myRank: rankInfo.rank,
    totalCount: rankInfo.total,
    myScore,
    myUid,
  };
};
