import { getXenditSecretKey } from './xendit-config'

export async function expireXenditInvoice(invoiceId: string): Promise<void> {
  const xenditKey = getXenditSecretKey()
  if (!xenditKey) {
    throw createError({ statusCode: 500, statusMessage: 'XENDIT_KEY belum dikonfigurasi.' })
  }
  if (!invoiceId) {
    throw createError({ statusCode: 400, statusMessage: 'invoiceId kosong.' })
  }

  const credentials = Buffer.from(`${xenditKey}:`).toString('base64')

  await $fetch(`https://api.xendit.co/v2/invoices/${invoiceId}/expire`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/json',
    },
  })
}
