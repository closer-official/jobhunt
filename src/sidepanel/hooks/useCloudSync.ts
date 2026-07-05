// sidepanel/hooks/useCloudSync.ts — Firebaseサインインとクラウド同期状態
import { useEffect, useState } from "preact/hooks";
import {
  ensureAuthPersistence,
  signInWithGoogle,
  signOutFirebase,
  watchAuthState,
} from "../../cloud/firebaseClient";
import { isCloudEnabled } from "../../cloud/firebaseClient";
import { syncCloudStateToLocal } from "../../cloud/snapshotSync";

export type CloudSyncStatus = "disabled" | "loading" | "signed_out" | "signed_in" | "syncing" | "error";

export interface CloudUserInfo {
  displayName: string | null;
  email: string | null;
  uid: string;
}

export function useCloudSync() {
  const [status, setStatus] = useState<CloudSyncStatus>(isCloudEnabled() ? "loading" : "disabled");
  const [user, setUser] = useState<CloudUserInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isCloudEnabled()) return;
    let alive = true;
    let unsubscribe = () => {};

    const bootstrap = async () => {
      try {
        await ensureAuthPersistence();
        unsubscribe = watchAuthState((fbUser) => {
          if (!alive) return;
          if (!fbUser) {
            setUser(null);
            setError(null);
            setStatus("signed_out");
            return;
          }

          setUser({
            displayName: fbUser.displayName ?? null,
            email: fbUser.email ?? null,
            uid: fbUser.uid,
          });
          setStatus("syncing");
          syncCloudStateToLocal()
            .then((result) => {
              if (!alive) return;
              setError(null);
              setStatus("signed_in");
              if (result.source !== "none") {
                // local storage listener が画面を更新する
              }
            })
            .catch((err: unknown) => {
              if (!alive) return;
              setError(err instanceof Error ? err.message : String(err));
              setStatus("error");
            });
        });
      } catch (err) {
        if (!alive) return;
        setError(err instanceof Error ? err.message : String(err));
        setStatus("error");
      }
    };

    bootstrap();
    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  const signIn = async () => {
    setStatus("syncing");
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus(isCloudEnabled() ? "signed_out" : "disabled");
      throw err;
    }
  };

  const signOut = async () => {
    await signOutFirebase();
  };

  const syncNow = async () => {
    if (!isCloudEnabled()) return;
    setStatus("syncing");
    setError(null);
    try {
      const result = await syncCloudStateToLocal();
      setStatus(user ? "signed_in" : "signed_out");
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("error");
      throw err;
    }
  };

  return {
    enabled: isCloudEnabled(),
    error,
    signIn,
    signOut,
    status,
    syncNow,
    user,
  };
}
