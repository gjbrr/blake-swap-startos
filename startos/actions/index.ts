import { sdk } from '../sdk'
import { verifyEngine } from './verifyEngine'
import { createPersistenceMarker } from './createPersistenceMarker'
import { verifyPersistenceMarker } from './verifyPersistenceMarker'

export const actions = sdk.Actions.of()
  .addAction(verifyEngine)
  .addAction(createPersistenceMarker)
  .addAction(verifyPersistenceMarker)
