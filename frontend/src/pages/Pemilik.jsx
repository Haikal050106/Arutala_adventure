import InfoPage from './InfoPage'

export default function Pemilik() {
  return <InfoPage
    title="Data Pemilik"
    description="Informasi pemilik dari setiap UMKM."
    columns={['Nama Pemilik', 'UMKM', 'Peran', 'Kontak']}
    rows={[
      ['Muh.Syarif Hidayatullah', 'Arutala Adventure', 'Pemilik', '0812-3456-7890'],
      ['Muh.Syarif Hidayatullah', 'Arutala Bike', 'Pemilik', '0813-2244-5566'],
    ]}
  />
}
