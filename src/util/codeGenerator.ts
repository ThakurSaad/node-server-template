import crypto from "crypto";

// 6-digit OTP from a CSPRNG (Math.random is predictable) plus its expiry
const codeGenerator = (minutes: number) => ({
  code: crypto.randomInt(100000, 1000000).toString(),
  expiredAt: Date.now() + minutes * 60 * 1000,
});

export = codeGenerator;
