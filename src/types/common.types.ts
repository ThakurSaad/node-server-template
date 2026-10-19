import { PaginationMeta } from "../builder/queryBuilder";

export interface ApiResponse<T = unknown> {
  statusCode: number;
  success: boolean;
  message?: string | null;
  meta?: Record<string, unknown> | PaginationMeta;
  data?: T | null;
}
