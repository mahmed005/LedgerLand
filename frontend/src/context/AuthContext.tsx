/* ═══════════════════════════════════════════════════════
   LedgerLand — Auth Context
   JWT-based auth state with localStorage persistence
   ═══════════════════════════════════════════════════════ */

import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { api, setToken, clearToken, getToken } from "../api/client";

/* ── Types ───────────────────────────────────────────── */

export interface User {
  id: string;
  cnic: string;
  fullName: string;
  email: string | null;
  role: "citizen" | "admin" | "judge";
  createdAt: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  isAuthenticated: boolean;
  login: (cnic: string, password: string) => Promise<User>;
  signup: (data: SignupData) => Promise<void>;
  logout: () => void;
}

interface SignupData {
  cnic: string;
  password: string;
  fullName: string;
  email?: string;
}

/* ── Reducer ─────────────────────────────────────────── */

type Action =
  | { type: "LOGIN"; user: User; token: string }
  | { type: "LOGOUT" }
  | { type: "SET_USER"; user: User }
  | { type: "SET_LOADING"; loading: boolean };

function authReducer(state: AuthState, action: Action): AuthState {
  switch (action.type) {
    case "LOGIN":
      return { user: action.user, token: action.token, loading: false };
    case "LOGOUT":
      return { user: null, token: null, loading: false };
    case "SET_USER":
      return { ...state, user: action.user, loading: false };
    case "SET_LOADING":
      return { ...state, loading: action.loading };
    default:
      return state;
  }
}

/* ── Context ─────────────────────────────────────────── */

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const existingToken = getToken();
  const [state, dispatch] = useReducer(authReducer, {
    user: null,
    token: existingToken,
    loading: !!existingToken, // loading only if we need to rehydrate
  });

  // Rehydrate user from stored token on mount
  useEffect(() => {
    const token = getToken();
    if (!token) return;

    api
      .get<{ user: User }>("/auth/me")
      .then((data) => {
        dispatch({ type: "SET_USER", user: data.user });
      })
      .catch(() => {
        // Token expired or invalid
        clearToken();
        dispatch({ type: "LOGOUT" });
      });
  }, []);

  const login = useCallback(async (cnic: string, password: string): Promise<User> => {
    const data = await api.post<{ token: string; user: User }>("/auth/login", {
      cnic,
      password,
    });
    setToken(data.token);
    dispatch({ type: "LOGIN", user: data.user, token: data.token });
    return data.user;
  }, []);

  const signup = useCallback(async (signupData: SignupData) => {
    // Sign up, then auto-login
    await api.post("/auth/signup", signupData);
    // Now login to get token
    const data = await api.post<{ token: string; user: User }>("/auth/login", {
      cnic: signupData.cnic,
      password: signupData.password,
    });
    setToken(data.token);
    dispatch({ type: "LOGIN", user: data.user, token: data.token });
  }, []);

  const logout = useCallback(() => {
    clearToken();
    dispatch({ type: "LOGOUT" });
  }, []);

  const value: AuthContextValue = {
    ...state,
    isAuthenticated: !!state.user && !!state.token,
    login,
    signup,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Hook to access auth state and actions */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
