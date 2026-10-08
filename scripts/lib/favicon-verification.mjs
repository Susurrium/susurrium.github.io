import assert from 'node:assert/strict'
import { decodeIco, isIco } from 'icojs'
import sharp from 'sharp'

async function verifyPng(actual, expected, label) {
  const decode = (buffer) => sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const [left, right] = await Promise.all([decode(actual), decode(expected)])
  assert.equal(left.info.width, right.info.width, `${label}: width differs`)
  assert.equal(left.info.height, right.info.height, `${label}: height differs`)
  assert.equal(left.info.channels, right.info.channels, `${label}: channels differ`)
  assert.ok(left.data.equals(right.data), `${label}: RGBA pixels differ`)
}

// 比较解码像素，允许 sharp 版本之间的无损 PNG 编码差异。
export async function verifyFavicon(actual, expected, name) {
  if (name.endsWith('.ico')) {
    assert.ok(isIco(actual) && isIco(expected), `${name}: expected ICO images`)
    const [left, right] = await Promise.all([
      decodeIco(actual, 'image/png'),
      decodeIco(expected, 'image/png')
    ])
    assert.ok(left.length > 0, `${name}: empty ICO`)
    assert.equal(left.length, right.length, `${name}: frame count differs`)
    for (let index = 0; index < left.length; index++) {
      for (const field of ['width', 'height', 'bpp'])
        assert.equal(
          left[index][field],
          right[index][field],
          `${name}: frame ${index} ${field} differs`
        )
      await verifyPng(
        Buffer.from(left[index].buffer),
        Buffer.from(right[index].buffer),
        `${name} frame ${index}`
      )
    }
  } else {
    await verifyPng(actual, expected, name)
  }
  return actual.equals(expected) ? 'identical bytes' : 'identical RGBA pixels; encoding differs'
}
