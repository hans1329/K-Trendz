import { useMemo } from 'react';
import { Wallet, LogIn, Loader2, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useWalletAuth } from '@/hooks/useWalletAuth';

interface WalletSignInProps {
  /** 로그인 성공 후 이동할 경로 (기본값: '/') */
  redirectTo?: string;
  /** 간소화된 UI (연결 + 로그인 한 버튼) */
  compact?: boolean;
}

/**
 * 지갑 연결(Connect)과 로그인(Sign in)을 제공하는 컴포넌트
 * - /auth 페이지와 /challenges 페이지 모두에서 사용 가능
 */
export default function WalletSignIn({ redirectTo = '/', compact = false }: WalletSignInProps) {
  const {
    connectedAddress,
    isConnecting,
    isSigningIn,
    isProcessing,
    connectWallet,
    disconnectWallet,
    signInWithWallet,
    signInWithConnectedWallet,
  } = useWalletAuth({ redirectTo });

  const shortAddress = useMemo(() => {
    if (!connectedAddress) return null;
    return `${connectedAddress.slice(0, 6)}...${connectedAddress.slice(-4)}`;
  }, [connectedAddress]);

  // Compact 모드: 연결 안 되어있으면 연결+로그인 한 번에, 되어있으면 로그인만
  if (compact) {
    return (
      <Button
        type="button"
        variant="outline"
        onClick={connectedAddress ? signInWithConnectedWallet : signInWithWallet}
        disabled={isProcessing}
        className="w-full h-12 text-sm border-muted-foreground/50 text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        {isProcessing ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            {isConnecting ? 'Connecting...' : 'Signing in...'}
          </>
        ) : (
          <>
            <svg className="h-4 w-4 mr-2" viewBox="0 0 111 111" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M54.921 110.034C85.359 110.034 110.034 85.402 110.034 55.017C110.034 24.6319 85.359 0 54.921 0C26.0432 0 2.35281 22.1714 0 50.3923H72.8467V59.6416H0C2.35281 87.8625 26.0432 110.034 54.921 110.034Z" fill="currentColor"/>
            </svg>
            Continue with Base Wallet
          </>
        )}
      </Button>
    );
  }

  // Full 모드: 카드 형태로 연결 상태 표시
  return (
    <div className="rounded-2xl border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-medium">Wallet sign-in</p>
        </div>
        {connectedAddress && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={disconnectWallet}
            className="rounded-full"
          >
            <X className="h-4 w-4 mr-1" />
            Disconnect
          </Button>
        )}
      </div>

      {connectedAddress ? (
        <>
          <p className="text-xs text-muted-foreground">Connected: {shortAddress}</p>
          <Button
            type="button"
            onClick={signInWithConnectedWallet}
            disabled={isSigningIn}
            className="w-full rounded-full"
          >
            {isSigningIn ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Signing in...
              </>
            ) : (
              <>
                <LogIn className="h-4 w-4 mr-2" />
                Sign in with Wallet
              </>
            )}
          </Button>
        </>
      ) : (
        <Button
          type="button"
          onClick={() => connectWallet()}
          disabled={isConnecting}
          className="w-full rounded-full"
        >
          {isConnecting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              <Wallet className="h-4 w-4 mr-2" />
              Connect Wallet
            </>
          )}
        </Button>
      )}

      <p className="text-xs text-muted-foreground">
        Use your Base wallet to create and access your K-Trendz account.
      </p>
    </div>
  );
}
