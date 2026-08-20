import { Link } from 'react-router-dom';
import { BRAND } from '../config';
import { DEPARTMENTS } from '../data/products';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <div className="footer-seal">{BRAND.monogram}</div>
            <h3>{BRAND.name}</h3>
            <p>{BRAND.tagline}</p>
            <p className="footer-muted">{BRAND.address} · {BRAND.city}</p>
          </div>

          <div className="footer-col">
            <h4>Departments</h4>
            {DEPARTMENTS.map((d) => (
              <Link key={d.id} to={`/shop?dept=${d.id}`}>{d.label}</Link>
            ))}
          </div>

          <div className="footer-col">
            <h4>The shop</h4>
            <Link to="/shop">All products</Link>
            <Link to="/track">Track your order</Link>
            <Link to="/contact">Visit us</Link>
            <Link to="/policies">Delivery & returns</Link>
            <Link to="/admin">Staff portal</Link>
          </div>

          <div className="footer-col">
            <h4>Talk to us</h4>
            <a href={`tel:${BRAND.phone.replace(/\s/g, '')}`}>{BRAND.phone}</a>
            <a href={`https://wa.me/${BRAND.whatsapp}`} target="_blank" rel="noreferrer">WhatsApp us</a>
            <p className="footer-muted">{BRAND.hours}</p>
          </div>
        </div>

        <div className="footer-bar">
          <span>© {new Date().getFullYear()} {BRAND.name} · {BRAND.city}</span>
          <div className="footer-pay">
            <span>MTN MoMo</span><span>Telecel Cash</span><span>AT Money</span><span>Visa</span><span>Mastercard</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
