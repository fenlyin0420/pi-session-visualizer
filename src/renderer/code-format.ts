import { stripAnsi } from './utils.js'

const languageAliases: Record<string, string> = {
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  console: 'bash',
  terminal: 'bash',
  command: 'bash',
  js: 'javascript',
  node: 'javascript',
  ts: 'typescript',
  jsx: 'jsx',
  html: 'markup',
  xml: 'markup',
  svg: 'markup',
  yml: 'yaml',
  md: 'markdown',
  patch: 'diff',
  jsonl: 'json',
  jsonc: 'json',
  json5: 'json',
  py: 'python',
  rs: 'rust',
  golang: 'go',
  'c++': 'cpp',
  cs: 'csharp',
  kt: 'kotlin',
  kts: 'kotlin',
  rb: 'ruby',
  dart: 'dart',
  swift: 'swift',
  php: 'php',
  plaintext: 'text',
  plain: 'text',
}

const languageLabels: Record<string, string> = {
  bash: 'Bash',
  c: 'C',
  cpp: 'C++',
  csharp: 'C#',
  css: 'CSS',
  dart: 'Dart',
  diff: 'Diff',
  go: 'Go',
  html: 'HTML',
  java: 'Java',
  javascript: 'JavaScript',
  json: 'JSON',
  kotlin: 'Kotlin',
  jsx: 'JSX',
  markdown: 'Markdown',
  markup: 'HTML',
  python: 'Python',
  php: 'PHP',
  ruby: 'Ruby',
  rust: 'Rust',
  sql: 'SQL',
  swift: 'Swift',
  text: '文本',
  tsx: 'TSX',
  typescript: 'TypeScript',
  xml: 'XML',
  yaml: 'YAML',
}

const pathLanguages: Array<[RegExp, string]> = [
  [/\.d\.ts$/i, 'typescript'],
  [/\.tsx$/i, 'tsx'],
  [/\.jsx$/i, 'jsx'],
  [/\.ts$/i, 'typescript'],
  [/\.js$/i, 'javascript'],
  [/\.mjs$/i, 'javascript'],
  [/\.cjs$/i, 'javascript'],
  [/\.jsonl?$/i, 'json'],
  [/\.json[5c]$/i, 'json'],
  [/\.(sh|bash|zsh)$/i, 'bash'],
  [/\.py$/i, 'python'],
  [/\.md$/i, 'markdown'],
  [/\.(css|scss|less)$/i, 'css'],
  [/\.(html?|xml|svg)$/i, 'markup'],
  [/\.(yaml|yml)$/i, 'yaml'],
  [/\.sql$/i, 'sql'],
  [/\.(diff|patch)$/i, 'diff'],
  [/\.go$/i, 'go'],
  [/\.rs$/i, 'rust'],
  [/\.java$/i, 'java'],
  [/\.c$/i, 'c'],
  [/\.(cpp|cc|cxx|hpp|hh)$/i, 'cpp'],
  [/\.(cs)$/i, 'csharp'],
  [/\.(kt|kts)$/i, 'kotlin'],
  [/\.dart$/i, 'dart'],
  [/\.swift$/i, 'swift'],
  [/\.php$/i, 'php'],
  [/\.rb$/i, 'ruby'],
]

