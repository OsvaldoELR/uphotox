import { useState } from 'react';
import ProductCard from './ProductCard';
import type { Product } from '../../data/products';

type FilterKey = 'all' | 'thca' | 'apparel' | 'new' | 'bestseller';

const filters: { key: FilterKey; label: string }[] = [
  { key: 'all',        label: 'ALL' },
  { key: 'thca',       label: 'THCA' },
  { key: 'apparel',    label: 'APPAREL' },
  { key: 'new',        label: 'NEW' },
  { key: 'bestseller', label: 'BESTSELLERS' },
];

interface ProductGridProps {
  products: Product[];
  onAddToCart: (product: Product) => void;
}

export default function ProductGrid({ products, onAddToCart }: ProductGridProps) {
  const [active, setActive] = useState<FilterKey>('all');

  const visible = products.filter((p) => {
    if (active === 'all')        return true;
    if (active === 'thca')       return p.category === 'thca';
    if (active === 'apparel')    return p.category === 'apparel';
    if (active === 'new')        return p.badge === 'NEW';
    if (active === 'bestseller') return p.badge === 'BESTSELLER';
    return true;
  });

  return (
    <section id="products" className="relative z-10 py-24 px-4">
      <div className="max-w-7xl mx-auto">

        {/* Section header */}
        <div className="text-center mb-12">
          <span
            className="block text-[10px] font-mono tracking-[0.4em] mb-4"
            style={{ color: 'rgba(0,255,255,0.45)' }}
          >
            ── PRODUCT CATALOG ──
          </span>
          <h2
            className="text-4xl sm:text-5xl font-black font-mono mb-3"
            style={{ color: '#fff', letterSpacing: '-0.02em' }}
          >
            TOKYO
            <span style={{ color: '#00ffff', textShadow: '0 0 20px rgba(0,255,255,0.5)' }}>
              STORE
            </span>
          </h2>
          <p className="text-xs font-mono" style={{ color: '#4b5563' }}>
            Premium THCA products &amp; apparel · For adults 21+ only
          </p>
        </div>

        {/* Filter pills */}
        <div className="flex flex-wrap justify-center gap-2 mb-12">
          {filters.map((f) => {
            const isActive = active === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setActive(f.key)}
                className="px-5 py-2 text-[10px] font-black font-mono tracking-widest transition-all duration-200"
                style={{
                  background: isActive ? 'rgba(0,255,255,0.12)' : 'rgba(0,0,0,0.5)',
                  color: isActive ? '#00ffff' : '#6b7280',
                  border: `1px solid ${isActive ? 'rgba(0,255,255,0.4)' : 'rgba(255,255,255,0.07)'}`,
                  clipPath: 'polygon(8px 0%, 100% 0%, calc(100% - 8px) 100%, 0% 100%)',
                  boxShadow: isActive ? '0 0 18px rgba(0,255,255,0.2)' : 'none',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLElement).style.color = '#9ca3af';
                    (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.15)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLElement).style.color = '#6b7280';
                    (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.07)';
                  }
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {/* Product grid */}
        {visible.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {visible.map((product, idx) => (
              <div
                key={product.id}
                style={{ animation: `fadeInUp 0.45s ease-out ${idx * 0.06}s both` }}
              >
                <ProductCard product={product} onAddToCart={onAddToCart} />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-24">
            <p className="text-xs font-mono tracking-widest" style={{ color: '#374151' }}>
              NO PRODUCTS IN THIS CATEGORY
            </p>
          </div>
        )}

        {/* Bottom divider */}
        <div className="mt-16 flex items-center justify-center gap-4">
          <div className="h-px flex-1 max-w-xs" style={{ background: 'linear-gradient(to right, transparent, rgba(0,255,255,0.15))' }} />
          <span className="text-[9px] font-mono tracking-widest" style={{ color: '#374151' }}>
            TOKYO INDUSTRIES © 2025
          </span>
          <div className="h-px flex-1 max-w-xs" style={{ background: 'linear-gradient(to left, transparent, rgba(0,255,255,0.15))' }} />
        </div>
      </div>
    </section>
  );
}
