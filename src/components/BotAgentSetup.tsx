import { useState, useCallback, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Wallet,
  Shield,
  Copy,
  Check,
  ChevronRight,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { useCoinbaseWallet } from "@/hooks/useCoinbaseWallet";
import { toast } from "sonner";
import { ethers } from "ethers";

// 지갑 타입
type WalletType = "coinbase" | "metamask";

// V3 Bot Contract
const BOT_CONTRACT_ADDRESS = "0xBBf57b07847E355667D4f8583016dD395c5cB1D1";
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const USDC_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
];

// 승인 금액 옵션 (USDC)
const APPROVE_OPTIONS = [
  { label: "$50", value: 50 },
  { label: "$100", value: 100 },
  { label: "$500", value: 500 },
  { label: "Unlimited", value: -1 },
];

// 클립보드 복사 버튼
const CopyButton = ({ text, className = "" }: { text: string; className?: string }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handleCopy} className={`p-1.5 rounded-md hover:bg-muted transition-colors ${className}`}>
      {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
    </button>
  );
};

type Step = "connect" | "approve" | "register" | "done";

const BotAgentSetup = () => {
  const { connectWallet, connectedAddress, isConnecting, disconnectWallet, getProvider } = useCoinbaseWallet();
  const [currentStep, setCurrentStep] = useState<Step>("connect");
  const [approveAmount, setApproveAmount] = useState(100);
  const [isApproving, setIsApproving] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [agentName, setAgentName] = useState("");
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [currentAllowance, setCurrentAllowance] = useState<number | null>(null);
  const [walletType, setWalletType] = useState<WalletType | null>(null);
  const [metamaskAddress, setMetamaskAddress] = useState<string | null>(null);
  const [isMetamaskConnecting, setIsMetamaskConnecting] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);

  // EIP-6963 이벤트로 지갑 provider 수집 (Coinbase SDK가 window.ethereum 덮어쓰는 문제 해결)
  useEffect(() => {
    if (!(window as any).__eip6963Providers) {
      (window as any).__eip6963Providers = [];
    }
    const handler = (event: any) => {
      const { info, provider } = event.detail || {};
      if (!info || !provider) return;
      const existing = (window as any).__eip6963Providers as Array<{ info: any; provider: any }>;
      if (!existing.find((p: any) => p.info?.uuid === info.uuid)) {
        existing.push({ info, provider });
        console.log("[EIP-6963] Wallet discovered:", info.name, info.rdns);
      }
    };
    window.addEventListener("eip6963:announceProvider", handler);
    // 기존에 등록된 provider를 요청
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    return () => window.removeEventListener("eip6963:announceProvider", handler);
  }, []);

  // 현재 연결된 주소 (Coinbase 또는 MetaMask)
  const activeAddress = walletType === "metamask" ? metamaskAddress : connectedAddress;

  // 진짜 MetaMask인지 판별
  const isRealMetaMask = useCallback((p: any) => {
    if (!p?.isMetaMask) return false;
    if (p.isPhantom || p.isCoinbaseWallet || p.coinbaseWalletInstalls || p.isCoinbaseBrowser || p.isBraveWallet) return false;
    return true;
  }, []);

  // EIP-6963 이벤트로 MetaMask provider 탐지 (Coinbase SDK 충돌 해결)
  const getMetamaskProvider = useCallback((): any => {
    // 1) EIP-6963 캐시된 providers 확인
    if ((window as any).__eip6963Providers) {
      const providers = (window as any).__eip6963Providers as Array<{ info: any; provider: any }>;
      const mm = providers.find((p) => p.info?.rdns === "io.metamask" || p.info?.name === "MetaMask");
      if (mm) {
        console.log("[MM] Found via EIP-6963 cache:", mm.info?.name);
        return mm.provider;
      }
    }

    const eth = window.ethereum as any;
    if (!eth) return null;

    // 2) providers 배열 (multi-provider 환경)
    if (eth.providers?.length) {
      const mm = eth.providers.find((p: any) => isRealMetaMask(p));
      if (mm) { console.log("[MM] Found in providers array"); return mm; }
    }

    // 3) detected 배열
    if (eth.detected?.length) {
      const mm = eth.detected.find((p: any) => isRealMetaMask(p));
      if (mm) { console.log("[MM] Found in detected array"); return mm; }
    }

    // 4) 단일 provider
    if (isRealMetaMask(eth)) { console.log("[MM] Found as single provider"); return eth; }

    // 5) providerMap (레거시)
    if ((window as any).providerMap) {
      const map = (window as any).providerMap as Map<string, any>;
      for (const [, p] of map) {
        if (isRealMetaMask(p)) { console.log("[MM] Found in providerMap"); return p; }
      }
    }

    console.log("[MM] Not found. ethereum flags:", { isMetaMask: eth.isMetaMask, isCoinbaseWallet: eth.isCoinbaseWallet, isPhantom: eth.isPhantom });
    return null;
  }, [isRealMetaMask]);

  // 현재 활성 provider 가져오기 (EIP-6963 캐시 우선 사용)
  const getActiveProvider = useCallback(() => {
    if (walletType === "metamask") {
      const mmProvider = getMetamaskProvider();
      if (!mmProvider) throw new Error("MetaMask provider not found");
      return new ethers.BrowserProvider(mmProvider);
    }
    const cbProvider = getProvider();
    return new ethers.BrowserProvider(cbProvider as any);
  }, [walletType, getProvider, getMetamaskProvider]);

  // Allowance 확인 공통 함수
  const checkAllowance = useCallback(async (address: string) => {
    try {
      const provider = getActiveProvider();
      const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, provider);
      const allowance = await usdcContract.allowance(address, BOT_CONTRACT_ADDRESS);
      const allowanceUsdc = Number(allowance) / 1e6;
      setCurrentAllowance(allowanceUsdc);
      setCurrentStep(allowanceUsdc > 0 ? "register" : "approve");
    } catch (e) {
      console.warn("Allowance check failed:", e);
      setCurrentStep("approve");
    }
  }, [getActiveProvider]);

  // Step 1: Coinbase 지갑 연결
  const handleConnectCoinbase = useCallback(async () => {
    setShowWalletModal(false);
    try {
      const address = await connectWallet();
      if (address) {
        setWalletType("coinbase");
        await checkAllowance(address);
      }
    } catch (error: any) {
      if (error?.code !== 4001) {
        toast.error("Wallet connection failed");
      }
    }
  }, [connectWallet, checkAllowance]);

  const isMobileDevice = useCallback(() => {
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  }, []);

  // Step 1: MetaMask 지갑 연결
  const handleConnectMetamask = useCallback(async () => {
    setShowWalletModal(false);

    // 모바일: MetaMask 앱의 인앱 브라우저로 열기
    if (isMobileDevice()) {
      const mmProvider = getMetamaskProvider();
      if (!mmProvider) {
        // 프로덕션 도메인 사용, Trade 탭으로 복귀
        const targetUrl = `https://k-trendz.com/bot-trading?tab=trade`;
        const deepLink = `https://metamask.app.link/dapp/${targetUrl.replace(/^https?:\/\//, "")}`;
        // window.open으로 시도 (iframe 제약 우회)
        const opened = window.open(deepLink, "_blank");
        if (!opened) {
          // 팝업 차단 시 직접 이동
          window.location.href = deepLink;
        }
        return;
      }
    }

    const mmProvider = getMetamaskProvider();
    if (!mmProvider) {
      toast.error("MetaMask not detected. Please install the MetaMask browser extension first.", {
        duration: 5000,
        action: {
          label: "Install",
          onClick: () => window.open("https://metamask.io/download/", "_blank"),
        },
      });
      return;
    }
    setIsMetamaskConnecting(true);
    try {
      const accounts: string[] = await mmProvider.request({ method: "eth_requestAccounts" });
      if (accounts && accounts.length > 0) {
        // Base 네트워크로 전환
        try {
          await mmProvider.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: "0x2105" }],
          });
        } catch (switchErr: any) {
          if (switchErr?.code === 4902) {
            await mmProvider.request({
              method: "wallet_addEthereumChain",
              params: [{
                chainId: "0x2105",
                chainName: "Base",
                nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
                rpcUrls: ["https://mainnet.base.org"],
                blockExplorerUrls: ["https://basescan.org"],
              }],
            });
          }
        }
        const address = accounts[0];
        setMetamaskAddress(address);
        setWalletType("metamask");
        await checkAllowance(address);
      }
    } catch (error: any) {
      if (error?.code === 4001 || error?.code === "ACTION_REJECTED") return;
      // -32603 "Unexpected error" = provider가 MetaMask가 아님
      if (error?.code === -32603 || error?.message?.includes("coalesce") || error?.message?.includes("Unexpected error")) {
        toast.error("MetaMask not available. Please install the extension or use Coinbase Wallet instead.", { duration: 5000 });
      } else {
        toast.error(error?.shortMessage || error?.message || "MetaMask connection failed");
      }
      console.error("MetaMask error:", error);
    } finally {
      setIsMetamaskConnecting(false);
    }
  }, [checkAllowance, getMetamaskProvider]);


  // Step 2: USDC Approve
  const handleApprove = useCallback(async () => {
    if (!activeAddress) return;
    setIsApproving(true);
    try {
      // Raw provider 가져오기
      let rawProvider: any;
      if (walletType === "metamask") {
        rawProvider = getMetamaskProvider();
        if (!rawProvider) throw new Error("MetaMask provider not found");
        // Base 네트워크 전환 확인
        try {
          await rawProvider.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: "0x2105" }],
          });
        } catch {
          // 이미 Base이면 무시
        }
      } else {
        rawProvider = getProvider();
      }

      // 네트워크 전환 후 새로 BrowserProvider 생성 (stale 캐시 방지)
      const provider = new ethers.BrowserProvider(rawProvider, {
        name: "Base",
        chainId: 8453,
      });
      const signer = await provider.getSigner();
      const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, signer);

      const amount = approveAmount === -1
        ? ethers.MaxUint256
        : BigInt(approveAmount) * 1_000_000n; // USDC 6 decimals

      const tx = await usdcContract.approve(BOT_CONTRACT_ADDRESS, amount);
      toast.info("Approving USDC... Please wait for confirmation.");
      await tx.wait();

      const label = approveAmount === -1 ? "Unlimited" : `$${approveAmount}`;
      setCurrentAllowance(approveAmount === -1 ? Infinity : approveAmount);
      toast.success(`USDC approved: ${label}`);
      setCurrentStep("register");
    } catch (error: any) {
      if (error?.code !== 4001 && error?.code !== "ACTION_REJECTED") {
        const msg = error?.shortMessage || error?.message || "USDC approval failed";
        toast.error(msg);
        console.error("Approve error:", error);
      }
    } finally {
      setIsApproving(false);
    }
  }, [activeAddress, approveAmount, getActiveProvider]);

  // Step 3: 에이전트 등록
  const handleRegister = useCallback(async () => {
    if (!activeAddress || !agentName.trim()) return;
    setIsRegistering(true);
    try {
      const res = await fetch("https://k-trendz.com/api/bot/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_name: agentName.trim(),
          wallet_address: activeAddress,
        }),
      });
      const data = await res.json();

      if (!data.success) {
        toast.error(data.error || "Registration failed");
        return;
      }

      setApiKey(data.data.api_key);
      setCurrentStep("done");
      toast.success("Agent registered successfully!");
    } catch (error) {
      toast.error("Registration failed. Please try again.");
      console.error("Register error:", error);
    } finally {
      setIsRegistering(false);
    }
  }, [activeAddress, agentName]);

  // 단계 번호 렌더링
  const StepNumber = ({ num, active, done }: { num: number; active: boolean; done: boolean }) => (
    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold transition-colors ${
      done ? "bg-green-500 text-white" : active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
    }`}>
      {done ? <Check className="w-4 h-4" /> : num}
    </div>
  );

  const steps: Step[] = ["connect", "approve", "register", "done"];
  const stepIndex = steps.indexOf(currentStep);

  return (
    <Card className="p-4 border-primary/30 bg-primary/5">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="p-2 bg-primary/10 rounded-full">
          <Wallet className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-base">Setup Bot Trading</h3>
          <p className="text-xs text-muted-foreground">Connect wallet → Approve USDC → Get API Key</p>
        </div>
      </div>

      <div className="space-y-3">
        {/* Step 1: Connect Wallet */}
        <div className={`rounded-lg border p-3.5 transition-colors ${
          stepIndex === 0 ? "border-primary/40 bg-background" : stepIndex > 0 ? "border-border/30 bg-muted/30" : "border-border/30"
        }`}>
          <div className="flex items-center gap-2.5 mb-2">
            <StepNumber num={1} active={stepIndex === 0} done={stepIndex > 0} />
            <span className="text-sm font-medium">Connect Wallet</span>
            {activeAddress && (
              <div className="flex items-center gap-1.5 ml-auto">
                <Badge variant="outline" className="text-[10px] font-mono">
                  {walletType === "metamask" ? "🦊 " : ""}{activeAddress.slice(0, 6)}...{activeAddress.slice(-4)}
                </Badge>
                <button
                  onClick={async () => {
                    try {
                      if (walletType === "coinbase") {
                        disconnectWallet();
                      } else if (walletType === "metamask") {
                        // MetaMask 권한 해제 시도
                        const mmProvider = getMetamaskProvider();
                        if (mmProvider) {
                          try {
                            await mmProvider.request({
                              method: "wallet_revokePermissions",
                              params: [{ eth_accounts: {} }],
                            });
                          } catch {
                            // wallet_revokePermissions 미지원 시 무시
                          }
                        }
                      }
                    } catch {}
                    setMetamaskAddress(null);
                    setWalletType(null);
                    setCurrentStep("connect");
                    setCurrentAllowance(null);
                    setApiKey(null);
                    setAgentName("");
                  }}
                  className="text-[10px] text-muted-foreground hover:text-destructive transition-colors"
                >
                  Disconnect
                </button>
              </div>
            )}
          </div>

          {stepIndex === 0 && (
            <div className="pl-9 space-y-2">
              <p className="text-xs text-muted-foreground mb-1 leading-relaxed">
                Connect your wallet that holds USDC on Base network. This wallet will fund your bot trades.
              </p>
              <Button
                onClick={() => setShowWalletModal(true)}
                disabled={isConnecting || isMetamaskConnecting}
                variant="outline"
                className="rounded-full text-sm h-9"
              >
                {(isConnecting || isMetamaskConnecting) ? (
                  <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Connecting...</>
                ) : (
                  <><Wallet className="w-4 h-4 mr-1.5" /> Connect Wallet</>
                )}
              </Button>
            </div>
          )}
        </div>

        {/* Step 2: Approve USDC */}
        <div className={`rounded-lg border p-3.5 transition-colors ${
          stepIndex === 1 ? "border-primary/40 bg-background" : stepIndex > 1 ? "border-border/30 bg-muted/30" : "border-border/30"
        }`}>
          <div className="flex items-center gap-2.5 mb-2">
            <StepNumber num={2} active={stepIndex === 1} done={stepIndex > 1} />
            <span className="text-sm font-medium">Approve USDC</span>
            {currentAllowance !== null && currentAllowance > 0 && (
              <Badge variant="outline" className="text-[10px] ml-auto text-green-600">
                {currentAllowance === Infinity ? "Unlimited" : `$${currentAllowance}`} approved
              </Badge>
            )}
          </div>

          {stepIndex === 1 && (
            <div className="pl-9 space-y-2.5">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Set the maximum USDC amount your bot can spend. You can change this anytime.
              </p>

              <div className="flex flex-wrap gap-1.5">
                {APPROVE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setApproveAmount(opt.value)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      approveAmount === opt.value
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-foreground border-border hover:bg-muted"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <div className="flex items-start gap-1.5 bg-muted/60 rounded-md p-2">
                <Shield className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  This only allows the V3 contract to use your USDC for trades. Your wallet and other tokens remain safe.
                </p>
              </div>

              <Button
                onClick={handleApprove}
                disabled={isApproving}
                className="rounded-full text-sm h-9"
              >
                {isApproving ? (
                  <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Approving...</>
                ) : (
                  <>Approve {approveAmount === -1 ? "Unlimited" : `$${approveAmount}`} USDC</>
                )}
              </Button>
            </div>
          )}
        </div>

        {/* Step 3: Register Agent */}
        <div className={`rounded-lg border p-3.5 transition-colors ${
          stepIndex === 2 ? "border-primary/40 bg-background" : stepIndex > 2 ? "border-border/30 bg-muted/30" : "border-border/30"
        }`}>
          <div className="flex items-center gap-2.5 mb-2">
            <StepNumber num={3} active={stepIndex === 2} done={stepIndex > 2} />
            <span className="text-sm font-medium">Register & Get API Key</span>
          </div>

          {stepIndex === 2 && (
            <div className="pl-9 space-y-2.5">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Name your agent and get an API key to use with Claude, Cursor, or any AI client.
              </p>

              <Input
                placeholder="Agent name (e.g., My Trading Bot)"
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                className="h-9 text-sm"
                maxLength={100}
              />

              <Button
                onClick={handleRegister}
                disabled={isRegistering || agentName.trim().length < 2}
                className="rounded-full text-sm h-9"
              >
                {isRegistering ? (
                  <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Registering...</>
                ) : (
                  <>Register Agent <ChevronRight className="w-4 h-4 ml-1" /></>
                )}
              </Button>
            </div>
          )}
        </div>

        {/* Step 4: Done — API Key 표시 */}
        {currentStep === "done" && apiKey && (
          <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-3.5">
            <div className="flex items-center gap-2.5 mb-2.5">
              <div className="w-7 h-7 rounded-full bg-green-500 text-white flex items-center justify-center">
                <Check className="w-4 h-4" />
              </div>
              <span className="text-sm font-semibold text-green-600">Setup Complete!</span>
            </div>

            <div className="pl-9 space-y-3">
              {/* API Key 표시 */}
              <div>
                <p className="text-xs font-medium text-foreground mb-1">Your API Key</p>
                <div className="flex items-center gap-1 bg-muted rounded-lg p-2 border border-border/50">
                  <code className="text-[11px] font-mono text-foreground break-all flex-1 select-all">
                    {apiKey}
                  </code>
                  <CopyButton text={apiKey} />
                </div>
              </div>

              {/* 경고 */}
              <div className="flex items-start gap-1.5 bg-yellow-500/10 rounded-md p-2 border border-yellow-500/20">
                <AlertCircle className="w-3.5 h-3.5 text-yellow-600 mt-0.5 shrink-0" />
                <p className="text-[11px] text-yellow-700 dark:text-yellow-400 leading-relaxed">
                  Save this API key now — it won't be shown again. If lost, re-register to get a new one.
                </p>
              </div>

              {/* Claude MCP 설정 */}
              <div>
                <p className="text-xs font-medium text-foreground mb-1.5">Use in Claude Desktop</p>
                <p className="text-[11px] text-muted-foreground mb-1.5">
                  Tell Claude: <span className="font-medium text-foreground italic">"Use API key [paste key] for trading"</span>
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Or set it as an environment variable: <code className="font-mono text-primary">KTRENDZ_API_KEY</code>
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 지갑 선택 모달 */}
      <Dialog open={showWalletModal} onOpenChange={setShowWalletModal}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-base">Select Wallet</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 pt-1">
            <button
              onClick={handleConnectCoinbase}
              disabled={isConnecting}
              className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-50"
            >
              <svg className="w-6 h-6 shrink-0" viewBox="0 0 111 111" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M54.921 110.034C85.359 110.034 110.034 85.402 110.034 55.017C110.034 24.6319 85.359 0 54.921 0C26.0432 0 2.35281 22.1714 0 50.3923H72.8467V59.6416H0C2.35281 87.8625 26.0432 110.034 54.921 110.034Z" fill="currentColor"/>
              </svg>
              <div className="text-left">
                <p className="text-sm font-medium">Coinbase Wallet</p>
                <p className="text-[11px] text-muted-foreground">Smart Wallet & Extension</p>
              </div>
            </button>
            <button
              onClick={handleConnectMetamask}
              disabled={isMetamaskConnecting}
              className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-50"
            >
              <span className="text-2xl shrink-0 w-6 text-center">🦊</span>
              <div className="text-left">
                <p className="text-sm font-medium">MetaMask</p>
                <p className="text-[11px] text-muted-foreground">Browser Extension</p>
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default BotAgentSetup;
