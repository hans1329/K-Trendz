# K-Trendz

**K-Trendz** is a social platform for K-culture and K-pop fans, featuring community-driven content, lightstick token trading on Base chain, and an **MCP server for AI agent trading**.

🌐 **Website**: [https://k-trendz.com](https://k-trendz.com)

---

## 🤖 MCP Server — AI Agent Trading

K-Trendz provides a remote MCP (Model Context Protocol) server that enables AI agents to discover, analyze, and trade K-pop lightstick tokens on Base chain.

### Quick Setup

**MCP Server URL:**
```
https://k-trendz.com/api/bot/mcp
```

#### Claude Desktop

Add to your Claude Desktop configuration (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "ktrendz": {
      "command": "npx",
      "args": ["mcp-remote", "https://k-trendz.com/api/bot/mcp"]
    }
  }
}
```

> **Note:** Requires Node.js installed. Uses `mcp-remote` to bridge remote HTTP transport to local stdio.

#### Cursor / Windsurf / Other MCP Clients

```json
{
  "mcpServers": {
    "ktrendz": {
      "url": "https://k-trendz.com/api/bot/mcp"
    }
  }
}
```

### Available Tools

| Tool | Description | Auth Required |
|------|-------------|:---:|
| `list_tokens` | Browse all available K-pop lightstick tokens with supply, trending scores | ❌ |
| `get_token_price` | Get price, buy cost, sell refund, 24h change, and news signals | ❌ |
| `register_agent` | Register a trading agent and receive an API key | ❌ |
| `buy_token` | Buy 1 lightstick token (max $100/day per agent) | ✅ API Key |
| `sell_token` | Sell 1 lightstick token | ✅ API Key |

### REST API (Developer Integration)

For custom bots using Python, Node.js, or any HTTP client:

**OpenAPI Spec:** `https://k-trendz.com/api/bot/openapi.json`

```python
import requests

BASE = "https://k-trendz.com/api/bot"

# Browse tokens (no auth)
tokens = requests.get(f"{BASE}/tokens").json()

# Check price (no auth)
price = requests.post(f"{BASE}/token-price",
  json={"artist_name": "RIIZE"}).json()

# Buy token (API key required)
res = requests.post(f"{BASE}/buy",
  json={"artist_name": "RIIZE"},
  headers={"x-bot-api-key": "YOUR_API_KEY"})
```

### OpenClaw Skill

Pre-packaged skill for OpenClaw agents:
[Install on ClaHub](https://clawhub.ai/hans1329/ktrendz-lightstick-trading)

---

## ✨ Key Features

### Lightstick Token Trading
- **Bonding curve pricing** — price rises with supply, falls on sells
- **On-chain on Base** — all trades recorded on Base L2 via smart contracts
- **USDC settlement** — buy/sell with USDC, gas sponsored via Paymaster
- **Bot trading** — AI agents can trade via MCP or REST API

### Community & Content
- Reddit-style posts with upvote/downvote
- Communities with custom rules
- Mentions, direct messages, notifications
- AI-powered news generation (Korean → English translation)

### Wiki & Knowledge Base
- Collaborative K-pop artist/group wiki entries
- Relationship mapping between artists
- Chat rooms linked to wiki entries

### Challenges & Events
- Fan challenges with on-chain prize distribution
- Farcaster Mini App integration
- Calendar events for K-pop schedules

### Points & Levels
- Activity-based point rewards (posts, comments, votes)
- 7-tier level system (Newbie → Legend)
- KTREND token rewards on Base chain

---

## 🛠 Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui |
| **Backend** | Supabase (PostgreSQL, Auth, Storage, Edge Functions) |
| **Blockchain** | Base (Coinbase L2), Solidity, ethers.js |
| **AI/ML** | OpenAI API, NewsAPI |
| **Deployment** | Netlify (frontend), Supabase Cloud (backend) |
| **MCP** | mcp-lite, Hono, Streamable HTTP Transport |

---

## 🏗 Architecture

```
┌──────────────────────────────────────────────┐
│              Frontend (React + Vite)          │
│  React Router · TanStack Query · shadcn/ui   │
└──────────────────┬───────────────────────────┘
                   │ HTTPS
                   ▼
┌──────────────────────────────────────────────┐
│           Supabase Backend                    │
│  PostgreSQL · Auth · Storage · Edge Functions │
│  ┌─────────────────────────────────────────┐ │
│  │  Edge Functions (Deno)                  │ │
│  │  - Bot Trading API (MCP + REST)         │ │
│  │  - Token Buy/Sell (on-chain)            │ │
│  │  - News Generation (AI)                 │ │
│  │  - Paymaster (gas sponsoring)           │ │
│  └─────────────────────────────────────────┘ │
└──────────────────┬───────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────┐
│          Base Chain (Coinbase L2)             │
│  FanzToken USDC · KTrendzVote · KTrendzDAU   │
│  KTREND (ERC20) · KTrendzChallenge           │
└──────────────────────────────────────────────┘
```

---

## 🔒 Security

- **Row Level Security (RLS)** on all database tables
- **JWT-based authentication** via Supabase Auth
- **Role-based access control** (admin, moderator, user)
- **API key authentication** for bot trading endpoints
- **Paymaster gas sponsoring** with daily limits per agent

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm or bun

### Local Development

```bash
git clone https://github.com/hans1329/ktrendz.git
cd ktrendz
npm install
npm run dev
```

### Domain

- **Production:** https://k-trendz.com
- **Bot API Base:** https://k-trendz.com/api/bot/
- **MCP Server:** https://k-trendz.com/api/bot/mcp

---

## 📄 License

This project is owned by K-Trendz.

## 📞 Contact

- **Website:** [https://k-trendz.com](https://k-trendz.com)
- **Email:** manager@fantagram.ai
- **GitHub:** [https://github.com/hans1329/ktrendz](https://github.com/hans1329/ktrendz)
