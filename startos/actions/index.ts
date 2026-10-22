import { resumableBtcScan } from './resumableBtcScan'
import { benchmarkBtcScan } from './benchmarkBtcScan'
import { sdk } from '../sdk'
import { verifyEngine } from './verifyEngine'
import { createPersistenceMarker } from './createPersistenceMarker'
import { verifyPersistenceMarker } from './verifyPersistenceMarker'

import { checkBlakeRpc } from './checkBlakeRpc'
import { checkBtcRpc } from './checkBtcRpc'
import { configureBtcProvider } from './configureBtcProvider'
import { configureBlakeProvider } from './configureBlakeProvider'
import { configureNodeProviders } from './configureNodeProviders'
import { configureBtcFeePolicy } from './configureBtcFeePolicy'
import { configureNostrRelays } from './configureNostrRelays'
import { configureWallets } from './configureWallets'
import { checkWalletReadiness } from './checkWalletReadiness'
import { checkEconomicReadiness } from './checkEconomicReadiness'
import { fundBlake } from './fundBlake'
import { publishBlakeFunding } from './publishBlakeFunding'
import { receiveBtcFunding } from './receiveBtcFunding'
import { resumeSwap } from './resumeSwap'
import { refundBlake } from './refundBlake'
import { reconcileSwap } from './reconcileSwap'
import { syncFunding } from './syncFunding'
import { syncSettlement } from './syncSettlement'
import { viewMarket } from './viewMarket'
import { swapStatus } from './swapStatus'
import { showParticipantIdentity } from './showParticipantIdentity'
import {
  getBlakeDepositAddress,
  getBtcDepositAddress,
} from './depositAddresses'
import { createOffer } from './createOffer'
import { cancelOffer } from './cancelOffer'
import { takeOffer } from './takeOffer'
import { acceptTake } from './acceptTake'
import { acceptMatch } from './acceptMatch'
import { acceptReverseSwapOffer } from './acceptReverseSwapOffer'

export const actions = sdk.Actions.of()
  .addAction(verifyEngine)
  .addAction(createPersistenceMarker)
  .addAction(verifyPersistenceMarker)
  .addAction(checkBlakeRpc)
  .addAction(configureBtcProvider)
  .addAction(configureBlakeProvider)
  .addAction(configureNodeProviders)
  .addAction(configureBtcFeePolicy)
  .addAction(configureNostrRelays)
  .addAction(configureWallets)
  .addAction(checkWalletReadiness)
  .addAction(checkEconomicReadiness)
  .addAction(viewMarket)
  .addAction(swapStatus)
  .addAction(showParticipantIdentity)
  .addAction(getBlakeDepositAddress)
  .addAction(getBtcDepositAddress)
  .addAction(createOffer)
  .addAction(cancelOffer)
  .addAction(takeOffer)
  .addAction(acceptTake)
  .addAction(acceptMatch)
  .addAction(acceptReverseSwapOffer)
  .addAction(fundBlake)
  .addAction(publishBlakeFunding)
  .addAction(receiveBtcFunding)
  .addAction(reconcileSwap)
  .addAction(syncFunding)
  .addAction(syncSettlement)
  .addAction(benchmarkBtcScan)
  .addAction(resumableBtcScan)
  .addAction(refundBlake)
  .addAction(resumeSwap)
  .addAction(checkBtcRpc)
