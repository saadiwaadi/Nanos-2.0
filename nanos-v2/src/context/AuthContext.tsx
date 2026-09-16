"use client";

import { createContext, useContext, ReactNode } from "react";
import { useAuth as useAuthStore } from "@/lib/auth";

type AuthContextType = ReturnType<typeof useAuthStore>;

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuthStore();
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
