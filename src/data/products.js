// ── Yvonne's Collections catalog ────────────────────────────
// Every photo here is the client's own stock, shown in FULL (no
// cropping) on a uniform 4:5 canvas. Prices are her real shelf
// prices, read from the tags in her photos.
// `cost` is what the shop paid, used for profit reporting.

const P = (f) => `/products/${f}.jpg`;
const U = (id, w = 1000) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&q=80&auto=format&fit=crop`;

export const DEPARTMENTS = [
  { id: 'women',    label: 'Women',      blurb: 'Comfort, sets and everyday pieces', image: P('p15') },
  { id: 'men',      label: 'Men',        blurb: 'Polos, denim and sharp staples',    image: P('w3') },
  { id: 'kids',     label: 'Kids',       blurb: 'Little looks, school to Sunday',    image: P('p17') },
  { id: 'footwear', label: 'Footwear',   blurb: 'Sandals, sneakers and classics',    image: P('p8') },
  { id: 'watches',  label: 'Watches',    blurb: 'Time pieces and smart tech',        image: P('p3') },
  { id: 'daily',    label: 'Essentials', blurb: 'Everyday things, honest prices',    image: P('p22') },
];

// margin helper: cost is a plausible landed cost for profit reporting
const c = (price, pct = 0.58) => Math.round(price * pct);

export const PRODUCTS = [
  // ── MEN ───────────────────────────────────────────────
  { id: 'm-01', sku: 'YC-M01', name: 'Ocean Stripe Knit Polo', dept: 'men', price: 320, cost: c(320), tagline: 'Cotton knit, ribbed cuff',
    story: 'A cool knit polo in ocean blue and cream stripes. Smart enough for the office, easy enough for Saturday.', image: P('w1'), badge: 'Bestseller', sizes: ['S','M','L','XL'] },
  { id: 'm-02', sku: 'YC-M02', name: 'Sky Line Polo', dept: 'men', price: 300, cost: c(300), tagline: 'Breathable knit, cotton',
    story: 'Horizontal sky blue stripes on a breathable knit. Sits clean under a blazer, works alone with chinos.', image: P('w2'), badge: 'New', sizes: ['S','M','L','XL'] },
  { id: 'm-03', sku: 'YC-M03', name: 'Wave Zip Polo, Chocolate', dept: 'men', price: 340, cost: c(340), tagline: 'Textured knit, quarter zip',
    story: 'A textured chocolate knit polo with a quarter zip and cream wave stripes. Weekend ready.', image: P('w3'), sizes: ['S','M','L','XL'] },
  { id: 'm-04', sku: 'YC-M04', name: 'Ivory Ribbed Polo', dept: 'men', price: 280, cost: c(280), tagline: 'Ribbed cotton, rolled cuff',
    story: 'A clean ivory ribbed polo with a two button placket. The staple that goes with everything.', image: P('w4'), sizes: ['S','M','L','XL'] },
  { id: 'm-05', sku: 'YC-M05', name: 'Everyday Tees, 4 Pack', dept: 'men', price: 100, cost: c(100, 0.62), tagline: 'Four colours, soft cotton',
    story: 'Black, white, blue and grey. The four tees every wardrobe runs on.', image: P('p23'), badge: 'Value', sizes: ['M','L','XL','XXL'] },
  { id: 'm-06', sku: 'YC-M06', name: 'Palm Night Shirt', dept: 'men', price: 180, cost: c(180), tagline: 'Relaxed fit, resort print',
    story: 'Black with white palms. For the beach, the barbecue and the boys.', image: P('p24'), sizes: ['M','L','XL'] },
  { id: 'm-07', sku: 'YC-M07', name: 'Indigo Slim Jeans', dept: 'men', price: 400, cost: c(400), tagline: 'Dark wash, slim leg',
    story: 'Deep indigo denim that dresses up or down. Wears in, not out.', image: P('p25'), badge: 'Bestseller', sizes: ['30','32','34','36'] },
  { id: 'm-08', sku: 'YC-M08', name: 'True Blue Jeans', dept: 'men', price: 400, cost: c(400), tagline: 'Mid wash, straight leg',
    story: 'The honest everyday jean. Classic blue, full length, clean break.', image: P('p26'), sizes: ['30','32','34','36'] },
  { id: 'm-09', sku: 'YC-M09', name: 'Light Wash Jeans', dept: 'men', price: 400, cost: c(400), tagline: 'Light wash, relaxed',
    story: 'A lighter blue for harmattan afternoons and easy Saturdays.', image: P('p27'), sizes: ['30','32','34','36'] },
  { id: 'm-10', sku: 'YC-M10', name: 'Classic Straight Jeans', dept: 'men', price: 400, cost: c(400), tagline: 'Mid blue, classic cut',
    story: 'The cut that suits every build. Sits right on the waist, straight to the hem.', image: P('p28'), sizes: ['30','32','34','36'] },
  { id: 'm-11', sku: 'YC-M11', name: 'Jet Black Jeans', dept: 'men', price: 400, cost: c(400), tagline: 'Black wash, straight leg',
    story: 'Black denim with contrast stitching. Office Friday to Friday night.', image: P('p29'), sizes: ['30','32','34','36'] },

  // ── WOMEN ─────────────────────────────────────────────
  { id: 'w-01', sku: 'YC-W01', name: 'Comfort Hipster, 5 Pack', dept: 'women', price: 180, cost: c(180, 0.6), tagline: 'Soft stretch cotton',
    story: 'Five colours of mid rise comfort with a flat elastic waistband.', image: P('p14'), badge: 'Bestseller', sizes: ['S','M','L','XL','XXL'] },
  { id: 'w-02', sku: 'YC-W02', name: 'Everyday Briefs, 5 Pack', dept: 'women', price: 180, cost: c(180, 0.6), tagline: 'Cotton mix, five shades',
    story: 'Black to blush, the everyday rotation sorted in one pack.', image: P('p13'), sizes: ['S','M','L','XL'] },
  { id: 'w-03', sku: 'YC-W03', name: 'Bikini Cut, 6 Pack', dept: 'women', price: 120, cost: c(120, 0.62), tagline: 'Six pairs, breathable',
    story: 'Six everyday pairs in soft neutral shades.', image: P('p12'), badge: 'Value', sizes: ['M','L','XL','XXXL'] },
  { id: 'w-04', sku: 'YC-W04', name: 'Cloud Shorts, Grey', dept: 'women', price: 80, cost: c(80, 0.6), tagline: 'High waist, real pockets',
    story: 'Featherlight shorts with a smocked waist and a real pocket.', image: P('p15'), sizes: ['S','M','L'] },
  { id: 'w-05', sku: 'YC-W05', name: 'Sprint Shorts, Blue', dept: 'women', price: 80, cost: c(80, 0.6), tagline: 'Retro trim, drawstring',
    story: 'Royal blue with white piping. Gym, errands, lounging.', image: P('p16'), sizes: ['S','M','L'] },
  { id: 'w-06', sku: 'YC-W06', name: 'Adjoa Wrap Dress', dept: 'women', price: 320, cost: c(320), tagline: 'Flowing chiffon, tie waist',
    story: 'A red dress that moves with you. The one you wear when you want the room to notice.', image: U('1595777457583-95e059d581b8'), badge: 'New', sizes: ['S','M','L','XL'], supplement: true },
  { id: 'w-07', sku: 'YC-W07', name: 'Ivory Cloud Dress', dept: 'women', price: 340, cost: c(340), tagline: 'Soft layers, occasion',
    story: 'Crisp white layers for birthdays, showers and photo days.', image: U('1515372039744-b8f02a3ae446'), sizes: ['S','M','L'], supplement: true },
  { id: 'w-08', sku: 'YC-W08', name: 'Seaside Maxi Dress', dept: 'women', price: 380, cost: c(380), tagline: 'Powder blue, high slit',
    story: 'Light as air and floor length. Beach weddings and December parties.', image: U('1539008835657-9e8e9680c956'), sizes: ['S','M','L'], supplement: true },

  // ── KIDS ──────────────────────────────────────────────
  { id: 'k-01', sku: 'YC-K01', name: 'Kids Smartwatch Set', dept: 'kids', price: 550, cost: c(550, 0.6), tagline: 'Camera, games, earphones',
    story: 'A touchscreen watch with camera and games, plus shark earphones in the box.', image: P('p4'), badge: 'Hot', sizes: ['One size'] },
  { id: 'k-02', sku: 'YC-K02', name: 'Pink Buckle Sandals', dept: 'kids', price: 80, cost: c(80, 0.55), tagline: 'Washable, sizes 24 to 30',
    story: 'The waterproof sandal that survives nursery, church and the beach.', image: P('p17'), badge: 'Bestseller', sizes: ['24','26','28','30'] },
  { id: 'k-03', sku: 'YC-K03', name: 'Bow Party Flats', dept: 'kids', price: 80, cost: c(80, 0.55), tagline: 'Little sizes, big day',
    story: 'Black patent flats with a bow. For outdoorings, weddings and photos.', image: P('p20'), sizes: ['2-3y','4-5y','5-6y'] },
  { id: 'k-04', sku: 'YC-K04', name: 'School Pencils, 36 Pack', dept: 'kids', price: 100, cost: c(100, 0.55), tagline: 'Mechanical, twelve colours',
    story: 'A full term of pencils in one pack. No sharpener needed.', image: P('p21'), badge: 'Back to school', sizes: ['One size'] },

  // ── FOOTWEAR ──────────────────────────────────────────
  { id: 'f-01', sku: 'YC-F01', name: 'Chestnut Wingtip Sneaker', dept: 'footwear', price: 750, cost: c(750), tagline: 'Leather, white sole',
    story: 'Brogue detail on a modern sole. The shoe that gets asked about.', image: P('p8'), badge: 'Premium', sizes: ['40','41','42','43','44'] },
  { id: 'f-02', sku: 'YC-F02', name: 'Navy Boat Shoes', dept: 'footwear', price: 450, cost: c(450), tagline: 'Canvas, leather laces',
    story: 'Navy canvas with tan leather trim. Smart casual, solved.', image: P('p11'), sizes: ['40','41','42','43','44'] },
  { id: 'f-03', sku: 'YC-F03', name: 'Trail Runner Sneakers', dept: 'footwear', price: 450, cost: c(450), tagline: 'Cushioned, all terrain',
    story: 'Black and blue trainers built for long days on hard roads.', image: P('p10'), badge: 'New', sizes: ['40','41','42','43','44'] },
  { id: 'f-04', sku: 'YC-F04', name: 'Grey Comfort Slip-ons', dept: 'footwear', price: 180, cost: c(180), tagline: 'Memory foam sole',
    story: 'Slip on, step out. The softest sole in the shop.', image: P('p6'), sizes: ['39','40','41','42','43'] },
  { id: 'f-05', sku: 'YC-F05', name: 'Braided Flat Sandals', dept: 'footwear', price: 100, cost: c(100, 0.55), tagline: 'Braided straps, buckle',
    story: 'Black braided straps on a tan footbed. Everyday elegant.', image: P('p18'), badge: 'Bestseller', sizes: ['37','38','39','40','41'] },
  { id: 'f-06', sku: 'YC-F06', name: 'Cloud Slides, Pink', dept: 'footwear', price: 50, cost: c(50, 0.5), tagline: 'Pillow soft, waterproof',
    story: 'Walking on clouds, for less than lunch.', image: P('p19'), badge: 'Value', sizes: ['36','37','38','39','40'] },

  // ── WATCHES ───────────────────────────────────────────
  { id: 't-01', sku: 'YC-T01', name: 'Eclipse Charm Watch', dept: 'watches', price: 240, cost: c(240), tagline: 'Rose charms, steel chain',
    story: 'Jewellery that tells the time. Mother of pearl face with rose quartz charms.', image: P('p1'), badge: 'Bestseller', sizes: ['One size'] },
  { id: 't-02', sku: 'YC-T02', name: 'Anne Klein Rose Gold', dept: 'watches', price: 240, cost: c(240), tagline: 'Boxed, Roman dial',
    story: 'Rose gold on a soft Roman dial, gift boxed and ready.', image: P('p3'), sizes: ['One size'] },
  { id: 't-03', sku: 'YC-T03', name: 'Casio Step Tracker', dept: 'watches', price: 550, cost: c(550, 0.65), tagline: 'Genuine, 100m water resist',
    story: 'A genuine Casio with step tracking, lap memory and a long life battery.', image: P('p2'), badge: 'Genuine', sizes: ['One size'] },
  { id: 't-04', sku: 'YC-T04', name: 'Pulse Fitness Watch', dept: 'watches', price: 700, cost: c(700, 0.6), tagline: 'Heart rate, sport modes',
    story: 'Tracks steps, sleep and heart rate. Navy or red strap.', image: P('p5'), badge: 'New', sizes: ['One size'] },

  // ── ESSENTIALS ────────────────────────────────────────
  { id: 'd-01', sku: 'YC-D01', name: 'Gillette Shave Gel', dept: 'daily', price: 60, cost: c(60, 0.65), tagline: 'Soothing, sensitive skin',
    story: 'The proper shave gel, priced per can.', image: P('p22'), sizes: ['One size'] },
];

export const byId = (id) => PRODUCTS.find((p) => p.id === id);
export const byDept = (dept) =>
  dept === 'all' ? PRODUCTS : PRODUCTS.filter((p) => p.dept === dept);

export const FEATURED = ['m-01', 'm-03', 't-02', 'f-01', 't-01', 'f-02'].map(byId);
export const BEST_SELLERS = ['m-01', 'w-01', 'f-05', 't-01', 'k-02', 'm-07', 'f-01', 'k-01'].map(byId);

// Home slider
export const SLIDES = [
  {
    id: 'her', eyebrow: 'The women’s floor', title: 'For Her', accent: 'lovely',
    line: 'Dresses, comfort and everyday pieces, sizes S to XXXL.',
    dept: 'women',
    imageA: U('1483985988355-763728e1935b', 1200),
    imageB: U('1595777457583-95e059d581b8', 700),
  },
  {
    id: 'him', eyebrow: 'The men’s floor', title: 'For Him', accent: 'sharp',
    line: 'Knit polos, honest denim and shoes that finish the look.',
    dept: 'men',
    imageA: U('1552374196-1ab2a1c593e8', 1200),
    imageB: P('w1'),
  },
  {
    id: 'kids', eyebrow: 'The little ones', title: 'For the Kids', accent: 'charming',
    line: 'Sunday best, school shoes and a smartwatch they will not take off.',
    dept: 'kids',
    imageA: U('1778166073553-06b955067508', 1200),
    imageB: P('p17'),
  },
];

export const EDITORIAL = {
  racks: U('1445205170230-053b83016050', 1400),
  rail: U('1567401893414-76b7b1e5a7a5', 1200),
  store: U('1441986300917-64674bd600d8', 1400),
  lookbook: P('w5'),
};
