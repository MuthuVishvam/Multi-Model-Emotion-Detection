import { Link } from "react-router-dom";

export default function Navbar({ brand = "Emotion Learning Platform", links = [] }) {
  return (
    <header className="top-navbar">
      <div className="top-navbar__brand">
        <Link to="/">{brand}</Link>
      </div>
      <nav className="top-navbar__nav" aria-label="Primary">
        {links.map((item) => (
          <Link key={item.to} to={item.to} className="nav-pill">
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
