import { VersionGraph } from '@start9labs/start-sdk'
import { current } from './current'
import { previous12 } from './v1_0_0_12'
import { previous11 } from './v1_0_0_11'
import { previous10 } from './v1_0_0_10'
import { previous9 } from './v1_0_0_9'
import { previous2 } from './v1_0_0_2'
import { previous1 } from './v1_0_0_1'
import { previous } from './v1_0_0_0'

export const versionGraph = VersionGraph.of({
  current,
  other: [previous12, previous11, previous10, previous9, previous2, previous1, previous],
})
