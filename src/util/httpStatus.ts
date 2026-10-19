// Re-export `status` with number-typed values. The upstream literal types
// make e.g. BAD_REQUEST unusable as a general status code, so we widen them
// to `number` here.
import { status as rawStatus } from "http-status";

const status = rawStatus as unknown as {
  [K in keyof typeof rawStatus]: number;
};

export { status };
