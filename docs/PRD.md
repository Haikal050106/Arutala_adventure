# PRD — Arutala Adventure

## Ringkasan

Arutala Adventure adalah website pelanggan untuk menemukan perlengkapan pendakian yang dapat dibeli atau disewa, mengirim pesanan pembelian atau booking penyewaan, dan melihat informasi usaha. Katalog, autentikasi, checkout pembelian, booking penyewaan, serta riwayat transaksi dan pembayaran terhubung ke API Rails. Checkout pelanggan membuat transaksi yang belum dibayar; pembayaran dilakukan langsung di toko dan dicatat kasir melalui POS ke Payment Ledger. Integrasi Midtrans tetap dipertahankan di backend untuk kompatibilitas ledger/notifikasi lama, tetapi tidak digunakan atau ditawarkan pada alur pelanggan. Modul internal lama tetap berada di source project, tetapi tidak menjadi bagian dari navigasi website pelanggan pada tahap ini.

## Teknologi

- React 19 dan Vite 6.
- JavaScript dengan JSX. Source aplikasi tidak menggunakan TypeScript.
- Tailwind CSS 4 melalui plugin Vite; styling komponen ditulis langsung pada `className`.
- Lucide React untuk ikon.
- `clsx` dan `tailwind-merge` melalui helper `cn` di `frontend/src/lib/utils.js`.
- Alias `@/` mengarah ke `frontend/src/`, dikonfigurasi di `frontend/vite.config.js`.
- `frontend/components.json` tersedia untuk konfigurasi gaya shadcn. Komponen UI saat ini merupakan komponen lokal; tidak ada dependency `shadcn/ui` runtime.
- `react-router-dom` digunakan oleh satu `BrowserRouter` di `frontend/src/main.jsx`. Rute `/admin/*` diarahkan ke `frontend/src/App.jsx`, sedangkan rute website pelanggan tetap ditangani `frontend/src/CustomerApp.jsx`.
- Produk dan kategori katalog pelanggan dimuat dari API Rails; autentikasi pelanggan memakai endpoint Rails dan token sesi terpisah di `sessionStorage`. Keranjang disimpan lokal; order pembelian dan booking sewa baru serta riwayat pelanggan disimpan di API Rails, sedangkan booking demo lama tetap lokal.
- Keranjang dan booking demo sewa pelanggan disimpan pada `localStorage` dengan key berawalan `arutala-customer-`; token pelanggan dan token Admin/Kasir memakai key terpisah di `sessionStorage`. Order pembelian pelanggan disimpan dan dibaca melalui API Rails.

## Struktur Project

```text
.
├── .gitignore
├── README.md
├── docs/
│   └── PRD.md
├── frontend/
│   ├── components.json
│   ├── index.html
│   ├── package.json
│   ├── package-lock.json
│   ├── .env.example
│   ├── vite.config.js
│   ├── eslint.config.js
│   ├── public/
│   │   └── arutala-logo-transparent.png
│   └── src/
│       ├── App.jsx
│       ├── main.jsx
│       ├── index.css
│       ├── assets/
│       ├── components/
│       ├── data/
│       ├── lib/
│       └── pages/
└── backend/
    ├── app/
    ├── config/
    ├── db/
    ├── test/
    └── Gemfile
```

## Fitur yang Sudah Tersedia

