# Panduan E2E Buyer dan Seller untuk Menyelesaikan Order API Biteship

> Last updated: 17 April 2026
> Audience: Buyer utama dan seller Tiara, Ichlas, Fathim, Rava
> Tujuan: dari daftar akun baru, melengkapi profil, membuat transaksi real, sampai mendapatkan order Biteship berstatus delivered dan, bila perlu, cancelled.

## Ringkasan Jawaban Cepat

### Apakah sudah ada opsi pickup dan drop-off?

Ya, flow checkout shipping sudah mendukung dua model pengumpulan paket:

- **Dijemput Kurir**: kurir datang ke alamat seller untuk mengambil paket.
- **Antar ke Gerai**: seller mengantar paket ke agen atau gerai ekspedisi.

Ketersediaan opsi ini bisa berbeda tergantung kurir, area, dan rate yang muncul saat checkout.

### Siapa yang packing ke kardus?

**Seller yang packing.**

Rinciannya:

- seller menyiapkan barang, bubble wrap, kardus, dan label paket;
- kurir bertugas menjemput atau mengantar, **bukan** membungkus barang;
- agen ekspedisi atau gerai biasanya hanya menerima paket dan memproses pengiriman, **bukan** melakukan packing utama.

Kalau seller belum punya kardus, seller tetap yang harus menyiapkan atau membeli kemasan sebelum paket diserahkan.

### Apakah Xendit harus production atau live dulu?

Kalau targetnya adalah **tes order Biteship yang benar-benar real sampai delivered**, maka **ya, Xendit sebaiknya sudah menggunakan production atau live key**.

Alasannya:

- buyer perlu menyelesaikan pembayaran sungguhan;
- setelah pembayaran sukses, order masuk ke status siap diproses seller;
- dari situ seller baru bisa lanjut membuat pengiriman via Biteship pada flow produksi.

Kalau Xendit masih sandbox atau test, kalian mungkin hanya bisa menguji sebagian flow internal, tetapi itu biasanya **belum cukup** untuk bukti order delivered real yang dibutuhkan saat verifikasi end-to-end.

### Apakah label paket dari Biteship?

**Ya, label atau resi resmi pengiriman pada umumnya berasal dari Biteship atau ekspedisi setelah order shipping berhasil dibuat.**

Sekarang di aplikasi VivaThrift, seller juga sudah punya tombol **Unduh Label** di halaman pesanan untuk:

- membuka halaman label siap print;
- menyimpan versi PDF jika perlu;
- membuka label resmi kurir jika URL resminya memang sudah tersedia dari Biteship.

Praktiknya seperti ini:

- seller tetap packing barang terlebih dahulu;
- setelah order shipping berhasil dibuat, cek apakah label atau resi sudah tersedia di dashboard atau detail order;
- jika label resmi tersedia, seller cukup **print lalu tempel** pada bagian luar paket atau kardus.

Jadi pembagian tugasnya jelas:

- **seller**: packing barang dan menempel label;
- **Biteship atau ekspedisi**: menyediakan informasi resi atau label resmi;
- **kurir**: menjemput atau mengantarkan paket yang sudah siap kirim.

---

## Target Tim yang Disarankan

Agar approval Biteship cepat, gunakan pembagian tugas berikut.

| Orang | Role | Tugas inti |
| --- | --- | --- |
| Iqbal | Buyer utama | Menyelesaikan pembayaran, menerima paket, dan konfirmasi order selesai |
| Tiara dan Fathim | Seller utama | Menyiapkan produk, packing, dan menjalankan order utama sampai status **delivered** |
| Ichlas dan Rava | Seller pendukung | Menjadi backup seller, membantu skenario **cancelled**, dan mengamankan dokumentasi evidence |

> Rekomendasi paling efisien: buat **2 order nyata**. Satu order dibiarkan sampai delivered, satu order dibuat lalu dibatalkan agar status menjadi cancelled.

---

## Hasil Akhir yang Harus Didapat

