export const ACCESS_TOKEN_COOKIE = "solvesync-access-token"
export const REFRESH_TOKEN_COOKIE = "solvesync-refresh-token"

export const authCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
}
