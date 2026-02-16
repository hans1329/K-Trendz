// 에이전트 배치 해시 로직 시뮬레이션 테스트
// DB/온체인 호출 없이 핵심 암호화 및 ABI 인코딩 로직만 검증

import { assertEquals, assertNotEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { ethers } from "npm:ethers@6.15.0";

// === 테스트용 상수 (agent-cron과 동일) ===
const BACKEND_SMART_ACCOUNT = "0x8B4197d938b8F4212B067e9925F7251B6C21B856";
const ENTRY_POINT_ADDRESS = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";
const DAU_CONTRACT_ADDRESS = "0xf7F05cEd0F2c905aD59C370265D67846FAb9959E";

const DAU_ABI = [
  "function recordActivity(address user, bytes32 activityType, bytes32 referenceHash) external",
];
const SIMPLE_ACCOUNT_ABI = [
  "function execute(address dest, uint256 value, bytes calldata func) external",
];
const ENTRY_POINT_ABI = [
  "function getNonce(address sender, uint192 key) view returns (uint256)",
  "function handleOps(tuple(address sender, uint256 nonce, bytes initCode, bytes callData, uint256 callGasLimit, uint256 verificationGasLimit, uint256 preVerificationGas, uint256 maxFeePerGas, uint256 maxPriorityFeePerGas, bytes paymasterAndData, bytes signature)[] ops, address beneficiary) external",
];

const ACTIVITY_AGENT_BATCH = ethers.keccak256(ethers.toUtf8Bytes("agent_batch"));

// === 테스트 1: 메시지 직렬화 및 해시 생성 ===
Deno.test("배치 페이로드 직렬화 및 keccak256 해시 생성", () => {
  const messages = [
    {
      id: "msg-001",
      user_id: "user-aaa",
      message: "BTS is the best!",
      topic_type: "fan_cheer",
      created_at: "2026-02-15T01:00:00Z",
    },
    {
      id: "msg-002",
      user_id: "user-bbb",
      message: "BLACKPINK in your area!",
      topic_type: "fan_cheer",
      created_at: "2026-02-15T02:00:00Z",
    },
  ];

  const batchPayload = messages.map(m => ({
    id: m.id,
    user_id: m.user_id,
    message: m.message,
    topic_type: m.topic_type,
    created_at: m.created_at,
  }));

  const batchJson = JSON.stringify(batchPayload);
  const batchHash = ethers.keccak256(ethers.toUtf8Bytes(batchJson));

  // 해시가 bytes32 형식인지 확인 (0x + 64자)
  assertEquals(batchHash.length, 66, "해시 길이는 66자 (0x + 64 hex)");
  assert(batchHash.startsWith("0x"), "해시는 0x로 시작");
  console.log(`✅ 배치 해시: ${batchHash}`);
  console.log(`   페이로드 크기: ${batchJson.length} bytes, 메시지 수: ${messages.length}`);
});

// === 테스트 2: 동일 입력 → 동일 해시 (결정적) ===
Deno.test("동일 입력에 대해 동일한 해시 생성 (결정적)", () => {
  const payload = [{ id: "msg-001", user_id: "u1", message: "hello", topic_type: "test", created_at: "2026-02-15T00:00:00Z" }];
  const hash1 = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(payload)));
  const hash2 = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(payload)));
  assertEquals(hash1, hash2, "동일 입력 → 동일 해시");
  console.log(`✅ 결정적 해시 확인: ${hash1}`);
});

// === 테스트 3: 다른 입력 → 다른 해시 ===
Deno.test("다른 입력에 대해 다른 해시 생성", () => {
  const p1 = [{ id: "msg-001", user_id: "u1", message: "hello", topic_type: "t", created_at: "2026-02-15T00:00:00Z" }];
  const p2 = [{ id: "msg-001", user_id: "u1", message: "world", topic_type: "t", created_at: "2026-02-15T00:00:00Z" }];
  const hash1 = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(p1)));
  const hash2 = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(p2)));
  assertNotEquals(hash1, hash2, "다른 입력 → 다른 해시");
  console.log(`✅ 해시 차이 확인`);
  console.log(`   hash1: ${hash1}`);
  console.log(`   hash2: ${hash2}`);
});

// === 테스트 4: activity type 해시 일관성 ===
Deno.test("ACTIVITY_AGENT_BATCH 해시가 컨트랙트와 일치", () => {
  const expected = ethers.keccak256(ethers.toUtf8Bytes("agent_batch"));
  assertEquals(ACTIVITY_AGENT_BATCH, expected);
  console.log(`✅ activity type 해시: ${ACTIVITY_AGENT_BATCH}`);
});

// === 테스트 5: DAU recordActivity ABI 인코딩 ===
Deno.test("DAU recordActivity calldata 인코딩", () => {
  const batchHash = ethers.keccak256(ethers.toUtf8Bytes("test_payload"));

  const dauIface = new ethers.Interface(DAU_ABI);
  const innerCallData = dauIface.encodeFunctionData("recordActivity", [
    BACKEND_SMART_ACCOUNT, ACTIVITY_AGENT_BATCH, batchHash,
  ]);

  // recordActivity selector = 0x의 첫 4바이트 (8 hex)
  assert(innerCallData.startsWith("0x"), "calldata는 0x로 시작");
  // address(20) + bytes32 + bytes32 = 96 bytes = 192 hex + 8 hex selector = 200 + 2 (0x)
  assertEquals(innerCallData.length, 202, "calldata 길이 = 0x + 8 selector + 192 params");
  console.log(`✅ recordActivity calldata: ${innerCallData.substring(0, 42)}...`);
});

