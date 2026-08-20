import { Reveal } from '../components/ProductBits';
import { BRAND } from '../config';

const BLOCKS = [
  {
    title: 'Delivery',
    body: [
      'Accra and Tema: same day for orders placed before 3pm, otherwise next morning.',
      'Kumasi, Takoradi and regional capitals: 24 to 48 hours by trusted courier.',
      'Everywhere else in Ghana: 48 hours. Delivery is free on orders above GH₵ 500.',
    ],
  },
  {
    title: 'Returns and exchanges',
    body: [
      'Wrong size or a change of heart? Bring or send the item back within 7 days, unworn and with its tags, and we will exchange it or refund you.',
      'Underwear and personal care items cannot be returned once opened, for hygiene reasons.',
      'Faulty items are replaced or refunded in full, always.',
    ],
  },
  {
    title: 'Payments',
    body: [
      'We accept MTN MoMo, Telecel Cash, AT Money and all Visa and Mastercard payments, processed securely.',
      'Cash on delivery is available within Accra and Tema.',
      'A receipt is sent to your phone for every order.',
    ],
  },
  {
    title: 'Privacy',
    body: [
      'We only collect the details needed to deliver your order: your name, phone number and address.',
      'We never sell or share your information. You can ask us to delete your details at any time.',
    ],
  },
];

export default function Policies() {
  return (
    <div className="page">
      <div className="container policies">
        <Reveal className="page-head">
          <span className="eyebrow">The small print, kept short</span>
          <h1>Delivery <em className="accent-italic">& returns</em></h1>
        </Reveal>

        {BLOCKS.map((b, i) => (
          <Reveal key={b.title} delay={i * 0.06} className="policy-block">
            <h2>{b.title}</h2>
            <ul>
              {b.body.map((line) => <li key={line}>{line}</li>)}
            </ul>
          </Reveal>
        ))}

        <Reveal className="policy-block">
          <h2>Questions?</h2>
          <p>Call or WhatsApp {BRAND.phone}. {BRAND.hours}.</p>
        </Reveal>
      </div>
    </div>
  );
}
