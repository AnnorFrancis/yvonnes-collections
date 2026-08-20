// ── Brand configuration ─────────────────────────────────────
// Change these once and the whole site (and BMS) rebrands itself.
export const BRAND = {
  name: "Yvonne's Collections",
  short: 'Yvonne’s',
  monogram: 'Y',
  tagline: 'Everything you love, under one roof.',
  city: 'Accra',
  phone: '055 817 0012',
  whatsapp: '233558170012',
  address: 'Shop 12, Accra Central',
  hours: 'Mon to Sat, 8:00am to 7:00pm',
  currency: 'GH₵',
};

export const fmtPrice = (n) =>
  `${BRAND.currency} ${Number(n).toLocaleString('en-GH', { maximumFractionDigits: 0 })}`;