- **Beranda pelanggan:** pengenalan Arutala Adventure, akses ke pembelian dan penyewaan, kategori, produk unggulan, dan ajakan menghubungi toko.
- **Katalog dan detail produk:** pencarian nama/kategori, filter kategori dari API, pilihan beli atau sewa, foto API dengan fallback ilustrasi, deskripsi, harga dan stok katalog dari API, serta estimasi ketersediaan browser.
- **Keranjang:** menambah produk, mengubah jumlah, menghapus item, dan melihat subtotal. Keranjang tetap lokal; harga dan stok order pembelian selalu divalidasi ulang di server.
- **Checkout pembelian:** pelanggan yang masuk dapat membuat order barang melalui `POST /api/v1/customer/orders`. Server menentukan pelanggan dari sesi bearer, menghitung harga/total dari katalog, memvalidasi stok termasuk order pending, dan mengembalikan nomor serta status pesanan. Kunci idempotensi mencegah retry membuat order ganda.
- **Booking penyewaan:** pelanggan yang masuk dapat mengirim item sewa dari keranjang secara terpisah melalui `POST /api/v1/customer/rentals`. Server menghitung tarif dan total, memvalidasi tanggal (mulai tidak boleh lampau dan tanggal kembali harus setelah mulai), alamat, jumlah, dan ketersediaan periode. Booking `pending_confirmation` menahan kapasitas per tanggal tanpa mengurangi stok fisik; konfirmasi staf memotong stok tersedia satu kali. Idempotency key mencegah retry membuat booking ganda.
- **Pembayaran tunai:** Admin/Kasir mencatat pembayaran Order atau Rental melalui endpoint pembayaran bertingkat yang sama. Dialog POS menampilkan sisa tagihan server, menerima nominal uang, memvalidasi agar tidak kurang, dan menghitung kembalian. Setelah uang diterima dan dicatat, Payment berstatus succeeded dengan nominal pembayaran, waktu, referensi, nominal uang diterima, kembalian, serta ID kasir pembuat dan pengonfirmasi tersimpan di ledger. Pembayaran parsial diperbolehkan API; status pembayaran (`unpaid`, `partially_paid`, `paid`) dihitung terpisah dari status transaksi dan stok. Kunci idempotensi mencegah catatan ganda.
- **Pembayaran QRIS POS:** Kasir dapat membuat pembayaran QRIS statis dengan nominal sisa tagihan penuh untuk Order atau Rental. Ledger menyimpan status awal pending dan ID kasir pembuat; kasir hanya mengubahnya menjadi succeeded setelah memverifikasi aplikasi merchant atau mutasi bank. Waktu pembayaran dan ID kasir yang mengonfirmasi dicatat. Pembayaran pending tidak dihitung sebagai lunas dan dapat dibatalkan bersama transaksi sesuai aturan status yang berlaku; order atau rental mengikuti transisi fulfillment yang sudah berlaku setelah lunas. Gambar barcode statis toko diunggah pada POS dan tersimpan di browser/perangkat POS tersebut; pelanggan tidak mengunggah bukti transfer.
- **Pembayaran pelanggan di toko:** checkout pembelian atau booking sewa hanya membuat transaksi dengan status pembayaran belum lunas. Pelanggan membayar langsung di toko Arutala Adventure; kasir memverifikasi uang yang diterima lalu mencatat pembayaran melalui POS. Halaman konfirmasi dan akun menampilkan status pesanan serta ringkasan pembayaran dari backend/Payment Ledger. Tidak ada redirect, Snap popup, tombol pembayaran online, callback frontend, atau pemanggilan API pembayaran Midtrans dari halaman pelanggan.
- **Konfirmasi dan riwayat pembelian:** halaman `/pesanan/:orderId` dan akun pelanggan memuat order dari API yang dibatasi ke pemiliknya. Pelanggan dapat membatalkan pesanan berstatus menunggu konfirmasi atau dikonfirmasi melalui endpoint milik pelanggan; pembatalan pada status terkonfirmasi mengembalikan stok secara atomik. Pesanan yang sedang diproses, selesai, atau sudah dibatalkan tidak dapat dibatalkan. Item sewa dalam keranjang tidak ikut checkout dan tetap tersimpan.
- **Akun pelanggan:** registrasi dan login melalui API Rails, profil dari server, serta logout yang mencabut sesi server. Riwayat pembelian dan booking sewa dimuat dari endpoint pelanggan sesuai kepemilikan.
- **Informasi usaha:** halaman tentang, galeri ilustrasi perlengkapan, lokasi, dan kontak toko.
- **Navigasi responsif:** navigasi pelanggan melalui React Router, header mobile, logo transparan, dan footer dengan tautan penting.
- **Batasan operasional:** Midtrans Sandbox, endpoint backend, dan webhook signature tetap dipertahankan untuk kompatibilitas Payment Ledger/notifikasi lama, tetapi bukan metode pembayaran pada website pelanggan. Refund, pemrosesan refund sebagian/chargeback, dan sinkronisasi booking demo sewa lama yang sudah tersimpan lokal belum tersedia. Pembayaran sukses yang datang terlambat setelah transaksi dibatalkan tetap dicatat di ledger, tetapi tidak menghidupkan kembali transaksi atau memenuhi pesanan otomatis.

