import { sdk } from '../sdk'
import { verifyEngine } from './verifyEngine'
import { createPersistenceMarker } from './createPersistenceMarker'
import { verifyPersistenceMarker } from './verifyPersistenceMarker'

import { checkBlakeRpc } from './checkBlakeRpc'
import { checkBtcRpc } from './checkBtcRpc'
import { configureBtcProvider } from './configureBtcProvider'
import { configureWallets } from './configureWallets'
import { checkWalletReadiness } from './checkWalletReadiness'

export const actions = sdk.Actions.of()
  .addAction(verifyEngine)
  .addAction(createPersistenceMarker)
  .addAction(verifyPersistenceMarker)
  .addAction(checkBlakeRpc)
  .addAction(configureBtcProvider)
  .addAction(configureWallets)
  .addAction(checkWalletReadiness)
  .addAction(checkBtcRpc)
