// Base Builder Code: bc_5wlsviyq
// ERC-8021 데이터 서픽스 형식 (뒤에서부터 파싱):
//   [코드길이: 1바이트][코드: N바이트][스키마ID: 1바이트(0x00)][ERC마커: 16바이트(8021 반복)]
//
// bc_5wlsviyq (11자)
//   코드길이: 0b (11)
//   코드 hex: 62635f35776c7376697971
//   스키마ID: 00
//   ERC마커: 80218021802180218021802180218021
//
// 전체 서픽스 (ERC-8021 전체 형식):
// "0b62635f35776c73766979710080218021802180218021802180218021"
//
// 주의: UserOperation callData에 추가할 때는 ERC 마커 없이 짧은 형식 사용
// (Paymaster/Bundler 호환성 확보 - 전체 형식은 EOA 트랜잭션용)
// 전체 ERC-8021 서픽스 사용 (Base 인덱서가 80218021... 마커를 필요로 함)
// 이전 짧은 형식("0762635f35776c7376697971")은 Paymaster/Bundler에서 동작했으나
// Base 대시보드에서 온체인 활동이 집계되지 않는 문제가 있었음
export const BUILDER_CODE_SUFFIX = "0b62635f35776c73766979710080218021802180218021802180218021";

// EOA 트랜잭션용 전체 ERC-8021 서픽스 (프론트엔드 Wagmi/Viem에서 사용)
export const BUILDER_CODE_SUFFIX_FULL = "0b62635f35776c73766979710080218021802180218021802180218021";

/**
 * UserOperation의 callData에 Base Builder Code 서픽스를 추가
 * @param callData - 기존 callData (0x로 시작하는 hex string)
 * @returns Builder Code가 추가된 callData
 */
export function appendBuilderCode(callData: string): string {
  return callData + BUILDER_CODE_SUFFIX;
}
