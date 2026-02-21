import React, { useState, useEffect } from 'react';
import { 
  Layout, 
  User, 
  Lock, 
  LogOut, 
  LayoutDashboard, 
  Settings, 
  Bell, 
  Search, 
  ChevronRight,
  TrendingUp,
  Users,
  CheckCircle,
  Menu,
  X
} from 'lucide-react';

// --- Components ---

const LoginPage = ({ onLogin, onSwitchToRegister }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    // Simulate API call
    if (email && password) {
      onLogin({ email, name: email.split('@')[0] });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-slate-100">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-xl mb-4 text-white">
            <LayoutDashboard size={32} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Welcome Back</h1>
          <p className="text-slate-500 mt-2">Sign in to your portal account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Email Address</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="email" 
                required
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="password" 
                required
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button 
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg shadow-lg shadow-blue-200 transition-all active:scale-[0.98]"
          >
            Sign In
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-100 text-center">
          <p className="text-slate-600">
            Don't have an account?{' '}
            <button 
              onClick={onSwitchToRegister}
              className="text-blue-600 font-medium hover:underline"
            >
              Create one now
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

const Dashboard = ({ user, onLogout }) => {
  const [isSidebarOpen, setSidebarOpen] = useState(true);

  const stats = [
    { label: 'Active Projects', value: '12', icon: LayoutDashboard, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Team Members', value: '48', icon: Users, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Completion Rate', value: '94%', icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Efficiency', value: '+12%', icon: TrendingUp, color: 'text-orange-600', bg: 'bg-orange-50' },
  ];

  const recentActivity = [
    { id: 1, action: 'Updated Project Alpha', user: 'Alex Rivera', time: '2 mins ago', status: 'Success' },
    { id: 2, action: 'New member joined', user: 'Sarah Chen', time: '1 hour ago', status: 'Notice' },
    { id: 3, action: 'Database backup', user: 'System', time: '4 hours ago', status: 'Success' },
    { id: 4, action: 'Server migration', user: 'DevOps', time: 'Yesterday', status: 'Warning' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className={`${isSidebarOpen ? 'w-64' : 'w-20'} bg-slate-900 transition-all duration-300 flex flex-col fixed h-full z-20`}>
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center shrink-0">
            <LayoutDashboard className="text-white" size={20} />
          </div>
          {isSidebarOpen && <span className="font-bold text-white text-lg truncate">Portal.io</span>}
        </div>

        <nav className="flex-1 px-4 py-4 space-y-2">
          {[
            { icon: LayoutDashboard, label: 'Dashboard', active: true },
            { icon: Users, label: 'Team' },
            { icon: Bell, label: 'Notifications' },
            { icon: Settings, label: 'Settings' },
          ].map((item) => (
            <button 
              key={item.label}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-colors ${
                item.active ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <item.icon size={20} />
              {isSidebarOpen && <span className="font-medium">{item.label}</span>}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button 
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-slate-400 hover:bg-red-500/10 hover:text-red-500 transition-colors"
          >
            <LogOut size={20} />
            {isSidebarOpen && <span className="font-medium">Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`flex-1 transition-all duration-300 ${isSidebarOpen ? 'ml-64' : 'ml-20'}`}>
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-10">
          <div className="flex items-center gap-4 flex-1">
            <button 
              onClick={() => setSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <Menu size={20} className="text-slate-600" />
            </button>
            <div className="max-w-md w-full relative hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                className="w-full bg-slate-100 border-none rounded-full py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-blue-500/20"
                placeholder="Search analytics..."
              />
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <button className="p-2 text-slate-400 hover:text-slate-600 relative">
              <Bell size={20} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
            <div className="h-8 w-[1px] bg-slate-200 mx-2"></div>
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-slate-900 leading-tight capitalize">{user.name}</p>
                <p className="text-xs text-slate-500">Admin Account</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">
                {user.name[0].toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="p-8 max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-slate-900">Dashboard Overview</h1>
            <p className="text-slate-500">Welcome back, {user.name}! Here is what is happening today.</p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {stats.map((stat) => (
              <div key={stat.label} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className={`p-3 rounded-xl ${stat.bg} ${stat.color}`}>
                    <stat.icon size={24} />
                  </div>
                  <span className="text-emerald-500 text-xs font-bold bg-emerald-50 px-2 py-1 rounded-full">+4.5%</span>
                </div>
                <div className="mt-4">
                  <h3 className="text-slate-500 text-sm font-medium">{stat.label}</h3>
                  <p className="text-2xl font-bold text-slate-900 mt-1">{stat.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Table / Details */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-bold text-slate-900">Recent Activity</h2>
              <button className="text-blue-600 text-sm font-semibold hover:underline flex items-center gap-1">
                View all <ChevronRight size={16} />
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Action</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">User</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Time</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentActivity.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-6 py-4 font-medium text-slate-900">{row.action}</td>
                      <td className="px-6 py-4 text-slate-600">{row.user}</td>
                      <td className="px-6 py-4 text-slate-500">{row.time}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          row.status === 'Success' ? 'bg-emerald-100 text-emerald-700' : 
                          row.status === 'Warning' ? 'bg-amber-100 text-amber-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default function App() {
  const [currentPage, setCurrentPage] = useState('login');
  const [user, setUser] = useState(null);

  const handleLogin = (userData) => {
    setUser(userData);
    setCurrentPage('dashboard');
  };

  const handleLogout = () => {
    setUser(null);
    setCurrentPage('login');
  };

  return (
    <div className="antialiased font-sans text-slate-900">
      {currentPage === 'login' && (
        <LoginPage 
          onLogin={handleLogin} 
          onSwitchToRegister={() => alert('Registration feature coming soon!')}
        />
      )}
      
      {currentPage === 'dashboard' && user && (
        <Dashboard 
          user={user} 
          onLogout={handleLogout}
        />
      )}
    </div>
  );
}