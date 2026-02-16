# FanzToken Smart Contract Deployment Guide

## Overview
ERC-1155 based Fungible-like Fan Token system with bonding curve pricing for wiki entries and posts.

## Key Features
- **Bonding Curve Pricing**: Integral formula `C = a·N + (2k/3)·[(S+N)^(3/2) – S^(3/2)]`
- **Slippage Protection**: `maxCost` for buy, `minRefund` for sell
- **Access Control**: Only owner can create tokens (DB-synchronized)
- **Fee Structure**: 10% buy (6% creator, 4% platform), 3% sell

## Prerequisites
- Node.js and npm installed
- Hardhat or Foundry setup
- Base network RPC URL
- Deployer wallet with Base ETH for gas
- Platform wallet address for fee collection

## Contract Details
- **Network**: Base Mainnet (or Base Sepolia for testing)
- **Standard**: ERC-1155
- **Pricing Formula**: `P(s) = basePrice + k * sqrt(supply)`
- **Security**: No emergency withdraw, slippage protection, owner-only token creation

## Installation

```bash
npm install --save-dev hardhat @openzeppelin/contracts
npm install --save-dev @nomicfoundation/hardhat-toolbox
```

## Hardhat Setup

Create `hardhat.config.js`:

```javascript
require("@nomicfoundation/hardhat-toolbox");

const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
const BASE_RPC_URL = process.env.BASE_RPC_URL || "https://mainnet.base.org";

module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    base: {
      url: BASE_RPC_URL,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      chainId: 8453
    },
    baseGoerli: {
      url: "https://goerli.base.org",
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      chainId: 84531
    }
  }
};
```

## Quick Start: Remix Deployment

1. **Open Remix IDE**: https://remix.ethereum.org
2. **Create new file**: `FanzToken.sol` and paste the contract code
3. **Compile**: 
   - Compiler: 0.8.20
   - Enable optimization: 200 runs
4. **Deploy**:
   - Environment: Injected Provider - MetaMask
   - Network: Base Mainnet (Chain ID: 8453)
   - Constructor parameter: `0xd5c1296990b9072302a627752e46061a40112342` (platform wallet)
5. **Verify on Basescan**: Copy deployed address to https://basescan.org

## Hardhat Deployment (Advanced)

### Setup
```bash
npm install --save-dev hardhat @openzeppelin/contracts
npm install --save-dev @nomicfoundation/hardhat-toolbox
```

### hardhat.config.js
```javascript
require("@nomicfoundation/hardhat-toolbox");

module.exports = {
  solidity: {
    version: "0.8.20",
    settings: { optimizer: { enabled: true, runs: 200 } }
  },
  networks: {
    base: {
      url: process.env.BASE_RPC_URL || "https://mainnet.base.org",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 8453
    }
  }
};
```

### Deploy Script
```javascript
// scripts/deploy-fanztoken.js
const hre = require("hardhat");

async function main() {
  const PLATFORM_WALLET = "0xd5c1296990b9072302a627752e46061a40112342";
  console.log("Deploying FanzToken...");
  console.log("Platform Wallet:", PLATFORM_WALLET);
  
  const FanzToken = await hre.ethers.getContractFactory("FanzToken");
  const fanzToken = await FanzToken.deploy(PLATFORM_WALLET);
  await fanzToken.waitForDeployment();
  
  console.log("Deployed to:", await fanzToken.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

```bash
npx hardhat run scripts/deploy-fanztoken.js --network base
```

## Deploy Commands

### Deploy to Base Testnet (Goerli)
```bash
npx hardhat run scripts/deploy-fanztoken.js --network baseGoerli
```

### Deploy to Base Mainnet
```bash
npx hardhat run scripts/deploy-fanztoken.js --network base
```

## Post-Deployment

1. **Save Contract Address**
   - Update Supabase environment variables with contract address
   - Update frontend config with contract address

2. **Grant Roles (if needed)**
   ```javascript
   // If you add role-based access control later
   await fanzToken.grantRole(ADMIN_ROLE, adminAddress);
   ```

3. **Test Token Creation**
   ```javascript
   // Create a test token
   const tokenId = 1; // wiki_entry_id or post_id
   const creatorAddress = "0x..."; // Content creator address
   const basePrice = ethers.parseEther("0.001"); // 0.001 ETH
   const kValue = ethers.parseEther("0.0001"); // 0.0001 ETH
   
   await fanzToken.createToken(tokenId, creatorAddress, basePrice, kValue);
   ```

## Backend Integration

### Edge Function: issue-fanz-token

Update `supabase/functions/issue-fanz-token/index.ts`:

```typescript
import { ethers } from 'ethers';

