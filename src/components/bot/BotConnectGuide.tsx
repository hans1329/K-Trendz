// Bot Trading - Connect 탭: MCP/OpenClaw 연결 방법 + 개발자 연동
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ExternalLink,
  Copy,
  Check,
  Zap,
  Code2,
  Blocks,
} from "lucide-react";
import { useState } from "react";
import openclawMascot from "@/assets/openclaw-mascot.jpeg";

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

// 코드 블록
const CodeBlock = ({ code }: { code: string }) => (
  <div className="flex items-start justify-between bg-muted/80 rounded-lg border border-border/50 overflow-hidden">
    <pre className="p-3 text-xs font-mono overflow-x-auto flex-1 leading-relaxed">
      <code className="break-all whitespace-pre-wrap">{code}</code>
    </pre>
    <div className="p-1.5 shrink-0">
      <CopyButton text={code} />
    </div>
  </div>
);

const BotConnectGuide = () => {
  return (
    <div className="space-y-3">
      {/* 소개 */}
      <Card className="p-4 border-border/50 bg-primary/5">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-primary/10 rounded-full shrink-0 mt-0.5">
            <Zap className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-base mb-1.5">Connect Your AI Agent</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Connect your AI client (Claude, Cursor, etc.) to K-Trendz via <span className="font-medium text-foreground">MCP</span> or{" "}
              <span className="font-medium text-foreground">OpenAPI</span>. Once connected, you can browse tokens and check prices immediately — no API key needed.
            </p>
          </div>
        </div>
      </Card>

      {/* MCP 연결 */}
      <Card className="p-4 border-border/50">
        <div className="flex items-center gap-2.5 mb-3.5">
          <div className="p-2 bg-primary/10 rounded-md">
            <Blocks className="w-4 h-4 text-primary" />
          </div>
          <h3 className="font-semibold text-base">MCP Server</h3>
          <Badge variant="outline" className="text-[10px] ml-auto">Recommended</Badge>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed mb-3">
          Add this URL to your AI client. 5 trading tools will load automatically.
        </p>

        <CodeBlock code="https://k-trendz.com/api/bot/mcp" />

        <div className="space-y-2 mt-3">
          {/* Claude Desktop */}
          <div className="bg-primary/5 rounded-lg p-3 border border-primary/20">
            <p className="text-xs font-semibold text-primary mb-1.5">Claude Desktop</p>
            <ol className="text-[11px] text-muted-foreground space-y-1 list-decimal list-inside leading-relaxed">
              <li>Open <span className="font-medium text-foreground">Settings → Integrations</span></li>
              <li>Click <span className="font-medium text-foreground">"Add Integration"</span></li>
              <li>Paste the MCP URL above and save</li>
            </ol>
          </div>

          {/* Cursor / Windsurf */}
          <div className="bg-muted/40 rounded-lg p-3">
            <p className="text-xs font-medium text-foreground mb-1.5">Cursor / Windsurf / Other Clients</p>
            <pre className="text-[11px] font-mono text-muted-foreground leading-relaxed whitespace-pre-wrap break-all">
{`{
  "mcpServers": {
    "ktrendz": {
      "url": "https://k-trendz.com/api/bot/mcp"
    }
  }
}`}
            </pre>
          </div>

          {/* OpenClaw 스킬 설치 - MCP 섹션 안에 배치 */}
          <a
            href="https://clawhub.ai/hans1329/ktrendz-lightstick-trading"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted transition-colors"
          >
            <img src={openclawMascot} alt="OpenClaw" className="w-8 h-8 rounded-full object-cover shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">Install Skill on ClaHub</p>
              <p className="text-[11px] text-muted-foreground">Alternative: pre-packaged skill for OpenClaw agents</p>
            </div>
            <ExternalLink className="w-4 h-4 text-muted-foreground shrink-0" />
          </a>
        </div>

        {/* 사용 가능한 도구 목록 */}
        <div className="bg-muted/50 rounded-lg p-3.5 mt-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">5 Tools Available</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { name: "list_tokens", desc: "Browse all tokens", free: true },
              { name: "get_token_price", desc: "Price + signals", free: true },
              { name: "register_agent", desc: "Get API key", free: true },
              { name: "buy_token", desc: "Buy 1 lightstick", free: false },
              { name: "sell_token", desc: "Sell 1 lightstick", free: false },
            ].map((tool, i) => (
              <div key={i} className="bg-background rounded-md px-2.5 py-2 border border-border/30">
                <div className="flex items-center gap-1">
                  <code className="text-[11px] font-mono text-primary">{tool.name}</code>
                  {tool.free && <span className="text-[9px] text-green-600">🌐</span>}
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">{tool.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* OpenAPI / 개발자 연동 */}
      <Card className="p-4 border-border/50">
        <div className="flex items-center gap-2.5 mb-3.5">
          <div className="p-2 bg-primary/10 rounded-md">
            <Code2 className="w-4 h-4 text-primary" />
          </div>
          <h3 className="font-semibold text-base">Developer Integration</h3>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed mb-3">
          Build your own trading bots with <span className="font-medium text-foreground">REST API</span>. 
          Works with Python, Node.js, or any HTTP client.
        </p>

        <div className="border border-border/50 rounded-lg overflow-hidden">
          <div className="bg-muted/60 px-3.5 py-2.5 border-b border-border/30 flex items-center gap-2">
            <Code2 className="w-3.5 h-3.5 text-primary" />
            <p className="text-[13px] font-semibold text-foreground">OpenAPI Spec</p>
            <Badge variant="outline" className="text-[10px] ml-auto">REST · Python · Node.js</Badge>
          </div>
          <div className="p-3.5 space-y-2.5">
            <CodeBlock code="https://k-trendz.com/api/bot/openapi.json" />
            <div className="bg-muted/40 rounded-lg p-3">
              <p className="text-xs font-medium text-foreground mb-1.5">Python Example</p>
              <pre className="text-[11px] font-mono text-muted-foreground leading-relaxed whitespace-pre-wrap break-all">
{`import requests

BASE = "https://k-trendz.com/api/bot"

# 1. Browse tokens (no auth needed)
tokens = requests.get(f"{BASE}/tokens").json()

# 2. Check price (no auth needed)
price = requests.post(f"{BASE}/token-price",
  json={"artist_name": "RIIZE"}).json()

# 3. Buy/Sell (API key required)
# Get your key at k-trendz.com/bot-trading
res = requests.post(f"{BASE}/buy",
  json={"artist_name": "RIIZE"},
  headers={"x-bot-api-key": API_KEY})`}
              </pre>
            </div>
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-2.5 mt-2">
              <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
                ⚠️ Buy/Sell requires a connected wallet with USDC approval.
                Complete the <span className="font-semibold">Trade tab setup</span> first to get your API key.
              </p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default BotConnectGuide;