Sebelum mengajukan approval atau verifikasi ke Biteship, minimal kumpulkan hal berikut:

- 1 akun buyer aktif;
- minimal 2 akun seller aktif;
- alamat buyer terisi;
- alamat seller terisi;
- rekening seller terisi;
- minimal 1 produk seller aktif;
- 1 order shipping yang sukses dibuat via aplikasi;
- 1 **Biteship Order ID** yang statusnya sudah **delivered**;
- 1 **Biteship Order ID** yang statusnya **cancelled** jika ingin approval lebih meyakinkan.

---

## Prasyarat Sebelum Mulai

### Untuk semua orang

Siapkan data berikut:

- email aktif;
- nomor HP aktif;
- alamat lengkap asli;

> Catatan aplikasi terbaru: nomor HP sekarang wajib diisi di profil untuk flow shipping. Jika kosong, checkout pengiriman dan pembuatan resi Biteship akan ditolak sistem.

- kode pos yang benar;
- nama lengkap sesuai identitas atau rekening;
- akses internet stabil.

### Khusus seller

Siapkan tambahan berikut:

- produk yang benar-benar siap dijual;
- foto produk yang jelas;
- berat perkiraan barang;
- ukuran paket kasar;
- kardus atau poly mailer;
- bubble wrap atau pelindung isi;
- rekening bank atau e-wallet yang didukung untuk pencairan dana.

### Khusus buyer

Siapkan tambahan berikut:

- alamat penerima yang bisa menerima paket;
- dana untuk membayar barang dan ongkir;
- kesiapan menerima paket dan melakukan konfirmasi selesai.

---

## Urutan Besar Proses

1. Buyer dan semua seller daftar akun.
2. Semua orang melengkapi profil dasar.
3. Buyer mengisi alamat pengiriman.
4. Seller mengisi alamat pengirim dan rekening bank.
5. Seller upload produk.
6. Buyer memilih produk dan checkout dengan metode shipping.
7. Buyer membayar invoice.
8. Seller packing barang.
9. Seller kirim lewat Biteship.
10. Paket dijemput kurir atau di-drop ke gerai.
11. Status tracking berjalan sampai delivered.
12. Buyer konfirmasi barang diterima.
13. Dana seller masuk ke antrean pencairan.
14. Tim menyalin Biteship Order ID sebagai evidence.

---

## Bagian A: Buyer Baru Sampai Siap Checkout

### Langkah 1. Daftar akun buyer

Buyer membuka halaman daftar lalu membuat akun baru.

Isi minimal:

- nama;
- username jika diminta;
- nomor HP aktif;
- email;
- password yang kuat.

Setelah itu:

- login ke akun;
- pastikan berhasil masuk ke beranda;
- cek apakah profil bisa dibuka.

### Langkah 2. Lengkapi profil buyer

Masuk ke menu profil, lalu isi data dasar seperti:

- nama lengkap;
- foto profil jika perlu;
- bio singkat bila tersedia;
- nomor HP yang aktif.

### Langkah 3. Isi alamat pengiriman buyer

Ini **wajib** untuk checkout shipping.

Masuk ke **Profil → Edit Profil → Address** lalu isi:

- label alamat, misalnya Rumah atau Kos;
- provinsi;
- kota atau kabupaten;
- kecamatan;
- kelurahan;
- kode pos;
- alamat lengkap;
- titik GPS jika fitur peta dipakai.

Tips:

- gunakan alamat yang benar-benar bisa menerima paket;
- pastikan nama penerima dan nomor HP jelas;
- cek ulang kode pos karena ongkir bergantung pada data ini.

### Langkah 4. Opsional isi rekening buyer

Untuk buyer murni, rekening biasanya belum wajib. Namun jika buyer nanti juga akan berjualan, langsung isi juga tab **Rekening** supaya akun lengkap sejak awal.

---

## Bagian B: Seller Baru Sampai Siap Menerima Order

