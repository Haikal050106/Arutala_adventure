# Laporan Audit Rekonstruksi 25 Transaksi

**Tanggal audit:** 20 November 2026  
**Ruang lingkup:** Rekonstruksi baris item dari log development dan pencocokan dengan header transaksi yang ada. Audit bersifat read-only. Tidak ada perubahan pada database, stok, status, atau log; item tidak dimasukkan kembali.

## Ringkasan

- Ditemukan **7 insert `order_items`** untuk 6 pesanan dan **28 insert `rental_items`** untuk 19 penyewaan di [development.log](../backend/log/development.log).
- Setiap item dapat dipetakan ke ID transaksi yang masih ada. Jumlah subtotal item untuk **seluruh 25 header cocok dengan total header**.
- Pada [development.sqlite3](../backend/storage/development.sqlite3), saat audit terdapat **0 baris `order_items` dan 0 baris `rental_items`**. Sequence SQLite menunjukkan high-water mark 7 dan 28. Dengan demikian, log membuktikan insert pernah tercatat, tetapi bukan pengganti detail yang saat ini tersimpan di database.
- Total header pesanan: **Rp6.338.000**. Total header penyewaan: **Rp1.770.000**.
- Nama produk di laporan dipetakan dari `product_id` ke nama produk **saat audit**. Nama historis tidak disimpan dalam sebagian besar insert item.

## Metode dan batas bukti

1. Membaca database development dalam mode read-only untuk mengambil ID, nomor transaksi, status, total header, dan status pembayaran.
2. Mem-parsing pernyataan SQL `INSERT` item di log, lalu mengelompokkan berdasarkan `order_id` atau `rental_id`.
3. Membandingkan jumlah seluruh `subtotal` item dengan `total_amount` header.
4. Tidak menjalankan seed, migrasi, pemulihan, atau query tulis.

Rujukan utama: [development.log](../backend/log/development.log), [development.sqlite3](../backend/storage/development.sqlite3), dan [test.log](../backend/log/test.log). `test.log` tidak memuat nomor transaksi yang sama. Tidak ditemukan file backup database di workspace yang diperiksa.

## Pesanan pembelian

Semua nominal dalam rupiah. Nomor baris merujuk ke pernyataan insert item dalam log.