## Batasan Implementasi Saat Ini

- Keranjang disimpan pada browser; order pembelian dan booking sewa baru serta riwayat pelanggan dibaca dari backend. Booking demo sewa yang sudah tersimpan lokal tidak otomatis dimigrasikan.
- Checkout pelanggan tidak memulai Midtrans dan tidak mengubah Payment menjadi lunas. Status internal Order/Rental awal tetap `pending_confirmation` untuk mempertahankan aturan reservasi, stok, pembatalan, dan fulfillment; untuk transaksi yang belum lunas, website pelanggan menampilkan status “Menunggu Pembayaran”. Pembayaran tunai dan QRIS statis hanya dicatat melalui POS oleh Admin/Kasir setelah diterima/diperiksa. Gambar QRIS disimpan di localStorage browser POS, sehingga perlu diunggah pada setiap browser/perangkat kasir. Endpoint dan webhook Midtrans tetap ada untuk kompatibilitas backend/ledger lama, tetapi frontend pelanggan tidak memanggil endpoint pembayaran tersebut. Refund belum tersedia. Endpoint order pembelian dan rental pelanggan terpisah dan hanya menerima role `customer`; endpoint order/rental operasional tetap mensyaratkan role Admin/Kasir.
- Foto produk dan galeri menggunakan ilustrasi dari Unsplash, bukan dokumentasi stok aktual.

### Konfigurasi Midtrans Sandbox

- Backend memerlukan `MIDTRANS_ENV=sandbox`, `MIDTRANS_SERVER_KEY`, dan `MIDTRANS_CLIENT_KEY`. Server Key wajib dirahasiakan di environment Rails/Kamal dan tidak pernah dikirim ke browser. Client Key bersifat publik dan hanya digunakan oleh Snap.js Sandbox.
- Webhook yang didaftarkan untuk integrasi lama: `POST /api/v1/webhooks/midtrans`. Endpoint ini tidak memakai sesi User; signature diverifikasi sebelum API status Midtrans dipanggil.
- Endpoint pembuatan pembayaran Midtrans untuk pelanggan sudah dinonaktifkan. `POST /api/v1/customer/payments/:payment_id/refresh` hanya dipertahankan untuk ledger/payment gateway lama dan memerlukan bearer token pelanggan serta membatasi akses pada transaksi miliknya. Website pelanggan tidak memanggil endpoint Midtrans.
- Checkout menggunakan saldo dari database; nominal frontend tidak menjadi sumber otoritatif. Callback hanya memperbarui Payment Ledger, bukan status pemenuhan atau stok.

## Struktur Menu dan Navigasi

### Kondisi Navigasi Saat Ini

- Website pelanggan tetap dimuat melalui `frontend/src/CustomerApp.jsx`. Area Admin tersedia terpisah pada `/admin` dan dirutekan dari `frontend/src/main.jsx`.
- Login Admin/Kasir tersedia pada `/admin/login` melalui API Rails. Token bearer disimpan dalam `sessionStorage`, sesi diperiksa kembali lewat endpoint backend, dan logout mencabut token pada server. Role Admin/Kasir divalidasi di backend; perlindungan frontend hanya untuk navigasi. Tinjau keamanan deployment dan mitigasi XSS sebelum penggunaan produksi.
- Area Admin menyediakan Dashboard dan modul Produk, Kategori, Pesanan, Penyewaan, Pelanggan, Penjualan (POS), serta Laporan. Produk, Kategori, Pesanan, Pelanggan, POS, dan Penyewaan memakai API Rails; Dashboard dan Laporan masih memakai data demo lokal.
- Sesi akun dan profil pelanggan divalidasi oleh API Rails; katalog produk/kategori, order pembelian, booking sewa, dan riwayat transaksi pelanggan juga dibaca dari API.