Lakukan langkah ini untuk Tiara, Ichlas, Fathim, dan Rava.

### Langkah 1. Daftar akun seller

Masing-masing seller membuat akun baru, lalu login.

Pastikan nomor HP diisi sejak awal karena sistem sekarang memakainya untuk checkout shipping dan pembuatan resi Biteship.

### Langkah 2. Lengkapi profil seller

Isi data utama berikut:

- nama lengkap;
- username yang mudah dikenali;
- foto profil;
- nomor HP aktif;
- deskripsi singkat toko atau penjual jika ingin.

### Langkah 3. Isi alamat seller atau alamat pengirim

Masuk ke **Profil → Edit Profil → Address**, lalu pindah ke tab alamat seller atau alamat pengirim.

Isi secara lengkap:

- label alamat;
- alamat lengkap penjemputan;
- provinsi;
- kota atau kabupaten;
- kecamatan;
- kelurahan;
- kode pos;
- titik GPS bila tersedia.

Alamat ini penting karena akan dipakai saat seller membuat pengiriman Biteship.

### Langkah 4. Isi rekening seller

Masuk ke **Profil → Edit Profil → Rekening** lalu isi:

- bank atau e-wallet;
- nomor rekening atau nomor HP e-wallet;
- nama pemilik rekening.

Checklist kualitas data rekening:

- nama pemilik sama dengan nama di bank;
- nomor rekening tidak salah digit;
- bank yang dipilih benar.

Kenapa ini penting:

- setelah order selesai, dana penjualan akan masuk ke alur pencairan;
- jika rekening belum diisi, pencairan ke seller bisa tertahan.

### Langkah 5. Upload minimal 1 produk

Masing-masing seller disarankan mengunggah setidaknya satu produk yang layak jual.

Isi produk sebaik mungkin:

- nama barang;
- harga;
- deskripsi;
- kategori;
- kondisi barang;
- stok;
- foto jelas dari beberapa sisi.

Tips operasional:

- pilih barang ringan dan mudah dikirim;
- hindari barang pecah belah untuk order pertama jika ingin cepat dan aman;
- pastikan barang benar-benar siap di rumah atau kos seller.

---

## Bagian C: Skenario Paling Efisien untuk Tim

Agar cepat mendapatkan bukti integrasi, jalankan skenario berikut.

### Skenario 1: Order delivered

- Buyer membeli 1 produk dari **Tiara**.
- Order dibayar dan dikirim sungguhan.
- Paket dibiarkan sampai status **delivered**.
- Biteship Order ID dari order ini dipakai untuk field paling penting.

### Skenario 2: Order cancelled

- Buyer membeli 1 produk dari **Fathim**.
- Setelah order berhasil terbentuk, order dibatalkan sesuai flow yang tersedia.
- Tunggu status **cancelled**.
- Biteship Order ID dari order ini dipakai untuk field cancelled.

### Skenario 3: Backup

- **Ichlas** dan **Rava** menyiapkan akun, alamat, rekening, dan produk sebagai backup.
- Jika seller utama sibuk atau ada error stok, buyer bisa langsung checkout dari seller cadangan.

---

## Bagian D: Langkah Transaksi Sampai Order Biteship Terbentuk

### Langkah 1. Buyer pilih produk

Buyer login, lalu:

- buka produk seller;
- pastikan deskripsi dan harga sudah sesuai;
- pilih produk yang benar-benar siap dikirim.

### Langkah 2. Buyer masuk checkout

Ada dua kemungkinan:

- checkout dari satu produk atau hasil tawaran;
- checkout dari keranjang jika membeli lebih dari satu item.

### Langkah 3. Buyer pilih metode pengiriman

Di halaman checkout, buyer pilih **shipping**, bukan COD, jika targetnya ingin membentuk order Biteship.

Pada bagian ongkir biasanya buyer akan melihat layanan yang tersedia berdasarkan alamat dan kurir.

Tambahan fitur yang sekarang sudah ada di aplikasi:

