/** Convex actions run in Node; process.env is available for env vars set in the dashboard. */
declare const process: { env: Record<string, string | undefined> };
