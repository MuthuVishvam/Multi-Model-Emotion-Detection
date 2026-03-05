import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { fetchCurrentUser } from "../services/api";

const AuthContext = createContext({
  user: null,
  loading: true,
  setUser: () => {},
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      const profile = await fetchCurrentUser();
      if (!mounted) {
        return;
      }
      setUser(profile);
      setLoading(false);
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const value = useMemo(() => ({ user, loading, setUser }), [user, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  return useContext(AuthContext);
}
