// src/auth/context.js
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import API, { bootstrapAuth } from '../api/client';

const TOKEN_KEY = 'kolder_token';
const PROFILE_KEY = 'kolder_profile';
const isWeb = Platform.OS === 'web';

/** Storage compatible Web/Nativo */
const storage = {
  getItem: async (key) => {
    if (isWeb) {
      try { return window.localStorage.getItem(key); } catch { return null; }
    }
    return SecureStore.getItemAsync(key);
  },
  setItem: async (key, value) => {
    if (isWeb) {
      try { window.localStorage.setItem(key, value); } catch {}
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },
  removeItem: async (key) => {
    if (isWeb) {
      try { window.localStorage.removeItem(key); } catch {}
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};

const AuthCtx = createContext({
  token: null,
  profile: null,
  loading: true,
  setToken: async () => {},
  login: async () => ({ token: null, profile: null }),
  logout: async () => {},
  refreshProfile: async () => {},
});

export function AuthProvider({ children }) {
  const [token, setTokenState] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // helpers de storage (identidad estable)
  const saveToken = useCallback(
    async (t) => (t ? storage.setItem(TOKEN_KEY, t) : storage.removeItem(TOKEN_KEY)),
    []
  );

  const saveProfile = useCallback(
    async (p) => (p ? storage.setItem(PROFILE_KEY, JSON.stringify(p)) : storage.removeItem(PROFILE_KEY)),
    []
  );

  const loadToken = useCallback(() => storage.getItem(TOKEN_KEY), []);
  const loadProfile = useCallback(async () => {
    const raw = await storage.getItem(PROFILE_KEY);
    try { return raw ? JSON.parse(raw) : null; } catch { return null; }
  }, []);

  /** Bootstrap inicial: restaura token/perfil y refresca /auth/me si hay token */
  useEffect(() => {
    (async () => {
      try {
        const persistedToken = await loadToken();
        const persistedProfile = await loadProfile();

        await bootstrapAuth(() => persistedToken);
        if (persistedToken) {
          API.setToken(persistedToken);
          setTokenState(persistedToken);
          setProfile(persistedProfile || null);

          try {
            const fresh = await API.getProfile(); // ← devuelve el perfil directo o null
            if (fresh) {
              setProfile(fresh);
              await saveProfile(fresh);
            }
          } catch (e) {
            console.warn('[AUTH] getProfile failed on bootstrap:', e?.message);
          }
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [loadToken, loadProfile, saveProfile]);

  /** Mantén Axios sincronizado si el token cambia (defensa adicional) */
  useEffect(() => {
    API.setToken(token || null);
  }, [token]);

  /** Login: obtiene token y asegura profile fresco */
  const login = useCallback(
    async (email, password) => {
      const res = await API.login(email, password); // { token, profile? }
      const t = res?.token;
      if (!t) throw new Error('Login sin token');

      API.setToken(t);
      setTokenState(t);
      await saveToken(t);

      // si el backend devuelve profile junto al login, úsalo; si no, llama /auth/me
      let freshProfile = res?.profile || null;
      if (!freshProfile) {
        const p = await API.getProfile(); // ← perfil directo
        freshProfile = p || null;
      }

      setProfile(freshProfile);
      await saveProfile(freshProfile);

      return { token: t, profile: freshProfile };
    },
    [saveToken, saveProfile]
  );

  /** Refresca /auth/me manualmente */
  const refreshProfile = useCallback(
    async () => {
      if (!token) return null;
      try {
        const fresh = await API.getProfile(); // ← perfil directo
        if (fresh) {
          setProfile(fresh);
          await saveProfile(fresh);
          return fresh;
        }
      } catch (e) {
        console.warn('[AUTH] refreshProfile failed:', e?.message);
      }
      return null;
    },
    [token, saveProfile]
  );

  const setToken = useCallback(
    async (t) => {
      if (t) {
        API.setToken(t);
        setTokenState(t);
        await saveToken(t);
        try {
          const fresh = await API.getProfile(); // ← perfil directo
          if (fresh) {
            setProfile(fresh);
            await saveProfile(fresh);
          }
        } catch (e) {
          console.warn('[AUTH] getProfile failed after setToken:', e?.message);
        }
      } else {
        API.setToken(null);
        setTokenState(null);
        setProfile(null);
        await saveToken(null);
        await saveProfile(null);
      }
    },
    [saveToken, saveProfile]
  );

  const logout = useCallback(
    async () => {
      API.setToken(null);
      setTokenState(null);
      setProfile(null);
      await saveToken(null);
      await saveProfile(null);
    },
    [saveToken, saveProfile]
  );

  const value = useMemo(
    () => ({ token, profile, loading, setToken, login, logout, refreshProfile }),
    [token, profile, loading, setToken, login, logout, refreshProfile]
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  return useContext(AuthCtx);
}
