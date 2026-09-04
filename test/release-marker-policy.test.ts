import { describe, expect, test } from 'bun:test'

import {
  arthalsMarkerText,
  isEditorialContentPage,
  manifestContainsArthalsFriend,
  stripAllowedArthalsFriend
} from '../scripts/release-marker-policy.mjs'

const linksManifest = {
  friends: [
    {
      link_list: [
        {
          name: "Arthals' ink",
          link: 'https://arthals.ink/',
          avatar: 'https://cdn.arthals.ink/Arthals.png'
        }
      ]
    }
  ]
}

const renderedFriend = arthalsMarkerText({
  visibleText: "Arthals' ink",
  renderedAttributeText: 'https://arthals.ink/ https://cdn.arthals.ink/Arthals.png'
})

describe('strict release Arthals marker exception', () => {
  test('does not audit editorial content detail pages for release markers', () => {
    expect(isEditorialContentPage('blog/susurrium-blog-development/index.html')).toBe(true)
    expect(isEditorialContentPage('traces/debug-session/index.html')).toBe(true)
    expect(isEditorialContentPage('sayings/example/index.html')).toBe(true)
    expect(isEditorialContentPage('about/index.html')).toBe(false)
    expect(isEditorialContentPage('blog/tags/index.html')).toBe(false)
  })

  test('requires the manifest-declared friend and strips only its exact fields on /links', () => {
    expect(manifestContainsArthalsFriend(linksManifest)).toBe(true)
    expect(
      stripAllowedArthalsFriend({
        path: 'links/index.html',
        markerText: renderedFriend,
        linksManifest
      })
    ).not.toMatch(/Arthals|arthals\.ink/i)
  })

  test('does not allow the same markers on another page', () => {
    expect(
      stripAllowedArthalsFriend({
        path: 'about/index.html',
        markerText: renderedFriend,
        linksManifest
      })
    ).toMatch(/Arthals|arthals\.ink/i)
  })

  test('keeps extra identity or domain occurrences on /links blocking', () => {
    expect(
      stripAllowedArthalsFriend({
        path: 'links/index.html',
        markerText: `${renderedFriend} Arthals appears in an unrelated note`,
        linksManifest
      })
    ).toMatch(/Arthals/i)
    expect(
      stripAllowedArthalsFriend({
        path: 'links/index.html',
        markerText: `${renderedFriend} https://other.arthals.ink/asset.png`,
        linksManifest
      })
    ).toMatch(/arthals\.ink/i)
  })

  test('does not waive an isolated marker when the declared friend fields are incomplete', () => {
    expect(
      stripAllowedArthalsFriend({
        path: 'links/index.html',
        markerText: "Arthals' ink",
        linksManifest
      })
    ).toMatch(/Arthals/i)
  })
})