function cleanCode(value: string): string {
  return stripAnsi(value)
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .replace(/\u0000/g, '')
    .replace(/\n$/, '')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function tryPrettyJson(value: string): string | null {
  const candidate = value.trim()
  if (!candidate || (!candidate.startsWith('{') && !candidate.startsWith('['))) return null

  try {
    const parsed: unknown = JSON.parse(candidate)
    if (parsed === null || typeof parsed !== 'object') return null
    return JSON.stringify(parsed, null, 2)
  } catch {
    return null
  }
}

function languageFromPath(filePath: string | null | undefined): string | null {
  if (!filePath) return null
  for (const [pattern, language] of pathLanguages) {
    if (pattern.test(filePath)) return language
  }
  return null
}

function hasShellSyntax(value: string): boolean {
  return /(^|\n)\s*(?:set\s+-[a-z]+|export\s+[A-Z_][\w]*=|cd\s+|echo\s+|printf\s+|mkdir\s+|rm\s+|cp\s+|mv\s+|grep\s+|sed\s+|awk\s+|find\s+|git\s+|npm\s+|pnpm\s+|yarn\s+|python\d*\s+|node\s+|curl\s+|wget\s+|docker\s+|kubectl\s+|if\s+\[|for\s+\w+\s+in\s+|while\s+|function\s+\w+\s*\(\s*\))/i.test(value)
}

function hasTypeScriptSyntax(value: string): boolean {
  return /(^|\n)\s*(?:interface\s+|type\s+\w+\s*=|enum\s+|namespace\s+|declare\s+|abstract\s+class\s+)/m.test(value)
}

function hasJavaScriptSyntax(value: string): boolean {
  return /(^|\n)\s*(?:import\s+(?:[\w{*][^;\n]*\s+from\s+['"]|['"])|export\s+|const\s+|let\s+|var\s+|function\s+|class\s+|async\s+|await\s+)/m.test(value)
    && /[;{}=()[\].]/.test(value)
}

function hasPythonSyntax(value: string): boolean {
  return /(^|\n)\s*(?:from\s+[\w.]+\s+import\s+|import\s+(?:os|sys|re|json|pathlib|typing|datetime|subprocess|requests|pytest)(?:\s+as\s+\w+)?\s*$|def\s+\w+\s*\(|class\s+\w+\s*(?:\(|:)|if\s+__name__\s*==)/m.test(value)
}

function hasKotlinSyntax(value: string): boolean {
  return /(^|\n)\s*(?:fun\s+\w+|data\s+class\s+|sealed\s+class\s+|suspend\s+fun\s+|(?:val|var)\s+\w+\s*[:=])/m.test(value)
}

function hasDartSyntax(value: string): boolean {
  return /(^|\n)\s*(?:import\s+['"]package:[\w/]+['"]|void\s+main\s*\(|Widget\s+build\s*\()/m.test(value)
}

function hasSwiftSyntax(value: string): boolean {
  return /(^|\n)\s*(?:import\s+(?:Foundation|UIKit|SwiftUI)|func\s+\w+\s*\(|struct\s+\w+\s*[:{]|class\s+\w+\s*[:{])/m.test(value)
}

function hasPhpSyntax(value: string): boolean {
  return /^\s*<\?php|\$\w+\s*=/m.test(value)
}

function hasRubySyntax(value: string): boolean {
  return /(^|\n)\s*(?:require\s+['"]|puts\s+|class\s+\w+\s*<|(?:def|module)\s+\w+)/m.test(value)
}

function hasYamlSyntax(value: string): boolean {
  const matches = value.match(/^\s*[\w.-]+\s*:\s*(?:#.*)?$/gm)
  return Boolean(matches && matches.length >= 2)
}

function hasSqlSyntax(value: string): boolean {
  return /(^|\n)\s*(?:select|insert\s+into|update|delete\s+from|create\s+table|alter\s+table|with\s+)\b/i.test(value)
}

function isDiff(value: string): boolean {
  return /^(?:diff --git |index [^\n]+\n|--- [^\n]+\n\+\+\+ [^\n]+\n|@@[^\n]*@@)/m.test(value)
}

export function normalizeLanguage(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase().replace(/^language-/, '').replace(/^lang-/, '')
  if (!normalized) return null
  return languageAliases[normalized] ?? normalized
}

export function languageLabel(language: string): string {
  return languageLabels[language] ?? language.toUpperCase()
}

export function inferLanguage(value: string, filePath?: string | null): string {
  const code = cleanCode(value)
  const pathLanguage = languageFromPath(filePath)
  if (pathLanguage) return pathLanguage
  if (tryPrettyJson(code) !== null || /^\s*[\[{]/.test(code)) return 'json'
  if (isDiff(code)) return 'diff'
  if (/^#!.*python[0-9.]*/m.test(code)) return 'python'
  if (/^#!.*\bnode\b/m.test(code)) return 'javascript'
  if (/^#!.*\bruby\b/m.test(code)) return 'ruby'
  if (/^#!.*\bphp\b/m.test(code)) return 'php'
  if (/^#!.*\/(?:ba|da|z|k)?sh(?:\s|$)/m.test(code) || hasShellSyntax(code)) return 'bash'
  if (/^\s*<(?:!doctype|html|svg|\w[\w-]*(?:\s|>))/i.test(code)) return 'markup'
  if (hasKotlinSyntax(code)) return 'kotlin'
  if (hasDartSyntax(code)) return 'dart'
  if (hasSwiftSyntax(code)) return 'swift'
  if (hasPhpSyntax(code)) return 'php'
  if (hasRubySyntax(code)) return 'ruby'
  if (hasTypeScriptSyntax(code)) return 'typescript'
  if (hasJavaScriptSyntax(code)) return 'javascript'
  if (hasPythonSyntax(code)) return 'python'
  if (hasSqlSyntax(code)) return 'sql'
  if (hasYamlSyntax(code)) return 'yaml'
  if (/^\s*(?:from\s+[\w.]+\s+import\s+|import\s+[\w.]+|def\s+\w+\s*\()/m.test(code)) return 'python'
  return 'text'
}

export interface FormatCodeOptions {
  language?: string | null
  filePath?: string | null
}

export interface FormattedCode {
  code: string
  formatted: boolean
  language: string
}

export function formatCode(value: string, options: FormatCodeOptions = {}): FormattedCode {
  const code = cleanCode(value)
  const hintedLanguage = normalizeLanguage(options.language)
  const language = hintedLanguage && hintedLanguage !== 'auto'
    ? hintedLanguage
    : inferLanguage(code, options.filePath)

  if (language === 'json') {
    const pretty = tryPrettyJson(code)
    if (pretty !== null) return { code: pretty, formatted: true, language }
  }

  return { code, formatted: false, language }
}

export function stringifyCodeValue(value: unknown): string {
  if (typeof value === 'string') return value
  if (value === undefined) return 'undefined'
  try {
    return JSON.stringify(value, null, 2) ?? String(value)
  } catch {
    return String(value)
  }
}

function firstString(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.length > 0) return value
  }
  return null
}

function toolNamePart(name: string): string {
  return name.toLowerCase().split(/[._:-]/).filter(Boolean).at(-1) ?? name.toLowerCase()
}

function isCommandTool(name: string): boolean {
  return /^(?:bash|shell|sh|zsh|exec|execute|command|terminal|run)$/.test(toolNamePart(name))
}

function isContentTool(name: string): boolean {
  return /^(?:write|edit|create|update|patch|apply_patch)$/.test(toolNamePart(name))
}

export interface ToolCodeSource {
  filePath: string | null
  language: string
  label: string
  value: string
}

export function toolCallCodeSources(name: string, argumentsValue: unknown): ToolCodeSource[] {
  const normalizedName = toolNamePart(name)
  if (!isRecord(argumentsValue)) {
    return [{
      filePath: null,
      language: isCommandTool(normalizedName) ? 'bash' : 'text',
      label: isCommandTool(normalizedName) ? '命令' : '参数',
      value: stringifyCodeValue(argumentsValue),
    }]
  }

  const command = firstString(argumentsValue, ['command', 'cmd', 'script', 'shell'])
  if (command && isCommandTool(normalizedName)) {
    const remaining = { ...argumentsValue }
    delete remaining.command
    delete remaining.cmd
    delete remaining.script
    delete remaining.shell
    const sources: ToolCodeSource[] = [{ filePath: null, language: 'bash', label: '命令', value: command }]
    if (Object.keys(remaining).length > 0) {
      sources.push({ filePath: null, language: 'json', label: '参数', value: stringifyCodeValue(remaining) })
    }
    return sources
  }

  const content = firstString(argumentsValue, ['content', 'text', 'source'])
  const filePath = firstString(argumentsValue, ['path', 'filePath', 'file', 'filename'])
  if (content && isContentTool(normalizedName)) {
    const remaining = { ...argumentsValue }
    delete remaining.content
    delete remaining.text
    delete remaining.source
    const sources: ToolCodeSource[] = [{
      filePath,
      language: inferLanguage(content, filePath),
      label: '内容',
      value: content,
    }]
    if (Object.keys(remaining).length > 0) {
      sources.push({ filePath: null, language: 'json', label: '参数', value: stringifyCodeValue(remaining) })
    }
    return sources
  }

  return [{ filePath: null, language: 'json', label: '参数', value: stringifyCodeValue(argumentsValue) }]
}

export function toolResultLanguage(argumentsValue: unknown): string | null {
  if (!isRecord(argumentsValue)) return null
  return languageFromPath(firstString(argumentsValue, ['path', 'filePath', 'file', 'filename']))
}
