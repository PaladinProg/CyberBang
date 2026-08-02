import { create } from 'zustand';
import { GameState } from '@cyberbang/shared/types';

interface GameStore {
  gameState: GameState | null;
  setGameState: (state: GameState) => void;
  resetGame: () => void;
}

export const useGameStore = create<GameStore>((set) => ({
  gameState: null,
  setGameState: (state) => set({ gameState: state }),
  resetGame: () => set({ gameState: null }),
}));