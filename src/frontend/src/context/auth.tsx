import React, {createContext, useContext, useState} from "react";
import { authClient } from "../lib/auth-client";

interface User {
  email?: string;
  name?: string
}
 
export interface AuthState {
  isAuthenticated: boolean;
  user: User | undefined;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data, isPending } = authClient.useSession();
  //TODO: handle authenticated by session
    const [isAuthenticated, setIsAuthenticated] = useState(false)

  // Show loading state while checking auth
  if (isPending) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        Loading...
      </div>
    );
  }

  const login = async (email: string, password: string) => {
      const {error: authError} = await authClient.signIn.email({
         email,
         password,
          rememberMe: true
      })
        if (authError) {
            throw authError
        }
        setIsAuthenticated(true)
  };

  const logout = async () => {
     await authClient.signOut()
      setIsAuthenticated(false)
  };

  console.log(isAuthenticated)
  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        user: { email: data?.user?.email, name: data?.user?.name },
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
