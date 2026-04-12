import { getXenditSecretKey } from './xendit-config'

interface XenditWithdrawParams {
  externalId: string
  amount: number
  bankCode: string
  accountHolderName: string
  accountNumber: string
  description: string
}

export async function createXenditWithdraw(params: XenditWithdrawParams): Promise<{ disbursementId: string }> {
  const xenditKey = getXenditSecretKey()
  if (!xenditKey) {
    throw createError({ statusCode: 500, statusMessage: 'XENDIT_KEY tidak dikonfigurasi.' })
  }

  const credentials = Buffer.from(`${xenditKey}:`).toString('base64')

  const res = await $fetch<{ id: string }>('https://api.xendit.co/disbursements', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/json',
    },
    body: {
      external_id: params.externalId,
      bank_code: params.bankCode,
      account_holder_name: params.accountHolderName,
      account_number: params.accountNumber,
      description: params.description,
      amount: params.amount,
    },
  })

  return { disbursementId: res.id }
}
