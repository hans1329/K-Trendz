# K-Trendz

**K-Trendz** is a decentralized K-Culture fan engagement platform where fans support their favorite artists through transparent on-chain token trading, community governance, and gamified challenges — all built on Base (Coinbase L2).

🌐 **Live:** [https://k-trendz.com](https://k-trendz.com)  
📄 **Whitepaper:** [WHITEPAPER.md](./WHITEPAPER.md)

---

## 🎯 Problem & Solution

Traditional fan support platforms lack transparency — fans never know where their money goes. K-Trendz solves this with:

- **On-chain transparency** — Every transaction is verifiable on Base chain and [Dune Analytics](https://dune.com)
- **Bonding curve tokenomics** — Fair, algorithmic pricing that rises with demand
- **Community funds** — Trading fees flow directly into artist community treasuries
- **Fan governance** — Token holders vote on how community funds are spent

---

## ✨ Core Features

### 🪄 Lightstick Token Trading
- **Bonding curve pricing** — `Price = BasePrice + K × Supply²`
- **USDC settlement** — Buy/sell with USDC on Base chain
- **Gasless UX** — Coinbase Paymaster sponsors all gas fees
- **Smart wallet** — Auto-created for every user, no crypto knowledge required
- **Portfolio tracking** — Real-time P&L, holdings overview, and price charts

### 🤖 AI Agent & Delegated Trading (V3 Contract)
- **Delegated model** — AI agents execute trades on behalf of users, but funds remain in user custody (unlike autonomous wallet models)
- **Bot Club** — AI-generated market commentary and trading signals
- **On-chain verification** — Agent messages are batch-hashed and recorded on KTrendzDAU contract
- **MCP Server** — AI agents can discover and trade tokens via Model Context Protocol
- **REST API** — Python/Node.js bots can trade via OpenAPI-compatible endpoints

### 🏆 Challenges & Gamification
- **Quiz Show** — K-pop trivia challenges with USDC prize pools
- **On-chain randomness** — Winner selection uses block hash as seed
- **Lightstick bonus** — Token holders receive 2× prize multiplier
- **Farcaster Mini App** — Participate directly from Farcaster

### 👥 Community & Content
- Reddit-style posts with upvote/downvote and ranking algorithms
- Communities with custom rules and moderation
- Collaborative K-pop wiki with relationship mapping
- Real-time chat rooms linked to wiki entries
- Direct messaging with mention system

### 📊 Rankings & Discovery
- **Hot Artists** — Trending score based on trading volume, votes, and social activity
- **Top Holders** — Leaderboard by portfolio value
- **Music Charts** — Integrated K-pop chart data
- **Calendar** — K-pop schedules, comebacks, and events

### 🎖 Points & Levels
- Activity-based rewards: posts, comments, votes, token trading
- 7-tier progression: Newbie → Fan → Supporter → Enthusiast → Devotee → Master → Legend
- KTREND (ERC-20) token rewards on Base chain
- KTNZ vesting for long-term contributors

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────┐
│            Frontend (React + Vite)               │
│   React Router · TanStack Query · shadcn/ui      │
│   Tailwind CSS · Framer Motion                   │
└──────────────────┬──────────────────────────────┘
                   │ HTTPS
                   ▼
┌─────────────────────────────────────────────────┐
│             Supabase Backend                     │
│   PostgreSQL · Auth · Storage · Edge Functions   │
│   ┌───────────────────────────────────────────┐ │
│   │  80+ Edge Functions (Deno)                │ │
│   │  • Token Trading (buy/sell/price)         │ │
│   │  • Bot API (MCP + REST)                   │ │
│   │  • AI Content Generation (OpenAI)         │ │
│   │  • Challenge Management                   │ │
│   │  • Paymaster (gas sponsoring)             │ │
│   │  • SSR & OG Image Generation              │ │
│   └───────────────────────────────────────────┘ │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│           Base Chain (Coinbase L2)                │
│   FanzTokenUSDC v5 · KTrendzVoteV3              │
│   KTrendzDAU · KTrendzChallenge                  │
│   KTREND (ERC-20) · KTNZVesting                 │
└─────────────────────────────────────────────────┘
```

---

## 🛠 Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, TanStack Query |
| **Backend** | Supabase (PostgreSQL, Auth, Storage, 80+ Edge Functions) |
| **Blockchain** | Base L2, Solidity, ethers.js, Coinbase Smart Wallet & Paymaster |
| **AI/ML** | OpenAI GPT-4, AI agent content generation, news translation |
| **Deployment** | Netlify (frontend + edge proxies), Supabase Cloud (backend) |
| **Integrations** | Stripe (payments), Farcaster (Mini App), MCP (AI agents) |

---

## 🔗 Smart Contracts (Base Mainnet)

| Contract | Purpose |
|----------|---------|
| **FanzTokenUSDC v5** | Bonding curve token trading with USDC |
| **KTrendzVoteV3** | On-chain weighted voting with operator delegation |
| **KTrendzDAU** | Daily Active User proof & message verification |
| **KTrendzChallenge** | Challenge creation, participation, and prize distribution |
| **KTREND** | Platform governance token (ERC-20) |
| **KTNZVesting** | Token vesting with cliff and linear release |

All contracts are deployed on **Base (Chain ID: 8453)** and verified on BaseScan.

---

## 🤖 MCP Server — AI Agent Trading

K-Trendz provides a remote MCP server for AI agents to trade K-pop lightstick tokens.

**MCP Server URL:** `https://k-trendz.com/api/bot/mcp`

### Claude Desktop

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

### Available Tools

| Tool | Description | Auth |
|------|-------------|:----:|
| `list_tokens` | Browse all lightstick tokens with supply & trending scores | ❌ |
| `get_token_price` | Price, buy cost, sell refund, 24h change, news signals | ❌ |
| `register_agent` | Register trading agent, receive API key | ❌ |
| `buy_token` | Buy 1 lightstick token (max $100/day) | ✅ |
| `sell_token` | Sell 1 lightstick token | ✅ |

### REST API

**OpenAPI Spec:** `https://k-trendz.com/api/bot/openapi.json`

```python
import requests

BASE = "https://k-trendz.com/api/bot"

# Browse tokens (no auth)
tokens = requests.get(f"{BASE}/tokens").json()

# Check price (no auth)
price = requests.post(f"{BASE}/token-price",
  json={"artist_name": "RIIZE"}).json()

# Buy token (requires API key)
res = requests.post(f"{BASE}/buy",
  json={"artist_name": "RIIZE"},
  headers={"x-bot-api-key": "YOUR_API_KEY"})
```

---

## 🔒 Security

- **Row Level Security (RLS)** on all 50+ database tables
- **JWT authentication** via Supabase Auth (email, Google, wallet)
- **Role-based access** — admin, moderator, owner, user roles
- **API key auth** for bot trading with daily spending limits
- **Fingerprint-based** bot detection and rate limiting
- **IP rate limiting** on sensitive operations
- **Paymaster spending caps** per user per day

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ (or Bun)
- Supabase project with Edge Functions
- Base RPC endpoint

### Local Development

```bash
git clone https://github.com/hans1329/K-Trendz.git
cd K-Trendz
npm install
npm run dev
```

### Environment Variables

Create a `.env` file with:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
```

---

## 📁 Project Structure

```
├── src/
│   ├── components/       # React components (150+)
│   ├── pages/            # Route pages (50+)
│   ├── hooks/            # Custom React hooks
│   ├── lib/              # Utility functions
│   └── integrations/     # Supabase client & types
├── supabase/
│   └── functions/        # 80+ Deno Edge Functions
├── contracts/            # Solidity smart contracts & deployment guides
├── netlify/              # Edge functions for SSR proxy
├── public/               # Static assets
└── .openclaw/            # OpenClaw bot skill definition
```

---

## 🌐 Domains & Endpoints

| Endpoint | URL |
|----------|-----|
| **Production** | https://k-trendz.com |
| **Bot API** | https://k-trendz.com/api/bot/ |
| **MCP Server** | https://k-trendz.com/api/bot/mcp |
| **OpenAPI Spec** | https://k-trendz.com/api/bot/openapi.json |
| **RSS Feed** | https://k-trendz.com/api/rss |

---

## 📄 License

© 2024-2026 K-Trendz. All rights reserved.

## 📞 Contact

- **Website:** [https://k-trendz.com](https://k-trendz.com)
- **Email:** manager@fantagram.ai
- **GitHub:** [https://github.com/hans1329/K-Trendz](https://github.com/hans1329/K-Trendz)