### 1. User / Pelanggan

Menu pelanggan berikut memakai API katalog/transaksi dan masih dapat memiliki data booking demo lama yang tersimpan lokal. Booking sewa baru disimpan di backend. Pembayaran transaksi baru dilakukan di toko dan dicatat kasir melalui POS; Midtrans tidak digunakan dari halaman pelanggan.

| Menu rancangan | Fungsi | Status berdasarkan kode |
|---|---|---|
| Beranda pelanggan | Menampilkan pengenalan, kategori, produk unggulan, serta akses ke pembelian dan penyewaan. | Tersedia pada `/`. |
| Katalog produk | Mencari dan melihat perlengkapan yang dijual atau disewakan serta memfilter kategori. | Tersedia pada `/katalog`; produk dan kategori dimuat dari endpoint publik `GET /api/v1/products` dan `GET /api/v1/categories`. |
| Detail produk & ketersediaan | Menampilkan foto, harga, stok katalog, deskripsi, dan pilihan sewa. | Tersedia pada `/produk/:productId` berdasarkan katalog API; ketersediaan yang terlihat adalah estimasi browser dan keputusan akhir dilakukan server saat checkout pembelian. |
| Booking penyewaan | Memilih rentang tanggal dan jumlah, lalu mengirim permintaan booking. | Keranjang menyimpan item sewa secara lokal. Checkout `/checkout-sewa` mengirim item sewa saja ke `POST /api/v1/customer/rentals`; harga dihitung server dan booking pending diperiksa terhadap ketersediaan rentang tanggal. Booking pending tidak memotong stok fisik; konfirmasi staf memotong stok sekali dan memvalidasi ketersediaan aktual. Idempotency key mencegah booking ganda saat retry. |
| Keranjang & checkout pembelian | Meninjau barang/booking, jumlah, subtotal, lalu mengirim transaksi secara terpisah. | Keranjang pada `/keranjang` tetap tersimpan lokal dan menyediakan checkout terpisah. Checkout `/checkout` mengirim item pembelian saja ke `POST /api/v1/customer/orders`; item sewa tidak ikut transaksi tersebut. Checkout hanya membuat pesanan berstatus pembayaran belum lunas. Pelanggan membayar langsung di toko; kasir mencatat pembayaran melalui POS setelah uang diterima. |
| Pesanan / booking & riwayat pembayaran saya | Melihat status transaksi dan pembayaran, periode sewa, alamat desa/kelurahan untuk penyewaan, riwayat transaksi, struk digital yang dapat dicetak, dan membatalkan pesanan pembelian yang memenuhi syarat. | Order dan booking dari server dimuat pada `/akun`; ledger Payment terkait ditampilkan sesuai kepemilikan. Transaksi yang belum lunas ditampilkan sebagai “Menunggu Pembayaran”; pelanggan dapat melihat sisa tagihan dan instruksi membayar di toko. Status pembayaran hanya berubah setelah kasir mencatat pembayaran melalui POS dan dibaca kembali dari backend. Callback frontend tidak menjadi sumber status. Struk menampilkan status Payment dan dapat dicetak. Pembatalan hanya berlaku untuk order yang memenuhi syarat dan belum memiliki Payment pending/sukses. |
| Akun pelanggan | Login, registrasi, profil dasar, dan logout. | `/masuk` dan `/daftar` memakai `POST /api/v1/auth/customer/login` dan `/api/v1/auth/customer/register`. Registrasi meminta nama, email, telepon, kata sandi minimal 12 karakter, dan konfirmasi kata sandi; kolom dimulai kosong dan autofill dinonaktifkan. Token bearer disimpan dalam `sessionStorage` dengan key berbeda dari sesi Admin/Kasir, diverifikasi melalui `/api/v1/auth/me`, dan dicabut melalui `/api/v1/auth/logout`. Profil diisi dari respons API; role pelanggan tetap tidak memiliki akses ke endpoint staf. |
| Informasi usaha & galeri | Melihat profil, lokasi, kontak, dan ilustrasi perlengkapan. | Tersedia pada `/tentang`, `/kontak`, dan `/galeri`. |