const CONTRACT_ADDRESS = Deno.env.get('FANZTOKEN_CONTRACT_ADDRESS');
const CONTRACT_ABI = [...]; // Import ABI
const DEPLOYER_PRIVATE_KEY = Deno.env.get('DEPLOYER_PRIVATE_KEY');

serve(async (req) => {
  const { wikiEntryId } = await req.json();
  
  // Verify ownership in database
  const { data: entry } = await supabaseAdmin
    .from('wiki_entries')
    .select('creator_id')
    .eq('id', wikiEntryId)
    .single();
  
  if (entry.creator_id !== userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403 });
  }
  
  // Get creator's wallet address from profiles
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('wallet_address')
    .eq('id', entry.creator_id)
    .single();
  
  const creatorAddress = profile.wallet_address || PLATFORM_WALLET; // Fallback to platform
  
  // Create token on blockchain (as contract owner)
  const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
  const wallet = new ethers.Wallet(DEPLOYER_PRIVATE_KEY, provider);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);
  
  const basePrice = ethers.parseEther("0.001");
  const kValue = ethers.parseEther("0.0001");
  
  const tx = await contract.createToken(wikiEntryId, creatorAddress, basePrice, kValue);
  await tx.wait();
  
  // Update database
  await supabaseAdmin.from('fanz_tokens').insert({
    token_id: wikiEntryId,
    wiki_entry_id: wikiEntryId,
    creator_id: userId,
    base_price: 0.001,
    k_value: 0.0001,
    contract_address: CONTRACT_ADDRESS
  });
  
  return new Response(JSON.stringify({ success: true }), { status: 200 });
});
```

### Required Environment Variables
```bash
FANZTOKEN_CONTRACT_ADDRESS=0x...
DEPLOYER_PRIVATE_KEY=0x...
BASE_RPC_URL=https://mainnet.base.org
PLATFORM_WALLET=0xd5c1296990b9072302a627752e46061a40112342
```

## Environment Variables

Add to Supabase Edge Function secrets:

```bash
FANZTOKEN_CONTRACT_ADDRESS=0x...
DEPLOYER_PRIVATE_KEY=0x...
BASE_RPC_URL=https://mainnet.base.org
PLATFORM_WALLET=0xd5c1296990b9072302a627752e46061a40112342
```

## Verify Contract on Basescan

```bash
npx hardhat verify --network base <CONTRACT_ADDRESS> <PLATFORM_WALLET_ADDRESS>
```

## Security Considerations

### Implemented Security Features
1. **Owner-Only Token Creation**: Only contract owner can create tokens (prevents unauthorized token issuance)
2. **Slippage Protection**: `maxCost` and `minRefund` parameters protect users from price manipulation
3. **ReentrancyGuard**: Prevents reentrancy attacks on buy/sell functions
4. **No Emergency Withdraw**: Liquidity pool cannot be drained by owner (prevents rug pull)
5. **Integral Bonding Curve**: Accurate pricing formula prevents arbitrage opportunities

### Pre-Deployment Checklist
- [ ] Audit contract code professionally
- [ ] Test extensively on Base Sepolia testnet
- [ ] Verify platform wallet address is correct
- [ ] Test slippage protection with various scenarios
- [ ] Verify owner can create tokens
- [ ] Test buy/sell functions with multiple users
- [ ] Monitor gas costs and optimize if needed

### Recommendations
1. **Rate Limiting**: Implement frontend rate limiting to prevent spam
2. **Price Impact Warning**: Show users estimated slippage before transaction
3. **Gas Monitoring**: Monitor Base network gas prices for optimal UX
4. **Liquidity Management**: Track contract ETH balance for sufficient liquidity

## Contract Functions Reference

### View Functions (No Gas Cost)
```solidity
// Get current token price based on supply
getCurrentPrice(uint256 tokenId) returns (uint256 price)

// Calculate total buy cost with fees and slippage protection
calculateBuyCost(uint256 tokenId, uint256 amount) 
  returns (uint256 totalCost, uint256 creatorFee, uint256 platformFee)

