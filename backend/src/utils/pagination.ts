export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
}

export interface PaginationMetadata {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 50;
export const MAX_PAGE = 10000;

/**
 * Normalizes and bounds pagination query parameters.
 * - page: positive integer, defaults to 1, capped at MAX_PAGE
 * - limit: positive integer, defaults to 20, capped at MAX_LIMIT (50)
 * - skip: calculated safely as (page - 1) * limit
 */
export function parsePaginationParams(
  query: any,
  defaultLimit = DEFAULT_LIMIT,
  maxLimit = MAX_LIMIT
): PaginationParams {
  let page = parseInt(String(query?.page ?? ''), 10);
  if (isNaN(page) || page < 1) {
    page = DEFAULT_PAGE;
  }
  if (page > MAX_PAGE) {
    page = MAX_PAGE;
  }

  let limit = parseInt(String(query?.limit ?? ''), 10);
  if (isNaN(limit) || limit < 1) {
    limit = defaultLimit;
  }
  if (limit > maxLimit) {
    limit = maxLimit;
  }

  const skip = (page - 1) * limit;

  return { page, limit, skip };
}

/**
 * Builds standard pagination metadata from total count, page, and limit.
 */
export function buildPaginationMetadata(
  total: number,
  page: number,
  limit: number
): PaginationMetadata {
  const safeTotal = Math.max(0, Number(total) || 0);
  const totalPages = Math.max(1, Math.ceil(safeTotal / limit));
  return {
    page,
    limit,
    total: safeTotal,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}
