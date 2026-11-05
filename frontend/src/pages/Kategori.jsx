import InfoPage from './InfoPage'

export default function Kategori() {
  return <InfoPage
    title="Kategori Produk"
    description="Kelompokkan perlengkapan pendakian berdasarkan jenis."
    columns={['Kategori', 'Jumlah Produk', 'Keterangan']}
    rows={[
      ['Tenda', '8 produk', 'Tempat bernaung'],
      ['Tas & Carrier', '12 produk', 'Tas pendakian'],
      ['Alat Masak', '7 produk', 'Perlengkapan memasak'],
      ['Alas Kaki', '6 produk', 'Sepatu dan sandal'],
    ]}
  />
}
