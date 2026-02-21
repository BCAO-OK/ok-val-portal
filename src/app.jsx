import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Database, 
  ShieldCheck, 
  BarChart3, 
  Users, 
  Settings, 
  Search, 
  Bell, 
  TrendingUp, 
  Activity,
  Box,
  ChevronRight,
  MoreHorizontal,
  LogOut,
  Zap
} from 'lucide-react';

/**
 * PROJECT: OK-VAL
 * THEME: Navy & Dark Gray Professional
 * LOGO: Custom 'V' with section lines
 */

const OKValLogo = ({ className = "w-10 h-10" }) => (
  <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Background Shield Shape */}
    <path d="M15 25C15 18 20 15 25 15H75C80 15 85 18 85 25V60C85 75 50 85 50 85C50 85 15 75 15 60V25Z" fill="url(#navyGradient)" />
    
    {/* The Section Lines (The "Grid" or "Sectors") */}
    <path d="M50 15V85" stroke="white" strokeWidth="0.5" strokeOpacity="0.2" />
    <path d="M15 35H85" stroke="white" strokeWidth="0.5" strokeOpacity="0.2" />
    <path d="M15 55H85" stroke="white" strokeWidth="0.5" strokeOpacity="0.2" />
    
    {/* The Stylized 'V' */}
    <path 
      d="M30 35L50 70L70 35" 
      stroke="white" 
      strokeWidth="8" 
      strokeLinecap="round" 
      strokeLinejoin="round"
      className="drop-shadow-lg"
    />
    
    {/* Accent Dot/Node */}
    <circle cx="50" cy="70" r="4" fill="#60A5FA" />

    <defs>
      <linearGradient id="navyGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#1E40AF" />
        <stop offset="100%" stopColor="#1E293B" />
      </linearGradient>
    </defs>
  </svg>
);