| DB ID / Referensi | Status header | Item dari insert log | Subtotal item | Cocok dengan header | Pembayaran di DB |
|---|---|---|---:|---|---|
| 1 · `AA-261029-E70A2DD6` | confirmed | 1 × Tenda Quechua 2 orang (produk 2) × Rp800.000 = Rp800.000 ([L4023](../backend/log/development.log#L4023)) | Rp800.000 | Ya · Rp800.000 | QRIS succeeded · Rp800.000 |
| 2 · `AA-261029-1DCC3E10` | cancelled | 1 × Tenda Quechua 2 orang (produk 2) × Rp800.000 = Rp800.000 ([L4390](../backend/log/development.log#L4390)) | Rp800.000 | Ya · Rp800.000 | QRIS failed · Rp800.000 |
| 3 · `AA-261101-46F4C986` | confirmed | 3 × Tenda Quechua 2 orang (produk 2) × Rp800.000 = Rp2.400.000 ([L26861](../backend/log/development.log#L26861)) | Rp2.400.000 | Ya · Rp2.400.000 | Tunai succeeded · Rp2.400.000 |
| 4 · `AA-261101-11D61758` | confirmed | 5 × Tracking Pole (produk 4) × Rp123.000 = Rp615.000 ([L28844](../backend/log/development.log#L28844)) | Rp615.000 | Ya · Rp615.000 | Tunai succeeded · Rp615.000 |
| 5 · `AA-261104-4EF54853` | confirmed | 1 × Tenda Quechua 2 orang (produk 2) × Rp800.000 = Rp800.000 ([L46694](../backend/log/development.log#L46694)); 1 × Tracking Pole (produk 4) × Rp123.000 = Rp123.000 ([L46696](../backend/log/development.log#L46696)) | Rp923.000 | Ya · Rp923.000 | Tunai succeeded · Rp923.000 |
| 6 · `AA-261106-62753B11` | confirmed | 1 × Tenda Quechua 2 orang (produk 2) × Rp800.000 = Rp800.000 ([L52191](../backend/log/development.log#L52191)) | Rp800.000 | Ya · Rp800.000 | Tunai succeeded · Rp800.000 |

**Rekap pesanan:** 7 insert item; subtotal terakumulasi Rp6.338.000, sama dengan total keenam header.

## Penyewaan

Harga adalah harga per hari. Rentang tanggal dan jumlah hari mengikuti nilai pada insert log.

| DB ID / Referensi | Status header | Item dari insert log | Subtotal item | Cocok dengan header | Pembayaran di DB |
|---|---|---|---:|---|---|
| 1 · `SEWA-261029-99290023` | returned | 2 × Tenda Quechua 2 orang (produk 2), 2026-10-30–2026-10-31, 1 hari × Rp35.000 = Rp70.000 ([L2270](../backend/log/development.log#L2270)) | Rp70.000 | Ya · Rp70.000 | Tidak ada baris pembayaran |
| 2 · `SEWA-261030-0DAF5B82` | returned | 2 × Tracking Pole (produk 4), 2026-11-01–2026-11-02, 1 hari × Rp15.000 = Rp30.000 ([L12940](../backend/log/development.log#L12940)) | Rp30.000 | Ya · Rp30.000 | Tidak ada baris pembayaran |
| 3 · `SEWA-261030-AD0D4B79` | returned | 1 × Tenda Quechua 2 orang (produk 2), 2027-02-01–2027-02-03, 2 hari × Rp35.000 = Rp70.000 ([L16087](../backend/log/development.log#L16087)) | Rp70.000 | Ya · Rp70.000 | Tidak ada baris pembayaran |
| 4 · `SEWA-261030-F25976E7` | returned | 5 × Tenda Quechua 2 orang (produk 2), 2026-11-03–2026-11-04, 1 hari × Rp35.000 = Rp175.000 ([L16702](../backend/log/development.log#L16702)); 5 × Tracking Pole (produk 4), tanggal sama, 1 hari × Rp15.000 = Rp75.000 ([L16704](../backend/log/development.log#L16704)) | Rp250.000 | Ya · Rp250.000 | Tidak ada baris pembayaran |
| 5 · `SEWA-261030-B628E496` | returned | 10 × Tracking Pole (produk 4), 2026-11-01–2026-11-02, 1 hari × Rp15.000 = Rp150.000 ([L17442](../backend/log/development.log#L17442)) | Rp150.000 | Ya · Rp150.000 | Tidak ada baris pembayaran |
| 6 · `SEWA-261030-40E2E023` | returned | 6 × Tenda Quechua 2 orang (produk 2), 2026-11-04–2026-11-05, 1 hari × Rp35.000 = Rp210.000 ([L18899](../backend/log/development.log#L18899)) | Rp210.000 | Ya · Rp210.000 | Tidak ada baris pembayaran |
| 7 · `SEWA-261031-87F0D4EB` | returned | 6 × Tracking Pole (produk 4), 2026-11-02–2026-11-03, 1 hari × Rp15.000 = Rp90.000 ([L20073](../backend/log/development.log#L20073)) | Rp90.000 | Ya · Rp90.000 | Tidak ada baris pembayaran |
| 8 · `SEWA-261101-2B3066EB` | returned | 3 × Tenda Quechua 2 orang (produk 2), 2026-11-06–2026-11-07, 1 hari × Rp35.000 = Rp105.000 ([L21222](../backend/log/development.log#L21222)) | Rp105.000 | Ya · Rp105.000 | Tidak ada baris pembayaran |
| 9 · `SEWA-261101-D99E8ABD` | returned | 3 × Tenda Quechua 2 orang (produk 2), 2026-11-06–2026-11-07, 1 hari × Rp35.000 = Rp105.000 ([L21539](../backend/log/development.log#L21539)) | Rp105.000 | Ya · Rp105.000 | Tidak ada baris pembayaran |
| 10 · `SEWA-261101-E8E7BD31` | returned | 1 × Tenda Quechua 2 orang (produk 2), 2026-11-10–2026-11-11, 1 hari × Rp35.000 = Rp35.000 ([L23612](../backend/log/development.log#L23612)) | Rp35.000 | Ya · Rp35.000 | Tidak ada baris pembayaran |
| 11 · `SEWA-261101-8F20F403` | returned | 2 × Tracking Pole (produk 4), 2026-11-03–2026-11-05, 2 hari × Rp15.000 = Rp60.000 ([L25822](../backend/log/development.log#L25822)) | Rp60.000 | Ya · Rp60.000 | Gateway pending · Rp60.000 |
| 12 · `SEWA-261101-A027A949` | returned | 2 × Tenda Quechua 2 orang (produk 2), 2026-11-03–2026-11-04, 1 hari × Rp35.000 = Rp70.000 ([L27874](../backend/log/development.log#L27874)); 2 × Tracking Pole (produk 4), tanggal sama, 1 hari × Rp15.000 = Rp30.000 ([L27876](../backend/log/development.log#L27876)) | Rp100.000 | Ya · Rp100.000 | Tidak ada baris pembayaran |
| 13 · `SEWA-261102-89F5F7C7` | rejected | 1 × Tracking Pole (produk 4), 2026-11-12–2026-11-13, 1 hari × Rp15.000 = Rp15.000 ([L37760](../backend/log/development.log#L37760)); 1 × Tenda Quechua 2 orang (produk 2), tanggal sama, 1 hari × Rp35.000 = Rp35.000 ([L37762](../backend/log/development.log#L37762)) | Rp50.000 | Ya · Rp50.000 | Tidak ada baris pembayaran |
| 14 · `SEWA-261102-B26B75F3` | returned | 3 × Tracking Pole (produk 4), 2026-11-02–2026-11-03, 1 hari × Rp15.000 = Rp45.000 ([L42462](../backend/log/development.log#L42462)) | Rp45.000 | Ya · Rp45.000 | Tunai succeeded · Rp45.000 |
| 15 · `SEWA-261102-76389524` | returned | 2 × Tenda Quechua 2 orang (produk 2), 2026-11-02–2026-11-03, 1 hari × Rp35.000 = Rp70.000 ([L45328](../backend/log/development.log#L45328)) | Rp70.000 | Ya · Rp70.000 | Tunai succeeded · Rp70.000 |
| 16 · `SEWA-261104-0C093F2C` | returned | 1 × Tenda Quechua 2 orang (produk 2), 2026-11-28–2026-11-30, 2 hari × Rp35.000 = Rp70.000 ([L46295](../backend/log/development.log#L46295)); 2 × Tracking Pole (produk 4), tanggal sama, 2 hari × Rp15.000 = Rp60.000 ([L46297](../backend/log/development.log#L46297)) | Rp130.000 | Ya · Rp130.000 | Tunai succeeded · Rp130.000 |
| 17 · `SEWA-261106-95F39DDF` | returned | 1 × Kompor (produk 10), 2026-11-07–2026-11-08, 1 hari × Rp10.000 = Rp10.000 ([L55166](../backend/log/development.log#L55166)); 1 × Tenda Wildsheel kap. 4 (produk 5), 1 hari × Rp45.000 = Rp45.000 ([L55168](../backend/log/development.log#L55168)); 1 × Sepatu (produk 8), 1 hari × Rp15.000 = Rp15.000 ([L55170](../backend/log/development.log#L55170)); 1 × Tenda Quechua 2 orang (produk 2), 1 hari × Rp35.000 = Rp35.000 ([L55172](../backend/log/development.log#L55172)) | Rp105.000 | Ya · Rp105.000 | Tunai succeeded · Rp105.000 |
| 18 · `SEWA-261116-1C0D5CBC` | returned | 1 × Backpack (produk 9), 2026-11-16–2026-11-17, 1 hari × Rp15.000 = Rp15.000 ([L60678](../backend/log/development.log#L60678)); 1 × Kompor (produk 10), 1 hari × Rp10.000 = Rp10.000 ([L60680](../backend/log/development.log#L60680)); 1 × Tenda Wildsheel kap. 4 (produk 5), 1 hari × Rp45.000 = Rp45.000 ([L60682](../backend/log/development.log#L60682)) | Rp70.000 | Ya · Rp70.000 | Tunai succeeded · Rp70.000 |
| 19 · `SEWA-261119-BD222449` | returned | 1 × Sepatu (produk 8), 2026-11-20–2026-11-21, 1 hari × Rp25.000 = Rp25.000. Insert juga memuat snapshot varian: Trail run, Putih, ukuran 40, opsi `{}`, desain `desain` ([L85787](../backend/log/development.log#L85787)) | Rp25.000 | Ya · Rp25.000 | Tunai succeeded · Rp25.000 |

**Rekap penyewaan:** 28 insert item; subtotal terakumulasi Rp1.770.000, sama dengan total 19 header.

## Pembayaran dan implikasi laporan

Status berikut berasal dari header/payment yang ada, bukan dari insert item:

- **11 pembayaran succeeded, Rp5.983.000:** pembelian Rp5.538.000 dan penyewaan Rp445.000.
- **1 pembayaran pending, Rp60.000:** terkait penyewaan 11 yang sudah berstatus returned. Tetap pending; perlu rekonsiliasi provider sebelum status ditafsirkan.
- **1 pembayaran failed, Rp800.000:** terkait pesanan 2 yang cancelled.
- **11 penyewaan returned tanpa baris pembayaran**, dengan total header Rp1.215.000. Tidak adanya baris pembayaran membuktikan bahwa ledger lokal tidak merekam pembayaran; hal itu sendiri tidak membuktikan apakah pembayaran dilakukan di luar sistem.

Laporan pendapatan yang hanya menjumlahkan pembayaran succeeded tidak menghitung pembayaran pending/failed maupun transaksi tanpa baris pembayaran. Hilangnya detail item juga membuat agregasi produk laporan tidak dapat dibangun dari database saat ini.

## Informasi yang tidak tersedia atau belum dapat dipastikan

- Sebagian besar insert item menyimpan `product_id`, bukan nama produk atau snapshot nama. Nama pada tabel di atas adalah nama produk saat audit; nama historis saat transaksi dibuat tidak dapat dibuktikan dari insert tersebut.
- Insert item tidak membuktikan pembayaran diterima, kondisi barang saat kembali, ataupun stok awal.
- Untuk penyewaan 17, insert menyebut produk “Sepatu” tetapi tidak menyimpan varian fisik/ukuran. Sebaliknya, insert penyewaan 19 menyimpan snapshot varian.
- Insert tidak menjelaskan mengapa baris item sekarang hilang. File [development.log](../backend/log/development.log) yang tersedia tidak menunjukkan pernyataan `DELETE` item yang menjelaskan kehilangan itu.
- Satu transaksi memiliki indikator uji kuat dari konteks pembuatan yang berdekatan di log: `SEWA-261030-AD0D4B79` mencantumkan “Verifikasi integrasi” dan identitas sintetis. Ini indikator dari log transaksi, **bukan** isi insert item. Transaksi lain tidak ditetapkan sebagai uji hanya berdasarkan kemiripan pola atau tanggal.
- Tiga belas penyewaan berstatus returned memiliki `actual_returned_at` yang mendahului tanggal mulai pada detail insert. Hal ini anomali untuk dikonfirmasi; bukan bukti tunggal bahwa semuanya data uji.

Tidak ada bukti yang cukup untuk menetapkan penyebab hilangnya baris. Kemungkinan yang perlu diuji tanpa mengasumsikan penyebab: penghapusan di luar log aplikasi, penggunaan/penyalinan snapshot database yang berbeda, atau perbedaan waktu/sumber antara database dan log. Tidak satu pun dapat dipastikan dari bukti lokal ini.

## Rekomendasi

1. Simpan laporan dan pertahankan file database serta log asli sebagai bukti; jangan memasukkan kembali item hanya dari log.
2. Cocokkan hasil ini dengan backup/snapshot production atau sumber audit independen sebelum menyimpulkan bahwa transaksi telah lengkap secara operasional.
3. Verifikasi 11 penyewaan returned tanpa pembayaran, pembayaran pending Rp60.000, serta anomali tanggal dan stok melalui catatan operasional/provider.
4. Jika nanti pemulihan dipertimbangkan, minta persetujuan terlebih dahulu dan lakukan rekonsiliasi terpisah atas stok, status, dan laporan. Laporan ini sendiri tidak melakukan perubahan tersebut.
