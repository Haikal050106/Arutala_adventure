import InfoPage from './InfoPage'

export default function Lokasi() {
  return <InfoPage
    title="Lokasi Toko"
    description="Alamat toko dan lokasi UMKM wisata."
    columns={['Nama UMKM', 'Alamat', 'Kecamatan', 'Jam buka']}
    rows={[
      ['Arutala Adventure', 'Jalan paokmotong Kotaraja,dusun Gerami,Desa Gelora (samping SMAN 1 Sikur)', 'Kecamatan Sikur,Lombok Timur', '08.00–22.00'],
      ['Arutala Bike', 'jalan Paokmotong Kotaraja,dusun Gerami,Desa Gelora (samping SMAN 1 Sikur)', 'Kecamatan Sikur,Lombok Timur', '24 jam'],
    ]}
  />
}
