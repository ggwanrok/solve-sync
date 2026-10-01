const PROGRAMMERS_LANGUAGES = new Set([
  "c", "c++", "c#", "go", "java", "javascript", "kotlin",
  "python", "python2", "python3", "ruby", "scala", "swift",
  "mariadb", "microsoft sql server", "mssql", "mysql", "oracle",
  "postgres", "postgresql", "sql", "sql server", "sqlite",
])

export function normalizeProgrammersLanguage(value: unknown): string | null {
  if (typeof value !== "string") return null
  const language = value.trim().replace(/\s+/g, " ")
  return PROGRAMMERS_LANGUAGES.has(language.toLowerCase()) ? language : null
}
