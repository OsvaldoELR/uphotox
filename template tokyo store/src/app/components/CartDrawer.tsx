import { X, Plus, Minus, Trash2, ShoppingCart, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { CartItem } from '../../data/products';

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

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
  cart: CartItem[];
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
}

export default function CartDrawer({ open, onClose, cart, setCart }: CartDrawerProps) {
  const updateQty = (id: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => (item.id === id ? { ...item, qty: item.qty + delta } : item))
        .filter((item) => item.qty > 0)
    );
  };

  const removeItem = (id: number) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  const total     = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const itemCount = cart.reduce((sum, item) => sum + item.qty, 0);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50"
            style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.div
            key="drawer"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className="fixed right-0 top-0 h-full w-full max-w-md z-50 flex flex-col"
            style={{
              background: 'rgba(3,3,12,0.97)',
              borderLeft: '1px solid rgba(0,255,255,0.12)',
              boxShadow: '-20px 0 60px rgba(0,0,0,0.6), -2px 0 20px rgba(0,255,255,0.04)',
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-6 py-5 flex-shrink-0"
              style={{ borderBottom: '1px solid rgba(0,255,255,0.08)' }}
            >
              <div className="flex items-center gap-3">
                <ShoppingCart size={16} style={{ color: '#00ffff' }} />
                <span className="font-mono font-black text-white tracking-widest text-sm">CART</span>
                {itemCount > 0 && (
                  <span
                    className="text-[10px] font-mono font-bold px-2 py-0.5"
                    style={{
                      background: 'rgba(0,255,255,0.12)',
                      color: '#00ffff',
                      border: '1px solid rgba(0,255,255,0.2)',
                    }}
                  >
                    {itemCount} items
                  </span>
                )}
              </div>
              <button
                onClick={onClose}
                className="transition-colors duration-200"
                style={{ color: '#4b5563' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#fff'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#4b5563'; }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              <AnimatePresence mode="popLayout">
                {cart.length === 0 ? (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center justify-center h-full py-20 gap-5"
                  >
                    <ShoppingCart size={48} style={{ color: '#1f2937' }} />
                    <div className="text-center">
                      <p className="text-xs font-mono font-bold tracking-widest mb-2" style={{ color: '#374151' }}>
                        EMPTY CART
                      </p>
                      <p className="text-[11px] font-mono" style={{ color: '#1f2937' }}>
                        Add products to get started
                      </p>
                    </div>
                    <button
                      onClick={onClose}
                      className="px-6 py-2 text-[10px] font-mono font-bold tracking-widest transition-all duration-200"
                      style={{
                        border: '1px solid rgba(0,255,255,0.3)',
                        color: '#00ffff',
                        background: 'rgba(0,255,255,0.05)',
                        clipPath: 'polygon(6px 0%, 100% 0%, calc(100% - 6px) 100%, 0% 100%)',
                      }}
                    >
                      VIEW PRODUCTS
                    </button>
                  </motion.div>
                ) : (
                  cart.map((item) => (
                    <motion.div
                      key={item.id}
                      layout
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20, height: 0, marginBottom: 0 }}
                      transition={{ duration: 0.2 }}
                      className="flex gap-3 p-3"
                      style={{
                        background: 'rgba(255,255,255,0.025)',
                        border: '1px solid rgba(255,255,255,0.05)',
                      }}
                    >
                      {/* Thumbnail */}
                      <div
                        className={`w-14 h-14 flex-shrink-0 bg-gradient-to-br ${item.gradient} flex items-center justify-center text-xl`}
                        style={{ clipPath: 'polygon(4px 0%, 100% 0%, calc(100% - 4px) 100%, 0% 100%)' }}
                      >
                        {subcategoryIcons[item.subcategory]}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-mono font-bold text-white truncate mb-0.5">{item.name}</p>
                        <p className="text-[10px] font-mono mb-1" style={{ color: '#4b5563' }}>
                          {item.subcategory}
                          {item.thca ? ` · ${item.thca}` : ''}
                          {item.flavors ? ` · ${item.flavors} flavors` : ''}
                        </p>
                        <p className="text-sm font-black font-mono" style={{ color: item.accentColor }}>
                          ${(item.price * item.qty).toFixed(2)}
                        </p>
                      </div>

                      {/* Controls */}
                      <div className="flex flex-col items-end justify-between flex-shrink-0">
                        <button
                          onClick={() => removeItem(item.id)}
                          className="transition-colors duration-200"
                          style={{ color: '#374151' }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#ef4444'; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#374151'; }}
                        >
                          <Trash2 size={13} />
                        </button>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateQty(item.id, -1)}
                            className="w-6 h-6 flex items-center justify-center transition-colors duration-150"
                            style={{ border: '1px solid rgba(255,255,255,0.1)', color: '#6b7280' }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#fff'; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#6b7280'; }}
                          >
                            <Minus size={10} />
                          </button>
                          <span className="text-sm font-mono font-bold text-white w-4 text-center">{item.qty}</span>
                          <button
                            onClick={() => updateQty(item.id, 1)}
                            className="w-6 h-6 flex items-center justify-center transition-colors duration-150"
                            style={{ border: '1px solid rgba(255,255,255,0.1)', color: '#6b7280' }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#00ffff'; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#6b7280'; }}
                          >
                            <Plus size={10} />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>

            {/* Footer */}
            {cart.length > 0 && (
              <div
                className="px-6 py-5 flex-shrink-0 space-y-4"
                style={{ borderTop: '1px solid rgba(0,255,255,0.08)' }}
              >
                <div className="space-y-2">
                  <div className="flex justify-between text-[11px] font-mono" style={{ color: '#6b7280' }}>
                    <span>SUBTOTAL ({itemCount} items)</span>
                    <span className="text-white">${total.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[11px] font-mono" style={{ color: '#6b7280' }}>
                    <span>SHIPPING</span>
                    <span style={{ color: '#34d399' }}>FREE</span>
                  </div>
                  <div
                    className="flex justify-between font-black font-mono text-sm pt-3"
                    style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
                  >
                    <span className="text-white tracking-widest">TOTAL</span>
                    <span style={{ color: '#00ffff', textShadow: '0 0 10px rgba(0,255,255,0.6)' }}>
                      ${total.toFixed(2)}
                    </span>
                  </div>
                </div>

                <button
                  className="w-full flex items-center justify-center gap-3 py-4 font-mono font-black text-sm tracking-widest uppercase transition-all duration-300"
                  style={{
                    background: '#00ffff',
                    color: '#000',
                    clipPath: 'polygon(10px 0%, 100% 0%, calc(100% - 10px) 100%, 0% 100%)',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.boxShadow = '0 0 30px rgba(0,255,255,0.7)';
                    (e.currentTarget as HTMLElement).style.background = '#33ffff';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                    (e.currentTarget as HTMLElement).style.background = '#00ffff';
                  }}
                >
                  PROCEED TO CHECKOUT
                  <ArrowRight size={16} />
                </button>

                <p className="text-center text-[10px] font-mono" style={{ color: '#1f2937' }}>
                  ⚠ Adults 21+ only · Check local regulations
                </p>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
