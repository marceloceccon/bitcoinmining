/**
 * Generate a random farm ID (UUID v4)
 */
export function generateFarmId(): string {
  return crypto.randomUUID();
}

/**
 * Create shareable link for a farm
 */
export function createShareLink(
  farmId: string,
  baseUrl: string = typeof window !== 'undefined' ? window.location.origin : ''
): string {
  return `${baseUrl}/load?farm=${farmId}`;
}
