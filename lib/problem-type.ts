export const PROBLEM_TYPES = ["algorithm", "sql"] as const

export type ProblemType = (typeof PROBLEM_TYPES)[number]

const SQL_LANGUAGES = new Set([
  "mariadb",
  "microsoft sql server",
  "mssql",
  "mysql",
  "oracle",
  "postgres",
  "postgresql",
  "sql",
  "sql server",
  "sqlite",
])

export function isProblemType(value: unknown): value is ProblemType {
  return typeof value === "string" && PROBLEM_TYPES.includes(value as ProblemType)
}

export function problemTypeFromLanguage(language: unknown): ProblemType {
  const normalized = String(language ?? "").trim().toLowerCase().replace(/\s+/g, " ")
  return SQL_LANGUAGES.has(normalized) ? "sql" : "algorithm"
}
