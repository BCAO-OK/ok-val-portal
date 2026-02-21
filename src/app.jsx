import React, { useState, useEffect } from 'react';
import { 
  Github, 
  Layers, 
  Zap, 
  Shield, 
  ArrowRight, 
  CheckCircle2, 
  Menu, 
  X 
} from 'lucide-react';

/**
 * App Component
 * A modern, responsive landing page template built with React and Tailwind CSS.
 * Features a sticky navigation, hero section with interactive elements, and a feature grid.
 */
export default function App() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [counter, setCounter] = useState(0);
  const [scrolled, setScrolled] = useState(false);

  // Handle scroll effect for navbar transparency
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const features = [
    {
      title: "Lightning Fast",
      description: "Optimized for speed with built-in performance best practices.",
      icon: <Zap className="w-6 h-6 text-yellow-500" />
    },
    {
      title: "Secure by Design",
      description: "Enterprise-grade security protocols implemented at every level.",
      icon: <Shield className="w-6 h-6 text-blue-500" />
    },
    {
      title: "Scalable Architecture",
      description: "Grow from 1 to 1 million users without breaking a sweat.",
      icon: <Layers className="w-6 h-6 text-purple-500" />
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* Navigation */}
      <nav className={`fixed w-full z-50 transition-all duration-300 ${scrolled ? 'bg-white/80 backdrop-blur-md shadow-sm py-3' : 'bg-transparent py-5'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Zap className="text-white w-5 h-5 fill-current" />
              </div>
              <span className="text-xl font-bold tracking-tight text-slate-900">NovaStack</span>
            </div>
            
            {/* Desktop Menu */}
            <div className="hidden md:flex items-center space-x-8">
              <a href="#" className="text-sm font-medium hover:text-blue-600 transition-colors">Features</a>
              <a href="#" className="text-sm font-medium hover:text-blue-600 transition-colors">Pricing</a>
              <a href="#" className="text-sm font-medium hover:text-blue-600 transition-colors">Documentation</a>
              <button className="bg-slate-900 text-white px-5 py-2 rounded-full text-sm font-medium hover:bg-slate-800 transition-all active:scale-95">
                Get Started
              </button>
            </div>

            {/* Mobile Menu Button */}
            <div className="md:hidden">
              <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2 text-slate-600">
                {isMenuOpen ? <X /> : <Menu />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu Overlay */}
        {isMenuOpen && (
          <div className="md:hidden bg-white border-t border-slate-100 p-4 space-y-4 animate-in slide-in-from-top duration-200">
            <a href="#" className="block text-base font-medium text-slate-600">Features</a>
            <a href="#" className="block text-base font-medium text-slate-600">Pricing</a>
            <a href="#" className="block text-base font-medium text-slate-600">Documentation</a>
            <button className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium">Get Started</button>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <main className="pt-32 pb-16 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center space-x-2 bg-blue-50 text-blue-700 px-4 py-1.5 rounded-full mb-8 animate-bounce-subtle">
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-sm font-medium">v2.5 now available for preview</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-slate-900 mb-6">
            Build the future <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">faster than ever.</span>
          </h1>
          
          <p className="max-w-2xl mx-auto text-lg md:text-xl text-slate-600 mb-10 leading-relaxed">
            NovaStack provides the ultimate starter kit for developers who want to ship high-quality applications without the boilerplate headache.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4">
            <button className="w-full sm:w-auto px-8 py-4 bg-blue-600 text-white rounded-2xl font-semibold shadow-lg shadow-blue-200 hover:bg-blue-700 hover:-translate-y-1 transition-all active:scale-95 flex items-center justify-center">
              Start Building <ArrowRight className="ml-2 w-5 h-5" />
            </button>
            <button className="w-full sm:w-auto px-8 py-4 bg-white text-slate-700 border border-slate-200 rounded-2xl font-semibold hover:bg-slate-50 transition-all flex items-center justify-center">
              <Github className="mr-2 w-5 h-5" /> View on GitHub
            </button>
          </div>

          {/* Interactive Demo Block */}
          <div className="mt-20 p-8 bg-white border border-slate-200 rounded-3xl shadow-xl max-w-lg mx-auto">
            <p className="text-sm font-semibold text-slate-400 uppercase tracking-widest mb-4">Interactive Demo</p>
            <h3 className="text-2xl font-bold mb-6 text-slate-900">Test Reactive State</h3>
            <div className="flex items-center justify-center space-x-6">
              <button 
                onClick={() => setCounter(c => Math.max(0, c - 1))}
                className="w-12 h-12 rounded-full border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors text-slate-900 font-bold"
              >
                -
              </button>
              <span className="text-4xl font-mono font-bold w-16 text-slate-900">{counter}</span>
              <button 
                onClick={() => setCounter(c => c + 1)}
                className="w-12 h-12 rounded-full bg-slate-900 text-white flex items-center justify-center hover:bg-slate-800 transition-colors font-bold"
              >
                +
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Features Grid */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-12">
            {features.map((feature, index) => (
              <div key={index} className="group p-8 rounded-2xl border border-transparent hover:border-slate-100 hover:bg-slate-50/50 transition-all">
                <div className="mb-4 inline-block p-3 bg-white rounded-xl shadow-sm group-hover:shadow-md transition-shadow">
                  {feature.icon}
                </div>
                <h4 className="text-xl font-bold mb-2 text-slate-900">{feature.title}</h4>
                <p className="text-slate-600 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-slate-200 text-center">
        <p className="text-slate-400 text-sm">
          © {new Date().getFullYear()} NovaStack Framework. All rights reserved.
        </p>
      </footer>

      <style>{`
        @keyframes bounce-subtle {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        .animate-bounce-subtle {
          animation: bounce-subtle 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}