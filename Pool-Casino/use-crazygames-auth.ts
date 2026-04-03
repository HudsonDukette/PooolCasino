import { useState, useEffect, useCallback, useRef } from "react";

declare global {
  interface Window {
    CrazyGames?: {
      SDK: {
        init(): Promise<void>;
        user: {
          getUser(): Promise<{ userId: string; username: string; profilePictureUrl?: string } | null>;
          getUserToken(): Promise<string>;
          showAuthPrompt(): Promise<void>;
          showAccountLinkPrompt(): Promise<void>;
          isUserAccountAvailable: boolean;
        };
      };
    };
  }
}

export type CGAuthState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "unavailable" }
  | { status: "ready"; isLoggedIn: boolean }
  | { status: "error"; message: string };

async function verifyCGToken(token: string, endpoint: string, method = "POST") {
  const res = await fetch(endpoint, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error || "CrazyGames request failed");
  }
  return res.json();
}

export function useCrazyGamesAuth() {
  const [state, setState] = useState<CGAuthState>({ status: "idle" });
  const [sdk, setSdk] = useState<Window["CrazyGames"] | null>(null);
  const [isCrazyGames, setIsCrazyGames] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (initialized.current) return;
      initialized.current = true;

      const cgExists = !!window.CrazyGames?.SDK;
      setIsCrazyGames(cgExists);

      if (cgExists) {
        const sdkRef = window.CrazyGames!;
        setSdk(sdkRef);
        sdkRef.SDK.init()
          .then(() => {
            const available = sdkRef.SDK.user.isUserAccountAvailable;
            setState(available ? { status: "ready", isLoggedIn: false } : { status: "unavailable" });
          })
          .catch(() => setState({ status: "unavailable" }));
      } else {
        setState({ status: "unavailable" });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const loginWithCrazyGames = useCallback(async (): Promise<{ user: unknown; message: string }> => {
    if (!sdk) throw new Error("CrazyGames SDK not available");
    setState({ status: "loading" });
    try {
      let user = await sdk.SDK.user.getUser();
      if (!user) {
        await sdk.SDK.user.showAuthPrompt();
        user = await sdk.SDK.user.getUser();
      }
      if (!user) throw new Error("Authentication cancelled");
      const token = await sdk.SDK.user.getUserToken();
      const result = await verifyCGToken(token, "/api/auth/crazygames");
      setState({ status: "ready", isLoggedIn: true });
      return result;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "CrazyGames login failed";
      setState({ status: "ready", isLoggedIn: false });
      throw new Error(message);
    }
  }, [sdk]);

  const linkCrazyGamesAccount = useCallback(async (): Promise<{ user: unknown; message: string }> => {
    if (!sdk) throw new Error("CrazyGames SDK not available");
    setState({ status: "loading" });
    try {
      let user = await sdk.SDK.user.getUser();
      if (!user) {
        await sdk.SDK.user.showAuthPrompt();
        user = await sdk.SDK.user.getUser();
      }
      if (!user) throw new Error("Authentication cancelled");
      const token = await sdk.SDK.user.getUserToken();
      const result = await verifyCGToken(token, "/api/auth/crazygames/link");
      setState({ status: "ready", isLoggedIn: true });
      return result;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Linking failed";
      setState({ status: "ready", isLoggedIn: false });
      throw new Error(message);
    }
  }, [sdk]);

  const showAccountLinkPrompt = useCallback(async (): Promise<void> => {
    if (!sdk) return;
    try {
      await sdk.SDK.user.showAccountLinkPrompt();
    } catch {
    }
  }, [sdk]);

  const isAvailable = state.status === "ready" || state.status === "loading";
  const isLoading = state.status === "loading";

  return {
    state,
    isCrazyGames,
    isAvailable,
    isLoading,
    loginWithCrazyGames,
    linkCrazyGamesAccount,
    showAccountLinkPrompt,
  };
}
