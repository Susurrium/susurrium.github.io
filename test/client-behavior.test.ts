import { describe, expect, spyOn, test } from 'bun:test'

import {
  createGitHubContributionHeatmap,
  fetchContributionHtml,
  parseGitHubContributionHtml
} from '../src/data/github-contributions'
import { normalizeMusicTracks } from '../src/lib/client/music'
import { resolveTheme } from '../src/lib/client/theme'

describe('browser integration boundaries', () => {
  test('explicit theme preferences survive system changes', () => {
    expect(resolveTheme('dark', false)).toBe('dark')
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
  })

  test('music metadata cannot inject HTML or executable media URLs into APlayer', () => {
    expect(
      normalizeMusicTracks([
        {
          name: '<img src=x onerror=alert(1)>',
          artist: 'A&B',
          url: 'https://music.example/song.mp3',
          cover: 'javascript:alert(1)'
        },
        { name: 'bad', url: 'javascript:alert(1)' },
        null
      ])
    ).toEqual([
      {
        name: '&lt;img src=x onerror=alert(1)&gt;',
        artist: 'A&amp;B',
        url: 'https://music.example/song.mp3',
        cover: '',
        lrc: ''
      }
    ])
    expect(normalizeMusicTracks({ error: 'provider unavailable' })).toEqual([])
  })

  test('missing contribution days remain unknown instead of reporting zero activity', () => {
    const heatmap = createGitHubContributionHeatmap(
      new Map([
        ['2026-09-08', { count: 4, date: '2026-09-08', label: '4 contributions', level: 2 }]
      ]),
      new Date('2026-09-08T10:00:00Z')
    )
    expect(heatmap.total).toBe(4)
    expect(heatmap.missingDays).toBe(364)
    expect(heatmap.snapshotAt).toBe('2026-09-08T10:00:00.000Z')
    const unknown = heatmap.days.find((day) => day.date === '2026-09-07')
    expect(unknown?.isUnknown).toBe(true)
    expect(unknown?.label).toContain('unavailable')
    expect(heatmap.days.find((day) => day.date === '2026-09-08')?.isUnknown).toBe(false)
  })

  test('contribution timeout covers a response body that stalls after HTTP headers', async () => {
    const mock = spyOn(globalThis, 'fetch').mockImplementation(
      async (_input, init) =>
        ({
          ok: true,
          text: () =>
            new Promise<string>((_resolve, reject) => {
              init?.signal?.addEventListener(
                'abort',
                () => reject(new DOMException('Timed out', 'AbortError')),
                { once: true }
              )
            })
        }) as Response
    )
    try {
      await expect(
        fetchContributionHtml('https://github.com/example', undefined, 10)
      ).rejects.toMatchObject({ name: 'AbortError' })
    } finally {
      mock.mockRestore()
    }
  })

  test('malformed external calendar markup does not crash the build parser', () => {
    expect(
      parseGitHubContributionHtml(
        '<td class="ContributionCalendar-day" data-date="2026-99-99" data-level="4"></td>'
      )
    ).toEqual([])
    expect(() =>
      parseGitHubContributionHtml(
        '<td class="ContributionCalendar-day" data-date="2026-09-08" data-level="4"></td><tool-tip>&#99999999;</tool-tip>'
      )
    ).not.toThrow()
  })
})
