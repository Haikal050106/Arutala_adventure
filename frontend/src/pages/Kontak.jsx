import InfoPage from './InfoPage'

export default function Kontak() {
  return <InfoPage
    title="Kontak UMKM"
    description="Saluran kontak setiap usaha."
    columns={['Nama UMKM', 'Telepon', 'Email', 'Instagram']}
    rows={[
      ['Arutala Adventure', '085333796838', '@arutalaadventure.id', '@arutala.adventure'],
      ['Arutala Bike', '085333796838', '@Arutaladventure.id', '@Arutaladevnture'],
    ]}
  />
}
