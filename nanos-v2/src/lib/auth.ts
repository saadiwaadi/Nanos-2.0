"use client";

import { useEffect, useState } from "react";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: string;
};

export type AuthState = {
  user: AuthUser | null;
  token: string | null;
};

const STORAGE_KEY = "nanos_auth_v1";
const CHANGE_EVENT = "nanos-auth-changed";

export function loadAuth(): AuthState {
  if (typeof window === "undefined") return { user: null, token: null };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { user: null, token: null };
    const parsed = JSON.parse(raw) as AuthState;
    return {
      user: parsed.user && typeof parsed.user === "object" ? parsed.user : null,
      token: typeof parsed.token === "string" ? parsed.token : null,
    };
  } catch {
    return { user: null, token: null };
  }
}

export function saveAuth(state: AuthState): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function clearAuth(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function getToken(): string | null {
  return loadAuth().token;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({ user: null, token: null });

  useEffect(() => {
    const sync = () => setState(loadAuth());
    sync();
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return {
    user: state.user,
    token: state.token,
    isLoggedIn: Boolean(state.user && state.token),
    login(user: AuthUser, token: string) {
      saveAuth({ user, token });
    },
    logout() {
      clearAuth();
    },
  };
}
