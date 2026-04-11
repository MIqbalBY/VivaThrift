# Security Policy

Dokumen ini menjelaskan cara melaporkan kerentanan keamanan di VivaThrift secara aman dan bertanggung jawab.

## Supported Versions

| Version | Status |
| --- | --- |
| `main` / deployment terbaru | Supported |
| Versi lama yang tidak lagi aktif | Not supported |

Jika Anda menemukan isu pada deployment lama, tetap laporkan. Kami akan menilai dampaknya terhadap versi aktif.

## Cara Melaporkan Kerentanan

Jangan laporkan kerentanan keamanan melalui GitHub Issues publik.

Gunakan salah satu jalur berikut:

- Email ke `admin@vivathrift.store`
- Subject email: `[SECURITY] ringkasan singkat isu`

Jika GitHub Private Security Advisory sudah diaktifkan untuk repo ini, jalur itu juga boleh digunakan.

## Informasi yang Harus Disertakan

Agar triage lebih cepat, sertakan informasi berikut:

- Deskripsi singkat kerentanan
- Dampak yang mungkin terjadi
- Langkah reproduksi yang jelas
- Proof of concept jika ada
- Endpoint, halaman, atau fitur yang terdampak
- Asumsi akun atau role yang dibutuhkan
- Screenshot atau log yang relevan jika aman untuk dibagikan

Jangan kirim data pribadi pengguna asli, secret production, atau dump database lengkap di email laporan.

## Target Waktu Respons

| Tahap | Target |
| --- | --- |
| Konfirmasi penerimaan laporan | Maksimal 48 jam |
| Triage awal dan penilaian severity | Maksimal 5 hari kerja |
| Update status pertama | Maksimal 7 hari kerja |
| Perbaikan atau mitigasi awal | Bergantung severity dan kompleksitas |

Kami akan berusaha memberi update berkala sampai isu ditutup atau dimitigasi.

## Scope Utama

Laporan yang paling relevan untuk VivaThrift biasanya mencakup:

- Authentication dan session handling Supabase
- Authorization bypass pada route server atau area admin
- Broken access control pada data buyer, seller, order, dispute, review, atau chat
- Payment flow, webhook validation, dan status transition order
- Shipping webhook authentication dan validasi event payload dari provider
- Upload, media handling, dan akses asset privat
- Push subscription abuse atau disclosure data notifikasi
- Stored XSS, reflected XSS, CSRF, SSRF, SQL injection, command injection
- Security misconfiguration pada Vercel, Nitro routes, atau env handling

## Out of Scope

Temuan berikut biasanya tidak kami proses sebagai vulnerability utama, kecuali ada dampak nyata terhadap keamanan pengguna atau data:

- Isu UI murni tanpa dampak security
- Missing security header yang tidak bisa dieksploitasi secara nyata
- Rate limit bypass teoretis tanpa bukti dampak
- Best-practice umum tanpa proof of concept
- Laporan dari dependency scanner tanpa jalur eksploitasi yang relevan ke aplikasi ini
- Social engineering, phishing, atau credential stuffing di luar kendali repo ini

## Aturan Pengujian

Silakan lakukan pengujian secara hati-hati dan bertanggung jawab.

- Jangan lakukan denial-of-service, spam, atau brute force agresif
- Jangan mengakses, mengubah, atau menghapus data pengguna lain tanpa izin eksplisit
- Jangan mengubah transaksi nyata atau webhook production untuk eksperimen
- Gunakan akun uji milik Anda sendiri bila memungkinkan
- Hentikan pengujian segera jika terlihat berisiko terhadap integritas data atau ketersediaan layanan

## Safe Harbor

Kami tidak akan menganggap aktivitas Anda sebagai pelanggaran jika seluruh kondisi berikut dipenuhi:

- Anda bertindak dengan itikad baik untuk meningkatkan keamanan platform
- Anda tidak mengeksfiltrasi data lebih dari yang diperlukan untuk membuktikan isu
- Anda tidak menyalahgunakan temuan untuk keuntungan pribadi atau pihak ketiga
- Anda memberi kami waktu yang wajar untuk memperbaiki sebelum disclosure publik

## Disclosure

Mohon jangan mempublikasikan detail teknis kerentanan sebelum kami menyelesaikan perbaikan atau mitigasi yang memadai.

Jika laporan menghasilkan perbaikan yang valid, kami dapat memberi pengakuan non-finansial sesuai kebijakan internal tim, kecuali Anda meminta tetap anonim.

## Catatan Teknis

Stack utama yang perlu diperhatikan saat melaporkan isu:

- Nuxt 4 dan Nitro server routes
- Supabase untuk auth dan database
- Xendit untuk payment flow
- Biteship untuk shipping flow
- Resend untuk email
- Vercel untuk hosting dan cron

Laporan yang menyebut komponen terdampak secara spesifik akan jauh lebih cepat ditangani.