### 2. Admin

Daftar berikut menggambarkan cakupan Admin bertahap. Login dan otorisasi role sudah terhubung ke backend; modul Produk, Kategori, Pesanan, Pelanggan, Penjualan (POS), dan Penyewaan juga menggunakan API Rails, sedangkan Dashboard dan Laporan masih memakai data demo lokal.

| Menu | Fungsi | Status berdasarkan kode |
|---|---|---|
| Login Admin | Login staf dan membatasi akses berdasarkan role Admin/Kasir. | Tersedia pada `/admin/login` dengan bearer token backend; akun Admin pertama dibuat melalui task Rails, akun tidak ditanam di source code. |
| Dashboard | Melihat pendapatan aktual dari Payment sukses, transaksi pembelian/penyewaan, pelanggan online/offline, grafik pendapatan, produk terlaris, barang paling sering disewa, antrean pesanan/booking, dan filter tanggal. | Tersedia pada `/admin` dari `GET /api/v1/dashboard` menggunakan database Rails dan role Admin/Kasir. Pendapatan dihitung satu kali per Payment berstatus `succeeded`, dikelompokkan terpisah untuk Order/Rental berdasarkan `paid_at`; jumlah transaksi, pelanggan, item terlaris, dan antrean memakai rentang tanggal yang dipilih. |
| Produk | Mencari, memfilter, menambah, mengubah, dan menghapus katalog, harga, stok, kategori, deskripsi, serta URL foto. | Tersedia pada `/admin/products`; daftar dan CRUD tersambung ke API Rails (`/api/v1/products`) dan memerlukan sesi Admin untuk perubahan. |
| Kategori | Mencari dan melakukan CRUD kategori. | Tersedia pada `/admin/categories`; daftar dan CRUD tersambung ke API Rails (`/api/v1/categories`) dan kategori yang masih dipakai produk tidak dapat dihapus. |
| Pesanan pelanggan | Mencari dan memfilter pesanan berdasarkan status, termasuk pesanan yang dibatalkan pelanggan. | Tersedia pada `/admin/orders`; daftar dimuat dari `GET /api/v1/orders` menggunakan sesi Admin/Kasir. Status backend seperti `cancelled` ditampilkan sebagai `Dibatalkan`, konsisten dengan akun pelanggan. Pesanan yang sama tidak digabungkan dengan data demo lokal. |
| Penyewaan & pengembalian | Melihat/filter seluruh booking, detail pelanggan dan item, menyetujui/menolak, mencatat serah-terima dan pengembalian beserta kondisi tiap barang, serta melihat riwayat status dan pembayaran. | Kasir membuat penyewaan baru pada tab **Kasir Penyewaan** di `/admin/pos`; riwayat booking online dan transaksi sewa ada pada tab **Riwayat Penyewaan**/sidebar `/admin/rentals`. Semua memakai halaman/model dan API Rails yang sama. Booking pelanggan online tetap menunggu persetujuan Admin/Kasir. Booking yang dibuat kasir melalui POS langsung melewati transisi konfirmasi backend sebelum pembayaran, dengan validasi ketersediaan ulang. Pembayaran Cash/QRIS tercatat pada ledger; QRIS tetap pending sampai kasir memverifikasi dana. Hanya booking lunas dapat diserahterimakan; saat itu stok dikurangi satu kali. Pembatalan sebelum serah-terima melepas reservasi tanpa mengubah stok. Pengembalian menambah stok hanya untuk unit berkondisi baik; barang rusak/hilang tidak distok kembali. Keterlambatan ditandai dari tanggal kembali terjadwal; denda belum tersedia karena belum ada aturan tarif denda. |
| Pelanggan | Mencari, menambah, mengubah, dan menghapus pelanggan. | Tersedia pada `/admin/customers`; daftar dan CRUD tersambung ke API Rails (`/api/v1/customers`). Tambah tersedia untuk Admin/Kasir, edit/hapus untuk Admin, dan pelanggan dengan riwayat transaksi tidak dapat dihapus. |
| Laporan | Mencari dan memfilter transaksi pembelian/sewa serta melihat ringkasan usaha. | `/admin/reports` mempertahankan laporan operasionalnya; dashboard pendapatan database tersedia terpisah pada `/admin`. |

