import { describe, expect, it } from 'vitest'
import {
  formatCode,
  inferLanguage,
  toolCallCodeSources,
} from '../src/renderer/code-format.js'

describe('code formatting', () => {
  it('pretty-prints structured JSON and keeps its language', () => {
    const result = formatCode('{"b":2,"a":[1,3]}', { language: 'json' })

    expect(result.formatted).toBe(true)
    expect(result.language).toBe('json')
    expect(result.code).toBe('{\n  "b": 2,\n  "a": [\n    1,\n    3\n  ]\n}')
  })

  it('detects common code and diff formats', () => {
    expect(inferLanguage('#!/usr/bin/env bash\necho "$HOME"')).toBe('bash')
    expect(inferLanguage('diff --git a/a.ts b/a.ts\n@@ -1 +1 @@\n-old\n+new')).toBe('diff')
    expect(inferLanguage('import React from "react";\nexport const answer = 42')).toBe('javascript')
    expect(inferLanguage('interface Answer { value: number }')).toBe('typescript')
    expect(inferLanguage('fun main() {\n  println("hi")\n}', '/tmp/Main.kt')).toBe('kotlin')
    expect(inferLanguage('import "package:flutter/material.dart";\nvoid main() {}', '/tmp/main.dart')).toBe('dart')
    expect(inferLanguage('export const answer = 42', '/tmp/example.ts')).toBe('typescript')
  })

  it('separates a shell command from its remaining arguments', () => {
    const sources = toolCallCodeSources('bash', { command: 'npm test', timeout: 30 })

    expect(sources).toHaveLength(2)
    expect(sources[0]).toMatchObject({ label: '命令', language: 'bash', value: 'npm test' })
    expect(sources[1]).toMatchObject({ label: '参数', language: 'json' })
    expect(sources[1]?.value).toContain('"timeout": 30')
  })
})
