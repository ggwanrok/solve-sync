export const CODE_LANGUAGE_MODES = [
  "c",
  "cpp",
  "csharp",
  "go",
  "java",
  "javascript",
  "kotlin",
  "python",
  "ruby",
  "scala",
  "swift",
  "sql",
  "mariadb",
  "mssql",
  "mysql",
  "oracle",
  "postgresql",
  "sqlite",
] as const

export type CodeLanguageMode = (typeof CODE_LANGUAGE_MODES)[number]

export const CODEMIRROR_LANGUAGE_NAMES: Record<CodeLanguageMode, string> = {
  c: "C",
  cpp: "C++",
  csharp: "C#",
  go: "Go",
  java: "Java",
  javascript: "JavaScript",
  kotlin: "Kotlin",
  python: "Python",
  ruby: "Ruby",
  scala: "Scala",
  swift: "Swift",
  sql: "SQL",
  mariadb: "MariaDB SQL",
  mssql: "MS SQL",
  mysql: "MySQL",
  oracle: "PLSQL",
  postgresql: "PostgreSQL",
  sqlite: "SQLite",
}

export function codeLanguageMode(language: unknown): CodeLanguageMode | null {
  if (typeof language !== "string" || !language.trim()) return null

  const compact = language.trim().toLowerCase().replace(/[\s._()-]+/g, "")

  if (compact.startsWith("javascript") || compact.startsWith("nodejs") || compact === "js") return "javascript"
  if (compact.startsWith("typescript") || compact === "ts") return "javascript"
  if (compact.startsWith("python")) return "python"
  if (compact.startsWith("c++") || compact.startsWith("cpp")) return "cpp"
  if (compact.startsWith("c#") || compact.startsWith("csharp")) return "csharp"
  if (compact === "c" || /^c(?:89|90|99|11|17|23)$/.test(compact)) return "c"
  if (/^java\d*$/.test(compact)) return "java"
  if (/^kotlin\d*$/.test(compact)) return "kotlin"
  if (/^swift\d*$/.test(compact)) return "swift"
  if (/^go\d*$/.test(compact) || compact.startsWith("golang")) return "go"
  if (/^ruby\d*$/.test(compact)) return "ruby"
  if (/^scala\d*$/.test(compact)) return "scala"

  if (compact.startsWith("mariadb")) return "mariadb"
  if (compact === "mssql" || compact.startsWith("microsoftsqlserver") || compact.startsWith("sqlserver")) return "mssql"
  if (compact.startsWith("mysql")) return "mysql"
  if (compact.startsWith("oracle")) return "oracle"
  if (compact.startsWith("postgresql") || compact.startsWith("postgres")) return "postgresql"
  if (compact.startsWith("sqlite")) return "sqlite"
  if (compact === "sql" || compact.startsWith("standardsql")) return "sql"

  return null
}
