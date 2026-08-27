import { describe, expect, test } from 'bun:test'
import {
  createGitHubContributionHeatmapSkeleton,
  parseGitHubContributionHtml
} from '../src/data/github-contributions'
import { residence } from '../src/data/residence'
import {
  globeFitPaddingForDistance,
  globeFitZoomForDistance,
  haversineDistanceKm,
  shortestLongitudeFrom
} from '../src/scripts/residence-map-geometry'

describe('Phase 5 HanLife contribution data', () => {
  test('parses GitHub cells regardless of attribute order and preserves labels', () => {
    const fixture = `
      <td data-level="4" class="ContributionCalendar-day" data-date="2026-08-27"></td>
      <tool-tip>1,234 contributions on August 27, 2026.</tool-tip>
      <td class="ContributionCalendar-day" data-date="2026-08-28" data-level="0"></td>
      <tool-tip>No contributions on August 28, 2026.</tool-tip>
    `

    expect(parseGitHubContributionHtml(fixture)).toEqual([
      {
        count: 1234,
        date: '2026-08-27',
        label: '1,234 contributions on August 27, 2026.',
        level: 4
      },
      {
        count: 0,
        date: '2026-08-28',
        label: 'No contributions on August 28, 2026.',
        level: 0
      }
    ])
  })

  test('keeps a deterministic 53-week neutral fallback when GitHub is unavailable', () => {
    const heatmap = createGitHubContributionHeatmapSkeleton(new Date('2026-08-27T12:00:00.000Z'))

    expect(heatmap.weekCount).toBe(53)
    expect(heatmap.days).toHaveLength(371)
    expect(heatmap.days.filter((day) => !day.isBlank)).toHaveLength(365)
    expect(heatmap.total).toBe(0)
  })
})

describe('Phase 5 SkyWT residence geometry', () => {
  test('keeps the direct-reuse geography helpers stable', () => {
    expect(haversineDistanceKm([116.3229, 39.9834], [116.3229, 39.9834])).toBe(0)
    expect(haversineDistanceKm([0, 0], [1, 0])).toBeCloseTo(111.195, 3)
    expect(shortestLongitudeFrom(170, -170)).toBe(190)
    expect(globeFitZoomForDistance(0)).toBe(12.5)
    expect(globeFitZoomForDistance(800)).toBe(3.8)
    expect(globeFitPaddingForDistance(49)).toBe(72)
    expect(globeFitPaddingForDistance(50)).toBe(120)
  })

  test('keeps development location data and all runtime marker assets explicit', () => {
    expect(residence.city).toBe('北京')
    expect(residence.mapStyle).toContain('basemaps.cartocdn.com')
    expect(residence.ownerAvatar).toBe('/media/residence/avatar.jpg')
    expect(residence.visitorAvatar).toBe('/media/residence/visitor-avatar.svg')
  })
})
