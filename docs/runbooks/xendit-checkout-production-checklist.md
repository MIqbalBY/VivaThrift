# Xendit Checkout Production Checklist

## 1. Environment Verification

- [ ] `XENDIT_KEY` sudah production key (bukan `xnd_development_*`)
- [ ] `XENDIT_CALLBACK_TOKEN` sudah diisi dan disamakan dengan dashboard Xendit
- [ ] `SITE_URL` menunjuk domain production aktif
- [ ] `XENDIT_PAYMENT_FEE_BY_CHANNEL_JSON` valid JSON (jika digunakan)
- [ ] `XENDIT_PAYMENT_FEE_PERCENT`, `XENDIT_PAYMENT_FEE_FLAT`, `XENDIT_PAYMENT_FEE_TAX_PERCENT` terisi sesuai pricing
- [ ] `XENDIT_AUTO_DISBURSE_ADMIN_FEE` diputuskan eksplisit (`true`/`false`)
- [ ] `XENDIT_DISBURSEMENT_FEE_SELLER_FLAT` dan `XENDIT_DISBURSEMENT_FEE_ADMIN_FLAT` sesuai biaya aktual

## 2. Xendit Dashboard Verification

- [ ] Callback URL: `https://<domain>/api/webhooks/xendit`
- [ ] Callback token pada dashboard sama dengan `XENDIT_CALLBACK_TOKEN`
- [ ] Payment methods aktif sesuai channel yang dipakai app (`qris`, `bca_va`, `bni_va`, `bri_va`, `mandiri_va`, `gopay`, `ovo`, `dana`, `shopeepay`)
- [ ] Akun live mode sudah aktif dan mampu membuat invoice

## 3. Functional Smoke (Offer Checkout)

- [ ] Buat checkout offer, dapat `paymentUrl`
- [ ] Selesaikan pembayaran, order berubah ke `confirmed`
- [ ] Simulasikan expired/failed payment, status order fallback sesuai flow
- [ ] Ulang callback yang sama (duplicate), verifikasi tidak double process

## 4. Functional Smoke (Cart Checkout)

- [ ] Checkout cart multi-item berhasil buat satu invoice
- [ ] `grandTotal` konsisten dengan akumulasi order
- [ ] Jalur idempotency bekerja (refresh/retry tidak membuat invoice duplikat)
- [ ] Simulasi gagal buat invoice memicu rollback order/stock

## 5. Finance & Wallet Consistency

- [ ] `platform_fee` dan `payment_gateway_fee` tersimpan benar di order
- [ ] Saat complete, seller wallet mendapat credit sesuai formula
- [ ] Withdraw seller berhasil ke bank via Xendit
- [ ] Jika withdraw gagal di Xendit, saldo wallet rollback konsisten

## 6. Observability

- [ ] Error webhook dan checkout masuk log/Sentry dengan context invoice/order id
- [ ] Tidak ada lonjakan 5xx di endpoint `/api/checkout`, `/api/checkout/cart`, `/api/webhooks/xendit`
- [ ] Ada prosedur rollback env key (key rotation) jika terjadi insiden

## 7. Sign-off

- [ ] QA lead sign-off
- [ ] Backend lead sign-off
- [ ] Business owner sign-off
- [ ] Release note mencantumkan perubahan checkout/Xendit terbaru