const App = () => {
  const [activePage, setActivePage] = useState('dashboard');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  const SidebarLink = ({ id, icon: Icon, label }) => (
    <button
      onClick={() => setActivePage(id)}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative ${
        activePage === id 
          ? 'bg-[#1E293B] text-white shadow-[0_4px_20px_rgba(0,0,0,0.3)]' 
          : 'text-slate-400 hover:text-white hover:bg-[#1E293B]/40'
      }`}
    >
      {activePage === id && (
        <div className="absolute left-0 w-1 h-6 bg-blue-500 rounded-r-full" />
      )}
      <Icon size={18} className={activePage === id ? 'text-blue-400' : 'group-hover:text-blue-300'} />
      <span className="font-semibold text-sm tracking-tight">{label}</span>
    </button>
  );

  return (
    <div className="flex h-screen bg-[#020617] text-slate-200 font-sans selection:bg-blue-500/30 overflow-hidden">
      {/* SIDEBAR */}
      <aside className="w-72 bg-[#0F172A] border-r border-slate-800/60 flex flex-col z-20 shadow-2xl">
        <div className="p-8 pb-10">
          <div className="flex items-center gap-4">
            <OKValLogo className="w-12 h-12" />
            <div>
              <h1 className="text-2xl font-black tracking-tighter text-white leading-none italic">OK-VAL</h1>
              <div className="flex items-center gap-1 mt-1">
                <div className="w-1 h-1 rounded-full bg-blue-500 animate-pulse" />
                <p className="text-[9px] uppercase tracking-[0.3em] text-slate-500 font-bold">CORE ENGINE</p>
              </div>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-2 overflow-y-auto">
          <div className="text-[10px] uppercase tracking-widest text-slate-600 font-black px-4 mb-4 mt-2">Operations</div>
          <SidebarLink id="dashboard" icon={LayoutDashboard} label="Dashboard" />
          <SidebarLink id="database" icon={Database} label="Vault Explorer" />
          <SidebarLink id="analytics" icon={BarChart3} label="Engine Stats" />
          
          <div className="text-[10px] uppercase tracking-widest text-slate-600 font-black px-4 mb-4 mt-8">Administration</div>
          <SidebarLink id="users" icon={Users} label="Permissions" />
          <SidebarLink id="settings" icon={Settings} label="System Config" />
        </nav>

        <div className="p-6 mt-auto border-t border-slate-800/40">
          <div className="bg-[#1E293B]/60 rounded-2xl p-4 border border-slate-800 flex items-center gap-3">
             <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-slate-700 to-slate-800 border border-slate-600 flex items-center justify-center overflow-hidden">
                <Activity size={20} className="text-slate-400" />
             </div>
             <div className="flex-1 overflow-hidden">
                <p className="text-xs font-bold text-white truncate">Admin_Console</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-tighter">Verified Node</p>
             </div>
             <LogOut size={16} className="text-slate-500 hover:text-rose-400 cursor-pointer transition-colors" />
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col overflow-hidden relative bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-[#1e293b1a] via-[#020617] to-[#020617]">
        {/* Header */}
        <header className="h-20 border-b border-slate-800/40 flex items-center justify-between px-10 backdrop-blur-md bg-[#020617]/40 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-white tracking-tight capitalize">{activePage.replace('-', ' ')}</h2>
            <div className="px-2 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20 text-[10px] font-bold text-blue-400 uppercase tracking-widest">Live</div>
          </div>

          <div className="flex items-center gap-6">
            <div className="relative group">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-400 transition-colors" size={16} />
               <input 
                type="text" 
                placeholder="Search engine..." 
                className="bg-[#0F172A] border border-slate-800 rounded-full py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/5 w-64 transition-all"
              />
            </div>
            <button className="relative p-2 text-slate-400 hover:text-white transition-colors">
              <Bell size={20} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-blue-500 rounded-full border-2 border-[#020617]" />
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className={`flex-1 overflow-y-auto p-10 transition-all duration-1000 ${isLoaded ? 'opacity-100' : 'opacity-0 translate-y-4'}`}>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            {/* Action Cards */}
            <div className="md:col-span-2 grid grid-cols-2 gap-6">
              {[
                { label: 'Validation Cycle', val: '402ms', icon: Zap, color: 'text-blue-400' },
                { label: 'Active Streams', val: '12,082', icon: Activity, color: 'text-emerald-400' },
              ].map((card, i) => (
                <div key={i} className="bg-[#0F172A] border border-slate-800/60 p-6 rounded-3xl relative overflow-hidden group hover:border-slate-700 transition-all">
                  <card.icon className={`absolute -right-4 -bottom-4 w-24 h-24 opacity-5 group-hover:opacity-10 transition-opacity ${card.color}`} />
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">{card.label}</p>
                  <h3 className="text-3xl font-black text-white italic">{card.val}</h3>
                </div>
              ))}
            </div>
            
            <div className="bg-gradient-to-br from-[#1E293B] to-[#0F172A] border border-slate-700/50 p-6 rounded-3xl flex flex-col justify-between shadow-xl">
               <div className="flex justify-between items-start">
                  <div className="p-2 bg-blue-500/10 rounded-xl border border-blue-500/20">
                    <ShieldCheck className="text-blue-400" size={24} />
                  </div>
                  <span className="text-[10px] font-black bg-blue-500 text-white px-2 py-0.5 rounded">AUTO-SHIELD ACTIVE</span>
               </div>
               <div>
                  <h4 className="text-lg font-bold text-white mb-1">Security Integrity</h4>
                  <p className="text-xs text-slate-500">All nodes reporting within valid parameters.</p>
               </div>
            </div>
          </div>

          <div className="flex items-center gap-4 mb-8">
            <h3 className="text-xl font-bold text-white tracking-tight">Recent Validations</h3>
            <div className="h-px flex-1 bg-gradient-to-r from-slate-800 to-transparent" />
          </div>

          {/* Table Container */}
          <div className="bg-[#0F172A] border border-slate-800/60 rounded-3xl overflow-hidden shadow-2xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#1E293B]/40 text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-800/60">
                  <th className="px-8 py-5">Entry ID</th>
                  <th className="px-8 py-5">Status</th>
                  <th className="px-8 py-5">Verification Hash</th>
                  <th className="px-8 py-5">Timestamp</th>
                  <th className="px-8 py-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40 text-sm">
                {[
                  { id: 'VAL-9920', status: 'verified', hash: '0x442...ae21', time: 'Just Now' },
                  { id: 'VAL-9919', status: 'verified', hash: '0x102...99bc', time: '2m ago' },
                  { id: 'VAL-9918', status: 'processing', hash: '0x921...ff22', time: '5m ago' },
                  { id: 'VAL-9917', status: 'verified', hash: '0x882...bb12', time: '12m ago' },
                  { id: 'VAL-9916', status: 'flagged', hash: '0x221...cc01', time: '18m ago' },
                ].map((row, i) => (
                  <tr key={i} className="hover:bg-[#1E293B]/20 transition-colors group">
                    <td className="px-8 py-5 font-mono font-bold text-blue-400">{row.id}</td>
                    <td className="px-8 py-5">
                      <span className={`flex items-center gap-2 text-[11px] font-black uppercase tracking-tighter ${
                        row.status === 'verified' ? 'text-emerald-400' : row.status === 'flagged' ? 'text-rose-400' : 'text-amber-400 animate-pulse'
                      }`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${
                          row.status === 'verified' ? 'bg-emerald-400' : row.status === 'flagged' ? 'bg-rose-400' : 'bg-amber-400'
                        }`} />
                        {row.status}
                      </span>
                    </td>
                    <td className="px-8 py-5 font-mono text-slate-500 text-xs">{row.hash}</td>
                    <td className="px-8 py-5 text-slate-400 font-medium">{row.time}</td>
                    <td className="px-8 py-5 text-right">
                      <button className="p-2 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-white transition-all">
                        <ChevronRight size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>
      </main>
    </div>
  );
};

export default App;