### 3. Kasir / POS

| Menu | Fungsi | Status berdasarkan kode |
|---|---|---|
| Kasir (POS) | Memilih pelanggan dan produk, membuat penjualan langsung, mengonfirmasi transaksi, dan mencatat pembayaran tunai atau QRIS statis. | Tersedia pada tab **Kasir Penjualan** di `/admin/pos`; setelah order dan konfirmasi melalui `POST /api/v1/orders` dan `PATCH /api/v1/orders/:id`, Kasir/Admin mencatat pembayaran melalui `POST /api/v1/orders/:id/payments`. Cash dicatat sukses setelah kasir menerima uang; QRIS dicatat pending sampai kasir memverifikasi dana dan mengonfirmasi. Payment Ledger mencatat metode, nominal, waktu, status, dan kasir pembuat/pengonfirmasi. Server menghitung kembalian; stok tetap mengikuti transisi order. Tab **Kasir Penyewaan** memakai pemilih pelanggan, katalog stok sewa per periode, keranjang bertanggal, serta harga/subtotal harian. Setelah transaksi dibuat, POS mengonfirmasikannya melalui transisi Rental yang ada untuk memeriksa ketersediaan backend, lalu mencatat Cash atau membuat Payment QRIS pending melalui endpoint Rental yang sama; serah-terima tetap mensyaratkan lunas. |
| Riwayat pembayaran & struk | Melihat, membuka, dan mencetak bukti pembayaran Order/Rental. | Tersedia pada `/admin/payments` untuk Admin/Kasir dari riwayat Payment yang sudah terasosiasikan ke transaksi; akun pelanggan menampilkan struk hanya untuk Order/Rental miliknya. Struk menampilkan rincian transaksi dan status aktual ledger Payment, bukan menyimpulkan pembayaran dari status Order/Rental. |
| Riwayat Transaksi | Melihat status transaksi dan riwayat pembayaran penjualan. | Tersedia pada halaman `/admin/pos` dari `GET /api/v1/orders`; status pembayaran dihitung dari ledger dan ditampilkan terpisah dari status order. |
| Booking online masuk & pembayaran sewa | Menemukan booking pelanggan, memeriksa jadwal, mencatat pembayaran tunai/QRIS statis dan mengonfirmasi pembayaran melalui ledger. | Booking pelanggan online tetap masuk dengan status menunggu konfirmasi dan dapat ditangani pada **Riwayat Penyewaan**. Booking kasir baru dibuat melalui tab **Kasir Penyewaan** dengan pelanggan, item, kuantitas, periode, harga per hari, subtotal dan total; sistem menghitung harga final dari server dan memeriksa ketersediaan pada saat booking serta konfirmasi. Kasir memilih Cash atau QRIS sebelum menyimpan. Cash memvalidasi uang diterima terhadap total dan mencatat kembalian; QRIS menampilkan barcode statis dan nominal, berstatus pending hingga dana diverifikasi manual lalu dikonfirmasi kasir. Semua pembayaran menggunakan `POST /api/v1/rentals/:id/payments` dan `POST /api/v1/rentals/:id/payments/:payment_id/confirm`, masuk Payment Ledger yang terhubung ke Rental. Transaksi dan status juga tersedia pada **Riwayat Penyewaan** untuk serah-terima setelah lunas dan pengembalian; rental tidak dianggap sebagai Order penjualan. |
| Pengembalian sewa | Melihat jatuh tempo, mencatat pengembalian, dan memperbarui unit yang tersedia. | Pengembalian dapat diproses melalui tab Kasir Penyewaan di POS maupun menu Admin/Kasir Penyewaan; kedua jalur menggunakan komponen dan API yang sama. |

