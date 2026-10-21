import { VersionGraph } from '@start9labs/start-sdk'
import { current } from './current'
import { previous2 } from './v1_0_0_2'
import { previous1 } from './v1_0_0_1'
import { previous } from './v1_0_0_0'

export const versionGraph = VersionGraph.of({
  current,
  other: [previous2, previous1, previous],
})
