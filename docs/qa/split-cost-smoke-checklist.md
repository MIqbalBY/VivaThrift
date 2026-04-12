# Split-Cost Smoke Checklist

Tujuan: memastikan model split-cost konsisten di checkout, settlement wallet, dispute, dan withdraw.

## Konfigurasi Awal

- `XENDIT_PAYMENT_FEE_BY_CHANNEL_JSON` terisi channel yang aktif.
- `XENDIT_PAYMENT_FEE_TAX_PERCENT` sesuai fee tax terbaru.
- `XENDIT_DISBURSEMENT_FEE_SELLER_FLAT` sesuai biaya withdraw seller.
- `XENDIT_AUTO_DISBURSE_ADMIN_FEE=false` untuk model admin hold balance.

## Formula Acuan

- `baseAmount = subtotal + shippingCost + platformFee`
- `paymentGatewayFee = gatewayFeeBase + gatewayFeeTax`
- `gatewayFeeBase = round(baseAmount * percent / 100) + flat`
- `gatewayFeeTax = round(gatewayFeeBase * taxPercent / 100)`
- `order.total_amount` (buyer bayar) = `baseAmount`
- `sellerNetPerOrder = total_amount - shipping_cost - platform_fee - payment_gateway_fee`
- `walletCredit(order_credit) = max(0, sellerNetPerOrder)`

## Skenario 1: Checkout Single Item (QRIS)

Input contoh:

- subtotal: 100000
- shippingCost: 10000
- platformFee (0.5%): 500
- channel: `qris`
- fee rule qris: percent `0.63`, flat `0`
- taxPercent: `11`

Expected:

- `baseAmount = 110500`
- `gatewayFeeBase = round(110500 * 0.63%) = 696`
- `gatewayFeeTax = round(696 * 11%) = 77`
- `payment_gateway_fee = 773`
- buyer invoice amount = `110500`
- seller net = `110500 - 10000 - 500 - 773 = 99227`

Checklist:

- API checkout menyimpan `orders.payment_method=qris`.
- API checkout menyimpan `orders.payment_gateway_fee=773`.
- Xendit invoice terkunci ke payment method QRIS.

## Skenario 2: Checkout Cart Multi-Seller

Expected:

- setiap order per seller punya `platform_fee` dan `payment_gateway_fee` masing-masing.
- `grandTotal` invoice = penjumlahan `order.total_amount` semua seller.
- tidak ada buyer surcharge tambahan di luar `total_amount`.

Checklist:

- jumlah order = jumlah seller unik di cart.
- `payment_method` di semua order = channel yang dipilih user.

## Skenario 3: Complete Order Manual

Expected:

- status order menjadi `completed`.
- wallet seller bertambah `sellerNetPerOrder`.
- ada transaksi `seller_wallet_transactions.tx_type='order_credit'`.
- idempotent: trigger complete ulang tidak membuat credit ganda untuk order yang sama.

Checklist:

- notif seller: saldo masuk wallet.
- response API mengembalikan `wallet_credited` dan `wallet_credit_amount`.

## Skenario 4: Auto-Complete Cron (7 hari)

Expected:

- order shipped lama berubah `completed`.
- wallet seller bertambah dengan formula net yang sama.
- tidak ada disbursement langsung ke rekening seller.

Checklist:

- cron menambah `order_credit` sekali per order.
- notif buyer dan seller terkirim.

## Skenario 5: Dispute Partial Refund

Input contoh:

- total_amount: 110500
- shipping_cost: 10000
- platform_fee: 500
- payment_gateway_fee: 773
- refund_amount: 20000

Expected:

- `sellerReceives = 110500 - 20000 - 10000 - 500 - 773 = 79227`
- wallet credit `partial_refund_credit` = `79227` (jika > 0)

Checklist:

- status dispute `resolved_partial`.
- status order `resolved_partial`.
- tidak ada double credit jika endpoint dipanggil ulang.

## Skenario 6: Withdraw Seller

Input contoh:

- requestedAmount: 50000
- disbursementFeeSeller: 2500

Expected:

- `transferAmount = 47500`
- wallet `available_balance` berkurang `50000`
- wallet `total_withdrawn` naik `50000`
- transaksi withdraw tercatat amount negatif `-50000`

Failure path expected:

- jika Xendit gagal: `available_balance` rollback ke sebelum withdraw.
- `total_withdrawn` rollback.
- transaksi reserve withdraw sementara dihapus.

## Query Verifikasi Cepat (SQL)

```sql
-- 1) Cek order terbaru + fee
select id, status, total_amount, shipping_cost, platform_fee, payment_gateway_fee, payment_method
from orders
order by created_at desc
limit 20;

-- 2) Cek saldo wallet seller
select seller_id, available_balance, total_credited, total_withdrawn, updated_at
from seller_wallets
order by updated_at desc
limit 20;

-- 3) Cek ledger wallet
select seller_id, order_id, tx_type, amount, balance_before, balance_after, created_at
from seller_wallet_transactions
order by created_at desc
limit 50;
```

## Release Gate

Semua item di bawah harus `PASS`:

- Checkout single item
- Checkout cart multi-seller
- Complete manual
- Auto-complete cron
- Dispute partial
- Withdraw success
- Withdraw rollback on failure
- Tidak ada wallet double credit per order
