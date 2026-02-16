// withdraw-usdc 출금 한도 및 수수료 로직 시뮬레이션 테스트
// 실제 온체인/DB 호출 없이 순수 비즈니스 로직만 검증

import { assertEquals, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";

// 비즈니스 로직 상수 (Edge Function과 동일)
const WITHDRAWAL_FEE_USD = 0.5;
const MAX_WITHDRAWAL_AMOUNT = 100;

// 출금 검증 로직을 별도 함수로 추출하여 테스트
function validateWithdrawal(amount: number, balance: number): { netAmount: number; fee: number } {
  if (isNaN(amount) || amount <= 0) {
    throw new Error("Invalid amount");
  }
  
  if (amount <= WITHDRAWAL_FEE_USD) {
    throw new Error(`Amount must be greater than $${WITHDRAWAL_FEE_USD} (withdrawal fee)`);
  }

  if (amount > MAX_WITHDRAWAL_AMOUNT) {
    throw new Error(`Maximum withdrawal amount is $${MAX_WITHDRAWAL_AMOUNT} per transaction`);
  }

  if (amount > balance) {
    throw new Error("Insufficient USDC balance");
  }

  const netAmount = amount - WITHDRAWAL_FEE_USD;
  const fee = WITHDRAWAL_FEE_USD;

  return { netAmount, fee };
}

// ===== 테스트 케이스 =====

Deno.test("정상 출금: $50 요청 → 순수금액 $49.50, 수수료 $0.50", () => {
  const result = validateWithdrawal(50, 200);
  assertEquals(result.netAmount, 49.5);
  assertEquals(result.fee, 0.5);
});

Deno.test("정상 출금: $100 (최대한도) 요청 → 순수금액 $99.50, 수수료 $0.50", () => {
  const result = validateWithdrawal(100, 200);
  assertEquals(result.netAmount, 99.5);
  assertEquals(result.fee, 0.5);
});

Deno.test("정상 출금: $1 최소 유효 금액 요청", () => {
  const result = validateWithdrawal(1, 200);
  assertEquals(result.netAmount, 0.5);
  assertEquals(result.fee, 0.5);
});

Deno.test("거부: $150 요청 → 최대 한도 $100 초과", () => {
  let errorMsg = "";
  try {
    validateWithdrawal(150, 200);
  } catch (e) {
    errorMsg = (e as Error).message;
  }
  assertEquals(errorMsg, `Maximum withdrawal amount is $${MAX_WITHDRAWAL_AMOUNT} per transaction`);
});

Deno.test("거부: $100.01 요청 → 최대 한도 $100 초과 (경계값)", () => {
  let errorMsg = "";
  try {
    validateWithdrawal(100.01, 200);
  } catch (e) {
    errorMsg = (e as Error).message;
  }
  assertEquals(errorMsg, `Maximum withdrawal amount is $${MAX_WITHDRAWAL_AMOUNT} per transaction`);
});

Deno.test("거부: $0.30 요청 → 수수료($0.50) 미만", () => {
  let errorMsg = "";
  try {
    validateWithdrawal(0.3, 200);
  } catch (e) {
    errorMsg = (e as Error).message;
  }
  assertEquals(errorMsg, `Amount must be greater than $${WITHDRAWAL_FEE_USD} (withdrawal fee)`);
});

Deno.test("거부: $0.50 요청 → 수수료와 동일 (순수금액 0)", () => {
  let errorMsg = "";
  try {
    validateWithdrawal(0.5, 200);
  } catch (e) {
    errorMsg = (e as Error).message;
  }
  assertEquals(errorMsg, `Amount must be greater than $${WITHDRAWAL_FEE_USD} (withdrawal fee)`);
});

Deno.test("거부: $0 요청 → 유효하지 않은 금액", () => {
  let errorMsg = "";
  try {
    validateWithdrawal(0, 200);
  } catch (e) {
    errorMsg = (e as Error).message;
  }
  assertEquals(errorMsg, "Invalid amount");
});

Deno.test("거부: 음수 금액 요청", () => {
  let errorMsg = "";
  try {
    validateWithdrawal(-10, 200);
  } catch (e) {
    errorMsg = (e as Error).message;
  }
  assertEquals(errorMsg, "Invalid amount");
});

Deno.test("거부: $80 요청, 잔액 $50 → 잔액 부족", () => {
  let errorMsg = "";
  try {
    validateWithdrawal(80, 50);
  } catch (e) {
    errorMsg = (e as Error).message;
  }
  assertEquals(errorMsg, "Insufficient USDC balance");
});

Deno.test("경계값: 잔액과 정확히 같은 금액 요청 ($100, 잔액 $100)", () => {
  const result = validateWithdrawal(100, 100);
  assertEquals(result.netAmount, 99.5);
  assertEquals(result.fee, 0.5);
});

Deno.test("수수료 계산 정확도: $0.51 요청 (수수료 직후 금액)", () => {
  const result = validateWithdrawal(0.51, 200);
  // 부동소수점 보정
  assertEquals(Math.round(result.netAmount * 100) / 100, 0.01);
  assertEquals(result.fee, 0.5);
});
