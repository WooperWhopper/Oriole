// Sole AsyncStorage gateway — reads/writes ItemRecords and ProgressMeta.
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ItemRecord, ProgressMeta, Settings } from '../types';

const KEYS = {
  records: 'oriole:records',
  meta: 'oriole:meta',
  settings: 'oriole:settings',
} as const;

type RecordMap = Record<string, ItemRecord>;

let cachedRecords: RecordMap = {};
let cachedMeta: ProgressMeta | null = null;

const DEFAULT_META: ProgressMeta = {
  currentStreakDays: 0,
  lastActiveDate: null,
  sessionsCompleted: 0,
  speedHistory: [],
  endgameHistory: [],
  automaticByTier: { jamo: 0, geulja: 0, word: 0, phrase: 0 },
  currentTier: 'jamo',
};

export async function loadProfile(): Promise<void> {
  const [rawRecords, rawMeta] = await Promise.all([
    AsyncStorage.getItem(KEYS.records),
    AsyncStorage.getItem(KEYS.meta),
  ]);
  cachedRecords = rawRecords ? (JSON.parse(rawRecords) as RecordMap) : {};
  cachedMeta = rawMeta ? (JSON.parse(rawMeta) as ProgressMeta) : { ...DEFAULT_META };
}

export function getRecord(itemId: string): ItemRecord | null {
  return cachedRecords[itemId] ?? null;
}

export async function upsertRecords(records: ItemRecord[]): Promise<void> {
  for (const r of records) {
    cachedRecords[r.itemId] = r;
  }
  await AsyncStorage.setItem(KEYS.records, JSON.stringify(cachedRecords));
}

export function getMeta(): ProgressMeta {
  return cachedMeta ?? { ...DEFAULT_META };
}

export async function setMeta(meta: ProgressMeta): Promise<void> {
  cachedMeta = meta;
  await AsyncStorage.setItem(KEYS.meta, JSON.stringify(meta));
}

export async function getSettings(): Promise<Settings> {
  const raw = await AsyncStorage.getItem(KEYS.settings);
  if (!raw) return { soundEnabled: true, sessionLength: 20 };
  return JSON.parse(raw) as Settings;
}

export async function setSettings(settings: Settings): Promise<void> {
  await AsyncStorage.setItem(KEYS.settings, JSON.stringify(settings));
}
