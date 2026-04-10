/**
 * Transactional email HTML templates for VivaThrift.
 * Uses the same navy brand gradient as the app (#1e3a8a).
 * All templates are pure functions that return HTML strings — no templating engine needed.
 */

const SITE_URL = process.env.SITE_URL ?? 'https://www.vivathrift.store'
const LOGO_URL = `${SITE_URL}/img/logo-vivathrift.png`

function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount)
}

function layout(badge: string, badgeBg: string, badgeColor: string, title: string, bodyContent: string): string {
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <title>${title} - VivaThrift</title>
</head>
<body style="margin:0;padding:0;background-color:#eef2ff;font-family:'Segoe UI',Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#eef2ff;padding:40px 16px;">
<tr><td align="center">
  <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(30,58,138,0.10);">
    <!-- Header -->
    <tr>
      <td align="center" style="background:#1e3a8a;background:linear-gradient(135deg,#162d6e 0%,#1e3a8a 50%,#1e40af 100%);padding:36px 24px 32px;">
        <img src="${LOGO_URL}" alt="VivaThrift" width="48" height="48" style="display:block;width:48px;height:48px;margin:0 auto 14px auto;border-radius:10px;background-color:#ffffff;padding:5px;box-shadow:0 2px 12px rgba(0,0,0,0.20);" />
        <span style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:0.3px;">VivaThrift</span>
      </td>
    </tr>
    <!-- Body -->
    <tr>
      <td style="padding:36px 32px 28px;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
          <tr><td style="background-color:${badgeBg};border-radius:20px;padding:6px 14px;">
            <span style="font-size:13px;color:${badgeColor};font-weight:600;">${badge}</span>
          </td></tr>
        </table>
        <h1 style="margin:0 0 16px 0;font-size:22px;font-weight:700;color:#0f172a;">${title}</h1>
        ${bodyContent}
      </td>
    </tr>
    <!-- Footer -->
    <tr>
      <td align="center" style="background-color:#f8fafc;padding:20px 32px;border-top:1px solid #e2e8f0;">
        <p style="margin:0;font-size:12px;color:#1e3a8a;font-weight:600;">&copy; 2026 VivaThrift &mdash; Marketplace Preloved ITS</p>
        <p style="margin:8px 0 0 0;font-size:11px;color:#64748b;">
          <a href="${SITE_URL}" style="color:#2563eb;text-decoration:none;font-weight:600;">www.vivathrift.store</a>
        </p>
      </td>
    </tr>
  </table>
  <p style="margin:24px 0 0 0;font-size:11px;color:#94a3b8;text-align:center;">Email ini dikirim otomatis oleh VivaThrift. Mohon jangan membalas.</p>
</td></tr>
</table>
</body>
</html>`
}

function ctaButton(href: string, label: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
  <tr><td align="center">
    <a href="${href}" target="_blank" style="display:inline-block;background:#1e3a8a;background:linear-gradient(135deg,#1e3a8a,#2563eb);color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:12px 36px;border-radius:8px;box-shadow:0 4px 12px rgba(30,58,138,0.30);">${label}</a>
  </td></tr>
</table>`
}

function divider(): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
  <tr><td style="border-top:1px solid #e2e8f0;"></td></tr>
