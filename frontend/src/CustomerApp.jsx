import { Link, Route, Routes } from 'react-router-dom'
import { CustomerStoreProvider } from './components/CustomerStore'
import CustomerLayout from './components/CustomerLayout'
import StoreHome from './pages/StoreHome'
import CustomerCatalog from './pages/CustomerCatalog'
import ProductDetail from './pages/ProductDetail'
import CustomerCart from './pages/CustomerCart'
import CustomerCheckout from './pages/CustomerCheckout'
import CustomerRentalCheckout from './pages/CustomerRentalCheckout'
import CustomerOrderConfirmation from './pages/CustomerOrderConfirmation'
import CustomerAuth from './pages/CustomerAuth'
import CustomerAccount from './pages/CustomerAccount'
import { AboutCustomerPage, ContactCustomerPage, CustomerGalleryPage } from './pages/CustomerInfo'

function CustomerRoot() {
  return <CustomerStoreProvider><CustomerLayout /></CustomerStoreProvider>
}

function NotFound() {
  return <div className="mx-auto max-w-xl px-5 py-20 text-center"><p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">404 · Halaman tidak ditemukan</p><h1 className="mt-3 text-2xl font-bold text-navy">Halaman ini tidak tersedia</h1><Link to="/" className="mt-5 inline-flex text-sm font-semibold text-[#C94F08]">Kembali ke beranda</Link></div>
}

export default function CustomerApp() {
  return <Routes>
    <Route element={<CustomerRoot />}>
      <Route index element={<StoreHome />} />
      <Route path="katalog" element={<CustomerCatalog />} />
      <Route path="produk/:productId" element={<ProductDetail />} />
      <Route path="keranjang" element={<CustomerCart />} />
      <Route path="checkout" element={<CustomerCheckout />} />
      <Route path="checkout-sewa" element={<CustomerRentalCheckout />} />
      <Route path="pesanan/:orderId" element={<CustomerOrderConfirmation />} />
      <Route path="masuk" element={<CustomerAuth />} />
      <Route path="daftar" element={<CustomerAuth />} />
      <Route path="akun" element={<CustomerAccount />} />
      <Route path="tentang" element={<AboutCustomerPage />} />
      <Route path="kontak" element={<ContactCustomerPage />} />
      <Route path="galeri" element={<CustomerGalleryPage />} />
    </Route>
    <Route path="*" element={<NotFound />} />
  </Routes>
}