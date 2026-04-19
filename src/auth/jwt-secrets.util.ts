export function getJwtAccessSecret(): string {
  const secret =
    process.env.JWT_SECRET?.trim() || process.env.JWT_SECRET_KEY?.trim();
  if (!secret) {
    throw new Error(
      'JWT access signing key is not configured. Set JWT_SECRET or JWT_SECRET_KEY in .env.',
    );
  }
  return secret;
}

export function getJwtRefreshSecret(): string {
  const secret =
    process.env.JWT_REFRESH_SECRET?.trim() ||
    process.env.JWT_SECRET_REFRESH_KEY?.trim();
  if (!secret) {
    throw new Error(
      'JWT refresh signing key is not configured. Set JWT_REFRESH_SECRET or JWT_SECRET_REFRESH_KEY in .env.',
    );
  }
  return secret;
}

export function assertJwtEnvConfigured(): void {
  getJwtAccessSecret();
  getJwtRefreshSecret();
}
