# Checkout Xendit Test Matrix

## Scope

Menguji jalur kritikal pembayaran untuk:

- `POST /api/checkout` (offer-based, single item)
- `POST /api/checkout/cart` (cart-based, multi item)
- webhook `POST /api/webhooks/xendit`

## Preconditions

- `XENDIT_KEY` menggunakan production key di environment target
- `XENDIT_CALLBACK_TOKEN` sudah match dengan dashboard Xendit
- `SITE_URL` mengarah ke domain environment yang diuji
- Data seller memiliki rekening bank valid untuk jalur withdraw

## Matrix A: Offer Checkout (`/api/checkout`)

| ID | Scenario | Input/State | Expected Result |
|---|---|---|---|
| O-01 | Happy path create invoice | Offer accepted, stock cukup, channel valid | `200`, return `orderId` + `paymentUrl`, order `pending_payment` |
| O-02 | Missing payment channel | `paymentChannel` kosong | `400 paymentChannel harus diisi` |
| O-03 | Unsupported payment channel | channel tidak ada di map | `400 paymentChannel tidak didukung` |
| O-04 | Missing Xendit key | `XENDIT_KEY` kosong | `500 XENDIT_KEY belum dikonfigurasi` dan tidak ada mutasi DB |
| O-05 | Invalid shipping method | selain `cod`/`shipping` | `400 shippingMethod harus "cod" atau "shipping"` |
| O-06 | Invalid meetup location (COD) | `shippingMethod=cod`, location invalid | `400 Lokasi meetup tidak valid` |
| O-07 | Offer not accepted | status offer bukan `accepted` | `422 Penawaran belum diterima` |
| O-08 | Stock depleted race | stok berubah saat re-check | `409 stock_depleted` |
| O-09 | Idempotency pending | order pending + payment URL sudah ada | return URL existing, tanpa buat invoice baru |
| O-10 | Xendit invoice create failed | Xendit API error | `502`, rollback order/stock/offer sesuai flow |

## Matrix B: Cart Checkout (`/api/checkout/cart`)

| ID | Scenario | Input/State | Expected Result |
|---|---|---|---|
| C-01 | Happy path multi-item | cart valid, item >1, channel valid | `200`, return `paymentUrl`, `orderIds[]`, `grandTotal` |
| C-02 | Missing payment channel | `paymentChannel` kosong | `400 paymentChannel harus diisi` |
| C-03 | Unsupported payment channel | channel tidak valid | `400 paymentChannel tidak didukung` |
| C-04 | Missing Xendit key | `XENDIT_KEY` kosong | `500 XENDIT_KEY belum dikonfigurasi` dan tidak ada mutasi DB |
| C-05 | Empty cart | cart tanpa item | `400 Keranjang kosong` |
| C-06 | Self purchase in cart | item milik buyer sendiri | `422 Tidak bisa membeli produk milikmu sendiri` |
| C-07 | Stock not enough | salah satu item stok kurang | `409 Stok tidak cukup` |
| C-08 | Idempotency pending | sudah ada pending invoice cart | return URL existing |
| C-09 | Xendit invoice create failed | Xendit API error | `502`, rollback order + restore stock |
| C-10 | Shipping split check | multiple seller + shipping | total ongkir terdistribusi dan `grandTotal` konsisten |

## Matrix C: Webhook (`/api/webhooks/xendit`)

| ID | Scenario | Payload/Auth | Expected Result |
|---|---|---|---|
| W-01 | Paid callback valid | token valid, invoice id valid, status `PAID` | order -> `confirmed`, side effects notifikasi berjalan |
| W-02 | Callback token invalid | token mismatch | `401`, body tidak diproses |
| W-03 | Missing invoice id | payload tanpa `id` | `400 Missing invoice id` |
| W-04 | Expired invoice | status `EXPIRED` | order -> `payment_failed`/cancel flow sesuai handler |
| W-05 | Duplicate callback | callback sama dikirim ulang | idempotent, tidak ada double side effects |

## Pass Criteria

- Semua skenario `O-01..O-10`, `C-01..C-10`, `W-01..W-05` lulus
- Tidak ada mismatch nominal antara order, invoice amount, fee breakdown
- Tidak ada order orphan (order pending tanpa URL karena config/error)
- Log error untuk skenario gagal jelas dan actionable
