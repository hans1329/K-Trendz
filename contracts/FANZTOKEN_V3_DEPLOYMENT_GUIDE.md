# FanzTokenUSDC_v3 Deployment Guide

## Overview
V3 adds a 4% platform fee on token sales while maintaining identical purchase logic from V2.

### Changes from V2:
- **Purchase**: Unchanged (20% Artist Fund, 10% Platform, 70% Reserve)
- **Sale**: 4% platform fee deducted from refund (96% to user)

## Deployment Steps

### 1. Deploy V3 Contract

1. Open Remix IDE: https://remix.ethereum.org
2. Create new file: `FanzTokenUSDC_v3.sol`
3. Copy contract code from `/contracts/FanzTokenUSDC_v3.sol`
4. Compile with Solidity 0.8.20+
5. Deploy to Base Mainnet with constructor args:
   - `_platformWallet`: `0x354f221cb4a528f2a2a8e4a126ea39dd120e40ab`
   - `_artistFundWallet`: `0xd5C1296990b9072302a627752E46061a40112342`

### 2. Record New Contract Address

After deployment, save the new contract address:
```
V3 Contract: 0x________________________________________
```

### 3. Re-register Existing Tokens

For each existing token, call `createToken()` with matching parameters:
```solidity
createToken(
    tokenId,      // Same token ID from V2
    basePrice,    // Same base price (1150000 = $1.15)
    k,            // Same k value (2000000 = 2.0)
    creatorAddress // Original creator address
)
```

**Note**: New tokens start with supply = 0. If V2 had existing supply, you'll need to handle migration manually.

### 4. Update Environment Variables

In Supabase Dashboard → Edge Functions → Secrets:
```
FANZTOKEN_CONTRACT_ADDRESS = <new V3 address>
```

### 5. Update Coinbase Gas Policy

In Coinbase Developer Platform → Gas Policies:
1. Add new contract address
2. Allow method: `sell(uint256,uint256,uint256)`
3. Keep V2 contract in allowlist during migration period

### 6. Migration Checklist

- [ ] V3 contract deployed
- [ ] All existing tokens re-registered
- [ ] `FANZTOKEN_CONTRACT_ADDRESS` updated
- [ ] Coinbase Gas Policy updated
- [ ] Test sell transaction successful
- [ ] Test buy transaction successful

## Verification

After deployment, verify:
1. `calculateBuyCost()` returns same values as V2
2. `calculateSellRefund()` returns 96% (4% less than V2)
3. Sell transaction correctly sends 4% to platform wallet

## Rollback Plan

If issues arise:
1. Revert `FANZTOKEN_CONTRACT_ADDRESS` to V2 address
2. Update Coinbase Gas Policy back to V2
