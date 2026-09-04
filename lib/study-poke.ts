export const POKE_COOLDOWN_MS = 10 * 60 * 1000

export function pokeExpiresAt(lastPokedAt: string | null, localExpiration = 0) {
  const serverExpiration = lastPokedAt ? Date.parse(lastPokedAt) + POKE_COOLDOWN_MS : 0
  return Math.max(Number.isFinite(serverExpiration) ? serverExpiration : 0, localExpiration)
}

export function nextPokeExpiration(expirations: number[], now: number) {
  const future = expirations.filter((expiration) => expiration > now)
  return future.length ? Math.min(...future) : null
}