- opsi asuransi tambahan untuk barang elektronik atau gadget;
- checkbox khusus untuk menandai paket sebagai fragile atau pecah belah;
- label print seller akan menampilkan penanda FRAGILE atau PECAH BELAH jika opsi itu diaktifkan.

### Langkah 4. Buyer pilih tipe collection

Saat rate pengiriman muncul, buyer akan menemukan opsi seperti:

- **Dijemput Kurir**;
- **Antar ke Gerai**.

Penjelasan operasional:

#### Opsi 1. Dijemput Kurir

Cocok jika:

- seller ingin menunggu di rumah, kos, atau titik pickup;
- kurir tersedia untuk area seller;
- seller ingin lebih praktis.

Konsekuensinya:

- seller harus memastikan paket **sudah rapi dibungkus** sebelum kurir datang;
- seller harus siap di lokasi saat jam pickup.

#### Opsi 2. Antar ke Gerai

Cocok jika:

- seller ingin lebih cepat menyerahkan paket;
- di dekat seller ada agen atau gerai ekspedisi yang mendukung layanan tersebut;
- pickup kurir di area seller kurang fleksibel.

Konsekuensinya:

- seller tetap harus packing sendiri;
- seller yang membawa paket ke gerai dan menyerahkannya ke petugas.

### Langkah 5. Buyer pilih layanan dan bayar

Setelah ongkir muncul:

- pilih kurir dan service yang paling masuk akal;
- aktifkan asuransi jika barang bernilai tinggi, terutama elektronik;
- aktifkan tanda fragile atau pecah belah jika paket perlu penanganan ekstra;
- lanjut ke pembayaran.

Pembayaran diproses lewat Xendit. Buyer bisa menggunakan metode yang tersedia seperti QRIS, transfer bank, virtual account, atau e-wallet.

### Langkah 6. Buyer selesaikan pembayaran sampai sukses

Pastikan invoice benar-benar dibayar sampai status payment sukses.

Tanda berhasil:

- buyer diarahkan ke halaman sukses;
- order masuk ke daftar pesanan;
- status order tidak lagi menunggu pembayaran.

---

## Bagian E: Langkah Seller Setelah Buyer Bayar

### Langkah 1. Seller buka daftar order

Seller login lalu buka halaman order.

Cari order yang statusnya sudah siap diproses dan pastikan ini adalah order shipping, bukan COD.

### Langkah 2. Seller siapkan barang dan packing

Ini tahap yang paling penting secara operasional.

#### Siapa yang packing?

**Seller sendiri.**

#### Standar packing minimum

Untuk pakaian atau barang non-fragile:

- lipat rapi;
- masukkan ke plastik atau pelindung dalam;
- masukkan ke poly mailer atau kardus;
- rekatkan dengan lakban kuat.

Untuk barang fragile atau elektronik:

- bungkus bubble wrap beberapa lapis;
- gunakan kardus yang pas;
- beri pelindung tambahan di sisi kosong;
- tempel penanda fragile jika perlu.

#### Yang sebaiknya disiapkan seller

- kardus atau poly mailer;
- bubble wrap;
- lakban;
- gunting atau cutter;
- catatan nama penerima jika ingin.

#### Yang **bukan** tugas kurir

- mencari kardus untuk seller;
- membungkus barang dari nol;
- memastikan keamanan isi sebelum seller packing.

#### Apa yang dicantumkan di kardus atau label packing?

Tulis atau tempel label sederhana di bagian luar paket yang berisi:

- nama penerima;
- nomor HP penerima;
- alamat lengkap penerima;
- kode pos;
- nama pengirim;
- nomor HP pengirim;
- catatan tambahan seperti **fragile** atau **jangan dibanting** jika barang rentan.

Opsional, tetapi bagus untuk operasional internal:

- kode order internal VivaThrift;
- nama produk singkat, misalnya 1 pcs hoodie.

Yang sebaiknya **tidak** dicantumkan besar-besar di luar paket:

