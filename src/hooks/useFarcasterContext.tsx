import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface FarcasterContextValue {
  isFarcasterMiniApp: boolean;
}

const FarcasterContext = createContext<FarcasterContextValue>({ isFarcasterMiniApp: false });

export function FarcasterProvider({ children }: { children: ReactNode }) {
  const [isFarcasterMiniApp, setIsFarcasterMiniApp] = useState(false);

  useEffect(() => {
    const detect = async () => {
      try {
        const { sdk } = await import("@farcaster/miniapp-sdk");
        // context가 존재하면 Farcaster 환경
        const ctx = await Promise.race([
          sdk.context,
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500)),
        ]);
        setIsFarcasterMiniApp(!!ctx);
      } catch {
        setIsFarcasterMiniApp(false);
      }
    };

    void detect();
  }, []);

  return (
    <FarcasterContext.Provider value={{ isFarcasterMiniApp }}>
      {children}
    </FarcasterContext.Provider>
  );
}

export function useFarcasterContext() {
  return useContext(FarcasterContext);
}
