import { useState } from 'react';
import { ShoppingCart, Star } from 'lucide-react';
import type { Product } from '../../data/products';

const subcategoryIcons: Record<string, string> = {
  Flower:      '🌿',
  Disposable:  '💨',
  Preroll:     '🌀',
  Concentrate: '💎',
  Gummies:     '🍬',
  Cartridge:   '💨',
  Tee:         '👕',
  Hoodie:      '🧥',
  Cap:         '🧢',
  Jacket:      '🥷',
};

const badgeConfig: Record<string, { bg: string; color: string; glow: string }> = {
  BESTSELLER: { bg: '#f59e0b', color: '#000', glow: 'rgba(245,158,11,0.6)' },
  NEW:        { bg: '#10b981', color: '#000', glow: 'rgba(16,185,129,0.6)' },
  LIMITED:    { bg: '#ef4444', color: '#fff', glow: 'rgba(239,68,68,0.6)'  },
  HOT:        { bg: '#f97316', color: '#000', glow: 'rgba(249,115,22,0.6)' },
};

interface ProductCardProps {
  product: Product;
  onAddToCart: (product: Product) => void;
}

export default function ProductCard({ product, onAddToCart }: ProductCardProps) {
  const [hovered, setHovered] = useState(false);
  const [adding, setAdding]   = useState(false);

  const handleAdd = () => {
    if (adding) return;
    setAdding(true);
    onAddToCart(product);
    setTimeout(() => setAdding(false), 700);
  };

  const filledStars = Math.round(product.rating);

  const categoryColor = product.category === 'thca'
    ? { bg: 'rgba(16,185,129,0.1)', text: '#34d399', border: 'rgba(16,185,129,0.2)' }
    : { bg: 'rgba(139,92,246,0.1)', text: '#a78bfa', border: 'rgba(139,92,246,0.2)' };

  const infoTag = product.category === 'thca'
    ? (product.thca ?? 'THCA')
    : product.subcategory.toUpperCase();

  return (
    <div
      className="relative flex flex-col overflow-hidden transition-all duration-300"
      style={{
        background: hovered ? 'rgba(5,5,20,0.88)' : 'rgba(0,0,0,0.62)',
        border: `1px solid ${hovered ? product.accentColor + '55' : 'rgba(255,255,255,0.07)'}`,
        boxShadow: hovered
          ? `0 0 25px ${product.accentColor}20, 0 20px 50px rgba(0,0,0,0.5), inset 0 0 30px ${product.accentColor}06`
          : '0 4px 20px rgba(0,0,0,0.3)',
        transform: hovered ? 'translateY(-6px)' : 'translateY(0)',
        backdropFilter: 'blur(8px)',
        clipPath: 'polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px))',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* ── Image / Visual Area ───────────────────────────────── */}
      <div className={`relative h-48 bg-gradient-to-br ${product.gradient} overflow-hidden flex-shrink-0`}>
        {/* Lighting layers */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: [
              'radial-gradient(circle at 25% 75%, rgba(255,255,255,0.06) 0%, transparent 50%)',
              'radial-gradient(circle at 75% 25%, rgba(255,255,255,0.09) 0%, transparent 50%)',
            ].join(', '),
          }}
        />

        {/* Hex grid */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.07]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id={`hex-${product.id}`} x="0" y="0" width="60" height="52" patternUnits="userSpaceOnUse">
              <polygon points="30,1 59,16 59,36 30,51 1,36 1,16" fill="none" stroke="white" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill={`url(#hex-${product.id})`} />
        </svg>

        {/* Center glow orb */}
        <div
          className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-28 h-28 rounded-full ${product.glowColor} transition-opacity duration-300`}
          style={{ filter: 'blur(24px)', opacity: hovered ? 0.65 : 0.35 }}
        />

        {/* ── data-stream sweep (SEN-NIN effect) ─────────────── */}
        <div className="absolute inset-0 data-stream pointer-events-none" style={{ opacity: 0.35 }} />

        {/* Subcategory icon */}
        <div
          className="absolute top-3 left-3 text-2xl select-none"
          style={{ filter: 'drop-shadow(0 0 8px rgba(255,255,255,0.6))' }}
        >
          {subcategoryIcons[product.subcategory]}
        </div>

        {/* Badge */}
        {product.badge && (() => {
          const cfg = badgeConfig[product.badge];
          return (
            <div
              className="absolute top-3 right-3 px-2 py-0.5 text-[10px] font-black font-mono tracking-widest"
              style={{
                background: cfg.bg,
                color: cfg.color,
                clipPath: 'polygon(4px 0%, 100% 0%, calc(100% - 4px) 100%, 0% 100%)',
                boxShadow: `0 0 12px ${cfg.glow}`,
              }}
            >
              {product.badge}
            </div>
          );
        })()}

        {/* Type tag bottom-right */}
        <div
          className="absolute bottom-3 right-3 px-2 py-1 text-[10px] font-mono font-bold"
          style={{
            background: 'rgba(0,0,0,0.75)',
            border: `1px solid ${product.accentColor}45`,
            color: product.accentColor,
          }}
        >
          {infoTag}
        </div>

        {/* Hover scan line */}
        {hovered && (
          <div
            className="absolute left-0 w-full animate-scan pointer-events-none"
            style={{
              height: '1px',
              background: `linear-gradient(90deg, transparent, ${product.accentColor}80, transparent)`,
              boxShadow: `0 0 6px ${product.accentColor}`,
            }}
          />
        )}

        {/* Corner cut accent */}
        <div
          className="absolute top-0 right-0 w-3 h-3"
          style={{
            background: product.accentColor,
            clipPath: 'polygon(100% 0%, 0% 0%, 100% 100%)',
            opacity: 0.7,
          }}
        />
      </div>

      {/* ── Card body ─────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 p-4 relative overflow-hidden">
        {/* data-stream overlay on card body (SEN-NIN effect) */}
        <div className="absolute inset-0 data-stream pointer-events-none" style={{ opacity: 0.18 }} />

        {/* Category pill */}
        <div className="flex items-center gap-2 mb-2 relative z-10">
          <span
            className="text-[9px] font-mono font-bold tracking-widest px-2 py-0.5"
            style={{
              background: categoryColor.bg,
              color: categoryColor.text,
              border: `1px solid ${categoryColor.border}`,
            }}
          >
            {product.category.toUpperCase()} · {product.subcategory.toUpperCase()}
          </span>
        </div>

        {/* Product name */}
        <h3
          className="text-sm font-bold font-mono mb-1.5 text-white transition-all duration-200 leading-tight relative z-10"
          style={{ textShadow: hovered ? `0 0 8px ${product.accentColor}70` : 'none' }}
        >
          {product.name}
        </h3>

        {/* Flavors / Pack size */}
        {(product.flavors || product.packSize) && (
          <p className="text-[10px] font-mono mb-2 relative z-10" style={{ color: product.accentColor + 'aa' }}>
            {product.flavors ? `${product.flavors} flavors · ` : ''}{product.packSize ?? ''}
          </p>
        )}

        {/* Description */}
        <p className="text-[11px] font-mono leading-relaxed flex-1 mb-3 relative z-10" style={{ color: '#4b5563' }}>
          {product.description}
        </p>

        {/* Rating */}
        <div className="flex items-center gap-1.5 mb-3 relative z-10">
          <div className="flex gap-0.5">
            {Array.from({ length: 5 }, (_, i) => (
              <Star
                key={i}
                size={10}
                fill={i < filledStars ? '#f59e0b' : 'none'}
                color={i < filledStars ? '#f59e0b' : '#374151'}
              />
            ))}
          </div>
          <span className="text-[10px] font-mono" style={{ color: '#4b5563' }}>
            {product.rating} ({product.reviews})
          </span>
        </div>

        {/* Price + Add to Cart */}
        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-baseline gap-1.5">
            <span
              className="text-lg font-black font-mono"
              style={{
                color: product.accentColor,
                textShadow: hovered ? `0 0 10px ${product.accentColor}80` : 'none',
              }}
            >
              ${product.price}
            </span>
            {product.originalPrice && (
              <span className="text-xs font-mono line-through" style={{ color: '#374151' }}>
                ${product.originalPrice}
              </span>
            )}
          </div>

          <button
            onClick={handleAdd}
            className="flex items-center gap-1.5 px-3 py-2 text-[10px] font-black font-mono tracking-wider transition-all duration-200"
            style={{
              background: adding ? product.accentColor : 'transparent',
              color: adding ? '#000' : product.accentColor,
              border: `1px solid ${product.accentColor}55`,
              clipPath: 'polygon(6px 0%, 100% 0%, calc(100% - 6px) 100%, 0% 100%)',
              boxShadow: adding ? `0 0 20px ${product.accentColor}70` : 'none',
              transform: adding ? 'scale(0.95)' : 'scale(1)',
            }}
          >
            <ShoppingCart size={11} />
            {adding ? 'ADDED ✓' : 'ADD'}
          </button>
        </div>
      </div>
    </div>
  );
}
