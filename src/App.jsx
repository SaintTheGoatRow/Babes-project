import React, { useState, useEffect } from 'react';
import { 
  Sun, Moon, Plus, Search, Trash2, Download, 
  ChevronRight, UserPlus, X, Users, CreditCard, Wallet, 
  ShieldCheck, ArrowRight, CheckCircle2, UserCheck, LogOut, Loader2, UserX
} from 'lucide-react';
import { supabase } from './lib/supabaseClient';

const MEMBERSHIP_TIERS = [
  { id: 'tier_50', name: 'Standard Membership (K50)', price: 50 },
  { id: 'tier_70', name: 'Executive Membership (K70)', price: 70 }
];

export default function App() {
  const [theme, setTheme] = useState('dark');
  
  // Auth States
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [authMode, setAuthMode] = useState('login');
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [registerForm, setRegisterForm] = useState({ name: '', studentId: '', email: '', password: '' });
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');

  // Registered Users (Local Admin / Viewer credentials)
  const [registeredUsers, setRegisteredUsers] = useState([
    { username: 'Dinda', password: 'Twalumba10', name: 'Dinda Nkeete', role: 'admin' }
  ]);

  // Main Database States
  const [members, setMembers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modals
  const [selectedMemberModal, setSelectedMemberModal] = useState(null);
  const [isAddPaymentOpen, setIsAddPaymentOpen] = useState(false);
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);

  // Form States
  const [newMember, setNewMember] = useState({ name: '', email: '', studentId: '' });
  const [newPayment, setNewPayment] = useState({
    memberId: '',
    category: 'Membership',
    membershipType: 'tier_50',
    tourName: 'Livingstone Tour 2026',
    customCategory: '',
    amount: 50,
    year: new Date().getFullYear().toString(),
    date: new Date().toISOString().split('T')[0]
  });

  const isDark = theme === 'dark';
  const isAdmin = currentUser?.role === 'admin';

  const toggleTheme = () => setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));

  // FETCH DATA FROM SUPABASE ON MOUNT
  useEffect(() => {
    fetchDatabaseData();
  }, []);

  async function fetchDatabaseData() {
    setLoading(true);
    
    const { data: membersData, error: membersError } = await supabase
      .from('members')
      .select('*')
      .order('name', { ascending: true });

    const { data: paymentsData, error: paymentsError } = await supabase
      .from('payments')
      .select('*')
      .order('date', { ascending: false });

    if (!membersError && membersData) setMembers(membersData);
    if (!paymentsError && paymentsData) setPayments(paymentsData);

    setLoading(false);
  }

  // AUTH HANDLERS
  const handleLogin = (e) => {
    e.preventDefault();
    setAuthError('');
    
    const found = registeredUsers.find(
      u => u.username.toLowerCase() === loginForm.username.trim().toLowerCase() && u.password === loginForm.password
    );

    if (found) {
      setCurrentUser(found);
      setIsAuthenticated(true);
      setLoginForm({ username: '', password: '' });
    } else {
      setAuthError('Invalid username or password.');
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');

    if (!registerForm.name || !registerForm.password) {
      setAuthError('Please fill in all required fields.');
      return;
    }

    const username = registerForm.name.split(' ')[0] + Math.floor(100 + Math.random() * 900);
    const newUser = {
      username: username,
      password: registerForm.password,
      name: registerForm.name,
      role: 'user'
    };

    setRegisteredUsers([...registeredUsers, newUser]);

    const { data, error } = await supabase
      .from('members')
      .insert([
        {
          name: registerForm.name,
          email: registerForm.email || null,
          student_id: registerForm.studentId || null
        }
      ])
      .select();

    if (!error && data) {
      setMembers(prev => [...prev, data[0]]);
    }

    setAuthSuccess(`Account created! Username: ${username}`);
    setTimeout(() => {
      setAuthMode('login');
      setLoginForm({ username: username, password: registerForm.password });
      setAuthSuccess('');
    }, 2500);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentUser(null);
    setAuthError('');
  };

  // DATABASE ACTIONS
  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!isAdmin || !newMember.name) return;

    const { data, error } = await supabase
      .from('members')
      .insert([
        {
          name: newMember.name,
          email: newMember.email || null,
          student_id: newMember.studentId || null
        }
      ])
      .select();

    if (error) {
      alert(`Database Error: ${error.message}`);
    } else if (data) {
      setMembers(prev => [...prev, data[0]]);
      setNewMember({ name: '', email: '', studentId: '' });
      setIsAddMemberOpen(false);
    }
  };

  const handleDeleteMember = async (memberId, e) => {
    if (e) e.stopPropagation(); // Prevent opening modal when clicking delete button
    if (!isAdmin) return;

    const target = members.find(m => m.id === memberId);
    const confirmDelete = window.confirm(`Are you sure you want to delete ${target?.name || 'this member'}? All associated payment logs will also be permanently removed.`);
    if (!confirmDelete) return;

    const { error } = await supabase
      .from('members')
      .delete()
      .eq('id', memberId);

    if (error) {
      alert(`Failed to delete person: ${error.message}`);
    } else {
      setMembers(prev => prev.filter(m => m.id !== memberId));
      setPayments(prev => prev.filter(p => p.member_id !== memberId));
      if (selectedMemberModal?.id === memberId) {
        setSelectedMemberModal(null);
      }
    }
  };

  const handleAddPayment = async (e) => {
    e.preventDefault();
    if (!isAdmin || !newPayment.memberId) return;

    let finalDescription = '';
    let finalAmount = Number(newPayment.amount);

    if (newPayment.category === 'Membership') {
      const tier = MEMBERSHIP_TIERS.find(t => t.id === newPayment.membershipType);
      finalDescription = tier ? tier.name : 'Membership Dues';
      finalAmount = tier ? tier.price : finalAmount;
    } else if (newPayment.category === 'Tour') {
      finalDescription = newPayment.tourName || 'Student Tour';
    } else {
      finalDescription = newPayment.customCategory || newPayment.category;
    }

    const { data, error } = await supabase
      .from('payments')
      .insert([
        {
          member_id: newPayment.memberId,
          category: newPayment.category,
          description: finalDescription,
          amount: finalAmount,
          year: newPayment.year,
          date: newPayment.date
        }
      ])
      .select();

    if (error) {
      alert(`Database Error: ${error.message}`);
    } else if (data) {
      setPayments(prev => [data[0], ...prev]);
      setIsAddPaymentOpen(false);
    }
  };

  const handleDeletePayment = async (id) => {
    if (!isAdmin) return;

    const { error } = await supabase
      .from('payments')
      .delete()
      .eq('id', id);

    if (error) {
      alert(`Failed to delete record: ${error.message}`);
    } else {
      setPayments(prev => prev.filter(p => p.id !== id));
    }
  };

  // HELPER CALCULATIONS
  const getMemberTotal = (memberId) => {
    return payments
      .filter(p => p.member_id === memberId)
      .reduce((sum, p) => sum + Number(p.amount), 0);
  };

  const getMemberPayments = (memberId) => {
    return payments.filter(p => p.member_id === memberId);
  };

  const exportCSV = () => {
    const headers = ['Member Name', 'Category', 'Description', 'Amount (ZMW)', 'Year', 'Date'];
    
    const rows = payments.map(p => {
      const member = members.find(m => m.id === p.member_id);
      const memberName = member ? member.name : 'Unknown Member';

      return [
        `"${memberName}"`,
        `"${p.category}"`,
        `"${p.description}"`,
        p.amount,
        p.year,
        p.date
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `payment_ledger_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredMembers = members.filter(m => {
    const search = searchTerm.toLowerCase();
    return (m.name && m.name.toLowerCase().includes(search)) || 
           (m.student_id && m.student_id.toLowerCase().includes(search));
  });

  // LOGIN / REGISTER SCREEN
  if (!isAuthenticated) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 transition-colors duration-200 ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-900'}`}>
        
        <button
          onClick={toggleTheme}
          className={`fixed top-4 right-4 p-2.5 rounded-2xl border transition-all ${
            isDark ? 'border-slate-800 bg-slate-900 text-amber-400' : 'border-slate-300 bg-white text-slate-700 shadow-md'
          }`}
        >
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <div className={`w-full max-w-sm p-6 sm:p-8 rounded-3xl border shadow-2xl space-y-5 ${
          isDark ? 'bg-slate-900/90 border-slate-800/80 backdrop-blur-xl' : 'bg-white border-slate-200'
        }`}>
          <div className="text-center space-y-1.5">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 font-black text-xl shadow-lg shadow-emerald-500/30">
              Z
            </div>
            <h1 className="text-xl font-black uppercase tracking-tight bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
              ZICA Publicity Department
            </h1>
            <p className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">
              {authMode === 'login' ? 'Authentication Required' : 'Create Viewer Account'}
            </p>
          </div>

          {authError && (
            <div className="p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-400 text-xs font-mono text-center">
              {authError}
            </div>
          )}

          {authSuccess && (
            <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-mono text-center flex items-center justify-center space-x-1.5">
              <CheckCircle2 size={15} />
              <span>{authSuccess}</span>
            </div>
          )}

          {authMode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-3.5 font-mono text-xs">
              <div>
                <label className="block text-slate-400 uppercase mb-1 text-[10px] font-semibold">Username / Admin ID</label>
                <input
                  type="text"
                  required
                  placeholder="Username"
                  value={loginForm.username}
                  onChange={e => setLoginForm({ ...loginForm, username: e.target.value })}
                  className={`w-full p-3 rounded-xl border text-xs focus:outline-none ${
                    isDark ? 'bg-slate-950 border-slate-800 text-white focus:border-emerald-500' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div>
                <label className="block text-slate-400 uppercase mb-1 text-[10px] font-semibold">Password</label>
                <input
                  type="password"
                  required
                  placeholder="Password "
                  value={loginForm.password}
                  onChange={e => setLoginForm({ ...loginForm, password: e.target.value })}
                  className={`w-full p-3 rounded-xl border text-xs focus:outline-none ${
                    isDark ? 'bg-slate-950 border-slate-800 text-white focus:border-emerald-500' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <button
                type="submit"
                className="w-full py-3.5 rounded-xl text-xs uppercase font-bold tracking-wider bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center space-x-2"
              >
                <span>Access Dashboard</span>
                <ArrowRight size={15} />
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-3 font-mono text-xs">
              <div>
                <label className="block text-slate-400 uppercase mb-1 text-[10px] font-semibold">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dinda Nkeete"
                  value={registerForm.name}
                  onChange={e => setRegisterForm({ ...registerForm, name: e.target.value })}
                  className={`w-full p-2.5 rounded-xl border text-xs focus:outline-none ${
                    isDark ? 'bg-slate-950 border-slate-800 text-white focus:border-emerald-500' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div>
                <label className="block text-slate-400 uppercase mb-1 text-[10px] font-semibold">Student ID</label>
                <input
                  type="text"
                  placeholder="e.g. 202500652"
                  value={registerForm.studentId}
                  onChange={e => setRegisterForm({ ...registerForm, studentId: e.target.value })}
                  className={`w-full p-2.5 rounded-xl border text-xs focus:outline-none ${
                    isDark ? 'bg-slate-950 border-slate-800 text-white focus:border-emerald-500' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div>
                <label className="block text-slate-400 uppercase mb-1 text-[10px] font-semibold">Email Address</label>
                <input
                  type="email"
                  placeholder="e.g. user@example.com"
                  value={registerForm.email}
                  onChange={e => setRegisterForm({ ...registerForm, email: e.target.value })}
                  className={`w-full p-2.5 rounded-xl border text-xs focus:outline-none ${
                    isDark ? 'bg-slate-950 border-slate-800 text-white focus:border-emerald-500' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div>
                <label className="block text-slate-400 uppercase mb-1 text-[10px] font-semibold">Password *</label>
                <input
                  type="password"
                  required
                  placeholder="Create password"
                  value={registerForm.password}
                  onChange={e => setRegisterForm({ ...registerForm, password: e.target.value })}
                  className={`w-full p-2.5 rounded-xl border text-xs focus:outline-none ${
                    isDark ? 'bg-slate-950 border-slate-800 text-white focus:border-emerald-500' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <button
                type="submit"
                className="w-full py-3.5 rounded-xl text-xs uppercase font-bold tracking-wider bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-all shadow-lg shadow-emerald-500/20"
              >
                Create Account
              </button>
            </form>
          )}

          <div className="pt-1 text-center">
            {authMode === 'login' ? (
              <p className="text-[11px] text-slate-400 font-mono">
                Need a viewer account?{' '}
                <button
                  type="button"
                  onClick={() => { setAuthMode('register'); setAuthError(''); }}
                  className="text-emerald-400 hover:underline font-bold"
                >
                  Create Account
                </button>
              </p>
            ) : (
              <p className="text-[11px] text-slate-400 font-mono">
                Already registered?{' '}
                <button
                  type="button"
                  onClick={() => { setAuthMode('login'); setAuthError(''); }}
                  className="text-emerald-400 hover:underline font-bold"
                >
                  Sign In
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // MAIN DASHBOARD VIEW
  return (
    <div className={`min-h-screen transition-colors duration-200 pb-12 ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      
      {/* HEADER */}
      <header className={`border-b sticky top-0 z-30 ${isDark ? 'border-slate-800/80 bg-slate-950/90' : 'border-slate-200 bg-white/90'} backdrop-blur-md`}>
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2">
          
          <div className="flex items-center space-x-2 min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex-shrink-0 flex items-center justify-center text-slate-950 font-black text-sm sm:text-lg shadow-md shadow-emerald-500/20">
              Z
            </div>
            <div className="min-w-0">
              <h1 className="font-black text-xs sm:text-base tracking-tight uppercase bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent truncate">
                ZICA Publicity Department
              </h1>
              <p className="text-[9px] sm:text-[10px] text-slate-400 font-medium tracking-tight truncate">ONLINE DATABASE</p>
            </div>
          </div>

          <div className="flex items-center space-x-1.5 flex-shrink-0">
            <div className={`px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-bold uppercase tracking-wider flex items-center space-x-1 border ${
              isAdmin ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400' : 'border-cyan-500/40 bg-cyan-500/10 text-cyan-400'
            }`}>
              {isAdmin ? <ShieldCheck size={12} /> : <UserCheck size={12} />}
              <span className="truncate max-w-[70px] sm:max-w-none">{currentUser.name}</span>
            </div>

            <button
              onClick={handleLogout}
              className={`p-1.5 sm:p-2 rounded-lg border transition-all ${
                isDark ? 'border-slate-800 bg-slate-900 text-slate-400 hover:text-rose-400' : 'border-slate-200 bg-white text-slate-600 shadow-sm'
              }`}
              title="Sign Out"
            >
              <LogOut size={15} />
            </button>

            <button
              onClick={toggleTheme}
              className={`p-1.5 sm:p-2 rounded-lg border transition-all ${
                isDark ? 'border-slate-800 bg-slate-900 text-amber-400' : 'border-slate-200 bg-white text-slate-700 shadow-sm'
              }`}
            >
              {isDark ? <Sun size={15} /> : <Moon size={15} />}
            </button>
          </div>
        </div>
      </header>

      {/* DASHBOARD CONTENT */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-8 space-y-4 sm:space-y-6">
        
        {/* STATS SUMMARY */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          <div className={`p-3 sm:p-5 rounded-xl sm:rounded-2xl border ${isDark ? 'border-slate-800/80 bg-slate-900/60' : 'border-slate-200 bg-white shadow-sm'}`}>
            <div className="flex items-center justify-between">
              <span className="text-[9px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">Members</span>
              <Users size={14} className="text-emerald-400 hidden sm:block" />
            </div>
            <p className="text-base sm:text-3xl font-black mt-1 font-mono">{members.length}</p>
          </div>

          <div className={`p-3 sm:p-5 rounded-xl sm:rounded-2xl border ${isDark ? 'border-slate-800/80 bg-slate-900/60' : 'border-slate-200 bg-white shadow-sm'}`}>
            <div className="flex items-center justify-between">
              <span className="text-[9px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">Logs</span>
              <CreditCard size={14} className="text-cyan-400 hidden sm:block" />
            </div>
            <p className="text-base sm:text-3xl font-black mt-1 font-mono">{payments.length}</p>
          </div>

          <div className={`p-3 sm:p-5 rounded-xl sm:rounded-2xl border ${isDark ? 'border-slate-800/80 bg-slate-900/60' : 'border-slate-200 bg-white shadow-sm'}`}>
            <div className="flex items-center justify-between">
              <span className="text-[9px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">Total</span>
              <Wallet size={14} className="text-teal-400 hidden sm:block" />
            </div>
            <p className="text-xs sm:text-3xl font-black mt-1 font-mono text-emerald-400 truncate">
              K{payments.reduce((acc, p) => acc + Number(p.amount), 0).toLocaleString()}
            </p>
          </div>
        </div>

        {/* SEARCH AND ACTION CONTROLS */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <div className={`relative flex-1 rounded-xl border ${
            isDark ? 'border-slate-800 bg-slate-900/80' : 'border-slate-300 bg-white shadow-sm'
          }`}>
            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search member name or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full bg-transparent pl-9 pr-3 py-2 text-xs focus:outline-none ${
                isDark ? 'text-white placeholder-slate-500' : 'text-slate-900 placeholder-slate-400'
              }`}
            />
          </div>

          <div className="flex items-center space-x-2">
            {isAdmin && (
              <>
                <button
                  onClick={() => setIsAddMemberOpen(true)}
                  className="flex-1 sm:flex-none px-3 py-2 rounded-xl text-xs font-bold tracking-wider uppercase flex items-center justify-center space-x-1.5 bg-emerald-500 text-slate-950"
                >
                  <UserPlus size={14} />
                  <span>Person</span>
                </button>

                <button
                  onClick={() => setIsAddPaymentOpen(true)}
                  className={`flex-1 sm:flex-none px-3 py-2 rounded-xl text-xs font-bold tracking-wider uppercase flex items-center justify-center space-x-1.5 border ${
                    isDark ? 'border-slate-800 bg-slate-900 text-slate-200' : 'border-slate-300 bg-white text-slate-800 shadow-sm'
                  }`}
                >
                  <Plus size={14} />
                  <span>Payment</span>
                </button>
              </>
            )}

            <button
              onClick={exportCSV}
              className={`p-2 rounded-xl border ${
                isDark ? 'border-slate-800 bg-slate-900 text-slate-300' : 'border-slate-300 bg-white text-slate-700 shadow-sm'
              }`}
              title="Export CSV"
            >
              <Download size={16} />
            </button>
          </div>
        </div>

        {/* MOBILE CARD VIEW (< sm) */}
        <div className="block sm:hidden space-y-2.5">
          {loading ? (
            <div className="py-8 text-center text-slate-400 text-xs flex items-center justify-center space-x-2">
              <Loader2 size={16} className="animate-spin text-emerald-400" />
              <span>Loading records...</span>
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-xs font-mono uppercase">
              No members found
            </div>
          ) : (
            filteredMembers.map((m) => {
              const mPayments = getMemberPayments(m.id);
              return (
                <div
                  key={m.id}
                  onClick={() => setSelectedMemberModal(m)}
                  className={`p-3.5 rounded-xl border transition-all active:scale-[0.98] flex items-center justify-between ${
                    isDark ? 'border-slate-800 bg-slate-900/60 text-white' : 'border-slate-200 bg-white text-slate-900 shadow-sm'
                  }`}
                >
                  <div className="space-y-0.5 min-w-0 pr-2">
                    <p className="font-bold text-xs truncate">{m.name}</p>
                    <div className="flex items-center space-x-2 text-[10px] text-slate-400 font-mono">
                      <span className="text-emerald-400 font-semibold">{m.student_id || 'No ID'}</span>
                      <span>•</span>
                      <span>{mPayments.length} payment{mPayments.length !== 1 ? 's' : ''}</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 flex-shrink-0">
                    <span className={`text-[10px] px-2.5 py-1 rounded-md border font-mono font-bold ${
                      isDark ? 'border-slate-800 bg-slate-950 text-emerald-400' : 'border-slate-200 bg-slate-50 text-emerald-600'
                    }`}>
                      Tap to reveal sum
                    </span>
                    {isAdmin && (
                      <button
                        onClick={(e) => handleDeleteMember(m.id, e)}
                        className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors"
                        title="Delete Person"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                    <ChevronRight size={16} className="text-slate-500" />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* DESKTOP TABLE VIEW (>= sm) */}
        <div className={`hidden sm:block border rounded-2xl overflow-hidden shadow-xl ${isDark ? 'border-slate-800/80 bg-slate-900/40' : 'border-slate-200 bg-white'}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className={`border-b text-[10px] uppercase font-mono ${
                  isDark ? 'border-slate-800 bg-slate-900/90 text-slate-400' : 'border-slate-200 bg-slate-100/80 text-slate-600'
                }`}>
                  <th className="py-3 px-4 font-semibold">Student ID</th>
                  <th className="py-3 px-4 font-semibold">Full Name</th>
                  <th className="py-3 px-4 font-semibold">Email</th>
                  <th className="py-3 px-4 font-semibold text-center">Entries</th>
                  <th className="py-3 px-4 font-semibold text-right">Total Paid</th>
                  {isAdmin && <th className="py-3 px-4 font-semibold text-center">Action</th>}
                </tr>
              </thead>
              <tbody className={`divide-y font-mono ${isDark ? 'divide-slate-800/60' : 'divide-slate-200'}`}>
                {loading ? (
                  <tr>
                    <td colSpan={isAdmin ? "6" : "5"} className="py-8 text-center text-slate-400 text-xs">
                      <div className="flex items-center justify-center space-x-2">
                        <Loader2 size={16} className="animate-spin text-emerald-400" />
                        <span>Loading records...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredMembers.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin ? "6" : "5"} className="py-8 text-center text-slate-500 text-xs uppercase tracking-widest">
                      No members found
                    </td>
                  </tr>
                ) : (
                  filteredMembers.map((m) => {
                    const mPayments = getMemberPayments(m.id);
                    return (
                      <tr
                        key={m.id}
                        onClick={() => setSelectedMemberModal(m)}
                        className={`cursor-pointer transition-colors ${
                          isDark ? 'hover:bg-slate-800/50' : 'hover:bg-slate-100/70'
                        }`}
                      >
                        <td className="py-3.5 px-4 font-semibold text-emerald-400">{m.student_id || 'N/A'}</td>
                        <td className="py-3.5 px-4 font-bold flex items-center justify-between">
                          <span>{m.name}</span>
                          <ChevronRight size={14} className="text-slate-500" />
                        </td>
                        <td className="py-3.5 px-4 text-slate-400">{m.email || 'N/A'}</td>
                        <td className="py-3.5 px-4 text-center">
                          <span className={`px-2.5 py-1 text-[10px] rounded-full border ${
                            isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-300 text-slate-700'
                          }`}>
                            {mPayments.length} record{mPayments.length !== 1 ? 's' : ''}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <span className={`text-[10px] px-3 py-1.5 rounded-lg border font-mono ${
                            isDark ? 'border-slate-800 bg-slate-900 text-slate-400' : 'border-slate-200 bg-slate-50 text-slate-600'
                          }`}>
                            Tap row to reveal sum
                          </span>
                        </td>
                        {isAdmin && (
                          <td className="py-3.5 px-4 text-center">
                            <button
                              onClick={(e) => handleDeleteMember(m.id, e)}
                              className="text-slate-500 hover:text-rose-400 transition-colors p-1"
                              title="Delete Person"
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </main>

      {/* MEMBER DETAILS MODAL */}
      {selectedMemberModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md">
          <div className={`w-full max-w-2xl sm:rounded-2xl rounded-t-2xl border shadow-2xl p-4 sm:p-6 relative max-h-[92vh] overflow-y-auto ${
            isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <button onClick={() => setSelectedMemberModal(null)} className="absolute top-4 right-4 text-slate-400 hover:text-white">
              <X size={18} />
            </button>

            <div className="border-b pb-3 border-slate-800 mb-4">
              <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-widest font-semibold">Individual Record</span>
              <h3 className="text-xl font-black uppercase tracking-tight mt-0.5">{selectedMemberModal.name}</h3>
              <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-slate-400 font-mono">
                <span>ID: {selectedMemberModal.student_id || 'N/A'}</span>
                <span>•</span>
                <span>{selectedMemberModal.email || 'N/A'}</span>
              </div>
            </div>

            <div className={`p-4 rounded-xl border mb-4 flex items-center justify-between ${
              isDark ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-emerald-300 bg-emerald-50'
            }`}>
              <div>
                <p className="text-[10px] font-mono uppercase tracking-wider text-emerald-500 font-bold">Total Paid</p>
                <p className="text-2xl font-black mt-0.5 font-mono text-emerald-400">
                  K{getMemberTotal(selectedMemberModal.id).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center space-x-1 px-2.5 py-1 rounded bg-emerald-500 text-slate-950 font-bold text-[10px] uppercase">
                <ShieldCheck size={14} />
                <span>Verified</span>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-[10px] uppercase font-mono tracking-wider font-bold text-slate-400">Payment Breakdown</h4>
              
              {getMemberPayments(selectedMemberModal.id).length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center font-mono uppercase">No payment entries found.</p>
              ) : (
                <div className={`border rounded-xl overflow-hidden ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className={`border-b uppercase text-[10px] ${isDark ? 'border-slate-800 bg-slate-950 text-slate-400' : 'border-slate-200 bg-slate-100 text-slate-600'}`}>
                        <th className="py-2 px-2.5">Category</th>
                        <th className="py-2 px-2.5">Description</th>
                        <th className="py-2 px-2.5 text-right">Amount</th>
                        {isAdmin && <th className="py-2 px-2 text-center">Action</th>}
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${isDark ? 'divide-slate-800' : 'divide-slate-200'}`}>
                      {getMemberPayments(selectedMemberModal.id).map(p => (
                        <tr key={p.id}>
                          <td className="py-2 px-2.5 font-bold text-emerald-400">{p.category}</td>
                          <td className="py-2 px-2.5 text-slate-300 truncate max-w-[100px]">{p.description}</td>
                          <td className="py-2 px-2.5 text-right font-bold text-white">K{p.amount}</td>
                          {isAdmin && (
                            <td className="py-2 px-2 text-center">
                              <button onClick={() => handleDeletePayment(p.id)} className="text-slate-500 hover:text-rose-400">
                                <Trash2 size={13} />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="mt-5 flex items-center justify-between pt-2">
              {isAdmin ? (
                <button
                  onClick={() => handleDeleteMember(selectedMemberModal.id)}
                  className="px-3 py-2 rounded-xl text-xs font-bold uppercase text-rose-400 hover:bg-rose-500/10 flex items-center space-x-1 border border-rose-500/20"
                >
                  <UserX size={15} />
                  <span>Delete Person</span>
                </button>
              ) : <div />}

              <button
                onClick={() => setSelectedMemberModal(null)}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold uppercase border ${
                  isDark ? 'border-slate-800 bg-slate-800 text-white' : 'border-slate-300 bg-slate-100 text-slate-800'
                }`}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD MEMBER MODAL */}
      {isAddMemberOpen && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md">
          <div className={`w-full max-w-md sm:rounded-2xl rounded-t-2xl border p-5 relative ${
            isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <button onClick={() => setIsAddMemberOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white">
              <X size={18} />
            </button>

            <h3 className="text-base font-bold uppercase tracking-wide mb-3">Add Person to Database</h3>

            <form onSubmit={handleAddMember} className="space-y-3 text-xs font-mono">
              <div>
                <label className="block text-slate-400 uppercase mb-1 text-[10px]">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dinda Nkeete"
                  value={newMember.name}
                  onChange={e => setNewMember({ ...newMember, name: e.target.value })}
                  className={`w-full p-2.5 rounded-xl border text-xs focus:outline-none ${
                    isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div>
                <label className="block text-slate-400 uppercase mb-1 text-[10px]">Student ID Number</label>
                <input
                  type="text"
                  placeholder="e.g. 202500652"
                  value={newMember.studentId}
                  onChange={e => setNewMember({ ...newMember, studentId: e.target.value })}
                  className={`w-full p-2.5 rounded-xl border text-xs focus:outline-none ${
                    isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div>
                <label className="block text-slate-400 uppercase mb-1 text-[10px]">Email Address</label>
                <input
                  type="email"
                  placeholder="e.g. user@example.com"
                  value={newMember.email}
                  onChange={e => setNewMember({ ...newMember, email: e.target.value })}
                  className={`w-full p-2.5 rounded-xl border text-xs focus:outline-none ${
                    isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div className="pt-2 flex space-x-2">
                <button
                  type="button"
                  onClick={() => setIsAddMemberOpen(false)}
                  className={`flex-1 py-2.5 rounded-xl text-xs uppercase border ${
                    isDark ? 'border-slate-800 text-slate-400' : 'border-slate-300 text-slate-600'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl text-xs uppercase font-bold bg-emerald-500 text-slate-950"
                >
                  Save Person
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD PAYMENT MODAL */}
      {isAddPaymentOpen && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md">
          <div className={`w-full max-w-md sm:rounded-2xl rounded-t-2xl border p-5 relative max-h-[90vh] overflow-y-auto ${
            isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <button onClick={() => setIsAddPaymentOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white">
              <X size={18} />
            </button>

            <h3 className="text-base font-bold uppercase tracking-wide mb-3">Log Payment Entry</h3>

            <form onSubmit={handleAddPayment} className="space-y-3 text-xs font-mono">
              <div>
                <label className="block text-slate-400 uppercase mb-1 text-[10px]">Select Person *</label>
                <select
                  required
                  value={newPayment.memberId}
                  onChange={e => setNewPayment({ ...newPayment, memberId: e.target.value })}
                  className={`w-full p-2.5 rounded-xl border text-xs focus:outline-none ${
                    isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                >
                  <option value="">-- Choose Member --</option>
                  {members.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.student_id || 'No ID'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 uppercase mb-1 text-[10px]">Category *</label>
                <select
                  value={newPayment.category}
                  onChange={e => setNewPayment({ ...newPayment, category: e.target.value })}
                  className={`w-full p-2.5 rounded-xl border text-xs focus:outline-none ${
                    isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                >
                  <option value="Membership">Membership Dues</option>
                  <option value="Tour">Student Tour</option>
                  <option value="Books">Books & Course Material</option>
                  <option value="Performance">Performance Event</option>
                  <option value="Custom">Custom Dues</option>
                </select>
              </div>

              {newPayment.category === 'Membership' && (
                <div>
                  <label className="block text-slate-400 uppercase mb-1 text-[10px]">Membership Package</label>
                  <select
                    value={newPayment.membershipType}
                    onChange={e => {
                      const tier = MEMBERSHIP_TIERS.find(t => t.id === e.target.value);
                      setNewPayment({
                        ...newPayment,
                        membershipType: e.target.value,
                        amount: tier ? tier.price : 150
                      });
                    }}
                    className={`w-full p-2.5 rounded-xl border text-xs focus:outline-none ${
                      isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  >
                    {MEMBERSHIP_TIERS.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {newPayment.category === 'Tour' && (
                <div>
                  <label className="block text-slate-400 uppercase mb-1 text-[10px]">Tour Name / Destination</label>
                  <input
                    type="text"
                    value={newPayment.tourName}
                    onChange={e => setNewPayment({ ...newPayment, tourName: e.target.value })}
                    placeholder="e.g. Livingstone Tour 2026"
                    className={`w-full p-2.5 rounded-xl border text-xs focus:outline-none ${
                      isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
              )}

              {newPayment.category === 'Custom' && (
                <div>
                  <label className="block text-slate-400 uppercase mb-1 text-[10px]">Description / Note</label>
                  <input
                    type="text"
                    value={newPayment.customCategory}
                    onChange={e => setNewPayment({ ...newPayment, customCategory: e.target.value })}
                    placeholder="e.g. T-Shirt Only"
                    className={`w-full p-2.5 rounded-xl border text-xs focus:outline-none ${
                      isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
              )}

              <div>
                <label className="block text-slate-400 uppercase mb-1 text-[10px]">Amount Paid (ZMW) *</label>
                <input
                  type="number"
                  required
                  value={newPayment.amount}
                  onChange={e => setNewPayment({ ...newPayment, amount: e.target.value })}
                  className={`w-full p-2.5 rounded-xl border text-xs focus:outline-none ${
                    isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 uppercase mb-1 text-[10px]">Year</label>
                  <input
                    type="text"
                    value={newPayment.year}
                    onChange={e => setNewPayment({ ...newPayment, year: e.target.value })}
                    className={`w-full p-2.5 rounded-xl border text-xs focus:outline-none ${
                      isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-slate-400 uppercase mb-1 text-[10px]">Payment Date</label>
                  <input
                    type="date"
                    value={newPayment.date}
                    onChange={e => setNewPayment({ ...newPayment, date: e.target.value })}
                    className={`w-full p-2.5 rounded-xl border text-xs focus:outline-none ${
                      isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
              </div>

              <div className="pt-2 flex space-x-2">
                <button
                  type="button"
                  onClick={() => setIsAddPaymentOpen(false)}
                  className={`flex-1 py-2.5 rounded-xl text-xs uppercase border ${
                    isDark ? 'border-slate-800 text-slate-400' : 'border-slate-300 text-slate-600'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl text-xs uppercase font-bold bg-emerald-500 text-slate-950"
                >
                  Save Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}