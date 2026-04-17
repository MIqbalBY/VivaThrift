function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function renderShippingLabelHtml(input: {
  orderId: string
  courierName?: string | null
  trackingNumber?: string | null
  biteshipOrderId?: string | null
  sellerName?: string | null
  sellerPhone?: string | null
  sellerAddress?: string | null
  buyerName?: string | null
  buyerPhone?: string | null
  buyerAddress?: string | null
  itemsHtml?: string | null
  shippingIsFragile?: boolean | null
  shippingIsInsured?: boolean | null
  shippingInsuranceFee?: number | null
  officialLabelUrl?: string | null
}) {
  const safeItemsHtml = String(input.itemsHtml ?? 'Produk VivaThrift')
    .split('<br/>')
    .map((item) => escapeHtml(item))
    .join('<br/>')

  const fragileBanner = input.shippingIsFragile
    ? `<div style="margin-top:16px;padding:12px 14px;border-radius:12px;border:1px solid #fca5a5;background:#fef2f2;color:#b91c1c;font-weight:700;">FRAGILE / PECAH BELAH — HANDLE WITH CARE / JANGAN DIBANTING</div>`
    : ''

  const insuranceBanner = input.shippingIsInsured
    ? `<div style="margin-top:12px;padding:10px 12px;border-radius:12px;border:1px solid #bfdbfe;background:#eff6ff;color:#1d4ed8;font-weight:600;">Asuransi pengiriman aktif${Number(input.shippingInsuranceFee ?? 0) > 0 ? ` · Rp ${Number(input.shippingInsuranceFee ?? 0).toLocaleString('id-ID')}` : ''}</div>`
    : ''

  const fragileSticker = input.shippingIsFragile
    ? `<div class="box" style="margin-top:16px;">
        <div class="muted">Sticker fragile</div>
        <div style="margin-top:8px;">
          <img src="/img/label-fragile.png" alt="Sticker fragile" style="width:100%;max-width:520px;border-radius:12px;border:1px solid #e2e8f0;display:block;" />
        </div>
      </div>`
    : ''

  return `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Label Pengiriman VivaThrift</title>
  <style>
    body { font-family: Arial, sans-serif; background: #f8fafc; color: #0f172a; padding: 24px; }
    .wrap { max-width: 820px; margin: 0 auto; }
    .card { background: #fff; border: 1px solid #cbd5e1; border-radius: 16px; padding: 24px; box-shadow: 0 8px 30px rgba(15,23,42,.08); }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .box { border: 1px dashed #94a3b8; border-radius: 12px; padding: 14px; background: #f8fafc; }
    .muted { color: #475569; font-size: 12px; }
    .title { font-size: 22px; font-weight: 700; margin: 0 0 8px; }
    .badge { display: inline-block; padding: 6px 10px; border-radius: 999px; background: #dbeafe; color: #1d4ed8; font-size: 12px; font-weight: 700; }
    .actions { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 18px; }
    .btn { display: inline-block; text-decoration: none; border-radius: 999px; padding: 10px 14px; font-size: 13px; font-weight: 700; }
    .btn-primary { background: #1d4ed8; color: white; }
    .btn-secondary { background: #e2e8f0; color: #0f172a; }
    @media print { .actions { display: none; } body { padding: 0; background: white; } .card { box-shadow: none; border-color: #000; } }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <div style="display:flex;justify-content:space-between;gap:16px;align-items:flex-start;flex-wrap:wrap;">
        <div>
          <p class="title">🏷️ Label Pengiriman VivaThrift</p>
          <span class="badge">${escapeHtml(input.courierName ?? 'Biteship')}</span>
        </div>
        <div style="text-align:right">
          <div><strong>Order ID:</strong> ${escapeHtml(input.orderId)}</div>
          <div><strong>Resi:</strong> ${escapeHtml(input.trackingNumber ?? '-')}</div>
          <div><strong>Biteship ID:</strong> ${escapeHtml(input.biteshipOrderId ?? '-')}</div>
        </div>
      </div>

      ${fragileBanner}
      ${insuranceBanner}

      <div class="grid" style="margin-top:18px;">
        <div class="box">
          <div class="muted">PENGIRIM</div>
          <div><strong>${escapeHtml(input.sellerName ?? 'Penjual')}</strong></div>
          <div>${escapeHtml(input.sellerPhone ?? '-')}</div>
          <div style="margin-top:8px">${escapeHtml(input.sellerAddress ?? '-')}</div>
        </div>
        <div class="box">
          <div class="muted">PENERIMA</div>
          <div><strong>${escapeHtml(input.buyerName ?? 'Pembeli')}</strong></div>
          <div>${escapeHtml(input.buyerPhone ?? '-')}</div>
          <div style="margin-top:8px">${escapeHtml(input.buyerAddress ?? '-')}</div>
        </div>
      </div>

      <div class="box" style="margin-top:16px;">
        <div class="muted">ISI PAKET</div>
        <div>${safeItemsHtml}</div>
      </div>

      ${fragileSticker}

      <div class="actions">
        <a href="#" onclick="window.print(); return false;" class="btn btn-primary">🖨️ Print / Save PDF</a>
        ${input.shippingIsFragile ? `<a href="/img/label-fragile.png" download="label-fragile-vivathrift.png" class="btn btn-secondary">⬇️ Unduh Sticker Fragile</a>` : ''}
        ${input.officialLabelUrl ? `<a href="${escapeHtml(input.officialLabelUrl)}" class="btn btn-secondary" target="_blank" rel="noopener noreferrer">📄 Buka Label Resmi Kurir</a>` : ''}
      </div>
    </div>
  </div>
</body>
</html>`
}
