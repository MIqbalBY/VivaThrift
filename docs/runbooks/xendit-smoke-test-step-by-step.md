# Xendit Smoke Test Step by Step

Dokumen ini untuk operator non-teknis agar bisa verifikasi alur checkout Xendit tanpa menebak-nebak.

## Kapan Dipakai

- Saat live key Xendit sudah terbit setelah KYC
- Saat mau go-live pembayaran di production
- Saat habis perubahan kode checkout/webhook

## Prasyarat

- Xendit key sudah live
- Xendit callback token di app sama dengan dashboard Xendit
- Site URL sudah ke production: [https://www.vivathrift.store](https://www.vivathrift.store)
- Mode fee admin sudah diputuskan: OFF

## A. Cek Konfigurasi Dasar

1. Buka Vercel project environment variables.
2. Pastikan value ini benar:
   - Xendit key
   - Xendit callback token
   - SITE_URL
   - Mode auto disburse admin fee = false
3. Redeploy jika ada perubahan env.

Lulus jika tidak ada env kosong atau typo.

## B. Uji Checkout Offer (Single Item)

1. Login sebagai buyer A.
2. Pilih produk seller B.
3. Lakukan alur offer sampai accepted.
4. Klik bayar dan pastikan redirect ke payment page Xendit.
5. Selesaikan pembayaran.
6. Kembali ke aplikasi.

Lulus jika:

- Order berubah ke confirmed
- Tidak ada error 5xx di network request checkout
- Notifikasi buyer/seller masuk

## C. Uji Checkout Cart (Multi Item)

1. Login buyer A.
2. Tambahkan minimal 2 item dari seller berbeda ke cart.
3. Checkout dari halaman cart.
4. Pastikan aplikasi membuat satu invoice payment URL.
5. Selesaikan pembayaran.

Lulus jika:

- Semua order terkait cart terbuat dan terhubung invoice yang sama
- Total grand total sesuai item plus fee
- Tidak ada order menggantung tanpa payment URL

## D. Uji Idempotency

1. Buat checkout sampai muncul payment URL.
2. Refresh halaman checkout beberapa kali.
3. Ulang klik bayar jika perlu.

Lulus jika:

- URL invoice tetap sama untuk transaksi pending yang sama
- Tidak tercipta order/invoice duplikat

## E. Uji Failure Path

1. Buat checkout lalu biarkan invoice expired.
2. Uji callback duplicate (jika bisa dari dashboard tools).
3. Coba skenario stok berubah saat checkout (race sederhana).

Lulus jika:

- Status order fallback sesuai flow
- Tidak ada double processing pada callback ganda
- Error message jelas dan bisa ditindaklanjuti

## F. Cek Wallet Seller Setelah Complete

1. Selesaikan satu order sampai completed.
2. Buka endpoint wallet seller lewat UI seller.
3. Verifikasi saldo bertambah sesuai nominal net seller.

Lulus jika:

- Credit wallet tercatat
- Nominal sesuai formula

## G. Uji Withdraw Seller

1. Pastikan seller sudah isi data rekening.
2. Lakukan withdraw nominal kecil.
3. Cek status response dan saldo setelah withdraw.

Lulus jika:

- Disbursement ke bank berhasil
- Saldo wallet berkurang sesuai requested amount
- Jika gagal disburse, saldo rollback dan tidak nyangkut

## H. Catat Hasil Uji

Gunakan format berikut:

- Tanggal uji
- Environment
- Tester
- Skenario yang dijalankan
- Pass/Fail per skenario
- Screenshot atau log error (jika fail)
- Keputusan go/no-go

## Keputusan Go-Live

Boleh go-live jika:

- Semua skenario B sampai G pass
- Tidak ada error kritikal di webhook
- Tim owner setuju sign-off
