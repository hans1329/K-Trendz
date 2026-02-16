// Solana PDA 생성 유틸리티
import { PublicKey } from '@solana/web3.js';

const WHMD_PROGRAM_ID = new PublicKey('FDLm8vjEuBTCNYgNatEWUocsEy71c8LmBFg7jCr1ygaL');

/**
 * SHA-256 해시를 사용하여 문자열을 32바이트로 변환
 */
async function hashString(str: string): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return new Uint8Array(hashBuffer);
}

/**
 * Supabase User UUID를 기반으로 PDA(Program Derived Address) 생성
 * @param userId - Supabase User UUID
 * @returns PDA 주소 (string)
 */
export const generateUserPDA = async (userId: string): Promise<string> => {
  try {
    // UUID를 SHA-256으로 해시하여 32바이트로 변환 (Solana seed 길이 제한 준수)
    const userIdHash = await hashString(userId);
    const vaultSeed = new TextEncoder().encode('user_vault');
    
    // Seeds: [b"user_vault", sha256(userId)]
    const [pda] = await PublicKey.findProgramAddressSync(
      [
        vaultSeed,
        userIdHash
      ],
      WHMD_PROGRAM_ID
    );
    
    return pda.toBase58();
  } catch (error) {
    console.error('Error generating PDA:', error);
    throw error;
  }
};
