import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { parseSessionFile } from '../src/main/session-parser.js'
import { SessionRepository } from '../src/main/session-repository.js'

const temporaryDirectories: string[] = []

async function fixture(lines: unknown[]): Promise<{ root: string; filePath: string }> {
  const root = await mkdtemp(join(tmpdir(), 'pi-session-visualizer-'))
  temporaryDirectories.push(root)
  const filePath = join(root, 'session.jsonl')
  await writeFile(filePath, `${lines.map((line) => JSON.stringify(line)).join('\n')}\n`, 'utf8')
  return { root, filePath }
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})

describe('parseSessionFile', () => {
  it('normalizes pi JSONL entries and aggregates session statistics', async () => {
    const { root, filePath } = await fixture([
      {
        type: 'session',
        id: 'session-1',
        version: '1',
        cwd: '/home/user/project',
        timestamp: '2026-09-20T10:00:00.000Z',
      },
      {
        type: 'session_info',
        id: 'info-1',
        parentId: null,
        timestamp: '2026-09-20T10:00:01.000Z',
        name: 'Parser test',
      },
      {
        type: 'model_change',
        id: 'model-1',
        parentId: null,
        timestamp: '2026-09-20T10:00:02.000Z',
        provider: 'test-provider',
        modelId: 'test-model',
      },
      {
        type: 'message',
        id: 'user-1',
        parentId: 'info-1',
        timestamp: '2026-09-20T10:01:00.000Z',
        message: {
          role: 'user',
          timestamp: 1_789_000_460_000,
          content: [{ type: 'text', text: 'Inspect the parser' }],
        },
      },
      {
        type: 'message',
        id: 'assistant-1',
        parentId: 'user-1',
        timestamp: '2026-09-20T10:01:02.000Z',
        message: {
          role: 'assistant',
          provider: 'test-provider',
          model: 'test-model',
          stopReason: 'toolUse',
          content: [
            { type: 'thinking', thinking: 'Check the source', thinkingSignature: 'sig' },
            { type: 'text', text: 'I will inspect it.' },
            { type: 'toolCall', id: 'call-1', name: 'read', arguments: { path: 'index.ts' } },
          ],
          usage: {
            input: 100,
            output: 20,
            cacheRead: 5,
            cacheWrite: 2,
            reasoning: 8,
            totalTokens: 127,
            cost: 0.5,
          },
        },
      },
      {
        type: 'message',
        id: 'result-1',
        parentId: 'assistant-1',
        timestamp: '2026-09-20T10:01:03.000Z',
        message: {
          role: 'toolResult',
          toolCallId: 'call-1',
          toolName: 'read',
          isError: false,
          content: [{ type: 'text', text: 'file contents' }],
          timestamp: 1_789_000_463_000,
        },
      },
      {
        type: 'compaction',
        id: 'compact-1',
        parentId: 'result-1',
        timestamp: '2026-09-20T10:02:00.000Z',
        summary: 'A compact summary',
        usage: {
          input: 10,
          output: 5,
          cacheRead: 0,
          cacheWrite: 0,
          reasoning: 0,
          totalTokens: 15,
          cost: { total: 0.25 },
        },
      },
    ])

    const session = await parseSessionFile(filePath, root, {
      size: 2048,
      mtimeMs: Date.parse('2026-09-20T10:02:01.000Z'),
      birthtimeMs: Date.parse('2026-09-20T10:00:00.000Z'),
    })

    expect(session.id).toBe('session-1')
    expect(session.title).toBe('Parser test')
    expect(session.workspace).toBe('project')
    expect(session.messageCount).toBe(3)
    expect(session.userMessageCount).toBe(1)
    expect(session.assistantMessageCount).toBe(1)
    expect(session.toolResultCount).toBe(1)
    expect(session.toolCallCount).toBe(1)
    expect(session.inputTokens).toBe(110)
    expect(session.outputTokens).toBe(25)
    expect(session.totalTokens).toBe(142)
    expect(session.cost).toBeCloseTo(0.75)
    expect(session.models[0]?.id).toBe('test-provider/test-model')
    expect(session.tools).toEqual([{ name: 'read', count: 1, errorCount: 0 }])
    expect(session.entries[4]?.blocks).toContainEqual({
      type: 'toolCall',
      id: 'call-1',
      name: 'read',
      arguments: { path: 'index.ts' },
    })
    expect(session.entries[4]?.thinking).toBe('Check the source')
    expect(session.entries[4]?.text).toBe('I will inspect it.')
    expect(session.entries[4]?.text).not.toContain('toolCall')
    expect(session.searchText).toContain('inspect the parser')
  })

  it('falls back to the first user message and reports malformed lines', async () => {
    const root = await mkdtemp(join(tmpdir(), 'pi-session-visualizer-'))
    temporaryDirectories.push(root)
    const filePath = join(root, 'fallback.jsonl')
    const content = [
      JSON.stringify({
        type: 'session',
        id: 'fallback',
        cwd: 'C:\\Users\\test\\workspace',
        timestamp: '2026-09-21T08:00:00.000Z',
      }),
      JSON.stringify({
        type: 'message',
        id: 'user',
        parentId: 'fallback',
        timestamp: '2026-09-21T08:00:01.000Z',
        message: { role: 'user', content: [{ type: 'text', text: 'A useful first prompt' }] },
      }),
      '{not-json}',
      '',
    ].join('\n')
    await writeFile(filePath, content, 'utf8')

    const session = await parseSessionFile(filePath, root, {
      size: content.length,
      mtimeMs: Date.parse('2026-09-21T08:01:00.000Z'),
      birthtimeMs: Date.parse('2026-09-21T08:00:00.000Z'),
    })

    expect(session.title).toBe('A useful first prompt')
    expect(session.workspace).toBe('workspace')
    expect(session.parseErrors).toBe(1)
    expect(session.entryCount).toBe(2)
  })

  it('keeps full-text search in the private repository index', async () => {
    const { root, filePath } = await fixture([
      {
        type: 'session',
        id: 'searchable',
        cwd: '/workspace/search-demo',
        timestamp: '2026-09-22T10:00:00.000Z',
      },
      {
        type: 'message',
        id: 'prompt',
        parentId: 'searchable',
        timestamp: '2026-09-22T10:00:01.000Z',
        message: { role: 'user', content: [{ type: 'text', text: 'Find this private needle' }] },
      },
    ])
    const repository = new SessionRepository(root)

    const update = await repository.refresh(true)
    const summary = update.sessions[0]
    expect(summary?.title).toBe('Find this private needle')
    expect(summary && 'searchText' in summary).toBe(false)
    expect(repository.search('private needle').map((session) => session.id)).toEqual(['searchable'])
    expect(repository.search('')).toHaveLength(1)

    const detail = await repository.getSession(filePath)
    expect('searchText' in detail).toBe(false)
    expect(() => repository.assertSessionPath(join(root, '..', 'outside.jsonl'))).toThrow()
  })
})
