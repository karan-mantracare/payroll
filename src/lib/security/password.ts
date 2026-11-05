import bcrypt from "bcrypt";

export const DEFAULT_SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || "12", 10);

/**
 * Hashes a plaintext password using bcrypt with configurable work factor (default 12).
 */
export async function hashPassword(
  password: string,
  saltRounds = DEFAULT_SALT_ROUNDS
): Promise<string> {
  if (!password || typeof password !== "string") {
    throw new Error("Password must be a non-empty string");
  }
  return bcrypt.hash(password, saltRounds);
}

/**
 * Securely verifies a plaintext password against a bcrypt hash.
 * Resistant to timing attacks.
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  if (!password || !hash) {
    return false;
  }
  return bcrypt.compare(password, hash);
}

/**
 * Benchmarks bcrypt hashing and verification latency on the current deployment environment.
 */
export async function benchmarkBcrypt(rounds = DEFAULT_SALT_ROUNDS): Promise<{
  rounds: number;
  hashTimeMs: number;
  verifyTimeMs: number;
  totalTimeMs: number;
}> {
  const samplePassword = "MantraCare_Secure_Password_2026!#";

  const t0 = performance.now();
  const hash = await bcrypt.hash(samplePassword, rounds);
  const t1 = performance.now();

  const verifySuccess = await bcrypt.compare(samplePassword, hash);
  const t2 = performance.now();

  if (!verifySuccess) {
    throw new Error("Benchmark verification failed");
  }

  const hashTimeMs = Math.round((t1 - t0) * 100) / 100;
  const verifyTimeMs = Math.round((t2 - t1) * 100) / 100;

  return {
    rounds,
    hashTimeMs,
    verifyTimeMs,
    totalTimeMs: Math.round((hashTimeMs + verifyTimeMs) * 100) / 100,
  };
}

