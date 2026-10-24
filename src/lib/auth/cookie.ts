// Shared with the middleware, which runs on the edge runtime and can't import
// the database client.
export const SESSION_COOKIE = "pp_session";
export const PUBLIC_PATHS = ["/login", "/signup"];
