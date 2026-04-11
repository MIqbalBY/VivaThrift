import { describe, expect, it, vi } from 'vitest'
import { buildPaidPaymentRows, normalizeRelation } from '../server/utils/xendit-webhook'

describe('normalizeRelation', () => {
  it('returns the same object when relation is not an array', () => {
    const relation = { id: 'buyer-1', email: 'buyer@example.com' }

    expect(normalizeRelation(relation)).toEqual(relation)
  })

  it('returns the first item when relation comes back as an array', () => {
    const first = { id: 'seller-1' }
    const second = { id: 'seller-2' }

    expect(normalizeRelation([first, second])).toEqual(first)
  })

  it('returns null for null or empty array relations', () => {
    expect(normalizeRelation(null)).toBeNull()
    expect(normalizeRelation([] as Array<{ id: string }>)).toBeNull()
  })
})

describe('buildPaidPaymentRows', () => {
  it('distributes a paid amount proportionally across multiple orders', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-11T12:00:00.000Z'))

    const rows = buildPaidPaymentRows({
      orders: [
        { id: 'order-1', total_amount: 150_000 },
        { id: 'order-2', total_amount: 50_000 },
      ],
      paidAmount: 200_000,
      paymentMethod: 'EWALLET',
      xenditInvoiceId: 'inv-123',
    })

    expect(rows).toEqual([
      {
        order_id: 'order-1',
        amount: 150_000,
        status: 'paid',
        payment_method: 'EWALLET',
        paid_at: '2026-04-11T12:00:00.000Z',
        xendit_invoice_id: 'inv-123',
      },
      {
        order_id: 'order-2',
        amount: 50_000,
        status: 'paid',
        payment_method: 'EWALLET',
        paid_at: '2026-04-11T12:00:00.000Z',
        xendit_invoice_id: 'inv-123',
      },
    ])

    vi.useRealTimers()
  })

  it('falls back to summed order total when paid amount is absent', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-11T12:00:00.000Z'))

    const rows = buildPaidPaymentRows({
      orders: [
        { id: 'order-1', total_amount: 80_000 },
        { id: 'order-2', total_amount: 20_000 },
      ],
      paymentMethod: null,
      xenditInvoiceId: 'inv-456',
    })

    expect(rows.map((row) => row.amount)).toEqual([80_000, 20_000])
    expect(rows.every((row) => row.payment_method === null)).toBe(true)
    expect(rows.every((row) => row.paid_at === '2026-04-11T12:00:00.000Z')).toBe(true)

    vi.useRealTimers()
  })

  it('returns zero amounts when total database amount is zero', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-11T12:00:00.000Z'))

    const rows = buildPaidPaymentRows({
      orders: [
        { id: 'order-1', total_amount: null },
        { id: 'order-2', total_amount: 0 },
      ],
      paidAmount: 50_000,
      paymentMethod: 'CARD',
      xenditInvoiceId: 'inv-789',
    })

    expect(rows.map((row) => row.amount)).toEqual([0, 0])
    expect(rows.every((row) => row.status === 'paid')).toBe(true)

    vi.useRealTimers()
  })
})