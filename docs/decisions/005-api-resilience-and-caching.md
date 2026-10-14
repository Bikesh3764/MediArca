# Architecture Decision Record 005: API Gateway Resilience, Error Normalization, and Caching

## Status
Accepted and Implemented

## Context
1. In production, reverse proxies (Cloudflare, Nginx, Render) occasionally return 502 Bad Gateway or 504 Gateway Timeout responses as HTML pages instead of JSON. When the frontend `fetch` called `res.json()`, it threw an unhandled `SyntaxError: Unexpected token '<'` which crashed user view components.
2. Rapid polling on live queues and directory catalogs can produce unnecessary database load if responses are not cached appropriately.
3. If public catalogs are cached globally without regard to authorization headers, private user status or doctor affiliations could be served across unauthenticated requests.

## Decision
1. **Frontend Non-JSON Body Handling**:
   In `frontend/src/services/api.ts`:
   - Inspect the response `Content-Type` header before parsing.
   - If `Content-Type` is not `application/json`, read the response as raw text (`res.text()`) and construct a clean, typed `Error` containing HTTP status code and a friendly human-readable message (e.g. `Server temporarily unavailable (502). Please retry.`).
   - Prevents unhandled JSON parse exceptions.
2. **Dynamic In-Memory Caching**:
   - The frontend API client implements a TTL-based cache (60 seconds for public doctor and clinic catalogs).
   - Rate limit normalization: Replaces numeric IDs in path metrics so individual entity lookups share route buckets.
3. **HTTP Cache Isolation**:
   - Backend public cache middleware attaches `Cache-Control: public, max-age=60` and `Vary: Authorization`.
   - Ensures private authenticated queries are never served from a public CDN or browser cache.

## Consequences
### Positive
- Zero white-screen frontend crashes caused by reverse proxy HTML error pages.
- Drastically reduced database traffic for frequent doctor and clinic discovery queries.
- Clean user feedback during intermittent backend maintenance or cold starts.

### Negative / Trade-offs
- Slight cache invalidation delay (up to 60s) for newly registered public doctors unless explicitly invalidated.