### Integrasi Booking, Ketersediaan Stok, Penjualan, dan Penyewaan

Aturan penyewaan yang saat ini diterapkan:

1. `rental_stock` adalah jumlah unit sewa yang tersedia. Booking `pending_confirmation` dan `confirmed` menahan kapasitas untuk tanggal bertumpang tindih, tanpa mengubah stok fisik.
2. Pembayaran tunai/QRIS hanya dapat dicatat setelah booking disetujui. QRIS tetap pending sampai diverifikasi kasir. Hanya booking lunas yang dapat diserahterimakan; transisi ke `active` mengurangi stok dengan update database kondisional dan atomik serta menyimpan `stock_deducted`. Booking aktif yang stoknya sudah dipotong tidak dihitung ulang sebagai reservasi tanggal.
3. Penolakan atau pembatalan sebelum serah-terima melepas reservasi tanpa mengubah stok. Pengembalian mencatat kondisi setiap item; hanya item `good` yang menambah stok kembali. `damaged` dan `lost` tidak ditambahkan. Perubahan stok dan status berada dalam transaksi yang sama.
4. Pengembalian hanya dapat diselesaikan dari status `active`, menyimpan waktu pengembalian aktual, dan menulis riwayat transisi status. Booking lama yang dibuat sebelum pelacakan stok dapat memiliki `stock_deducted = false` dan tidak memicu penambahan stok saat kembali.
5. Status `active` yang melewati tanggal kembali terjadwal ditandai terlambat di Admin. Belum ada aturan tarif, batas, atau kalkulasi denda, sehingga aplikasi tidak membebankan denda atau mengubah total booking.
6. Stok penjualan/POS tetap memakai `sale_stock` dan alur konfirmasi order yang terpisah; perubahan ini tidak mengubah stok, harga, maupun otorisasi POS/pembelian.

Website pelanggan membaca produk dan kategori dari API Rails. Endpoint order Admin/Kasir tetap terpisah dan tetap memerlukan role staf. Pelanggan memakai endpoint khusus yang hanya mengizinkan role `customer`; identitas berasal dari sesi dan harga berasal dari katalog server. Order pelanggan berstatus awal `pending_confirmation`; stok fisik dikurangi setelah staf mengonfirmasi order. Website menampilkan “Menunggu Pembayaran” saat Payment belum lunas tanpa mengubah status domain tersebut. Booking pelanggan dibuat melalui `POST /api/v1/customer/rentals`, sedangkan Admin/Kasir membaca booking yang sama melalui `GET /api/v1/rentals`; keduanya memakai tabel `rentals`, tanpa filter status default pada daftar staf. Pemilih pelanggan POS dan penyewaan membaca seluruh data `Customer`, termasuk pelanggan online dan pelanggan walk-in tanpa akun; staf dapat mencari nama/nomor HP serta membuat Customer dengan nama wajib dan kontak/alamat opsional. Pembuatan pelanggan memakai kembali record dengan nomor HP yang sama setelah normalisasi. Payment menyimpan tepat satu relasi ke Order atau Rental dan mendukung metode tunai/gateway. Endpoint pembuatan gateway pelanggan dinonaktifkan; endpoint refresh dan webhook Midtrans tetap dipertahankan untuk ledger/payment lama, dengan signature dan API status provider. Transaksi baru pelanggan dibayar di POS, status pembayaran berasal dari ledger, dan callback tidak mengubah Order/Rental, stok, atau pemenuhan. Refund belum tersedia.