</table>`
}

// ── Order Confirmed (buyer) ─────────────────────────────────────────

interface OrderConfirmedBuyerParams {
  buyerName: string
  orderId: string
  productTitle: string
  quantity: number
  totalAmount: number
  shippingMethod: 'cod' | 'shipping'
  meetupLocation?: string | null
}

export function emailOrderConfirmedBuyer(p: OrderConfirmedBuyerParams): { subject: string; html: string } {
  const isCod = p.shippingMethod === 'cod'
  const body = `
    <p style="margin:0 0 16px 0;font-size:14px;color:#475569;line-height:1.7;">
      Hai <strong>${p.buyerName}</strong>, pembayaranmu telah berhasil dikonfirmasi!
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border-radius:12px;padding:16px 20px;margin-bottom:16px;">
      <tr><td>
        <p style="margin:0 0 8px 0;font-size:13px;color:#64748b;">Detail Pesanan:</p>
        <p style="margin:0 0 4px 0;font-size:14px;color:#0f172a;font-weight:600;">${p.productTitle}</p>
        <p style="margin:0 0 4px 0;font-size:13px;color:#475569;">Jumlah: ${p.quantity} &nbsp;|&nbsp; Total: <strong style="color:#1e3a8a;">${formatRupiah(p.totalAmount)}</strong></p>
        <p style="margin:0;font-size:13px;color:#475569;">Metode: <strong>${isCod ? 'COD / Meetup' : 'Pengiriman'}</strong></p>
        ${isCod && p.meetupLocation ? `<p style="margin:4px 0 0 0;font-size:13px;color:#475569;">Lokasi meetup: <strong>${p.meetupLocation}</strong></p>` : ''}
      </td></tr>
    </table>
    <p style="margin:0 0 8px 0;font-size:14px;color:#475569;line-height:1.7;">
      ${isCod
        ? 'Penjual akan segera menghubungimu untuk atur jadwal meetup. Siapkan kode OTP yang ada di halaman pesanan.'
        : 'Penjual akan segera memproses dan mengirimkan pesananmu.'}
    </p>
    ${ctaButton(`${SITE_URL}/orders`, 'Lihat Pesanan')}
    ${divider()}
    <p style="margin:0;font-size:12px;color:#94a3b8;">Order ID: ${p.orderId}</p>`

  return {
    subject: `Pembayaran Berhasil — ${p.productTitle}`,
    html: layout('Pembayaran Dikonfirmasi', '#ecfdf5', '#065f46', 'Pembayaran Berhasil!', body),
  }
}

// ── New Order Alert (seller) ────────────────────────────────────────

interface NewOrderSellerParams {
  sellerName: string
  orderId: string
  productTitle: string
  quantity: number
  totalAmount: number
  buyerName: string
  shippingMethod: 'cod' | 'shipping'
}

export function emailNewOrderSeller(p: NewOrderSellerParams): { subject: string; html: string } {
  const isCod = p.shippingMethod === 'cod'
  const body = `
    <p style="margin:0 0 16px 0;font-size:14px;color:#475569;line-height:1.7;">
      Hai <strong>${p.sellerName}</strong>, ada pesanan baru yang sudah dibayar!
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border-radius:12px;padding:16px 20px;margin-bottom:16px;">
      <tr><td>
        <p style="margin:0 0 4px 0;font-size:14px;color:#0f172a;font-weight:600;">${p.productTitle}</p>
        <p style="margin:0 0 4px 0;font-size:13px;color:#475569;">Pembeli: <strong>${p.buyerName}</strong></p>
        <p style="margin:0 0 4px 0;font-size:13px;color:#475569;">Jumlah: ${p.quantity} &nbsp;|&nbsp; Total: <strong style="color:#1e3a8a;">${formatRupiah(p.totalAmount)}</strong></p>
        <p style="margin:0;font-size:13px;color:#475569;">Metode: <strong>${isCod ? 'COD / Meetup' : 'Pengiriman'}</strong></p>
      </td></tr>
    </table>
    <p style="margin:0 0 8px 0;font-size:14px;color:#475569;line-height:1.7;">
      ${isCod
        ? 'Segera atur jadwal meetup dengan pembeli lewat fitur chat.'
        : 'Segera proses dan kirim pesanan ini. Jangan lupa isi nomor resi!'}
    </p>
    ${ctaButton(`${SITE_URL}/orders`, 'Proses Pesanan')}
    ${divider()}
    <p style="margin:0;font-size:12px;color:#94a3b8;">Order ID: ${p.orderId}</p>`

  return {
    subject: `Pesanan Baru dari ${p.buyerName} — ${p.productTitle}`,
    html: layout('Pesanan Baru Masuk', '#eff6ff', '#1e3a8a', 'Ada Pesanan Baru!', body),
  }
}

// ── Order Shipped (buyer) ───────────────────────────────────────────

interface OrderShippedParams {
  buyerName: string
  orderId: string
  productTitle: string
  trackingNumber: string
  courierName?: string | null
}

export function emailOrderShipped(p: OrderShippedParams): { subject: string; html: string } {
  const body = `
    <p style="margin:0 0 16px 0;font-size:14px;color:#475569;line-height:1.7;">
      Hai <strong>${p.buyerName}</strong>, pesananmu sudah dikirim!
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border-radius:12px;padding:16px 20px;margin-bottom:16px;">
      <tr><td>
        <p style="margin:0 0 4px 0;font-size:14px;color:#0f172a;font-weight:600;">${p.productTitle}</p>
        ${p.courierName ? `<p style="margin:0 0 4px 0;font-size:13px;color:#475569;">Kurir: <strong>${p.courierName}</strong></p>` : ''}
        <p style="margin:0;font-size:13px;color:#475569;">No. Resi: <strong style="color:#1e3a8a;letter-spacing:0.5px;">${p.trackingNumber}</strong></p>
      </td></tr>
    </table>
    <p style="margin:0 0 8px 0;font-size:14px;color:#475569;line-height:1.7;">
      Setelah barang sampai, jangan lupa konfirmasi penerimaan di halaman pesanan agar dana bisa dicairkan ke penjual.
    </p>
    ${ctaButton(`${SITE_URL}/orders`, 'Lacak Pesanan')}
    ${divider()}
    <p style="margin:0;font-size:12px;color:#94a3b8;">Order ID: ${p.orderId}</p>`

  return {
    subject: `Pesananmu Dikirim — ${p.productTitle}`,
    html: layout('Pesanan Dikirim', '#fefce8', '#854d0e', 'Pesananmu Sedang Dalam Perjalanan!', body),
  }
}

// ── Order Completed (seller — dana dicairkan) ───────────────────────

interface OrderCompletedSellerParams {
  sellerName: string
  orderId: string
  productTitle: string
  sellerReceives: number
  disbursementSkipped: boolean
}

export function emailOrderCompletedSeller(p: OrderCompletedSellerParams): { subject: string; html: string } {
  const body = `
    <p style="margin:0 0 16px 0;font-size:14px;color:#475569;line-height:1.7;">
      Hai <strong>${p.sellerName}</strong>, pembeli telah mengkonfirmasi penerimaan barang!
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#ecfdf5;border-radius:12px;padding:16px 20px;margin-bottom:16px;">
      <tr><td>
        <p style="margin:0 0 4px 0;font-size:14px;color:#0f172a;font-weight:600;">${p.productTitle}</p>
        <p style="margin:0;font-size:14px;color:#065f46;font-weight:700;">
          ${p.disbursementSkipped
            ? 'Dana akan ditransfer setelah kamu melengkapi data rekening di Profil.'
            : `Pencairan ${formatRupiah(p.sellerReceives)} sedang diproses ke rekeningmu.`}
        </p>
      </td></tr>
    </table>
    ${p.disbursementSkipped
      ? ctaButton(`${SITE_URL}/profile/edit?tab=rekening`, 'Lengkapi Data Rekening')
      : ctaButton(`${SITE_URL}/orders`, 'Lihat Riwayat Pesanan')}
    ${divider()}
    <p style="margin:0;font-size:12px;color:#94a3b8;">Order ID: ${p.orderId}</p>`

  return {
    subject: `Pesanan Selesai — ${p.productTitle}`,
    html: layout('Pesanan Selesai', '#ecfdf5', '#065f46', 'Transaksi Berhasil!', body),
  }
}
