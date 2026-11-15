const KEY = 'shift-plus-save-v1';

export interface SaveData {
  unlocked: number; // number of levels the player can pick
  deaths: Record<number, number>;
  best: Record<number, number>; // fastest clear in ms
  muted: boolean;
}

const defaults: SaveData = { unlocked: 1, deaths: {}, best: {}, muted: false };

export function load(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...defaults, ...JSON.parse(raw) };
  } catch {
    // Private mode or blocked storage: play without saving.
  }
  return { ...defaults };
}

export function save(data: SaveData) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}
