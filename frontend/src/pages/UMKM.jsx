import InfoPage from './InfoPage'

export default function UMKM() {
  return <InfoPage
    title="Informasi UMKM"
    description="Data usaha mikro, kecil, dan menengah wisata."
    columns={['Nama UMKM', 'Pemilik', 'Kategori', 'Alamat']}
    rows={[
      ['Arutala Adventure', 'Muh.Syarif Hidayatullah', 'Outdoor & Pendakian', 'Jalan paokmotong Kotaraja,dusun Gerami,Desa Gelora (samping SMAN 1 Sikur)'],
      ['Arutala Bike', 'Muh.Syarif Hidayatullah', 'Bike Rental', 'Jalan paokmotong Kotaraja,dusun Gerami,Desa Gelora (samping SMAN 1 Sikur)'],
    ]}
  />
}
