import { useState } from 'react';
import { ShoppingCart, Menu, X } from 'lucide-react';

interface NavbarProps {
  cartCount: number;
  onCartClick: () => void;
}

const links = [
  { label: 'HOME',     href: '#' },
  { label: 'PRODUCTS', href: '#products' },
  { label: 'THCA',     href: '#products' },
  { label: 'APPAREL',  href: '#products' },
  { label: 'CONTACT',  href: '#footer' },
];

export default function Navbar({ cartCount, onCartClick }: NavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="fixed top-0 inset-x-0 z-50">
      <div
        style={{
          background: 'rgba(0, 0, 0, 0.75)',
          borderBottom: '1px solid rgba(0,255,255,0.12)',
          boxShadow: '0 4px 30px rgba(0,0,0,0.4), 0 1px 0 rgba(0,255,255,0.08)',
          backdropFilter: 'blur(16px)',
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">

            {/* Logo */}
            <div className="flex items-center gap-2 select-none">
              <div className="flex flex-col leading-none">
                <span
                  className="text-[9px] font-mono tracking-[0.4em]"
                  style={{ color: 'rgba(0,255,255,0.5)' }}
                >
                  東京
                </span>
                <span
                  className="text-lg font-black font-mono tracking-widest"
                  style={{
                    color: '#fff',
                    textShadow: '0 0 15px rgba(0,255,255,0.4)',
                    letterSpacing: '0.12em',
                  }}
                >
                  TOKYO<span style={{ color: '#00ffff', textShadow: '0 0 20px #00ffff, 0 0 40px rgba(0,255,255,0.4)' }}>THC</span>
                </span>
              </div>
            </div>

            {/* Desktop links */}
            <div className="hidden md:flex items-center gap-8">
              {links.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="text-[11px] font-mono font-bold tracking-[0.18em] text-gray-500 transition-all duration-200"
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.color = '#00ffff';
                    (e.currentTarget as HTMLElement).style.textShadow = '0 0 8px rgba(0,255,255,0.6)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.color = '';
                    (e.currentTarget as HTMLElement).style.textShadow = '';
                  }}
                >
                  {link.label}
                </a>
              ))}
            </div>

            {/* Right controls */}
            <div className="flex items-center gap-3">
              <button
                onClick={onCartClick}
                className="flex items-center gap-2 px-4 py-2 font-mono text-xs font-bold tracking-wider transition-all duration-200"
                style={{
                  border: '1px solid rgba(0,255,255,0.3)',
                  color: '#00ffff',
                  background: 'rgba(0,255,255,0.04)',
                  clipPath: 'polygon(8px 0%, 100% 0%, calc(100% - 8px) 100%, 0% 100%)',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = 'rgba(0,255,255,0.12)';
                  (e.currentTarget as HTMLElement).style.boxShadow = '0 0 20px rgba(0,255,255,0.25)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = 'rgba(0,255,255,0.04)';
                  (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                }}
              >
                <ShoppingCart size={14} />
                {cartCount > 0 ? (
                  <span
                    className="text-[11px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center"
                    style={{ background: '#00ffff', color: '#000', padding: '0 4px' }}
                  >
                    {cartCount}
                  </span>
                ) : (
                  <span className="hidden sm:inline">CART</span>
                )}
              </button>

              <button
                className="md:hidden p-2 transition-colors duration-200"
                style={{ color: '#6b7280' }}
                onClick={() => setMenuOpen(!menuOpen)}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#00ffff'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#6b7280'; }}
              >
                {menuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div
            className="md:hidden px-4 py-4 space-y-1"
            style={{
              borderTop: '1px solid rgba(0,255,255,0.08)',
              background: 'rgba(0,0,0,0.9)',
            }}
          >
            {links.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="block py-3 text-[11px] font-mono font-bold tracking-[0.2em] text-gray-500 hover:text-cyan-400 transition-colors border-b"
                style={{ borderColor: 'rgba(255,255,255,0.04)' }}
                onClick={() => setMenuOpen(false)}
              >
                {link.label}
              </a>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}
