import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type UserRole = "customer" | "restaurant_owner" | "driver" | "admin";

export interface SavedAddress {
  label: string;
  address: string;
}

export type DriverStatus = "pending" | "approved" | "rejected";

export interface AppUser {
  id: number;
  email: string;
  name: string;
  phone: string;
  role: UserRole;
  address?: string;
  savedAddresses?: SavedAddress[];
  isActive?: boolean;
  driverStatus?: DriverStatus | null;
  vehicleType?: string | null;
  createdAt: string;
}

interface AuthContextValue {
  user: AppUser | null;
  token: string | null;
  isLoading: boolean;
  login: (token: string, user: AppUser) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (user: AppUser) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const savedToken = await AsyncStorage.getItem("auth_token");
        const savedUser = await AsyncStorage.getItem("auth_user");
        if (savedToken && savedUser) {
          try {
            setToken(savedToken);
            setUser(JSON.parse(savedUser));
          } catch {
            // Corrupted session data — clear it so the user is sent to login cleanly
            await AsyncStorage.removeItem("auth_token");
            await AsyncStorage.removeItem("auth_user");
          }
        }
      } catch {
        // Storage read failure — continue as unauthenticated
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login = async (newToken: string, newUser: AppUser) => {
    await AsyncStorage.setItem("auth_token", newToken);
    await AsyncStorage.setItem("auth_user", JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  const logout = async () => {
    await AsyncStorage.removeItem("auth_token");
    await AsyncStorage.removeItem("auth_user");
    setToken(null);
    setUser(null);
  };

  const updateUser = (updated: AppUser) => {
    setUser(updated);
    AsyncStorage.setItem("auth_user", JSON.stringify(updated)).catch(() => {});
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
