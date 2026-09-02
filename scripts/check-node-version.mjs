const minimum = '22.12.0'
const actual = process.versions.node

function compareVersions(leftVersion, rightVersion) {
  const left = leftVersion.split('.').map(Number)
  const right = rightVersion.split('.').map(Number)
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0)
    if (difference !== 0) return difference
  }
  return 0
}

if (compareVersions(actual, minimum) < 0) {
  console.error(`FAIL Node ${actual} does not satisfy >=${minimum}`)
  process.exit(1)
}

console.log(`PASS Node ${actual} satisfies >=${minimum}`)
