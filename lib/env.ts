export function getSessionSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;

  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET must be set in production");
  }

  return new TextEncoder().encode(
    secret ?? "freelancr-mk-dev-secret-change-in-production"
  );
}

export function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  return url;
}
