import React, { useState, useEffect } from 'react';
import { 
  Sun, Moon, Plus, Search, Trash2, Download, 
  ChevronRight, UserPlus, X, Users, CreditCard, Wallet, 
  ShieldCheck, ArrowRight, CheckCircle2, UserCheck, LogOut, Loader2, UserX, Eye
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

  // Main Database & Network States
  const [members, setMembers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState('');
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

  // FETCH DATA FROM SUPABASE WITH TIMEOUT & ERROR HANDLING
  useEffect(() => {
    fetchDatabaseData();
  }, []);

  async function fetchDatabaseData() {
    setLoading(true);
    setStatusMessage('');

    const timer = setTimeout(() => {
      setStatusMessage('Establishing secure connection to database...');
    }, 4000);

    try {
      const { data: membersData, error: membersError } = await supabase
        .from('members')
        .select('*')
        .order('name', { ascending: true });

      const { data: paymentsData, error: paymentsError } = await supabase
        .from('payments')
        .select('*')
        .order('date', { ascending: false });

      if (membersError) throw membersError;
      if (paymentsError) throw paymentsError;

      if (membersData) setMembers(membersData);
      if (paymentsData) setPayments(paymentsData);
      setStatusMessage('');
    } catch (err) {
      console.error('Database connection error:', err.message);
      setStatusMessage('Network latency detected. Please check your data connection.');
    } finally {
      clearTimeout(timer);
      setLoading(false);
    }
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
      setAuthError('Invalid credentials. Please verify your username and password.');
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');

    if (!registerForm.name || !registerForm.password) {
      setAuthError('Full name and password are required.');
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

    setAuthSuccess(`Account provisioned. Your username is: ${username}`);
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
    if (e) e.stopPropagation();
    if (!isAdmin) return;

    const target = members.find(m => m.id === memberId);
    const confirmDelete = window.confirm(`Remove ${target?.name || 'this member'} from the ledger? All associated transaction logs will be permanently deleted.`);
    if (!confirmDelete) return;

    const { error } = await supabase
      .from('members')
      .delete()
      .eq('id', memberId);

    if (error) {
      alert(`Deletion failed: ${error.message}`);
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
      alert(`Transaction Error: ${error.message}`);
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
      alert(`Failed to void transaction: ${error.message}`);
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
    link.setAttribute('download', `zica_ledger_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredMembers = members.filter(m => {
    const search = searchTerm.toLowerCase();
    return (m.name && m.name.toLowerCase().includes(search)) || 
           (m.student_id && m.student_id.toLowerCase().includes(search));
  });

  // Shared Input Styles
  const inputClass = `w-full px-3.5 py-2.5 rounded-lg border text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-600/30 ${
    isDark 
      ? 'bg-slate-950 border-slate-800 text-slate-100 placeholder-slate-500 focus:border-emerald-500' 
      : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-emerald-600'
  }`;

  const labelClass = `block text-xs font-medium mb-1.5 ${
    isDark ? 'text-slate-300' : 'text-slate-700'
  }`;

  // INITIAL LOADING SCREEN
  if (loading) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center p-6 transition-colors duration-200 ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
        <div className="flex flex-col items-center space-y-4 text-center max-w-sm">
          <div className="w-12 h-12 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-bold text-xl shadow-sm">
            Z
          </div>
          <div className="flex items-center space-x-2.5">
            <Loader2 size={18} className="animate-spin text-emerald-500" />
            <span className="text-sm font-medium tracking-wide">Synchronizing Ledger Records...</span>
          </div>
          {statusMessage && (
            <p className={`text-xs px-3.5 py-2 rounded-lg border ${
              isDark ? 'text-amber-300 bg-amber-950/40 border-amber-800/50' : 'text-amber-800 bg-amber-50 border-amber-200'
            }`}>
              {statusMessage}
            </p>
          )}
        </div>
      </div>
    );
  }

  // LOGIN / REGISTER SCREEN
  if (!isAuthenticated) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 transition-colors duration-200 ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-900'}`}>
        
        <button
          onClick={toggleTheme}
          aria-label="Toggle Theme"
          className={`fixed top-5 right-5 p-2.5 rounded-lg border transition-colors ${
            isDark ? 'border-slate-800 bg-slate-900 text-slate-300 hover:text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-sm'
          }`}
        >
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <div className={`w-full max-w-md p-7 sm:p-9 rounded-2xl border shadow-xl space-y-6 ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          <div className="text-center space-y-2">
            <div className="w-12 h-12 mx-auto rounded-xl bg-emerald-600 flex items-center justify-center text-white font-bold text-xl shadow-sm">
              Z
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">
                ZICA Publicity Department
              </h1>
              <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {authMode === 'login' ? 'Sign in to access the financial ledger' : 'Register for read-only ledger access'}
              </p>
            </div>
          </div>

          {authError && (
            <div className={`p-3 rounded-lg border text-xs text-center font-medium ${
              isDark ? 'border-rose-900/60 bg-rose-950/50 text-rose-300' : 'border-rose-200 bg-rose-50 text-rose-700'
            }`}>
              {authError}
            </div>
          )}

          {authSuccess && (
            <div className={`p-3 rounded-lg border text-xs text-center font-medium flex items-center justify-center space-x-2 ${
              isDark ? 'border-emerald-800/60 bg-emerald-950/50 text-emerald-300' : 'border-emerald-200 bg-emerald-50 text-emerald-700'
            }`}>
              <CheckCircle2 size={16} />
              <span>{authSuccess}</span>
            </div>
          )}

          {authMode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className={labelClass}>Username or Admin ID</label>
                <input
                  type="text"
                  required
                  placeholder="Enter your username"
                  value={loginForm.username}
                  onChange={e => setLoginForm({ ...loginForm, username: e.target.value })}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Password</label>
                <input
                  type="password"
                  required
                  placeholder="Enter your password"
                  value={loginForm.password}
                  onChange={e => setLoginForm({ ...loginForm, password: e.target.value })}
                  className={inputClass}
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shadow-sm flex items-center justify-center space-x-2 mt-2"
              >
                <span>Sign In</span>
                <ArrowRight size={16} />
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-3.5">
              <div>
                <label className={labelClass}>Full Name <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dinda Nkeete"
                  value={registerForm.name}
                  onChange={e => setRegisterForm({ ...registerForm, name: e.target.value })}
                  className={inputClass}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Student ID</label>
                  <input
                    type="text"
                    placeholder="e.g. 202501869"
                    value={registerForm.studentId}
                    onChange={e => setRegisterForm({ ...registerForm, studentId: e.target.value })}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>Email Address</label>
                  <input
                    type="email"
                    placeholder="name@example.com"
                    value={registerForm.email}
                    onChange={e => setRegisterForm({ ...registerForm, email: e.target.value })}
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>Password <span className="text-rose-500">*</span></label>
                <input
                  type="password"
                  required
                  placeholder="Create a secure password"
                  value={registerForm.password}
                  onChange={e => setRegisterForm({ ...registerForm, password: e.target.value })}
                  className={inputClass}
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shadow-sm mt-2"
              >
                Create Viewer Account
              </button>
            </form>
          )}

          <div className={`pt-4 border-t text-center ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
            {authMode === 'login' ? (
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => { setAuthMode('register'); setAuthError(''); }}
                  className="text-emerald-500 hover:text-emerald-400 font-semibold"
                >
                  Request Viewer Access
                </button>
              </p>
            ) : (
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => { setAuthMode('login'); setAuthError(''); }}
                  className="text-emerald-500 hover:text-emerald-400 font-semibold"
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
    <div className={`min-h-screen transition-colors duration-200 pb-16 ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      
      {/* TOP NAVIGATION BAR */}
      <header className={`border-b sticky top-0 z-30 ${isDark ? 'border-slate-800 bg-slate-900/95' : 'border-slate-200 bg-white/95'} backdrop-blur-md`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-emerald-600 flex-shrink-0 flex items-center justify-center text-white font-bold text-base shadow-sm">
              Z
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-sm sm:text-base tracking-tight truncate">
                ZICA Publicity Department
              </h1>
              <p className={`text-[11px] font-medium truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Treasury & Member Ledger
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 flex-shrink-0">
            <div className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center space-x-1.5 border ${
              isAdmin 
                ? (isDark ? 'border-emerald-800/60 bg-emerald-950/60 text-emerald-400' : 'border-emerald-200 bg-emerald-50 text-emerald-700')
                : (isDark ? 'border-slate-700 bg-slate-800 text-slate-300' : 'border-slate-200 bg-slate-100 text-slate-700')
            }`}>
              {isAdmin ? <ShieldCheck size={14} /> : <UserCheck size={14} />}
              <span className="truncate max-w-[90px] sm:max-w-none">{currentUser.name}</span>
            </div>

            <button
              onClick={toggleTheme}
              className={`p-2 rounded-lg border transition-colors ${
                isDark ? 'border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
              title="Switch Theme"
            >
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            <button
              onClick={handleLogout}
              className={`p-2 rounded-lg border transition-colors ${
                isDark ? 'border-slate-800 bg-slate-900 text-slate-400 hover:text-rose-400' : 'border-slate-200 bg-white text-slate-600 hover:text-rose-600'
              }`}
              title="Sign Out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT CONTAINER */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        
        {/* KPI METRIC CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className={`p-5 rounded-xl border ${isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white shadow-sm'}`}>
            <div className="flex items-center justify-between">
              <span className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Registered Members</span>
              <div className={`p-2 rounded-lg ${isDark ? 'bg-slate-800 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>
                <Users size={16} />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-bold mt-2 font-mono tabular-nums">{members.length}</p>
          </div>

          <div className={`p-5 rounded-xl border ${isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white shadow-sm'}`}>
            <div className="flex items-center justify-between">
              <span className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Recorded Transactions</span>
              <div className={`p-2 rounded-lg ${isDark ? 'bg-slate-800 text-sky-400' : 'bg-sky-50 text-sky-600'}`}>
                <CreditCard size={16} />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-bold mt-2 font-mono tabular-nums">{payments.length}</p>
          </div>

          <div className={`p-5 rounded-xl border ${isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white shadow-sm'}`}>
            <div className="flex items-center justify-between">
              <span className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Total Treasury Balance</span>
              <div className={`p-2 rounded-lg ${isDark ? 'bg-slate-800 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>
                <Wallet size={16} />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-bold mt-2 font-mono tabular-nums text-emerald-500">
              ZMW {payments.reduce((acc, p) => acc + Number(p.amount), 0).toLocaleString()}
            </p>
          </div>
        </div>

        {/* TOOLBAR: SEARCH & ACTIONS */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className={`relative flex-1 max-w-md rounded-lg border ${
            isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-300 bg-white shadow-sm'
          }`}>
            <Search className="absolute left-3.5 top-2.5 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Filter by member name or student ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full bg-transparent pl-10 pr-4 py-2 text-sm focus:outline-none ${
                isDark ? 'text-slate-100 placeholder-slate-500' : 'text-slate-900 placeholder-slate-400'
              }`}
            />
          </div>

          <div className="flex items-center space-x-2.5">
            {isAdmin && (
              <>
                <button
                  onClick={() => setIsAddMemberOpen(true)}
                  className="flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold flex items-center justify-center space-x-1.5 bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shadow-sm"
                >
                  <UserPlus size={15} />
                  <span>Add Member</span>
                </button>

                <button
                  onClick={() => setIsAddPaymentOpen(true)}
                  className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold flex items-center justify-center space-x-1.5 border transition-colors ${
                    isDark 
                      ? 'border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-100' 
                      : 'border-slate-300 bg-white hover:bg-slate-50 text-slate-800 shadow-sm'
                  }`}
                >
                  <Plus size={15} />
                  <span>Record Payment</span>
                </button>
              </>
            )}

            <button
              onClick={exportCSV}
              className={`px-3 py-2 rounded-lg border text-xs sm:text-sm font-medium flex items-center space-x-1.5 transition-colors ${
                isDark 
                  ? 'border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300' 
                  : 'border-slate-300 bg-white hover:bg-slate-50 text-slate-700 shadow-sm'
              }`}
              title="Export Ledger CSV"
            >
              <Download size={15} />
              <span className="hidden md:inline">Export</span>
            </button>
          </div>
        </div>

        {/* MOBILE LIST VIEW (< sm) */}
        <div className="block sm:hidden space-y-2.5">
          {filteredMembers.length === 0 ? (
            <div className={`py-12 text-center rounded-xl border text-sm ${
              isDark ? 'border-slate-800 bg-slate-900/50 text-slate-400' : 'border-slate-200 bg-white text-slate-500'
            }`}>
              No matching member records found.
            </div>
          ) : (
            filteredMembers.map((m) => {
              const mPayments = getMemberPayments(m.id);
              return (
                <div
                  key={m.id}
                  onClick={() => setSelectedMemberModal(m)}
                  className={`p-4 rounded-xl border transition-all active:scale-[0.99] flex items-center justify-between ${
                    isDark ? 'border-slate-800 bg-slate-900 text-slate-100' : 'border-slate-200 bg-white text-slate-900 shadow-sm'
                  }`}
                >
                  <div className="space-y-1 min-w-0 pr-3">
                    <p className="font-semibold text-sm truncate">{m.name}</p>
                    <div className="flex items-center space-x-2 text-xs text-slate-400">
                      <span className="font-mono text-emerald-500 font-medium">{m.student_id || 'Unassigned ID'}</span>
                      <span>•</span>
                      <span>{mPayments.length} {mPayments.length === 1 ? 'entry' : 'entries'}</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 flex-shrink-0">
                    <span className={`text-xs px-2.5 py-1 rounded-md border font-medium flex items-center space-x-1 ${
                      isDark ? 'border-slate-700 bg-slate-800 text-slate-200' : 'border-slate-200 bg-slate-50 text-slate-700'
                    }`}>
                      <Eye size={12} />
                      <span>Statement</span>
                    </span>
                    {isAdmin && (
                      <button
                        onClick={(e) => handleDeleteMember(m.id, e)}
                        className="p-1.5 text-slate-400 hover:text-rose-500 transition-colors"
                        title="Remove Member"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                    <ChevronRight size={16} className="text-slate-400" />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* DESKTOP LEDGER TABLE (>= sm) */}
        <div className={`hidden sm:block border rounded-xl overflow-hidden ${isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white shadow-sm'}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className={`border-b text-xs font-semibold uppercase tracking-wider ${
                  isDark ? 'border-slate-800 bg-slate-900/80 text-slate-400' : 'border-slate-200 bg-slate-50 text-slate-600'
                }`}>
                  <th className="py-3.5 px-5">Student ID</th>
                  <th className="py-3.5 px-5">Member Name</th>
                  <th className="py-3.5 px-5">Email Address</th>
                  <th className="py-3.5 px-5 text-center">Transactions</th>
                  <th className="py-3.5 px-5 text-right">Account Statement</th>
                  {isAdmin && <th className="py-3.5 px-5 text-center">Manage</th>}
                </tr>
              </thead>
              <tbody className={`divide-y text-sm ${isDark ? 'divide-slate-800/80' : 'divide-slate-200'}`}>
                {filteredMembers.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin ? "6" : "5"} className="py-12 text-center text-slate-500">
                      No matching member records found.
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
                          isDark ? 'hover:bg-slate-800/60' : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="py-3.5 px-5 font-mono text-xs font-medium text-emerald-500">
                          {m.student_id || '—'}
                        </td>
                        <td className="py-3.5 px-5 font-semibold">
                          {m.name}
                        </td>
                        <td className={`py-3.5 px-5 text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                          {m.email || '—'}
                        </td>
                        <td className="py-3.5 px-5 text-center">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {mPayments.length}
                          </span>
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          <span className={`inline-flex items-center space-x-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                            isDark 
                              ? 'border-slate-700 bg-slate-800/80 text-slate-200 hover:border-emerald-500/50' 
                              : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-emerald-500'
                          }`}>
                            <Eye size={13} className="text-emerald-500" />
                            <span>View Ledger</span>
                          </span>
                        </td>
                        {isAdmin && (
                          <td className="py-3.5 px-5 text-center">
                            <button
                              onClick={(e) => handleDeleteMember(m.id, e)}
                              className="text-slate-400 hover:text-rose-500 transition-colors p-1.5 rounded-lg"
                              title="Remove Member"
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

      {/* MEMBER STATEMENT MODAL */}
      {selectedMemberModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/75 backdrop-blur-sm p-0 sm:p-4">
          <div className={`w-full max-w-2xl sm:rounded-2xl rounded-t-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] ${
            isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            {/* Modal Header */}
            <div className={`px-6 py-4 border-b flex items-start justify-between ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
              <div>
                <span className="text-xs font-semibold text-emerald-500 uppercase tracking-wider">Member Statement</span>
                <h3 className="text-lg font-bold mt-0.5">{selectedMemberModal.name}</h3>
                <div className={`flex flex-wrap items-center gap-2 mt-1 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  <span className="font-mono">ID: {selectedMemberModal.student_id || 'Unassigned'}</span>
                  <span>•</span>
                  <span>{selectedMemberModal.email || 'No email on file'}</span>
                </div>
              </div>
              <button 
                onClick={() => setSelectedMemberModal(null)} 
                className={`p-1.5 rounded-lg transition-colors ${isDark ? 'text-slate-400 hover:bg-slate-800 hover:text-white' : 'text-slate-500 hover:bg-slate-100'}`}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5">
              <div className={`p-4 rounded-xl border flex items-center justify-between ${
                isDark ? 'border-emerald-800/50 bg-emerald-950/30' : 'border-emerald-200 bg-emerald-50/70'
              }`}>
                <div>
                  <p className={`text-xs font-medium ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>Cumulative Contributions</p>
                  <p className="text-2xl font-bold mt-0.5 font-mono tabular-nums text-emerald-500">
                    ZMW {getMemberTotal(selectedMemberModal.id).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-600 text-white font-semibold text-xs">
                  <ShieldCheck size={14} />
                  <span>Verified</span>
                </div>
              </div>

              <div className="space-y-2.5">
                <h4 className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Transaction History
                </h4>
                
                {getMemberPayments(selectedMemberModal.id).length === 0 ? (
                  <div className={`py-8 text-center rounded-xl border text-xs ${
                    isDark ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-500'
                  }`}>
                    No transactions recorded for this member.
                  </div>
                ) : (
                  <div className={`border rounded-xl overflow-hidden ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className={`border-b font-semibold ${isDark ? 'border-slate-800 bg-slate-950/60 text-slate-400' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
                          <th className="py-2.5 px-3.5">Category</th>
                          <th className="py-2.5 px-3.5">Description</th>
                          <th className="py-2.5 px-3.5">Date</th>
                          <th className="py-2.5 px-3.5 text-right">Amount</th>
                          {isAdmin && <th className="py-2.5 px-3 text-center">Void</th>}
                        </tr>
                      </thead>
                      <tbody className={`divide-y ${isDark ? 'divide-slate-800' : 'divide-slate-200'}`}>
                        {getMemberPayments(selectedMemberModal.id).map(p => (
                          <tr key={p.id}>
                            <td className="py-2.5 px-3.5 font-semibold text-emerald-500">{p.category}</td>
                            <td className={`py-2.5 px-3.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{p.description}</td>
                            <td className={`py-2.5 px-3.5 font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{p.date}</td>
                            <td className="py-2.5 px-3.5 text-right font-mono font-semibold tabular-nums">K{Number(p.amount).toLocaleString()}</td>
                            {isAdmin && (
                              <td className="py-2.5 px-3 text-center">
                                <button onClick={() => handleDeletePayment(p.id)} className="text-slate-400 hover:text-rose-500 p-1">
                                  <Trash2 size={14} />
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
            </div>

            {/* Modal Footer */}
            <div className={`px-6 py-4 border-t flex items-center justify-between ${isDark ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-slate-50'}`}>
              {isAdmin ? (
                <button
                  onClick={() => handleDeleteMember(selectedMemberModal.id)}
                  className="px-3.5 py-2 rounded-lg text-xs font-semibold text-rose-500 hover:bg-rose-500/10 flex items-center space-x-1.5 border border-rose-500/20 transition-colors"
                >
                  <UserX size={14} />
                  <span>Remove Member</span>
                </button>
              ) : <div />}

              <button
                onClick={() => setSelectedMemberModal(null)}
                className={`px-4 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                  isDark ? 'border-slate-700 bg-slate-800 hover:bg-slate-700 text-white' : 'border-slate-300 bg-white hover:bg-slate-100 text-slate-800'
                }`}
              >
                Close Statement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD MEMBER MODAL */}
      {isAddMemberOpen && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/75 backdrop-blur-sm p-0 sm:p-4">
          <div className={`w-full max-w-md sm:rounded-2xl rounded-t-2xl border shadow-2xl overflow-hidden ${
            isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className={`px-6 py-4 border-b flex items-center justify-between ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
              <h3 className="text-base font-bold">Register New Member</h3>
              <button onClick={() => setIsAddMemberOpen(false)} className="text-slate-400 hover:text-slate-200">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddMember} className="p-6 space-y-4">
              <div>
                <label className={labelClass}>Full Name <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dinda Nkeete"
                  value={newMember.name}
                  onChange={e => setNewMember({ ...newMember, name: e.target.value })}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Student ID Number</label>
                <input
                  type="text"
                  placeholder="e.g. 202501869"
                  value={newMember.studentId}
                  onChange={e => setNewMember({ ...newMember, studentId: e.target.value })}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Email Address</label>
                <input
                  type="email"
                  placeholder="member@example.com"
                  value={newMember.email}
                  onChange={e => setNewMember({ ...newMember, email: e.target.value })}
                  className={inputClass}
                />
              </div>

              <div className="pt-2 flex space-x-3">
                <button
                  type="button"
                  onClick={() => setIsAddMemberOpen(false)}
                  className={`flex-1 py-2.5 rounded-lg text-xs font-semibold border transition-colors ${
                    isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
                >
                  Save Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD PAYMENT MODAL */}
      {isAddPaymentOpen && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/75 backdrop-blur-sm p-0 sm:p-4">
          <div className={`w-full max-w-md sm:rounded-2xl rounded-t-2xl border shadow-2xl overflow-hidden max-h-[92vh] flex flex-col ${
            isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className={`px-6 py-4 border-b flex items-center justify-between ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
              <h3 className="text-base font-bold">Record Payment Transaction</h3>
              <button onClick={() => setIsAddPaymentOpen(false)} className="text-slate-400 hover:text-slate-200">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddPayment} className="p-6 space-y-4 overflow-y-auto">
              <div>
                <label className={labelClass}>Member <span className="text-rose-500">*</span></label>
                <select
                  required
                  value={newPayment.memberId}
                  onChange={e => setNewPayment({ ...newPayment, memberId: e.target.value })}
                  className={inputClass}
                >
                  <option value="">Select a registered member...</option>
                  {members.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.student_id || 'No ID'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>Payment Category <span className="text-rose-500">*</span></label>
                <select
                  value={newPayment.category}
                  onChange={e => setNewPayment({ ...newPayment, category: e.target.value })}
                  className={inputClass}
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
                  <label className={labelClass}>Membership Tier</label>
                  <select
                    value={newPayment.membershipType}
                    onChange={e => {
                      const tier = MEMBERSHIP_TIERS.find(t => t.id === e.target.value);
                      setNewPayment({
                        ...newPayment,
                        membershipType: e.target.value,
                        amount: tier ? tier.price : 50
                      });
                    }}
                    className={inputClass}
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
                  <label className={labelClass}>Tour Destination</label>
                  <input
                    type="text"
                    value={newPayment.tourName}
                    onChange={e => setNewPayment({ ...newPayment, tourName: e.target.value })}
                    placeholder="e.g. Livingstone Tour 2026"
                    className={inputClass}
                  />
                </div>
              )}

              {newPayment.category === 'Custom' && (
                <div>
                  <label className={labelClass}>Payment Description</label>
                  <input
                    type="text"
                    value={newPayment.customCategory}
                    onChange={e => setNewPayment({ ...newPayment, customCategory: e.target.value })}
                    placeholder="e.g. Department Merch"
                    className={inputClass}
                  />
                </div>
              )}

              <div>
                <label className={labelClass}>Amount (ZMW) <span className="text-rose-500">*</span></label>
                <input
                  type="number"
                  required
                  value={newPayment.amount}
                  onChange={e => setNewPayment({ ...newPayment, amount: e.target.value })}
                  className={`${inputClass} font-mono`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Academic Year</label>
                  <input
                    type="text"
                    value={newPayment.year}
                    onChange={e => setNewPayment({ ...newPayment, year: e.target.value })}
                    className={`${inputClass} font-mono`}
                  />
                </div>

                <div>
                  <label className={labelClass}>Transaction Date</label>
                  <input
                    type="date"
                    value={newPayment.date}
                    onChange={e => setNewPayment({ ...newPayment, date: e.target.value })}
                    className={`${inputClass} font-mono`}
                  />
                </div>
              </div>

              <div className="pt-2 flex space-x-3">
                <button
                  type="button"
                  onClick={() => setIsAddPaymentOpen(false)}
                  className={`flex-1 py-2.5 rounded-lg text-xs font-semibold border transition-colors ${
                    isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
                >
                  Post Transaction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}