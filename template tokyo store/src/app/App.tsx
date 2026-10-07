import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Toaster, toast } from 'sonner';
import CyberpunkBackground from './components/CyberpunkBackground';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import ProductGrid from './components/ProductGrid';
import CartDrawer from './components/CartDrawer';
import Footer from './components/Footer';
import AgeGate from './components/AgeGate';
import { products } from '../data/products';
import type { CartItem, Product } from '../data/products';

export default function App() {
  const [ageVerified, setAgeVerified] = useState(false);
  const [cart, setCart]               = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen]       = useState(false);

  const addToCart = useCallback((product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id ? { ...item, qty: item.qty + 1 } : item
        );
      }
      return [...prev, { ...product, qty: 1 }];
    });

    toast.success(`${product.name} added`, {
      description: `${product.thca ? `${product.thca} · ` : ''}$${product.price}`,
      duration: 2500,
      style: {
        background: 'rgba(3,3,12,0.97)',
        border: '1px solid rgba(0,255,255,0.25)',
        color: '#00ffff',
        fontFamily: 'monospace',
        fontSize: '12px',
        letterSpacing: '0.05em',
      },
    });
  }, []);

  const cartCount = cart.reduce((sum, item) => sum + item.qty, 0);

  return (
    <div className="relative min-h-screen bg-black text-white overflow-x-hidden">

      {/* Age gate — renders on top of everything, removed with exit animation */}
      <AnimatePresence>
        {!ageVerified && (
          <motion.div
            key="age-gate"
            exit={{ opacity: 0, scale: 1.04 }}
            transition={{ duration: 0.45, ease: 'easeIn' }}
            className="fixed inset-0 z-[100]"
          >
            <AgeGate onConfirm={() => setAgeVerified(true)} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main site — blurred until age verified */}
      <motion.div
        animate={{ filter: ageVerified ? 'blur(0px)' : 'blur(8px)', scale: ageVerified ? 1 : 1.02 }}
        transition={{ duration: 0.5 }}
        className="relative"
      >
        <CyberpunkBackground />

        <div className="relative z-10">
          <Navbar cartCount={cartCount} onCartClick={() => setCartOpen(true)} />
          <Hero />
          <ProductGrid products={products} onAddToCart={addToCart} />
          <Footer />
        </div>

        <CartDrawer
          open={cartOpen}
          onClose={() => setCartOpen(false)}
          cart={cart}
          setCart={setCart}
        />
      </motion.div>

      <Toaster position="bottom-right" />
    </div>
  );
}
