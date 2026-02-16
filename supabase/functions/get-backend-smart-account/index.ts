import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { ethers } from "npm:ethers@6.15.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Coinbase Smart Wallet Factory (Base Mainnet)
const SMART_WALLET_FACTORY = "0x0BA5ED0c6AA8c49038F819E587E2633c4A9F428a";
// Coinbase Smart Wallet Implementation
const IMPLEMENTATION = "0x000100abaad02f1cfC8Bbe32bD5a564817339E72";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const backendPrivateKey = Deno.env.get('BACKEND_WALLET_PRIVATE_KEY');
    if (!backendPrivateKey) {
      throw new Error('BACKEND_WALLET_PRIVATE_KEY not configured');
    }

    // EOA 주소
    const eoaWallet = new ethers.Wallet(backendPrivateKey);
    const eoaAddress = eoaWallet.address;

    // Smart Account 주소 계산 (CREATE2)
    // owners 배열과 nonce를 사용하여 salt 생성
    const owners = [eoaAddress];
    const nonce = 0n;
    
    // salt = keccak256(abi.encode(owners, nonce))
    const abiCoder = new ethers.AbiCoder();
    const encodedOwnersAndNonce = abiCoder.encode(
      ["address[]", "uint256"],
      [owners, nonce]
    );
    const salt = ethers.keccak256(encodedOwnersAndNonce);

    // initCode = abi.encodeWithSelector(CoinbaseSmartWallet.initialize.selector, owners)
    const initializeInterface = new ethers.Interface([
      "function initialize(address[] calldata owners)"
    ]);
    const initializeCalldata = initializeInterface.encodeFunctionData("initialize", [owners]);
    
    // ERC1967 Proxy bytecode (simplified - this is the standard proxy creation code pattern)
    // The proxy bytecode includes: implementation address + initialize calldata
    // Coinbase uses a specific proxy pattern
    
    // For Coinbase Smart Wallet, the init code hash is computed from:
    // keccak256(abi.encodePacked(
    //   type(ERC1967Proxy).creationCode,
    //   abi.encode(implementation, initializeCalldata)
    // ))
    
    // Standard ERC1967Proxy creation code (from OpenZeppelin)
    const proxyCreationCode = "0x608060405260405161046c38038061046c83398101604081905261002291610249565b61002e82826000610035565b505061030e565b61003e83610061565b60008251118061004b5750805b1561005c5761005a83836100a1565b505b505050565b61006a816100cd565b6040516001600160a01b038216907fbc7cd75a20ee27fd9adebab32041f755214dbc6bffa90cc0225b39da2e5c2d3b90600090a250565b60606100c6838360405180606001604052806027815260200161044560279139610161565b9392505050565b6001600160a01b0381163b61013f5760405162461bcd60e51b815260206004820152602d60248201527f455243313936373a206e657720696d706c656d656e746174696f6e206973206e60448201526c1bdd08184818dbdb9d1c9858dd609a1b60648201526084015b60405180910390fd5b7f360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc80546001600160a01b0319166001600160a01b0392909216919091179055565b6060600080856001600160a01b03168560405161017e91906102bf565b600060405180830381855af49150503d80600081146101b9576040519150601f19603f3d011682016040523d82523d6000602084013e6101be565b606091505b5090925090506101d0868383876101da565b9695505050505050565b60608315610246578251610239576001600160a01b0385163b6102395760405162461bcd60e51b815260206004820152601d60248201527f416464726573733a2063616c6c20746f206e6f6e2d636f6e74726163740000006044820152606401610136565b5081610250565b6102508383610258565b949350505050565b8151156102685781518083602001fd5b8060405162461bcd60e51b81526004016101369190906102db565b634e487b7160e01b600052604160045260246000fd5b60005b838110156102b457818101518382015260200161029c565b50506000910152565b600082516102cf818460208701610299565b9190910192915050565b60208152600082518060208401526102f8816040850160208701610299565b601f01601f19169190910160400192915050565b610128806103206000396000f3fe6080604052366100135761001161001d565b005b61001b61001d565b005b610025610035565b61003561003061008c565b610095565b565b3660008037600080366000845af43d6000803e808015610056573d6000f35b3d6000fd5b60007f360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc610087836100b9565b905090565b6000610087610121565b3660008037600080366000845af43d6000803e8080156100b4573d6000f35b3d6000fd5b6000806100c583610121565b9050806001600160a01b03163b6000036101175760405162461bcd60e51b815260206004820152600e60248201526d1393d517d355531317d05353d5d560921b604482015260640160405180910390fd5b919050565b60006100877f360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc5490565b416464726573733a2064656c656761746563616c6c20746f206e6f6e2d636f6e7472616374000000";
    
    // Encode constructor arguments: (implementation, initializeCalldata)
    const constructorArgs = abiCoder.encode(
      ["address", "bytes"],
      [IMPLEMENTATION, initializeCalldata]
    );
    
    // Full init code = creation code + constructor args
    const initCode = proxyCreationCode + constructorArgs.slice(2);
    const initCodeHash = ethers.keccak256(initCode);
    
    // CREATE2 address calculation
    // address = keccak256(0xff ++ factory ++ salt ++ initCodeHash)[12:]
    const create2Input = ethers.concat([
      "0xff",
      SMART_WALLET_FACTORY,
      salt,
      initCodeHash
    ]);
    const create2Hash = ethers.keccak256(create2Input);
    const smartAccountAddress = ethers.getAddress("0x" + create2Hash.slice(-40));

    return new Response(
      JSON.stringify({
        success: true,
        eoaAddress,
        smartAccountAddress,
        salt,
        message: "USDC를 이 Smart Account 주소로 전송하세요. 주의: 이 주소는 아직 배포되지 않았을 수 있습니다. 첫 트랜잭션 시 자동 배포됩니다."
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error:', errorMessage);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
