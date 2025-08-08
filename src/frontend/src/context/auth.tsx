import React, { createContext, useContext } from "react";
import { authClient } from "../lib/auth-client";

interface User {
  email?: string;
}
 
export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  login: (email: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data, isPending } = authClient.useSession();

  // Show loading state while checking auth
  if (isPending) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        Loading...
      </div>
    );
  }

  const login = async (email: string) => {
    try {
      const { error: authError } = await authClient.signIn.magicLink({
        email,
        name: email,
        callbackURL: "/dashboard",
      });

      if (authError) {
        throw new Error(authError.message);
      }
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      } else {
        console.error(error);
      }
    }
  };

  // TODO: handle logout
  const logout = () => {
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: data?.session?.expiresAt ? data.session.expiresAt > new Date(): false,
        user: { email: data?.user?.email },
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// TODO: determine if fast refresh is important and affects anything
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