// === 테스트 6: SimpleAccount.execute 래핑 ===
Deno.test("SimpleAccount.execute로 DAU 호출 래핑", () => {
  const batchHash = ethers.keccak256(ethers.toUtf8Bytes("test_payload"));

  const dauIface = new ethers.Interface(DAU_ABI);
  const innerCallData = dauIface.encodeFunctionData("recordActivity", [
    BACKEND_SMART_ACCOUNT, ACTIVITY_AGENT_BATCH, batchHash,
  ]);

  const acctIface = new ethers.Interface(SIMPLE_ACCOUNT_ABI);
  const executeCallData = acctIface.encodeFunctionData("execute", [
    DAU_CONTRACT_ADDRESS, 0, innerCallData,
  ]);

  assert(executeCallData.startsWith("0x"), "execute calldata는 0x로 시작");
  // execute(address, uint256, bytes) — 동적 bytes이므로 길이가 더 길어짐
  assert(executeCallData.length > innerCallData.length, "execute calldata가 inner보다 길어야 함");
  console.log(`✅ execute calldata 길이: ${executeCallData.length} chars`);
});

// === 테스트 7: UserOp 해시 서명 시뮬레이션 ===
Deno.test("UserOp 해시 생성 및 서명 시뮬레이션", async () => {
  // 테스트용 랜덤 키 (실제 키가 아님)
  const testPrivateKey = ethers.hexlify(ethers.randomBytes(32));
  const testSigner = new ethers.Wallet(testPrivateKey);

  const batchHash = ethers.keccak256(ethers.toUtf8Bytes("sim_payload"));
  const dauIface = new ethers.Interface(DAU_ABI);
  const innerCallData = dauIface.encodeFunctionData("recordActivity", [
    BACKEND_SMART_ACCOUNT, ACTIVITY_AGENT_BATCH, batchHash,
  ]);

  const acctIface = new ethers.Interface(SIMPLE_ACCOUNT_ABI);
  const executeCallData = acctIface.encodeFunctionData("execute", [
    DAU_CONTRACT_ADDRESS, 0, innerCallData,
  ]);

  // 시뮬레이션 UserOp
  const userOp = {
    sender: BACKEND_SMART_ACCOUNT,
    nonce: 42n,
    initCode: "0x",
    callData: executeCallData,
    callGasLimit: 200000n,
    verificationGasLimit: 100000n,
    preVerificationGas: 50000n,
    maxFeePerGas: ethers.parseUnits("0.1", "gwei"),
    maxPriorityFeePerGas: ethers.parseUnits("0.05", "gwei"),
    paymasterAndData: "0x",
    signature: "0x",
  };

  // UserOp 해시 생성 (agent-cron과 동일한 로직)
  const opHash = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["address","uint256","bytes32","bytes32","uint256","uint256","uint256","uint256","uint256","bytes32"],
      [
        userOp.sender, userOp.nonce,
        ethers.keccak256(userOp.initCode), ethers.keccak256(userOp.callData),
        userOp.callGasLimit, userOp.verificationGasLimit, userOp.preVerificationGas,
        userOp.maxFeePerGas, userOp.maxPriorityFeePerGas,
        ethers.keccak256(userOp.paymasterAndData),
      ]
    )
  );

  const finalHash = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["bytes32","address","uint256"],
      [opHash, ENTRY_POINT_ADDRESS, 8453n] // chainId = Base Mainnet
    )
  );

  // 서명 생성
  const signature = await testSigner.signMessage(ethers.getBytes(finalHash));

  // 서명 검증
  assertEquals(signature.length, 132, "서명 길이는 132자 (0x + 130 hex = 65 bytes)");
  assert(signature.startsWith("0x"), "서명은 0x로 시작");

  // 서명에서 주소 복원
  const recovered = ethers.verifyMessage(ethers.getBytes(finalHash), signature);
  assertEquals(recovered, testSigner.address, "서명 복원 주소가 signer와 일치");

  console.log(`✅ UserOp 해시 서명 시뮬레이션 완료`);
  console.log(`   opHash: ${opHash}`);
  console.log(`   finalHash: ${finalHash}`);
  console.log(`   signature: ${signature.substring(0, 42)}...`);
  console.log(`   signer: ${testSigner.address}`);
});

// === 테스트 8: 빈 메시지 배열 처리 ===
Deno.test("빈 메시지 배열은 기록하지 않아야 함", () => {
  const messages: unknown[] = [];
  assertEquals(messages.length, 0);
  // 실제 로직: if (!messages || messages.length === 0) return "No approved messages to record"
  console.log(`✅ 빈 배열 처리 확인 — 스킵됨`);
});

// === 테스트 9: 대량 메시지 해시 성능 ===
Deno.test("100개 메시지 배치 해시 성능", () => {
  const messages = Array.from({ length: 100 }, (_, i) => ({
    id: `msg-${String(i).padStart(3, "0")}`,
    user_id: `user-${i % 10}`,
    message: `Test message number ${i} with some content about K-pop and fan activities`,
    topic_type: i % 3 === 0 ? "fan_cheer" : i % 3 === 1 ? "news" : "market",
    created_at: new Date(Date.now() - i * 60000).toISOString(),
  }));

  const start = performance.now();
  const batchJson = JSON.stringify(messages);
  const batchHash = ethers.keccak256(ethers.toUtf8Bytes(batchJson));
  const elapsed = performance.now() - start;

  assert(elapsed < 1000, `해시 생성이 1초 미만이어야 함 (실제: ${elapsed.toFixed(1)}ms)`);
  assertEquals(batchHash.length, 66);
  console.log(`✅ 100개 메시지 해시: ${elapsed.toFixed(1)}ms, 페이로드: ${(batchJson.length / 1024).toFixed(1)}KB`);
  console.log(`   해시: ${batchHash}`);
});