- harga barang;
- data sensitif yang tidak perlu;
- informasi akun atau detail pribadi berlebihan.

Kalau dari ekspedisi atau gerai nanti keluar label resi resmi, tempel label itu di sisi luar paket yang paling mudah terlihat.

### Langkah 3. Seller klik kirim via Biteship

Setelah paket siap:

- seller buka order;
- pilih aksi kirim dengan Biteship jika tombol atau opsi tersedia;
- sistem akan membuat order ke API Biteship secara otomatis.

Data yang biasanya dipakai sistem:

- alamat seller;
- alamat buyer;
- kurir dan service yang dipilih saat checkout;
- item dan nilai barang.

### Langkah 4. Simpan bukti order Biteship

Begitu order shipping berhasil dibuat, seller atau operator tim perlu:

- buka halaman **Pesanan Saya** di VivaThrift;
- klik **Unduh Label** untuk print atau simpan PDF label paket;
- jika tersedia, buka juga label resmi kurir dari detail tracking;
- lalu buka dashboard Biteship;
- masuk ke menu **Orders**;
- cari order tadi;
- buka detailnya;
- salin **Order ID** Biteship.

> Yang harus dicatat adalah **Order ID Biteship**, bukan nomor resi kurir.

Jika resi sudah muncul, boleh dicatat juga, tetapi untuk proses approval yang dicari tetap **Order ID**.

---

## Bagian F: Setelah Order Biteship Terbentuk

### Jika memilih Dijemput Kurir

Urutannya biasanya seperti ini:

1. seller sudah selesai packing;
2. seller menunggu kurir di alamat pickup;
3. kurir datang dan mengambil paket;
4. status pengiriman mulai bergerak;
5. buyer bisa memantau tracking.

### Jika memilih Antar ke Gerai

Urutannya biasanya seperti ini:

1. seller sudah selesai packing;
2. seller membawa paket ke agen atau gerai;
3. petugas menerima paket dan memproses pengiriman;
4. tracking mulai aktif;
5. buyer bisa memantau tracking.

### Catatan penting untuk dua opsi ini

- apa pun opsinya, **seller tetap packing sendiri**;
- buyer tidak perlu mengurus pengemasan;
- kurir atau ekspedisi menangani transportasi setelah paket siap serah.

---

## Bagian G: Sampai Status Delivered

Setelah paket masuk alur pengiriman, pantau status secara rutin.

Status normal yang mungkin terlihat antara lain:

- order dibuat;
- pickup dijadwalkan atau pickup berhasil;
- in transit;
- out for delivery;
- delivered.

Yang harus dilakukan buyer:

- siap menerima telepon kurir;
- memastikan alamat penerima mudah ditemukan;
- menerima paket saat datang;
- memeriksa isi paket.

Yang harus dilakukan seller:

- tetap standby jika kurir butuh konfirmasi;
- simpan bukti pengiriman atau tanda terima drop-off;
- jangan menghapus chat atau dokumentasi sampai order selesai.

---

## Bagian H: Menyelesaikan Order di VivaThrift

Setelah barang sampai dan sesuai:

1. buyer buka halaman order;
2. buyer cek bahwa barang memang sudah diterima;
3. buyer klik konfirmasi penerimaan atau selesaikan order;
4. status order berubah menjadi selesai atau completed.

Dampaknya:

- transaksi dianggap selesai;
- dana seller masuk ke alur pencairan;
- sistem payout seller bisa lanjut selama rekening seller sudah benar.

---

## Bagian I: Cara Mendapatkan Biteship Order ID Delivered

Ini field paling penting untuk kebutuhan verifikasi end-to-end.

### Langkah ambil datanya

1. pastikan order benar-benar sudah sampai ke buyer;
2. buka dashboard Biteship;
3. masuk ke **Orders**;
4. cari order yang statusnya **delivered**;
5. buka detail order;
6. salin **Order ID**.

