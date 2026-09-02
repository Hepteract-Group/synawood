export type WalletLedgerKind = 'grant' | 'debit' | 'refund' | 'pack' | 'adjustment'

export type WalletLedgerEntry = {
  id: string
  amountGbp: number
  kind: WalletLedgerKind
  idempotencyKey: string
  costEventId: string | null
  jobId: string | null
}

export type WalletState = {
  productId: string
  balanceGbp: number
  ledger: WalletLedgerEntry[]
}

export type WalletOk = { ok: true; state: WalletState }
export type WalletFail = {
  ok: false
  code: 'wallet_insufficient' | 'debit_not_found'
  state: WalletState
}
export type WalletResult = WalletOk | WalletFail

export const emptyWallet = (productId: string, balanceGbp: number): WalletState => ({
  productId,
  balanceGbp,
  ledger: [],
})

export const getBalance = (state: WalletState): number => state.balanceGbp

const findByKey = (state: WalletState, idempotencyKey: string): WalletLedgerEntry | undefined =>
  state.ledger.find((row) => row.idempotencyKey === idempotencyKey)

export const debitWallet = (
  state: WalletState,
  input: {
    estimatedGbp: number
    costEventId: string
    idempotencyKey: string
    ledgerId: string
    jobId?: string
  },
): WalletResult => {
  const existing = findByKey(state, input.idempotencyKey)
  if (existing) return { ok: true, state }
  if (input.estimatedGbp > state.balanceGbp) {
    return { ok: false, code: 'wallet_insufficient', state }
  }
  const next: WalletState = {
    ...state,
    balanceGbp: state.balanceGbp - input.estimatedGbp,
    ledger: [
      ...state.ledger,
      {
        id: input.ledgerId,
        amountGbp: -input.estimatedGbp,
        kind: 'debit',
        idempotencyKey: input.idempotencyKey,
        costEventId: input.costEventId,
        jobId: input.jobId ?? null,
      },
    ],
  }
  return { ok: true, state: next }
}

export const refundWallet = (
  state: WalletState,
  input: { debitLedgerId: string; idempotencyKey: string; ledgerId: string },
): WalletResult => {
  const existing = findByKey(state, input.idempotencyKey)
  if (existing) return { ok: true, state }
  const debit = state.ledger.find((row) => row.id === input.debitLedgerId && row.kind === 'debit')
  if (!debit) return { ok: false, code: 'debit_not_found', state }
  const amountGbp = Math.abs(debit.amountGbp)
  return {
    ok: true,
    state: {
      ...state,
      balanceGbp: state.balanceGbp + amountGbp,
      ledger: [
        ...state.ledger,
        {
          id: input.ledgerId,
          amountGbp,
          kind: 'refund',
          idempotencyKey: input.idempotencyKey,
          costEventId: debit.costEventId,
          jobId: debit.jobId,
        },
      ],
    },
  }
}

export const grantWallet = (
  state: WalletState,
  input: { amountGbp: number; idempotencyKey: string; ledgerId: string },
): WalletResult => {
  const existing = findByKey(state, input.idempotencyKey)
  if (existing) return { ok: true, state }
  return {
    ok: true,
    state: {
      ...state,
      balanceGbp: state.balanceGbp + input.amountGbp,
      ledger: [
        ...state.ledger,
        {
          id: input.ledgerId,
          amountGbp: input.amountGbp,
          kind: 'grant',
          idempotencyKey: input.idempotencyKey,
          costEventId: null,
          jobId: null,
        },
      ],
    },
  }
}
