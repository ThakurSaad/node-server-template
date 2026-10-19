// This describes the shape of the query parameters coming from the URL
// (e.g. ?searchTerm=john&sort=name&page=2&limit=10&fields=name,email)
// All fields are optional because the user may or may not include them
export interface QueryParams {
  searchTerm?: string;
  sort?: string;
  limit?: string;
  page?: string;
  fields?: string;
  [key: string]: string | undefined; // allows extra filter fields like ?age=25
}

// This describes what QueryBuilder.countTotal() returns
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPage: number;
}

export interface ApiResponse<T = unknown> {
  statusCode: number;
  success: boolean;
  message?: string | null;
  meta?: Record<string, unknown> | PaginationMeta;
  data?: T | null;
}
