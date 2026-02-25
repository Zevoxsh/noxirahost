/**
 * Auth Store — Zustand
 * Ne persiste PAS dans localStorage — auth via cookies httpOnly
 * Basé sur NebulaProxyV3/frontend/src/store/authStore.js
 */

import { create } from 'zustand';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  setUser: (user: User) => void;
  logout: () => void;
  updateUser: (userData: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,

  setUser: (user) => set({ user, isAuthenticated: true }),

  logout: () => set({ user: null, isAuthenticated: false }),

  updateUser: (userData) =>
    set((state) => ({
      user: state.user ? { ...state.user, ...userData } : null
    }))
}));