### Jangan tertukar dengan data ini

Jangan isi field approval dengan:

- nomor resi;
- airway bill;
- nomor invoice internal;
- nomor order dari marketplace.

Yang benar tetap **Biteship Order ID**.

---

## Bagian J: Cara Mendapatkan Order Cancelled

Untuk mempercepat approval, sebaiknya siapkan juga 1 order cancelled.

### Skenario yang disarankan

- buyer checkout dari seller Fathim;
- order berhasil tercipta;
- sebelum order berjalan jauh, lakukan pembatalan sesuai flow operasional;
- pastikan status akhirnya **cancelled**;
- salin **Order ID** dari dashboard Biteship.

### Catatan penting

Kalau belum memungkinkan, field cancelled bisa ditunda. Namun secara praktik, data ini sangat membantu menunjukkan integrasi kalian lengkap.

---

## Bagian K: Checklist Per Orang

### Checklist buyer utama

- [ ] berhasil daftar akun;
- [ ] berhasil login;
- [ ] profil dasar terisi;
- [ ] alamat pengiriman terisi lengkap;
- [ ] checkout shipping berhasil;
- [ ] invoice dibayar sukses;
- [ ] menerima paket;
- [ ] mengonfirmasi order selesai.

### Checklist tiap seller

- [ ] berhasil daftar akun;
- [ ] berhasil login;
- [ ] profil dasar terisi;
- [ ] alamat seller terisi lengkap;
- [ ] rekening bank terisi;
- [ ] minimal 1 produk aktif;
- [ ] barang sudah siap packing;
- [ ] order berhasil dikirim via Biteship.

### Checklist operator dokumentasi

- [ ] screenshot halaman order sukses;
- [ ] screenshot order di dashboard Biteship;
- [ ] copy Order ID delivered;
- [ ] copy Order ID cancelled bila ada;
- [ ] simpan tanggal, nama seller, dan nama buyer untuk bukti internal.

---

## Bagian L: Rencana Eksekusi 1 Hari Paling Realistis

### Sesi 1. Pagi atau siang

- Buyer daftar dan isi alamat.
- Tiara, Ichlas, Fathim, dan Rava daftar akun.
- Semua seller isi profil, alamat seller, dan rekening.
- Tiara dan Fathim upload produk.

### Sesi 2. Siang atau sore

- Buyer checkout produk Tiara untuk skenario delivered.
- Buyer checkout produk Fathim untuk skenario cancelled jika diperlukan.
- Buyer menyelesaikan pembayaran.

### Sesi 3. Setelah payment confirmed

- Tiara packing barang dan kirim via Biteship.
- Tentukan apakah mau **pickup** atau **drop-off** sesuai rate yang tersedia.
- Simpan Order ID Biteship.

### Sesi 4. Beberapa hari berikutnya

- Pantau tracking sampai delivered.
- Buyer menerima barang dan klik selesai.
- Ambil Order ID dari dashboard Biteship sebagai final evidence.

---

## Troubleshooting Cepat

### Buyer tidak bisa checkout shipping

Cek hal berikut:

- alamat pengiriman buyer belum diisi;
- kode pos belum valid;
- rate ongkir belum dipilih;
- seller belum punya alamat pengirim;
- jaringan atau payment sedang bermasalah.

### Seller tidak bisa kirim via Biteship

Cek hal berikut:

- order belum berstatus confirmed;
- alamat seller belum diisi;
- alamat buyer belum lengkap;
- kurir belum dipilih saat checkout;
- ada kendala pada kredensial production atau webhook Biteship.

### Paket belum bisa dipickup

Cek hal berikut:

- seller belum siap di lokasi;
- jam pickup tidak cocok;
- area seller lebih cocok drop-off daripada pickup.

Solusi cepat:

- gunakan opsi **Antar ke Gerai** jika tersedia dan lebih cepat.

---

## Checklist Praktis Per Orang

### Iqbal — Buyer utama

