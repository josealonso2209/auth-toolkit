import { create } from "zustand";
import type { User } from "@/types";

interface AuthState {
  user: User | null;
  sessionId: string | null;
  setAuth: (user: User, sessionId: string) => void;
  clearAuth: () => void;
  hasRole: (...roles: string[]) => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: JSON.parse(localStorage.getItem("user") || "null"),
  sessionId: localStorage.getItem("session_id"),

  setAuth: (user, sessionId) => {
    localStorage.setItem("user", JSON.stringify(user));
    localStorage.setItem("session_id", sessionId);
    set({ user, sessionId });
  },

  clearAuth: () => {
    localStorage.removeItem("user");
    localStorage.removeItem("session_id");
    set({ user: null, sessionId: null });
  },

  hasRole: (...roles) => {
    const { user } = get();
    return user ? roles.includes(user.role) : false;
  },
}));
