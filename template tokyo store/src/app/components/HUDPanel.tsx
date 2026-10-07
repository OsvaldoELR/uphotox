import { useState, useEffect } from 'react';
import { DollarSign, Clock, Wifi, Heart, Shield, Star, User } from 'lucide-react';

export function HUDPanel() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [money, setMoney] = useState(125420);
  const [ping, setPing] = useState(42);
  const [health, setHealth] = useState(87);
  const [armor, setArmor] = useState(64);
  const [wantedLevel, setWantedLevel] = useState(3);
  const [username] = useState("CYBER_RUNNER");

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    // Simulate dynamic data updates
    const dataTimer = setInterval(() => {
      setPing(prev => Math.max(15, Math.min(150, prev + (Math.random() - 0.5) * 10)));
      setHealth(prev => Math.max(0, Math.min(100, prev + (Math.random() - 0.5) * 2)));
      setArmor(prev => Math.max(0, Math.min(100, prev + (Math.random() - 0.5) * 2)));
    }, 3000);

    return () => {
      clearInterval(timer);
      clearInterval(dataTimer);
    };
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatMoney = (amount: number) => {
    return amount.toLocaleString();
  };

  return (
    <div className="absolute top-20 right-8 w-80">
      {/* Glassmorphism Panel */}
      <div className="relative p-6 rounded-xl border border-cyan-500/30"
           style={{
             background: `
               linear-gradient(135deg, 
                 rgba(0, 255, 255, 0.1) 0%,
                 rgba(0, 100, 255, 0.05) 100%
               )
             `,
             backdropFilter: 'blur(15px)',
             boxShadow: `
               0 0 20px rgba(0, 255, 255, 0.3),
               inset 0 1px 0 rgba(255, 255, 255, 0.1),
               inset 0 -1px 0 rgba(0, 0, 0, 0.1)
             `
           }}>
        
        {/* Corner Accents */}
        <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-cyan-400" />
        <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-cyan-400" />
        <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-cyan-400" />
        <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-cyan-400" />

        <div className="space-y-4">
          {/* Username Display */}
          <div className="flex items-center justify-between p-3 bg-pink-500/10 rounded-lg border border-pink-400/30">
            <div className="flex items-center space-x-3">
              <User className="w-6 h-6 text-pink-400" 
                    style={{
                      filter: 'drop-shadow(0 0 5px #ec4899)',
                      animation: 'pulse 2.3s infinite'
                    }} />
              <span className="text-pink-400 font-mono text-lg">{username}</span>
            </div>
            <div className="w-2 h-2 bg-pink-400 rounded-full animate-pulse" />
          </div>

          {/* Money Display */}
          <div className="flex items-center justify-between p-3 bg-green-500/10 rounded-lg border border-green-400/30">
            <div className="flex items-center space-x-3">
              <DollarSign className="w-6 h-6 text-green-400" 
                         style={{
                           filter: 'drop-shadow(0 0 5px #22c55e)',
                           animation: 'pulse 2s infinite'
                         }} />
              <span className="text-green-400 font-mono text-lg">${formatMoney(money)}</span>
            </div>
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          </div>

          {/* Time Display */}
          <div className="flex items-center justify-between p-3 bg-blue-500/10 rounded-lg border border-blue-400/30">
            <div className="flex items-center space-x-3">
              <Clock className="w-6 h-6 text-blue-400" 
                     style={{
                       filter: 'drop-shadow(0 0 5px #3b82f6)',
                       animation: 'pulse 1.8s infinite'
                     }} />
              <span className="text-blue-400 font-mono text-lg">{formatTime(currentTime)}</span>
            </div>
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
          </div>

          {/* WiFi/Ping Display */}
          <div className="flex items-center justify-between p-3 bg-cyan-500/10 rounded-lg border border-cyan-400/30">
            <div className="flex items-center space-x-3">
              <Wifi className="w-6 h-6 text-cyan-400" 
                    style={{
                      filter: 'drop-shadow(0 0 5px #06b6d4)',
                      animation: 'pulse 2.2s infinite'
                    }} />
              <span className="text-cyan-400 font-mono text-lg">{Math.round(ping)}ms</span>
            </div>
            <div className="flex space-x-1">
              {[...Array(3)].map((_, i) => (
                <div key={i} 
                     className={`w-1 h-3 rounded-full ${ping < 50 ? 'bg-cyan-400' : ping < 100 ? 'bg-yellow-400' : 'bg-red-400'}`}
                     style={{ opacity: i < (ping < 50 ? 3 : ping < 100 ? 2 : 1) ? 1 : 0.3 }} />
              ))}
            </div>
          </div>

          {/* Health and Armor Bars Side by Side */}
          <div className="grid grid-cols-2 gap-3">
            {/* Health Bar */}
            <div className="p-3 bg-red-500/10 rounded-lg border border-red-400/30">
              <div className="flex items-center mb-2">
                <Heart className="w-4 h-4 text-red-400 mr-2" 
                       style={{
                         filter: 'drop-shadow(0 0 5px #ef4444)',
                         animation: 'pulse 1.6s infinite'
                       }} />
                <span className="text-red-400 font-mono text-xs">HEALTH</span>
              </div>
              <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-red-400 rounded-full transition-all duration-300"
                     style={{ 
                       width: `${health}%`,
                       boxShadow: '0 0 10px #ef4444'
                     }} />
              </div>
            </div>

            {/* Armor Bar */}
            <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-400/30">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <Shield className="w-4 h-4 text-blue-400" 
                          style={{
                            filter: 'drop-shadow(0 0 5px #3b82f6)',
                            animation: 'pulse 2s infinite'
                          }} />
                  <span className="text-blue-400 font-mono text-xs">ARMOR</span>
                </div>
                <span className="text-blue-400 font-mono text-xs">{armor}%</span>
              </div>
              <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-blue-400 rounded-full transition-all duration-300"
                     style={{ 
                       width: `${armor}%`,
                       boxShadow: '0 0 10px #3b82f6'
                     }} />
              </div>
            </div>
          </div>

          {/* Wanted Level */}
          <div className="p-3 bg-yellow-500/10 rounded-lg border border-yellow-400/30">
            <div className="flex items-center justify-between mb-2">
              <span className="text-yellow-400 font-mono">WANTED</span>
            </div>
            <div className="flex justify-center space-x-0.5">
              {[...Array(6)].map((_, i) => (
                <Star key={i} 
                      className={`w-5 h-5 ${i < wantedLevel ? 'text-yellow-400 fill-current' : 'text-gray-600'}`}
                      style={{
                        filter: i < wantedLevel ? 'drop-shadow(0 0 5px #eab308)' : 'none',
                        animation: i < wantedLevel ? 'pulse 1.5s infinite' : 'none',
                        animationDelay: `${i * 0.1}s`
                      }} />
              ))}
            </div>
          </div>
        </div>

        {/* Scanning Line Animation */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl">
          <div className="absolute w-full h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-50 animate-scan" />
        </div>
      </div>
    </div>
  );
}