// Calculate sell refund after fees
calculateSellRefund(uint256 tokenId, uint256 amount) 
  returns (uint256 refundAmount, uint256 fee)

// Get token information
tokens(uint256 tokenId) returns (TokenInfo)
```

### State-Changing Functions (Requires Gas)
```solidity
// Create new token (Owner only)
createToken(uint256 tokenId, address creator, uint256 basePrice, uint256 kValue)

// Buy tokens with slippage protection
buy(uint256 tokenId, uint256 amount, uint256 maxCost) payable

// Sell tokens with slippage protection
sell(uint256 tokenId, uint256 amount, uint256 minRefund)
```

### Admin Functions (Owner Only)
```solidity
// Update platform wallet address
setPlatformWallet(address _platformWallet)
```

### Events
```solidity
event TokenCreated(uint256 indexed tokenId, address indexed creator, uint256 basePrice, uint256 kValue)
event Bought(uint256 indexed tokenId, address indexed buyer, uint256 amount, uint256 totalCost)
event Sold(uint256 indexed tokenId, address indexed seller, uint256 amount, uint256 refundAmount)
```

## Usage Examples

### 1. Create Token (Owner Only)
```javascript
// Only contract owner can create tokens
const tokenId = wikiEntryId; // or postId
const creatorAddress = "0x..."; // Content creator's wallet address
const basePrice = ethers.parseEther("0.001"); // 0.001 ETH
const kValue = ethers.parseEther("0.0001"); // 0.0001 ETH

await fanzToken.createToken(tokenId, creatorAddress, basePrice, kValue);
```

### 2. Buy Tokens (with Slippage Protection)
```javascript
const tokenId = 1;
const amount = 10;

// Get current cost estimate
const [totalCost, creatorFee, platformFee] = await fanzToken.calculateBuyCost(tokenId, amount);

// Add 2% slippage tolerance
const maxCost = totalCost * 102n / 100n;

// Execute buy with slippage protection
await fanzToken.buy(tokenId, amount, maxCost, { value: maxCost });
```

### 3. Sell Tokens (with Slippage Protection)
```javascript
const tokenId = 1;
const amount = 5;

// Get expected refund
const [refundAmount, fee] = await fanzToken.calculateSellRefund(tokenId, amount);

// Accept 2% slippage
const minRefund = refundAmount * 98n / 100n;

// Execute sell with slippage protection
await fanzToken.sell(tokenId, amount, minRefund);
```

### 4. Get Current Price
```javascript
const price = await fanzToken.getCurrentPrice(tokenId);
console.log("Current price:", ethers.formatEther(price), "ETH");
```

## Monitoring & Maintenance

### Basescan Monitoring
- **Contract**: https://basescan.org/address/CONTRACT_ADDRESS
- **Monitor**: TokenCreated, Bought, Sold events
- **Track**: Contract ETH balance for liquidity
- **Verify**: Creator and platform fee distributions

### Frontend Integration
```typescript
// Listen to contract events
contract.on("Bought", (tokenId, buyer, amount, totalCost) => {
  console.log(`Token ${tokenId} bought:`, {
    buyer,
    amount: amount.toString(),
    cost: ethers.formatEther(totalCost)
  });
});

contract.on("Sold", (tokenId, seller, amount, refundAmount) => {
  console.log(`Token ${tokenId} sold:`, {
    seller,
    amount: amount.toString(),
    refund: ethers.formatEther(refundAmount)
  });
});
```

### Health Checks
- Verify contract balance matches expected liquidity
- Monitor gas prices on Base network
- Check creator fee distribution accuracy
- Verify platform wallet receives correct fees
- Test slippage protection under various market conditions

## Troubleshooting

### Common Issues

**"Slippage: cost > maxCost"**
- Price increased between estimation and transaction
- Solution: Increase slippage tolerance (e.g., 3-5%)

**"Slippage: refund < minRefund"**
- Price decreased between estimation and transaction
- Solution: Decrease minRefund or retry transaction

**"Token already exists"**
- Token ID already created
- Solution: Check database synchronization

**"Not enough supply"**
- Trying to sell more tokens than exist
- Solution: Verify user balance and total supply

## Resources

- **Base Network**: https://base.org
- **Basescan**: https://basescan.org
- **OpenZeppelin Contracts**: https://docs.openzeppelin.com/contracts
- **Hardhat**: https://hardhat.org
- **Remix IDE**: https://remix.ethereum.org
