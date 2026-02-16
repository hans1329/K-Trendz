// Bot Trading - Trade 탭: 지갑 설정 + 거래 가이드 + 수수료/보안 정보
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DollarSign,
  Shield,
  Zap,
  ExternalLink,
  Copy,
  Check,
  TrendingUp,
  Newspaper,
  BarChart3,
  Eye,
  ArrowRight,
} from "lucide-react";
import { useState } from "react";
import BotAgentSetup from "@/components/BotAgentSetup";

// 클립보드 복사 버튼
const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handleCopy} className="p-1.5 rounded-md hover:bg-muted-foreground/20 transition-colors" title="Copy">
      {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
    </button>
  );
};

const BotTradeGuide = () => {
  return (
    <div className="space-y-3">
      {/* 지갑 설정 위저드 */}
      <BotAgentSetup />

      {/* 거래 커맨드 */}
      <Card className="p-4 border-border/50">
        <div className="flex items-center gap-2.5 mb-3.5">
          <div className="p-2 bg-primary/10 rounded-md">
            <TrendingUp className="w-4 h-4 text-primary" />
          </div>
          <h3 className="font-semibold text-base">Trading Commands</h3>
        </div>

        <div className="bg-muted/60 rounded-lg px-3.5 py-2.5 mb-3 flex items-start gap-2">
          <span className="text-sm mt-px">💬</span>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Type these in your <span className="font-medium text-foreground">AI agent's chat</span> (Claude, Cursor), not in a browser.
          </p>
        </div>

        {/* 접근 레벨 */}
        <div className="bg-muted/40 rounded-lg p-3 mb-3 border border-border/30">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Access Levels</p>
          <div className="space-y-1.5">
            {[
              { tool: "list_tokens", access: "🌐 Public", note: "No key needed" },
              { tool: "get_token_price", access: "🌐 Public", note: "No key needed" },
              { tool: "buy / sell", access: "🔒 API Key", note: "Setup above" },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <code className="font-mono text-foreground">{item.tool}</code>
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">{item.note}</span>
                  <Badge variant="outline" className="text-[10px] h-4">{item.access}</Badge>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          {[
            { cmd: "list_tokens", label: "Browse tokens", desc: "See all available lightstick tokens" },
            { cmd: "get_token_price RIIZE", label: "Check price", desc: "Price, 24h trend, and news signals" },
            { cmd: "buy_token RIIZE", label: "Buy", desc: "Purchase 1 lightstick token" },
            { cmd: "sell_token RIIZE", label: "Sell", desc: "Sell 1 token back for USDC" },
          ].map((item, i) => (
            <div key={i} className="bg-muted/50 rounded-lg p-3 space-y-1">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="text-xs font-normal">{item.label}</Badge>
                <CopyButton text={item.cmd} />
              </div>
              <code className="text-xs font-mono text-primary block">{item.cmd}</code>
              <p className="text-xs text-muted-foreground">{item.desc}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* AI 시그널 & 시나리오 */}
      <Card className="p-4 border-border/50">
        <div className="flex items-center gap-2.5 mb-3.5">
          <div className="p-2 bg-primary/10 rounded-md">
            <Newspaper className="w-4 h-4 text-primary" />
          </div>
          <h3 className="font-semibold text-base">How AI Agents Trade</h3>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed mb-3">
          Agents analyze <span className="font-medium text-foreground">real-time signals</span> to make informed decisions automatically.
        </p>

        {/* 시그널 타입 */}
        <div className="space-y-2 mb-4">
          {[
            { icon: Newspaper, label: "News Sentiment", desc: "Comeback, award wins, concert news" },
            { icon: BarChart3, label: "Trending Score", desc: "Social buzz and fan activity ranking" },
            { icon: Eye, label: "On-chain Activity", desc: "Supply changes, price momentum" },
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-3 bg-muted/40 rounded-lg p-3">
              <div className="p-1.5 bg-primary/10 rounded-md shrink-0 mt-0.5">
                <item.icon className="w-3.5 h-3.5 text-primary" />
              </div>
              <div>
                <p className="text-[13px] font-medium text-foreground">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* 시나리오 */}
        {[
          {
            title: "Comeback Announcement",
            steps: ["Agent detects news spike", "Auto-buys at $0.12", "Price rises to $0.18", "Sells for 50% profit"],
            highlight: "News → Buy → Price Rise → Profit"
          },
          {
            title: "Award Show Buzz",
            steps: ["Trending score jumps 3x", "Agent buys on momentum", "Holds at peak", "Strategic exit"],
            highlight: "Social Buzz → Trending ↑ → Strategic Entry"
          },
        ].map((scenario, i) => (
          <div key={i} className="border border-border/50 rounded-lg overflow-hidden mb-2 last:mb-0">
            <div className="bg-muted/60 px-3.5 py-2.5 border-b border-border/30">
              <p className="text-[13px] font-semibold text-foreground">{scenario.title}</p>
            </div>
            <div className="p-3.5 space-y-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {scenario.steps.map((step, j) => (
                  <span key={j} className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">{step}</span>
                    {j < scenario.steps.length - 1 && <ArrowRight className="w-3 h-3 text-primary shrink-0" />}
                  </span>
                ))}
              </div>
              <div className="bg-primary/5 rounded-md px-2.5 py-1.5">
                <p className="text-xs font-medium text-primary">{scenario.highlight}</p>
              </div>
            </div>
          </div>
        ))}
      </Card>

      {/* 수수료 & 한도 */}
      <Card className="p-4 border-border/50">
        <div className="flex items-center gap-2.5 mb-3.5">
          <div className="p-2 bg-primary/10 rounded-md">
            <DollarSign className="w-4 h-4 text-primary" />
          </div>
          <h3 className="font-semibold text-base">Fees & Limits</h3>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {[
            { label: "Buy Fee", value: "3%", note: "2% Artist + 1% Platform" },
            { label: "Sell Fee", value: "2%", note: "Platform" },
            { label: "Daily Limit", value: "$100", note: "Per agent" },
            { label: "Gas Fee", value: "Free", note: "Paymaster sponsored", highlight: true },
          ].map((item, i) => (
            <div key={i} className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">{item.label}</p>
              <p className={`text-base font-bold ${item.highlight ? 'text-primary' : 'text-foreground'}`}>{item.value}</p>
              <p className="text-xs text-muted-foreground">{item.note}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* 보안 */}
      <Card className="p-4 border-border/50">
        <div className="flex items-center gap-2.5 mb-3.5">
          <div className="p-2 bg-primary/10 rounded-md">
            <Shield className="w-4 h-4 text-primary" />
          </div>
          <h3 className="font-semibold text-base">Safety & Protection</h3>
        </div>
        <div className="space-y-2.5">
          {[
            { label: "Max 1 token per tx", desc: "Bonding curve protection" },
            { label: "Circuit breaker", desc: "Pauses if >20% move in 10 blocks" },
            { label: "Same-block prevention", desc: "MEV protection" },
            { label: "API key auth", desc: "SHA256 hash verified" },
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-2.5 text-[13px]">
              <Zap className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <div>
                <span className="font-medium text-foreground">{item.label}</span>
                <span className="text-muted-foreground"> — {item.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* 컨트랙트 정보 */}
      <Card className="p-4 border-border/50">
        <div className="flex items-center gap-2.5 mb-3.5">
          <div className="p-2 bg-primary/10 rounded-md">
            <ExternalLink className="w-4 h-4 text-primary" />
          </div>
          <h3 className="font-semibold text-base">Contract Info</h3>
        </div>
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-muted-foreground">Network</span>
            <Badge variant="outline" className="text-xs">Base Mainnet</Badge>
          </div>
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-muted-foreground">Standard</span>
            <span className="font-mono text-foreground">ERC-1155</span>
          </div>
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-muted-foreground">Currency</span>
            <span className="font-mono text-foreground">USDC</span>
          </div>
          <div className="mt-2.5 pt-2.5 border-t border-border/30">
            <p className="text-xs text-muted-foreground mb-1.5">Contract Address</p>
            <div className="flex items-center gap-1">
              <a
                href="https://basescan.org/address/0x28bE702CC3A611A1EB875E277510a74fD20CDD9C"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-mono text-primary hover:underline break-all leading-relaxed"
              >
                0x28bE702CC3A611A1EB875E277510a74fD20CDD9C
              </a>
              <div className="shrink-0">
                <CopyButton text="0x28bE702CC3A611A1EB875E277510a74fD20CDD9C" />
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default BotTradeGuide;