- [x] daftar akun dan login;
- [x] lengkapi profil dasar;
- [x] isi alamat pengiriman lengkap;
- [ ] pilih produk dari seller;
- [ ] checkout dengan metode **shipping**;
- [ ] pilih layanan ongkir yang tersedia;
- [ ] bayar invoice sampai sukses;
- [ ] pantau tracking;
- [ ] terima paket;
- [ ] konfirmasi order selesai.

### Tiara — Seller utama untuk order delivered

- [ ] daftar akun dan login;
- [ ] isi profil seller;
- [ ] isi alamat seller atau alamat pickup;
- [ ] isi rekening bank;
- [ ] upload minimal 1 produk ringan;
- [ ] siapkan barang ketika buyer sudah bayar;
- [ ] packing dengan aman;
- [ ] tempel label pengiriman di paket;
- [ ] kirim via Biteship;
- [ ] simpan Order ID Biteship untuk bukti delivered.

### Fathim — Seller utama untuk order cancelled

- [ ] daftar akun dan login;
- [ ] isi profil seller;
- [ ] isi alamat seller;
- [ ] isi rekening bank;
- [ ] upload minimal 1 produk;
- [ ] bantu buyer membuat order kedua;
- [ ] lakukan skenario pembatalan sesuai alur operasional;
- [ ] simpan Order ID Biteship jika status cancelled sudah terbentuk.

### Ichlas — Seller pendukung

- [ ] daftar akun dan login;
- [ ] isi profil seller;
- [ ] isi alamat seller;
- [ ] isi rekening bank;
- [ ] upload minimal 1 produk cadangan;
- [ ] siap jadi backup kalau seller utama berhalangan;
- [ ] bantu dokumentasi screenshot bila diperlukan.

### Rava — Seller pendukung dan dokumentasi

- [ ] daftar akun dan login;
- [ ] isi profil seller;
- [ ] isi alamat seller;
- [ ] isi rekening bank;
- [ ] upload minimal 1 produk cadangan;
- [ ] catat timeline transaksi tim;
- [ ] simpan screenshot dashboard order;
- [ ] simpan screenshot dashboard Biteship;
- [ ] kumpulkan Order ID delivered dan cancelled.

## Urutan Eksekusi Hari-H dalam 10 Langkah

1. **Iqbal** login dan pastikan alamat pengiriman sudah lengkap.
2. **Tiara** login dan pastikan alamat seller serta rekening sudah terisi.
3. **Tiara** upload atau cek 1 produk yang siap dijual dan siap dikirim.
4. **Iqbal** pilih produk Tiara lalu checkout dengan metode **shipping**.
5. **Iqbal** pilih ongkir, lalu bayar invoice sampai sukses.
6. **Tiara** buka order yang sudah confirmed lalu siapkan dan packing barang.
7. **Tiara** buat pengiriman via Biteship dan pilih **pickup** atau **drop-off** sesuai layanan yang tersedia.
8. **Rava** atau **Ichlas** simpan screenshot order dan catat **Biteship Order ID**.
9. Tunggu tracking berjalan sampai status **delivered**, lalu **Iqbal** konfirmasi barang diterima.
10. Jika perlu bukti tambahan, ulangi flow bersama **Fathim** untuk membuat 1 order dengan status **cancelled**.

## Kesimpulan Praktis

Kalau ingin paling cepat berhasil, lakukan ini:

1. buyer isi alamat lengkap;
2. Tiara isi alamat seller dan rekening;
3. Tiara upload barang yang ringan;
4. buyer checkout dengan metode shipping;
5. buyer bayar invoice;
6. Tiara packing sendiri dengan kardus atau poly mailer;
7. pilih pickup atau drop-off sesuai rate yang tersedia;
8. seller kirim via Biteship;
9. tunggu sampai delivered;
10. copy **Biteship Order ID** dari dashboard.

Jika ingin approval lebih kuat, ulangi sekali lagi dengan Fathim untuk membuat order cancelled.
