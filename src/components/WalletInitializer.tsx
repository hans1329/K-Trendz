import { useWallet } from "@/hooks/useWallet";

// 지갑 자동 생성을 위해 전역에서 useWallet 훅을 초기화하는 컴포넌트
const WalletInitializer = () => {
  // useWallet 훅 내부의 auto-create 로직을 트리거하기 위해 호출만 수행
  useWallet();
  return null;
};

export default WalletInitializer;
