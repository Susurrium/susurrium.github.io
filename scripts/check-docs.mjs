import { fileURLToPath } from 'node:url'

import { checkDocumentation } from './lib/documentation.mjs'

const result = checkDocumentation(fileURLToPath(new URL('../', import.meta.url)))
for (const failure of result.failures) console.error(`FAIL ${failure}`)
console.log(
  `Documentation: ${result.documents} documents, ${result.localLinks} local links, ${result.yamlExamples} YAML examples, ${result.failures.length} failures. External links were not requested.`
)
if (result.failures.length) process.exitCode = 1
