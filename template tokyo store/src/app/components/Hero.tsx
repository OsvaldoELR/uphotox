const stats = [
  { value: '50+',  label: 'PRODUCTS'  },
  { value: '100%', label: 'PREMIUM'   },
  { value: '24H',  label: 'SHIPPING'  },
  { value: '★ 4.8', label: 'RATING'  },
];

export default function Hero() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-4 pt-16 pb-8">
      {/* Corner brackets */}
      <div className="absolute top-24 left-8 w-8 h-8 hidden lg:block" style={{ borderTop: '1px solid rgba(0,255,255,0.3)', borderLeft: '1px solid rgba(0,255,255,0.3)' }} />
      <div className="absolute top-24 right-8 w-8 h-8 hidden lg:block" style={{ borderTop: '1px solid rgba(0,255,255,0.3)', borderRight: '1px solid rgba(0,255,255,0.3)' }} />
      <div className="absolute bottom-8 left-8 w-8 h-8 hidden lg:block" style={{ borderBottom: '1px solid rgba(0,255,255,0.3)', borderLeft: '1px solid rgba(0,255,255,0.3)' }} />
      <div className="absolute bottom-8 right-8 w-8 h-8 hidden lg:block" style={{ borderBottom: '1px solid rgba(0,255,255,0.3)', borderRight: '1px solid rgba(0,255,255,0.3)' }} />

      <div className="relative z-10 max-w-5xl mx-auto w-full">

        {/* Japanese label */}
        <div className="mb-6">
          <span
            className="inline-block text-xs font-mono tracking-[0.6em] uppercase"
            style={{ color: 'rgba(0,255,255,0.5)' }}
          >
            ── 東京 · PREMIUM COLLECTION · 東京 ──
          </span>
        </div>

        {/* Glitch title */}
        <div className="mb-4 relative">
          <h1
            className="text-[clamp(4rem,14vw,10rem)] font-black uppercase leading-none animate-glitch-main select-none"
            style={{ fontFamily: 'monospace', color: '#ffffff', letterSpacing: '-0.02em' }}
          >
            TOKYO
            <span
              style={{
                color: '#00ffff',
                textShadow: '0 0 20px #00ffff, 0 0 50px rgba(0,255,255,0.5), 0 0 100px rgba(0,255,255,0.2)',
              }}
            >
              THC
            </span>
          </h1>
          <div
            className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-3/4 h-px"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(0,255,255,0.6), transparent)' }}
          />
        </div>

        {/* Divider */}
        <div className="flex items-center justify-center gap-4 my-8">
          <div className="h-px w-24 sm:w-40" style={{ background: 'linear-gradient(to right, transparent, rgba(0,255,255,0.4))' }} />
          <span className="text-[10px] font-mono tracking-[0.3em] whitespace-nowrap" style={{ color: 'rgba(0,255,255,0.6)' }}>
            ◆ CYBERPUNK DISPENSARY ◆
          </span>
          <div className="h-px w-24 sm:w-40" style={{ background: 'linear-gradient(to left, transparent, rgba(0,255,255,0.4))' }} />
        </div>

        {/* Tagline */}
        <p
          className="text-base sm:text-lg font-mono mb-10 max-w-2xl mx-auto leading-relaxed"
          style={{ color: '#6b7280' }}
        >
          <span style={{ color: '#c084fc' }}>Premium</span> THCA products &amp; exclusive apparel.
          <br />
          Engineered for the future.{' '}
          <span style={{ color: '#00ffff' }}>Available now.</span>
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
          <a
            href="#products"
            className="px-8 py-4 font-mono text-sm font-bold tracking-widest uppercase transition-all duration-300"
            style={{
              background: '#00ffff',
              color: '#000',
              clipPath: 'polygon(12px 0%, 100% 0%, calc(100% - 12px) 100%, 0% 100%)',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow = '0 0 35px rgba(0,255,255,0.7), 0 0 70px rgba(0,255,255,0.3)';
              (e.currentTarget as HTMLElement).style.background = '#33ffff';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow = 'none';
              (e.currentTarget as HTMLElement).style.background = '#00ffff';
            }}
          >
            EXPLORE PRODUCTS
          </a>

          <a
            href="#footer"
            className="px-8 py-4 font-mono text-sm font-bold tracking-widest uppercase transition-all duration-300"
            style={{
              border: '1px solid rgba(168,85,247,0.45)',
              color: '#c084fc',
              background: 'rgba(168,85,247,0.05)',
              clipPath: 'polygon(12px 0%, 100% 0%, calc(100% - 12px) 100%, 0% 100%)',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(168,85,247,0.12)';
              (e.currentTarget as HTMLElement).style.boxShadow = '0 0 20px rgba(168,85,247,0.3)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(168,85,247,0.05)';
              (e.currentTarget as HTMLElement).style.boxShadow = 'none';
            }}
          >
            OUR STORY
          </a>
        </div>

        {/* Stats */}
        <div className="flex flex-wrap justify-center gap-8 sm:gap-16">
          {stats.map((stat, i) => (
            <div key={i} className="text-center">
              <div
                className="text-2xl font-black font-mono"
                style={{ color: '#00ffff', textShadow: '0 0 12px rgba(0,255,255,0.6)' }}
              >
                {stat.value}
              </div>
              <div className="text-[10px] font-mono tracking-widest mt-1" style={{ color: '#4b5563' }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-bounce">
        <span className="text-[10px] font-mono tracking-widest" style={{ color: '#374151' }}>SCROLL</span>
        <div className="w-px h-8" style={{ background: 'linear-gradient(to bottom, rgba(0,255,255,0.4), transparent)' }} />
      </div>
    </section>
  );
}
