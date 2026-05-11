"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { api } from "@/lib/api";

const TOKEN_KEY = "pm_token";
const BOARD_KEY = "pm_board_id";

type AuthContextType = {
  isAuthenticated: boolean;
  boardId: number | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [boardId, setBoardId] = useState<number | null>(null);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    const bid = localStorage.getItem(BOARD_KEY);
    if (token && bid) {
      setIsAuthenticated(true);
      setBoardId(Number(bid));
    }
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const data = await api.login(username, password);
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(BOARD_KEY, String(data.board_id));
      setIsAuthenticated(true);
      setBoardId(data.board_id);
      return true;
    } catch {
      return false;
    }
  };

  const logout = () => {
    api.logout().catch(() => {});
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(BOARD_KEY);
    setIsAuthenticated(false);
    setBoardId(null);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, boardId, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};
