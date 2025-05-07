
'use client';

import type { SpriteSlots } from '@/app/page';

export interface SavedGame {
  id: string; // Unique ID, e.g., timestamp
  name: string; // User-given name or derived from description
  spriteSlots: SpriteSlots;
  worldBackgroundDataUri: string; // The first generated background
  initialWorldDescription: string; // The prompt for the first background
  createdAt: string; // ISO date string
}

const STORAGE_KEY = 'spriteCraftSavedGames';

export function saveGame(
  gameName: string,
  sprites: SpriteSlots,
  worldBg: string,
  worldDesc: string
): SavedGame | null {
  try {
    const games = getSavedGames();
    const newGame: SavedGame = {
      id: Date.now().toString(),
      name: gameName || `Game from ${new Date().toLocaleString()}`,
      spriteSlots: sprites,
      worldBackgroundDataUri: worldBg,
      initialWorldDescription: worldDesc,
      createdAt: new Date().toISOString(),
    };
    games.push(newGame);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(games));
    return newGame;
  } catch (error) {
    console.error("Error saving game to localStorage:", error);
    // Handle potential QuotaExceededError
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      alert("Could not save game: Storage limit reached. Please clear some browser data or delete existing saved games.");
    } else {
      alert("Could not save game. See console for details.");
    }
    return null;
  }
}

export function getSavedGames(): SavedGame[] {
  if (typeof window === 'undefined') return []; // Guard for SSR
  try {
    const gamesJson = localStorage.getItem(STORAGE_KEY);
    return gamesJson ? JSON.parse(gamesJson) : [];
  } catch (error) {
    console.error("Error retrieving games from localStorage:", error);
    return [];
  }
}

export function getSavedGame(id: string): SavedGame | null {
  const games = getSavedGames();
  return games.find(game => game.id === id) || null;
}

export function deleteGame(id: string): boolean {
  try {
    let games = getSavedGames();
    games = games.filter(game => game.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(games));
    return true;
  } catch (error) {
    console.error("Error deleting game from localStorage:", error);
    return false;
  }
}