- **Palet:** Orange `#F97316`, Navy `#172B4D`, White `#FFFFFF`, dan Light Gray `#F3F5F8`; gunakan warna solid, tanpa gradient.
- **Tipografi:** DM Sans sebagai font UI utama. Judul tertentu merujuk Manrope dengan fallback sans-serif.
- **Permukaan:** gunakan border netral yang halus, shadow tipis, radius konsisten (umumnya 12px), dan spacing yang cukup. Hindari kartu datar tanpa hierarki.
- **Hierarki sesuai fungsi:** beranda menonjolkan jalur ke katalog; katalog dan detail menonjolkan foto, harga, stok demo, serta tindakan beli/sewa; checkout menampilkan detail pemesan dan ringkasan biaya dengan jelas.
- **Interaksi:** hover natural dan singkat; tombol tetap dapat digunakan tanpa hover pada perangkat sentuh. Beri fokus keyboard yang terlihat untuk kontrol interaktif.
- **Responsif:** gunakan utility Tailwind pada `className`; pastikan grid, form, navigasi, dan tabel tetap dapat digunakan pada layar sempit.
- **Ikon dan gambar:** gunakan Lucide React untuk ikon, sediakan teks alternatif untuk gambar, dan fallback bila gambar eksternal gagal dimuat.

## Aturan Pengembangan

- Pertahankan React + Vite + JavaScript/JSX; jangan menambahkan `.ts` atau `.tsx` atau melakukan migrasi TypeScript tanpa keputusan produk terpisah.
- Untuk website pelanggan, letakkan halaman langsung di `frontend/src/pages`, komponen bersama di `frontend/src/components`, dan aset statis di `frontend/src/assets`. Pertahankan folder data/helper yang sudah digunakan serta komponen UI lama di `frontend/src/components/ui`; jangan menambah lapisan folder tanpa kebutuhan.
- Gunakan utility Tailwind langsung di `className`; tambahkan CSS global hanya untuk kebutuhan dasar/global di `frontend/src/index.css`.
- Pertahankan pemetaan halaman pelanggan dan alur navigasi di `frontend/src/CustomerApp.jsx`; jangan menambahkan menu Admin, Kasir, atau POS ke area pelanggan.
- Pertahankan kontrak props antarhalaman dan key `localStorage` yang sudah digunakan. Perubahan data transaksi harus mempertahankan validasi checkout dan perhitungan total.
- Hindari mengganti semua tombol sekaligus. Pertahankan kontrol khusus POS/form bila animasi atau variasi tombol dapat mengganggu fungsi.
- Jangan menganggap data contoh sebagai data produksi; integrasi API/database perlu spesifikasi dan migrasi terpisah.
- Setelah perubahan frontend, jalankan `npm run lint` dan `npm run build` dari `frontend/`; uji manual alur yang terdampak di browser.

## Usulan Backlog — Belum Diimplementasikan

Daftar berikut adalah usulan pengembangan, bukan fitur yang sudah tersedia atau komitmen jadwal.

1. Backend/API dan database untuk sinkronisasi produk serta transaksi lintas perangkat.
2. Edit dan hapus produk, validasi stok, dan pengurangan stok yang konsisten setelah checkout.
3. Definisikan kebijakan denda keterlambatan (tarif, satuan, batas, dan persetujuan) sebelum mengimplementasikan perhitungan atau penagihan denda.
4. Integrasikan UI akun pelanggan dengan endpoint autentikasi backend; tinjau konfigurasi deployment, pembatasan percobaan login, verifikasi email, dan mitigasi XSS sebelum penggunaan produksi.
5. Upload/manajemen foto produk, bukan hanya pemetaan kategori ke foto eksternal.
6. Laporan pendapatan dan ekspor transaksi.
7. Automated test untuk checkout, persistensi, pencarian, serta navigasi.
