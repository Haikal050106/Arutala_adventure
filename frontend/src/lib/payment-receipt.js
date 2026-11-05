import { money } from './customer-shop.js'

const methodLabels = { cash: 'Tunai', qris: 'QRIS statis', gateway: 'Payment gateway' }
const statusLabels = { pending: 'Menunggu pembayaran', succeeded: 'Berhasil', failed: 'Gagal', refunded: 'Dikembalikan' }

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
})[character])

function paymentDate(payment) {
  const value = payment.paidAt || payment.paid_at || payment.createdAt || payment.created_at
  return value ? new Date(value).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : 'Belum tercatat'
}

export function printPaymentReceipt(payment, transaction) {
  const printWindow = window.open('', '_blank')
  if (!printWindow) throw new Error('Jendela cetak diblokir browser. Izinkan pop-up lalu coba lagi.')
  const details = transaction.items.map((item) => `
    <tr>
      <td>${escapeHtml(item.name)}${item.detail ? `<small>${escapeHtml(item.detail)}</small>` : ''}</td>
      <td>${escapeHtml(item.quantity)}</td>
      <td>${escapeHtml(money(item.subtotal))}</td>
    </tr>`).join('')
  const method = methodLabels[payment.method] || payment.method || '—'
  const status = payment.method === 'qris' && payment.status === 'pending'
    ? 'Pending — menunggu verifikasi kasir'
    : payment.method === 'qris' && payment.status === 'succeeded'
      ? 'Paid'
      : statusLabels[payment.status] || payment.status || '—'
  const html = `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Struk ${escapeHtml(payment.reference)}</title>
    <style>
      *{box-sizing:border-box}body{font:14px Arial,sans-serif;color:#172b4d;margin:0;padding:32px}
      main{max-width:620px;margin:0 auto}h1{font-size:22px;margin:0}p{margin:5px 0}
      .muted{color:#64748b;font-size:12px}.block{border-top:1px solid #cbd5e1;margin-top:18px;padding-top:14px}
      .row{display:flex;justify-content:space-between;gap:12px;margin:7px 0}
      table{border-collapse:collapse;width:100%;margin-top:12px}th,td{text-align:left;padding:9px 5px;border-bottom:1px solid #e2e8f0}
      th:last-child,td:last-child{text-align:right}td small{display:block;color:#64748b;margin-top:4px}
      @media print{body{padding:0}main{max-width:none}}
    </style></head><body><main>
      <h1>Arutala Adventure</h1><p class="muted">Struk pembayaran digital</p>
      <div class="block">
        <div class="row"><span>Nomor transaksi</span><strong>${escapeHtml(transaction.number)}</strong></div>
        <div class="row"><span>Jenis transaksi</span><span>${escapeHtml(transaction.type)}</span></div>
        <div class="row"><span>Pelanggan</span><span>${escapeHtml(transaction.customer?.name || '—')}</span></div>
        <div class="row"><span>Tanggal transaksi</span><span>${escapeHtml(transaction.createdAt ? new Date(transaction.createdAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '—')}</span></div>
      </div>
      <div class="block"><strong>Rincian barang</strong><table><thead><tr><th>Barang</th><th>Qty</th><th>Subtotal</th></tr></thead><tbody>${details}</tbody></table>
        <div class="row"><span>Total transaksi</span><strong>${escapeHtml(money(transaction.totalAmount))}</strong></div>
      </div>
      <div class="block">
        <div class="row"><span>Referensi pembayaran</span><strong>${escapeHtml(payment.reference)}</strong></div>
        <div class="row"><span>Nominal pembayaran</span><strong>${escapeHtml(money(payment.amount))}</strong></div>
        <div class="row"><span>Metode</span><span>${escapeHtml(method)}</span></div>
        <div class="row"><span>Status pembayaran</span><strong>${escapeHtml(status)}</strong></div>
        <div class="row"><span>Waktu pembayaran</span><span>${escapeHtml(paymentDate(payment))}</span></div>
        ${payment.confirmed_by_id != null || payment.created_by_id != null ? `<div class="row"><span>Kasir</span><span>#${escapeHtml(payment.confirmed_by_id ?? payment.created_by_id)}</span></div>` : ''}
      </div>
      ${payment.cash_received != null || payment.cashReceived != null ? `<div class="row"><span>Uang diterima</span><span>${escapeHtml(money(payment.cash_received ?? payment.cashReceived))}</span></div>` : ''}
      ${payment.change_amount != null || payment.changeAmount != null ? `<div class="row"><span>Kembalian</span><span>${escapeHtml(money(payment.change_amount ?? payment.changeAmount))}</span></div>` : ''}
      <p class="muted block">Struk ini mencatat status Payment dari ledger. Status transaksi bukan bukti pembayaran.</p>
    </main></body></html>`
  printWindow.document.open()
  printWindow.document.write(html)
  printWindow.document.close()
  printWindow.focus()
  printWindow.print()
}
