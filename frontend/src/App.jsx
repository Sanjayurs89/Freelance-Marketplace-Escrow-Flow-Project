import React, { useState, useEffect } from 'react';
import {
  Shield,
  Briefcase,
  DollarSign,
  User as UserIcon,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Clock,
  Lock,
  Unlock,
  FileText,
  LogOut,
  Plus,
  Info,
  Check,
  XCircle,
  HelpCircle,
  Sun,
  Moon,
  Palette
} from 'lucide-react';

const API_BASE = 'http://localhost:5000/api';

function App() {
  // Theme State
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');

  // Sync theme with localStorage
  useEffect(() => {
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Authentication State
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'register'
  const [authForm, setAuthForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'client'
  });

  // App Navigation State
  const [currentView, setCurrentView] = useState('auth'); // 'auth' | 'dashboard' | 'contract-detail'
  const [selectedContractId, setSelectedContractId] = useState(null);

  // Business Data State
  const [jobs, setJobs] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [freelancers, setFreelancers] = useState([]);
  const [selectedContract, setSelectedContract] = useState(null);
  const [escrowTx, setEscrowTx] = useState(null);
  const [myApplications, setMyApplications] = useState([]);
  const [jobApplications, setJobApplications] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState(null);

  // Form States (Client Dashboard)
  const [newJob, setNewJob] = useState({ title: '', description: '', budget: '' });

  // Bidding Form State (Freelancer Dashboard)
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [applyJobId, setApplyJobId] = useState(null);
  const [applyForm, setApplyForm] = useState({ bidAmount: '', coverLetter: '' });

  // UI Status State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // 1. Session Restoration on Load
  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        setUser(parsed);
        setCurrentView('dashboard');
      } catch (e) {
        localStorage.removeItem('user');
      }
    }
  }, []);

  // 2. Fetch Dashboard Data
  useEffect(() => {
    if (user && currentView === 'dashboard') {
      fetchDashboardData();
    }
  }, [user, currentView]);

  // 3. Fetch Contract & Escrow Details
  useEffect(() => {
    if (user && currentView === 'contract-detail' && selectedContractId) {
      fetchContractDetail(selectedContractId);
    }
  }, [user, currentView, selectedContractId]);

  // Helper: Trigger alerts
  const triggerError = (msg) => {
    setError(msg);
    setSuccess('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => setError(''), 6000);
  };

  const triggerSuccess = (msg) => {
    setSuccess(msg);
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => setSuccess(''), 6000);
  };

  // API Call Helpers
  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${user.token}` };

      // Fetch jobs
      const jobsRes = await fetch(`${API_BASE}/jobs`, { headers });
      const jobsData = await jobsRes.json();
      if (jobsData.success) setJobs(jobsData.data);

      // Fetch contracts
      const contractsRes = await fetch(`${API_BASE}/contracts`, { headers });
      const contractsData = await contractsRes.json();
      if (contractsData.success) setContracts(contractsData.data);

      // If client, fetch freelancers list for contract assignment
      if (user.role === 'client') {
        const freelancersRes = await fetch(`${API_BASE}/auth/freelancers`, { headers });
        const freelancersData = await freelancersRes.json();
        if (freelancersData.success) setFreelancers(freelancersData.data);
      }

      // If freelancer, fetch submitted applications
      if (user.role === 'freelancer') {
        const appsRes = await fetch(`${API_BASE}/jobs/applications/my`, { headers });
        const appsData = await appsRes.json();
        if (appsData.success) setMyApplications(appsData.data);
      }
    } catch (err) {
      triggerError('Failed to fetch dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const fetchContractDetail = async (contractId) => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${user.token}` };

      // Fetch Contract Details
      const contractRes = await fetch(`${API_BASE}/contracts/${contractId}`, { headers });
      const contractData = await contractRes.json();
      if (!contractData.success) throw new Error(contractData.message);
      setSelectedContract(contractData.data);

      // Fetch Escrow Details (may return 404 if draft)
      const escrowRes = await fetch(`${API_BASE}/escrow/contract/${contractId}`, { headers });
      const escrowData = await escrowRes.json();
      if (escrowRes.status === 404) {
        setEscrowTx(null); // Draft contract without escrow transaction
      } else if (escrowData.success) {
        setEscrowTx(escrowData.data);
      } else {
        throw new Error(escrowData.message);
      }
    } catch (err) {
      triggerError(err.message || 'Failed to fetch contract details');
    } finally {
      setLoading(false);
    }
  };

  // Auth Operations
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const url = authMode === 'login' ? `${API_BASE}/auth/login` : `${API_BASE}/auth/register`;
    const payload = authMode === 'login'
      ? { email: authForm.email, password: authForm.password }
      : authForm;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.message || 'Authentication failed');
      }

      // Save user session
      localStorage.setItem('user', JSON.stringify(data.data));
      setUser(data.data);
      setCurrentView('dashboard');
      triggerSuccess(`Successfully logged in as ${data.data.name}!`);
    } catch (err) {
      triggerError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    setUser(null);
    setCurrentView('auth');
    setSelectedContractId(null);
    setSelectedContract(null);
    setEscrowTx(null);
    setJobs([]);
    setContracts([]);
    triggerSuccess('Logged out successfully');
  };

  // Client Action: Post Job
  const handlePostJob = async (e) => {
    e.preventDefault();
    if (!newJob.title || !newJob.description || !newJob.budget) {
      triggerError('Please fill in all job fields');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/jobs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify({
          title: newJob.title,
          description: newJob.description,
          budget: Number(newJob.budget)
        })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);

      triggerSuccess('Job posted successfully!');
      setNewJob({ title: '', description: '', budget: '' });
      fetchDashboardData();
    } catch (err) {
      triggerError(err.message);
    } finally {
      setLoading(false);
    }
  };



  // Freelancer Action: Apply for Job
  const handleApplyJob = async (e) => {
    e.preventDefault();
    if (!applyForm.bidAmount || !applyForm.coverLetter) {
      triggerError('Please fill in all bidding fields');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/jobs/${applyJobId}/apply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify({
          bidAmount: Number(applyForm.bidAmount),
          coverLetter: applyForm.coverLetter
        })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);

      triggerSuccess('Application submitted successfully!');
      setShowApplyModal(false);
      setApplyForm({ bidAmount: '', coverLetter: '' });
      setApplyJobId(null);
      fetchDashboardData();
    } catch (err) {
      triggerError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Client Action: Fetch Applications for a Job
  const handleViewApplications = async (jobId) => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${user.token}` };
      const res = await fetch(`${API_BASE}/jobs/${jobId}/applications`, { headers });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);

      setJobApplications(data.data);
      setSelectedJobId(jobId);
    } catch (err) {
      triggerError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Client Action: Accept Application
  const handleAcceptApplication = async (applicationId) => {
    if (!window.confirm('Are you sure you want to hire this freelancer? This will automatically assign the job and create a draft contract.')) {
      return;
    }
    const deadlineStr = window.prompt('Enter contract deadline (YYYY-MM-DD) or leave blank if none:');
    if (deadlineStr === null) return; // User cancelled

    if (deadlineStr) {
      const selectedDate = new Date(deadlineStr);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (selectedDate.getTime() < today.getTime()) {
        alert('Contract deadline cannot be in the past');
        return;
      }
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/jobs/applications/${applicationId}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify({
          deadline: deadlineStr ? new Date(deadlineStr) : undefined
        })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);

      triggerSuccess('Freelancer hired! Draft contract created successfully.');
      setSelectedJobId(null);
      setJobApplications([]);
      fetchDashboardData();
    } catch (err) {
      triggerError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Client Action: Reject Application
  const handleRejectApplication = async (applicationId) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/jobs/applications/${applicationId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        }
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);

      triggerSuccess('Application rejected.');
      // Refresh current application list
      if (selectedJobId) {
        handleViewApplications(selectedJobId);
      }
      fetchDashboardData();
    } catch (err) {
      triggerError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Escrow State Transition Triggers
  const handleFundEscrow = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/escrow/fund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify({
          contractId: selectedContract._id,
          amount: selectedContract.agreedAmount
        })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);

      triggerSuccess('Escrow funded! State is now FUNDED.');
      fetchContractDetail(selectedContract._id);
    } catch (err) {
      triggerError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStartWork = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/escrow/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify({ transactionId: escrowTx._id })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);

      triggerSuccess('Work started! State is now IN PROGRESS.');
      fetchContractDetail(selectedContract._id);
    } catch (err) {
      triggerError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeliverWork = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/escrow/deliver`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify({ transactionId: escrowTx._id })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);

      triggerSuccess('Work delivered! State is now DELIVERED.');
      fetchContractDetail(selectedContract._id);
    } catch (err) {
      triggerError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveEscrow = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/escrow/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify({ transactionId: escrowTx._id })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);

      triggerSuccess('Escrow approved! Funds released to freelancer.');
      fetchContractDetail(selectedContract._id);
    } catch (err) {
      triggerError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDisputeEscrow = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/escrow/dispute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify({ transactionId: escrowTx._id })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);

      triggerSuccess('Escrow disputed! Waiting for admin resolution.');
      fetchContractDetail(selectedContract._id);
    } catch (err) {
      triggerError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResolveDispute = async (action) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/escrow/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify({
          transactionId: escrowTx._id,
          action
        })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);

      triggerSuccess(`Dispute resolved! Action: ${action.toUpperCase()}`);
      fetchContractDetail(selectedContract._id);
    } catch (err) {
      triggerError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRefundOverdue = async () => {
    if (!window.confirm('Are you sure you want to refund this escrow? This will cancel the contract and return the funds to your account.')) {
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/escrow/refund-overdue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify({ transactionId: escrowTx._id })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);

      triggerSuccess('Escrow refunded successfully due to overdue deadline.');
      fetchContractDetail(selectedContract._id);
    } catch (err) {
      triggerError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestExtension = async (days) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/contracts/${selectedContract._id}/extension-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify({ days })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);

      triggerSuccess('Deadline extension request sent successfully.');
      fetchContractDetail(selectedContract._id);
    } catch (err) {
      triggerError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRespondExtension = async (action, days) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/contracts/${selectedContract._id}/extension-respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify({ action, days })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);

      triggerSuccess(`Deadline extension request ${data.data.extensionRequest.status} successfully.`);
      fetchContractDetail(selectedContract._id);
    } catch (err) {
      triggerError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Helper to render state indicator widths & statuses
  const getTimelineProgressWidth = () => {
    if (!escrowTx) return '0%';
    switch (escrowTx.status) {
      case 'funded': return '0%';
      case 'in_progress': return '33.33%';
      case 'delivered': return '66.66%';
      case 'released':
      case 'disputed':
      case 'refunded':
        return '100%';
      default: return '0%';
    }
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Pending';
    return new Date(dateStr).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Rendering Functions
  return (
    <div className={`app-container theme-${theme}`}>
      {/* Navigation Header */}
      <header className="navbar">
        <div className="nav-brand">
          <Shield size={26} color="var(--accent)" style={{ strokeWidth: 2.5 }} />
          <span>EscrowFlow</span>
        </div>

        {/* Dynamic Theme Mode Toggler */}
        <div className="theme-picker-container">
          <button 
            className="theme-toggle-btn" 
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
          >
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>
        </div>

        {user && (
          <div className="nav-user">
            <div className="user-avatar" title={user.name}>
              {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <span style={{ fontSize: '0.95rem', fontWeight: 500, color: 'var(--text-primary)' }}>
              Welcome, <strong>{user.name}</strong>
            </span>
            <span className="user-badge">{user.role}</span>
            <button className="btn btn-secondary" onClick={handleLogout} style={{ padding: '0.5rem 1rem', gap: '0.35rem' }}>
              <LogOut size={16} />
              Logout
            </button>
          </div>
        )}
      </header>

      {/* Main Container */}
      <main className="main-content">
        {/* Banner Alert Messages */}
        {error && (
          <div className="alert alert-error">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="alert alert-success">
            <CheckCircle2 size={18} />
            <span>{success}</span>
          </div>
        )}

        {loading && <div className="spinner"></div>}

        {/* 1. AUTHENTICATION VIEW */}
        {currentView === 'auth' && (
          <div className="card auth-box">
            <h2 className="form-title">{authMode === 'login' ? 'Welcome Back' : 'Get Started'}</h2>
            <p className="form-subtitle">
              {authMode === 'login'
                ? 'Sign in to access your secure marketplace escrow'
                : 'Create an account to start secure freelancing'}
            </p>

            <form onSubmit={handleAuthSubmit}>
              {authMode === 'register' && (
                <div className="form-group">
                  <label htmlFor="auth-name">Full Name Label</label>
                  <input
                    id="auth-name"
                    type="text"
                    className="form-input"
                    placeholder="Enter your name"
                    value={authForm.name}
                    onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })}
                    required
                  />
                </div>
              )}
              <div className="form-group">
                <label htmlFor="auth-email">Email Address Label</label>
                <input
                  id="auth-email"
                  type="email"
                  className="form-input"
                  placeholder="name@example.com"
                  value={authForm.email}
                  onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="auth-password">Password Label</label>
                <input
                  id="auth-password"
                  type="password"
                  className="form-input"
                  placeholder="••••••••"
                  value={authForm.password}
                  onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                  required
                />
              </div>
              {authMode === 'register' && (
                <div className="form-group">
                  <label htmlFor="auth-role">Choose Account Role</label>
                  <select
                    id="auth-role"
                    className="form-select"
                    value={authForm.role}
                    onChange={(e) => setAuthForm({ ...authForm, role: e.target.value })}
                  >
                    <option value="client">Client (Post Jobs & Hire)</option>
                    <option value="freelancer">Freelancer (Work & Earn)</option>
                    <option value="admin">Administrator (Resolve Disputes)</option>
                  </select>
                </div>
              )}
              <button type="submit" className="btn btn-primary btn-block mt-4" disabled={loading}>
                {authMode === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            </form>

            <p className="text-center mt-4" style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              {authMode === 'login' ? "Don't have an account? " : "Already have an account? "}
              <span
                className="text-accent"
                style={{ cursor: 'pointer', fontWeight: 600 }}
                onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
              >
                {authMode === 'login' ? 'Sign Up' : 'Sign In'}
              </span>
            </p>
          </div>
        )}

        {/* 2. DASHBOARD VIEW */}
        {currentView === 'dashboard' && (
          <div>
            <div className="dashboard-header">
              <div>
                <h1 style={{ fontSize: '2rem' }}>Workspace Dashboard</h1>
                <p className="text-muted">Manage your job contracts, escrow transactions, and work cycles</p>
              </div>
            </div>

            <div className="dashboard-grid">
              {/* Left Column: Contracts list & Job marketplace */}
              <div className="dashboard-main-col">
                <div className="card">
                  <h3 className="mb-4" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <FileText size={20} color="var(--accent)" />
                    My Escrow Contracts
                  </h3>

                  {contracts.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)' }}>
                      <HelpCircle size={40} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                      <p>No contracts created yet</p>
                    </div>
                  ) : (
                    <div className="item-list">
                      {contracts.map((c) => (
                        <div key={c._id} className="list-item">
                          <div className="item-main">
                            <span className="item-title">{c.job ? c.job.title : 'Deleted Job'}</span>
                            <div className="item-meta">
                              <span>Client: {c.client ? c.client.name : 'Unknown'}</span>
                              <span>Freelancer: {c.freelancer ? c.freelancer.name : 'Unknown'}</span>
                            </div>
                          </div>
                          <div className="item-side">
                            <span className="price-tag">{formatCurrency(c.agreedAmount)}</span>
                            <span className={`status-badge status-${c.status}`}>
                              {c.status}
                            </span>
                            <button
                              className="btn btn-secondary"
                              style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                              onClick={() => {
                                setSelectedContractId(c._id);
                                setCurrentView('contract-detail');
                              }}
                            >
                              Escrow Detail
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Freelancer Views: Open Jobs & Bid History */}
                {user.role === 'freelancer' && (
                  <>
                    <div className="card">
                      <h3 className="mb-4" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Briefcase size={20} color="var(--accent)" />
                        Available Job Listings
                      </h3>
                      {jobs.filter(j => j.status === 'open').length === 0 ? (
                        <p className="text-muted">No open jobs available right now</p>
                      ) : (
                        <div className="item-list">
                          {jobs.filter(j => j.status === 'open').map((j) => {
                            const hasApplied = myApplications.some(app => app.job && app.job._id === j._id);
                            const application = myApplications.find(app => app.job && app.job._id === j._id);

                            return (
                              <div key={j._id} className="list-item">
                                <div className="item-main">
                                  <span className="item-title">{j.title}</span>
                                  <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                                    {j.description}
                                  </p>
                                  <div className="item-meta">
                                    <span>Client: {j.postedBy ? j.postedBy.name : 'Unknown'}</span>
                                  </div>
                                </div>
                                <div className="item-side">
                                  <span className="price-tag">{formatCurrency(j.budget)}</span>
                                  {hasApplied ? (
                                    <span className={`status-badge status-${application?.status || 'pending'}`} style={{ textTransform: 'capitalize' }}>
                                      Applied ({application?.status || 'pending'})
                                    </span>
                                  ) : (
                                    <button
                                      className="btn btn-primary"
                                      style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                                      onClick={() => {
                                        setApplyJobId(j._id);
                                        setApplyForm({ bidAmount: j.budget.toString(), coverLetter: '' });
                                        setShowApplyModal(true);
                                      }}
                                    >
                                      Apply / Bid
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className="card mt-4">
                      <h3 className="mb-4" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <FileText size={20} color="var(--accent)" />
                        My Submitted Bids / Applications
                      </h3>
                      {myApplications.length === 0 ? (
                        <p className="text-muted">You haven't submitted any job bids yet.</p>
                      ) : (
                        <div className="item-list">
                          {myApplications.map((app) => (
                            <div key={app._id} className="list-item" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                                <div>
                                  <span className="item-title">{app.job ? app.job.title : 'Deleted Job'}</span>
                                  <div className="item-meta" style={{ marginTop: '0.25rem' }}>
                                    <span>Client: {app.job?.postedBy?.name || 'Unknown'}</span>
                                    <span>Applied: {formatDate(app.createdAt)}</span>
                                  </div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'end' }}>
                                  <span className="price-tag">{formatCurrency(app.bidAmount)}</span>
                                  <span className={`status-badge status-${app.status}`}>{app.status}</span>
                                </div>
                              </div>
                              <div style={{ marginTop: '0.75rem', fontSize: '0.9rem', color: 'var(--text-secondary)', fontStyle: 'italic', backgroundColor: 'var(--bg-tertiary)', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                                Proposal: "{app.coverLetter}"
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Client Views: Posted Jobs & Bids Review Panel */}
                {user.role === 'client' && (
                  <>
                    <div className="card mt-4">
                      <h3 className="mb-4" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Briefcase size={20} color="var(--accent)" />
                        My Posted Jobs
                      </h3>
                      {jobs.filter(j => j.postedBy && (j.postedBy._id === user._id || j.postedBy === user._id)).length === 0 ? (
                        <p className="text-muted">You haven't posted any jobs yet.</p>
                      ) : (
                        <div className="item-list">
                          {jobs.filter(j => j.postedBy && (j.postedBy._id === user._id || j.postedBy === user._id)).map((j) => (
                            <div key={j._id} className="list-item" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                  <span className="item-title">{j.title}</span>
                                  <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                                    {j.description}
                                  </p>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'end', gap: '0.3rem' }}>
                                  <span className="price-tag">{formatCurrency(j.budget)}</span>
                                  <span className={`status-badge status-${j.status}`}>{j.status}</span>
                                </div>
                              </div>

                              {j.status === 'open' && (
                                <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                    Review bids from interested freelancers
                                  </span>
                                  <button
                                    className="btn btn-secondary"
                                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                                    onClick={() => handleViewApplications(j._id)}
                                  >
                                    Review Bids
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {selectedJobId && (
                      <div className="card mt-4" style={{ border: '1px solid var(--accent)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                          <h3 style={{ margin: 0 }}>
                            Reviewing Bids for: "{jobs.find(j => j._id === selectedJobId)?.title}"
                          </h3>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.85rem' }}
                            onClick={() => {
                              setSelectedJobId(null);
                              setJobApplications([]);
                            }}
                          >
                            Close Review
                          </button>
                        </div>

                        {jobApplications.length === 0 ? (
                          <p className="text-muted" style={{ padding: '1rem 0' }}>No applications received yet for this job.</p>
                        ) : (
                          <div className="item-list">
                            {jobApplications.map((app) => (
                              <div key={app._id} className="list-item" style={{ flexDirection: 'column', alignItems: 'stretch', backgroundColor: 'rgba(15, 23, 42, 0.015)', padding: '1.2rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                                  <div>
                                    <strong style={{ fontSize: '1.1rem', color: 'var(--text-primary)' }}>{app.freelancer?.name}</strong>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{app.freelancer?.email}</div>
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'end' }}>
                                    <span className="price-tag" style={{ fontSize: '1.15rem' }}>Bid: {formatCurrency(app.bidAmount)}</span>
                                    <span className={`status-badge status-${app.status}`} style={{ marginTop: '0.25rem' }}>{app.status}</span>
                                  </div>
                                </div>

                                <div style={{ marginTop: '0.75rem', fontSize: '0.9rem', color: 'var(--text-secondary)', fontStyle: 'italic', backgroundColor: 'var(--bg-tertiary)', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--border-color)', borderLeft: '3px solid var(--accent)' }}>
                                  "{app.coverLetter}"
                                </div>

                                {app.status === 'pending' && (
                                  <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', justifyContent: 'end' }}>
                                    <button
                                      className="btn btn-success"
                                      style={{ padding: '0.4rem 0.9rem', fontSize: '0.85rem' }}
                                      onClick={() => handleAcceptApplication(app._id)}
                                    >
                                      Accept & Hire
                                    </button>
                                    <button
                                      className="btn btn-danger"
                                      style={{ padding: '0.4rem 0.9rem', fontSize: '0.85rem' }}
                                      onClick={() => handleRejectApplication(app._id)}
                                    >
                                      Reject
                                    </button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Right Column: Actions (Clients) or Stats (Freelancer/Admin) */}
              <div className="dashboard-side-col">
                {user.role === 'client' && (
                  <>
                    {/* Post a Job Card */}
                    <div className="card">
                      <h3 className="mb-4" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Plus size={20} color="var(--accent)" />
                        Post a New Job
                      </h3>
                      <form onSubmit={handlePostJob}>
                        <div className="form-group">
                          <label htmlFor="job-title">Job Title Label</label>
                          <input
                            id="job-title"
                            type="text"
                            className="form-input"
                            placeholder="e.g. Develop Escrow Contract UI"
                            value={newJob.title}
                            onChange={(e) => setNewJob({ ...newJob, title: e.target.value })}
                            required
                          />
                        </div>
                        <div className="form-group">
                          <label htmlFor="job-description">Job Description Label</label>
                          <textarea
                            id="job-description"
                            className="form-input"
                            rows="3"
                            placeholder="Detail job deliverables..."
                            value={newJob.description}
                            onChange={(e) => setNewJob({ ...newJob, description: e.target.value })}
                            required
                          />
                        </div>
                        <div className="form-group">
                          <label htmlFor="job-budget">Budget (USD) Label</label>
                          <input
                            id="job-budget"
                            type="number"
                            className="form-input"
                            placeholder="500"
                            value={newJob.budget}
                            onChange={(e) => setNewJob({ ...newJob, budget: e.target.value })}
                            required
                          />
                        </div>
                        <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
                          Publish Job
                        </button>
                      </form>
                    </div>


                  </>
                )}

                {/* Stats Panel for Freelancers & Admin */}
                {user.role !== 'client' && (
                  <div className="card">
                    <h3 className="mb-4">Quick Account Stats</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                        <span className="text-muted">Total Active Contracts:</span>
                        <strong style={{ marginLeft: 'auto' }}>{contracts.filter(c => c.status === 'active').length}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                        <span className="text-muted">Completed Work:</span>
                        <strong style={{ marginLeft: 'auto' }}>{contracts.filter(c => c.status === 'completed').length}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                        <span className="text-muted">Role Assignment:</span>
                        <strong style={{ marginLeft: 'auto', textTransform: 'capitalize' }}>{user.role}</strong>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 3. CONTRACT & ESCROW DETAIL VIEW */}
        {currentView === 'contract-detail' && selectedContract && (
          <div>
            <div className="mb-4">
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setCurrentView('dashboard');
                  setSelectedContractId(null);
                  setSelectedContract(null);
                  setEscrowTx(null);
                }}
                style={{ gap: '0.35rem', padding: '0.5rem 1rem' }}
              >
                <ArrowLeft size={16} />
                Back to Dashboard
              </button>
            </div>

            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <h1 style={{ fontSize: '2.2rem' }}>{selectedContract.job ? selectedContract.job.title : 'Job Contract Details'}</h1>
                  <p className="text-muted" style={{ marginTop: '0.5rem' }}>
                    Contract ID: {selectedContract._id}
                  </p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'end', gap: '0.5rem' }}>
                  <span className="price-tag" style={{ fontSize: '2rem' }}>
                    {formatCurrency(selectedContract.agreedAmount)}
                  </span>
                  <div>
                    <span className="text-muted" style={{ marginRight: '0.5rem' }}>Contract:</span>
                    <span className={`status-badge status-${selectedContract.status}`}>{selectedContract.status}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Visual Escrow Timeline Flow */}
            <div className="card">
              <h3 className="timeline-title">Escrow State Machine Tracking</h3>

              {!escrowTx ? (
                <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                  <Unlock size={32} color="var(--warning)" style={{ marginBottom: '1rem' }} />
                  <h4>Escrow is Unfunded</h4>
                  <p className="text-muted mt-4" style={{ maxWidth: '480px', margin: '0 auto' }}>
                    This contract is currently in draft. The client must fund the escrow amount before work can begin.
                  </p>
                </div>
              ) : (
                <div className="timeline-wrapper">
                  <div className="timeline-flow">
                    <div className="timeline-connector"></div>
                    <div
                      className="timeline-connector-active"
                      style={{ '--progress-width': getTimelineProgressWidth() }}
                    ></div>

                    {/* Node 1: Funded */}
                    <div className={`timeline-node ${escrowTx.status === 'funded' ? 'active' :
                        ['in_progress', 'delivered', 'released', 'disputed', 'refunded'].includes(escrowTx.status) ? 'completed' : ''
                      }`}>
                      <div className="node-circle">1</div>
                      <span className="node-label">Funded</span>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                        {formatDate(escrowTx.fundedAt)}
                      </span>
                    </div>

                    {/* Node 2: In Progress */}
                    <div className={`timeline-node ${escrowTx.status === 'in_progress' ? 'active' :
                        ['delivered', 'released', 'disputed', 'refunded'].includes(escrowTx.status) ? 'completed' : ''
                      }`}>
                      <div className="node-circle">2</div>
                      <span className="node-label">In Progress</span>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                        {escrowTx.inProgressAt ? formatDate(escrowTx.inProgressAt) : 'Pending'}
                      </span>
                    </div>

                    {/* Node 3: Delivered */}
                    <div className={`timeline-node ${escrowTx.status === 'delivered' ? 'active' :
                        ['released', 'disputed', 'refunded'].includes(escrowTx.status) ? 'completed' : ''
                      }`}>
                      <div className="node-circle">3</div>
                      <span className="node-label">Delivered</span>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                        {escrowTx.deliveredAt ? formatDate(escrowTx.deliveredAt) : 'Pending'}
                      </span>
                    </div>

                    {/* Node 4: Released or Refunded */}
                    <div className={`timeline-node ${escrowTx.status === 'released' ? 'completed' :
                        escrowTx.status === 'refunded' ? 'failed' :
                          escrowTx.status === 'disputed' ? 'active' : ''
                      }`}>
                      <div className="node-circle">
                        {escrowTx.status === 'released' ? <Check size={16} /> :
                          escrowTx.status === 'refunded' ? <XCircle size={16} /> : '4'}
                      </div>
                      <span className="node-label">
                        {escrowTx.status === 'refunded' ? 'Refunded' :
                          escrowTx.status === 'disputed' ? 'Disputed' : 'Released'}
                      </span>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                        {escrowTx.status === 'released' ? formatDate(escrowTx.releasedAt) :
                          escrowTx.status === 'refunded' ? formatDate(escrowTx.refundedAt) :
                            escrowTx.status === 'disputed' ? formatDate(escrowTx.disputedAt) : 'Pending'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Escrow Details & Controls Grid */}
            <div className="detail-grid">
              {/* Detailed Breakdown */}
              <div className="card">
                <h3 className="mb-4">Contract Specifications</h3>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                  {selectedContract.job ? selectedContract.job.description : 'No job description available.'}
                </p>

                <div className="detail-info">
                  <div className="info-row">
                    <span className="info-label">Client Account</span>
                    <span className="info-value">{selectedContract.client ? selectedContract.client.name : 'Unknown'}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Freelancer Account</span>
                    <span className="info-value">{selectedContract.freelancer ? selectedContract.freelancer.name : 'Unknown'}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Contract Deadline</span>
                    <span className="info-value" style={{ fontWeight: 600 }}>
                      {selectedContract.deadline ? formatDate(selectedContract.deadline) : 'No deadline set'}
                    </span>
                  </div>
                  {selectedContract.deadline && (
                    <div className="info-row">
                      <span className="info-label">Time Remaining</span>
                      <span className="info-value">
                        {(() => {
                          const diff = new Date(selectedContract.deadline).getTime() - Date.now();
                          if (diff <= 0) {
                            return <span className="status-badge status-cancelled" style={{ padding: '0.2rem 0.5rem', fontWeight: 600 }}>Overdue / Lapsed</span>;
                          }
                          const hours = Math.floor(diff / (1000 * 60 * 60));
                          const days = Math.floor(hours / 24);
                          if (days > 0) return `${days} day(s) remaining`;
                          return `${hours} hour(s) remaining`;
                        })()}
                      </span>
                    </div>
                  )}
                  {selectedContract.extensionRequest && selectedContract.extensionRequest.status === 'pending' && (
                    <div className="info-row" style={{ backgroundColor: 'rgba(234, 179, 8, 0.1)', padding: '0.75rem', borderRadius: '4px' }}>
                      <span className="info-label" style={{ color: '#854d0e', fontWeight: 600 }}>Pending Extension Request</span>
                      <span className="info-value" style={{ fontWeight: 600, color: '#854d0e' }}>
                        {selectedContract.extensionRequest.days} days requested
                      </span>
                    </div>
                  )}
                  {escrowTx && (
                    <>
                      <div className="info-row">
                        <span className="info-label">Escrow Account Balance (Held)</span>
                        <span className="info-value" style={{ color: 'var(--warning)' }}>
                          {formatCurrency(escrowTx.heldAmount)}
                        </span>
                      </div>
                      <div className="info-row">
                        <span className="info-label">Released Funds</span>
                        <span className="info-value" style={{ color: 'var(--success)' }}>
                          {formatCurrency(escrowTx.releasedAmount)}
                        </span>
                      </div>
                      <div className="info-row">
                        <span className="info-label">Refunded Funds</span>
                        <span className="info-value" style={{ color: 'var(--error)' }}>
                          {formatCurrency(escrowTx.refundedAmount)}
                        </span>
                      </div>
                      <div className="info-row" style={{ borderBottom: 'none' }}>
                        <span className="info-label">Current Escrow Status</span>
                        <span className={`status-badge status-${escrowTx.status}`}>{escrowTx.status}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Action Sidebar */}
              <div className="card action-card">
                <h3 className="action-title">Escrow Action Control</h3>

                {/* 1. Unfunded draft contract (Client funds) */}
                {!escrowTx && selectedContract.status === 'draft' && (
                  <div>
                    {user.role === 'client' ? (
                      <>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                          Authorize the funding of escrow for <strong>{formatCurrency(selectedContract.agreedAmount)}</strong>. Funds will be held securely in escrow.
                        </p>
                        <button className="btn btn-primary btn-block" onClick={handleFundEscrow} disabled={loading}>
                          <Lock size={16} />
                          Fund Escrow Account
                        </button>
                      </>
                    ) : (
                      <p className="text-muted" style={{ fontSize: '0.9rem' }}>
                        Waiting for the client to fund the escrow so you can begin working.
                      </p>
                    )}
                  </div>
                )}

                {/* 2. Escrow Funded (Freelancer starts) */}
                {escrowTx && escrowTx.status === 'funded' && (
                  <div>
                    {user.role === 'freelancer' ? (
                      <>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                          The client has funded this escrow. You can now start the work.
                        </p>
                        <button className="btn btn-primary btn-block" onClick={handleStartWork} disabled={loading}>
                          Start Active Work
                        </button>
                      </>
                    ) : (
                      <p className="text-muted" style={{ fontSize: '0.9rem' }}>
                        Escrow funded successfully! Waiting for the freelancer to start work.
                      </p>
                    )}
                  </div>
                )}

                {/* 3. Work In Progress (Freelancer delivers) */}
                {escrowTx && escrowTx.status === 'in_progress' && (
                  <div>
                    {user.role === 'freelancer' ? (
                      <>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                          Work is in progress. Once complete, deliver it to prompt client approval.
                        </p>
                        <button className="btn btn-primary btn-block" onClick={handleDeliverWork} disabled={loading}>
                          Deliver Finished Work
                        </button>
                      </>
                    ) : (
                      <p className="text-muted" style={{ fontSize: '0.9rem' }}>
                        Freelancer is currently working on your project.
                      </p>
                    )}
                  </div>
                )}

                {/* 4. Work Delivered (Client approves or disputes / Freelancer files arbitration) */}
                {escrowTx && escrowTx.status === 'delivered' && (
                  <div>
                    {user.role === 'client' ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                          Review the work delivered. You can either approve to release the funds, or open a dispute if issues exist.
                        </p>
                        <button className="btn btn-success btn-block" onClick={handleApproveEscrow} disabled={loading}>
                          <CheckCircle2 size={16} />
                          Approve & Release Funds
                        </button>
                        <button className="btn btn-danger btn-block" onClick={handleDisputeEscrow} disabled={loading}>
                          <AlertCircle size={16} />
                          Dispute Delivery
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                          Work delivered! Waiting for client approval. If the client is unresponsive, you can file for arbitration.
                        </p>
                        {user.role === 'freelancer' && (() => {
                          const deliveredAt = escrowTx.deliveredAt ? new Date(escrowTx.deliveredAt) : new Date();
                          const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;
                          const elapsed = Date.now() - deliveredAt.getTime();
                          const isEligible = elapsed >= sevenDaysInMs;
                          
                          if (!isEligible) {
                            const remainingMs = sevenDaysInMs - elapsed;
                            const days = Math.floor(remainingMs / (24 * 60 * 60 * 1000));
                            const hours = Math.floor((remainingMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
                            const mins = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
                            
                            let timeRemainingStr = '';
                            if (days > 0) {
                              timeRemainingStr = `${days}d ${hours}h remaining`;
                            } else if (hours > 0) {
                              timeRemainingStr = `${hours}h ${mins}m remaining`;
                            } else {
                              timeRemainingStr = `${mins}m remaining`;
                            }
                            
                            return (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
                                <button className="btn btn-secondary btn-block" disabled={true} style={{ opacity: 0.6, cursor: 'not-allowed', width: '100%' }}>
                                  <AlertCircle size={16} />
                                  Arbitration locked ({timeRemainingStr})
                                </button>
                                <p className="text-muted" style={{ fontSize: '0.8rem', textAlign: 'center', margin: 0 }}>
                                  You can file for arbitration if the client does not respond within 7 days of delivery.
                                </p>
                              </div>
                            );
                          }
                          
                          return (
                            <button className="btn btn-danger btn-block" onClick={handleDisputeEscrow} disabled={loading}>
                              <AlertCircle size={16} />
                              File for Arbitration
                            </button>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                )}

                {/* 5. Dispute Opened (Admin resolves) */}
                {escrowTx && escrowTx.status === 'disputed' && (
                  <div>
                    {user.role === 'admin' ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                          As administrator, review the contract dispute and release to freelancer or refund client.
                        </p>
                        <button className="btn btn-success btn-block" onClick={() => handleResolveDispute('release')} disabled={loading}>
                          Resolve: Release Funds
                        </button>
                        <button className="btn btn-danger btn-block" onClick={() => handleResolveDispute('refund')} disabled={loading}>
                          Resolve: Refund Client
                        </button>
                      </div>
                    ) : (
                      <div style={{ border: '1px solid rgba(239, 68, 68, 0.2)', padding: '1rem', borderRadius: '8px', backgroundColor: 'var(--error-light)' }}>
                        <h4 style={{ color: 'var(--error)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <AlertCircle size={18} />
                          Escrow Disputed
                        </h4>
                        <p className="text-muted mt-4" style={{ fontSize: '0.85rem' }}>
                          A dispute has been logged. An administrator will review details and release or refund the escrow balance.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* 6. Released (Completed) */}
                {escrowTx && escrowTx.status === 'released' && (
                  <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                    <CheckCircle2 size={40} color="var(--success)" style={{ marginBottom: '0.75rem' }} />
                    <p style={{ fontWeight: 600, color: 'var(--success)' }}>Transaction Completed</p>
                    <p className="text-muted" style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>
                      Funds of {formatCurrency(escrowTx.releasedAmount)} have been transferred to the freelancer's account.
                    </p>
                  </div>
                )}

                {/* 7. Refunded (Cancelled) */}
                {escrowTx && escrowTx.status === 'refunded' && (
                  <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                    <XCircle size={40} color="var(--error)" style={{ marginBottom: '0.75rem' }} />
                    <p style={{ fontWeight: 600, color: 'var(--error)' }}>Transaction Refunded</p>
                    <p className="text-muted" style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>
                      Funds of {formatCurrency(escrowTx.refundedAmount)} have been returned to the client's account.
                    </p>
                  </div>
                )}

                {/* 8. Overdue refund client action */}
                {escrowTx && ['funded', 'in_progress', 'delivered', 'disputed'].includes(escrowTx.status) &&
                  selectedContract.deadline && new Date(selectedContract.deadline).getTime() < Date.now() &&
                  user.role === 'client' && (
                    <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
                      <p style={{ fontSize: '0.85rem', color: 'var(--error)', marginBottom: '0.75rem', fontWeight: 500 }}>
                        ⚠️ The contract deadline has passed. You are entitled to a full refund of the escrowed amount.
                      </p>
                      <button className="btn btn-danger btn-block" onClick={handleRefundOverdue} disabled={loading}>
                        <XCircle size={16} />
                        Refund Overdue Escrow
                      </button>
                    </div>
                  )}

                {/* 9. Freelancer deadline extension request form */}
                {escrowTx && ['funded', 'in_progress'].includes(escrowTx.status) &&
                  user.role === 'freelancer' && (
                    <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)' }}>
                      <h4 style={{ fontSize: '0.95rem', marginBottom: '0.5rem', fontWeight: 600 }}>Deadline Extension</h4>
                      {selectedContract.extensionRequest && selectedContract.extensionRequest.status === 'pending' ? (
                        <p style={{ fontSize: '0.85rem', color: '#854d0e', margin: 0, padding: '0.5rem', backgroundColor: 'rgba(234,179,8,0.1)', borderRadius: '4px' }}>
                          ⏳ Request pending for <strong>{selectedContract.extensionRequest.days} days</strong>.
                        </p>
                      ) : (
                        <div>
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                            Ask the client to extend the deadline (maximum 15 days):
                          </p>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <input
                              type="number"
                              placeholder="Days"
                              id="request-extend-days"
                              className="form-input"
                              min="1"
                              max="15"
                              style={{ width: '40%', padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
                            />
                            <button
                              className="btn btn-primary"
                              style={{ flex: 1, padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
                              onClick={() => {
                                const val = document.getElementById('request-extend-days').value;
                                if (!val || Number(val) <= 0) {
                                  alert('Please enter a valid positive number of days');
                                  return;
                                }
                                if (Number(val) > 15) {
                                  alert('Extension request cannot exceed 15 days');
                                  return;
                                }
                                handleRequestExtension(Number(val));
                              }}
                              disabled={loading}
                            >
                              Request Days
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                {/* 10. Client response to extension request */}
                {selectedContract.extensionRequest && selectedContract.extensionRequest.status === 'pending' &&
                  user.role === 'client' && (
                    <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)', padding: '1rem', backgroundColor: 'rgba(15, 23, 42, 0.05)', borderRadius: '8px' }}>
                      <h4 style={{ fontSize: '0.95rem', marginBottom: '0.5rem', fontWeight: 600 }}>Extension Requested</h4>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                        The freelancer has requested a deadline extension of <strong>{selectedContract.extensionRequest.days} days</strong>.
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <button className="btn btn-success btn-block" onClick={() => handleRespondExtension('approve')} disabled={loading}>
                          Approve {selectedContract.extensionRequest.days} Days
                        </button>
                        
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                          <input
                            type="number"
                            placeholder="Reduced days"
                            id="grant-fewer-days"
                            className="form-input"
                            min="1"
                            max={selectedContract.extensionRequest.days - 1}
                            style={{ width: '50%', padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
                          />
                          <button
                            className="btn btn-primary"
                            style={{ flex: 1, padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
                            onClick={() => {
                              const val = document.getElementById('grant-fewer-days').value;
                              if (!val || Number(val) <= 0) {
                                  alert('Please enter a valid number of days');
                                  return;
                              }
                              if (Number(val) > selectedContract.extensionRequest.days) {
                                  alert('You cannot grant more days than the freelancer requested');
                                  return;
                              }
                              handleRespondExtension('modify', Number(val));
                            }}
                            disabled={loading}
                          >
                            Grant Reduced
                          </button>
                        </div>
                        
                        <button className="btn btn-secondary btn-block" style={{ marginTop: '0.25rem' }} onClick={() => handleRespondExtension('reject')} disabled={loading}>
                          Reject Request
                        </button>
                      </div>
                    </div>
                  )}
              </div>
            </div>
          </div>
        )}

        {/* Bidding Modal Overlay */}
        {showApplyModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.4)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(5px)'
          }}>
            <div className="card" style={{ width: '100%', maxWidth: '500px', margin: '1rem', border: '1px solid var(--border-color)' }}>
              <h2 className="form-title">Submit Application & Bid</h2>
              <p className="form-subtitle">Pitch your services and set your desired rate for this project.</p>

              <form onSubmit={handleApplyJob}>
                <div className="form-group">
                  <label htmlFor="bid-amount">Your Bid Amount (USD)</label>
                  <input
                    id="bid-amount"
                    type="number"
                    className="form-input"
                    placeholder="e.g. 450"
                    value={applyForm.bidAmount}
                    onChange={(e) => setApplyForm({ ...applyForm, bidAmount: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="cover-letter">Cover Letter & Proposal</label>
                  <textarea
                    id="cover-letter"
                    className="form-input"
                    rows="5"
                    placeholder="Why should the client hire you? List your experience, tools, and schedule..."
                    value={applyForm.coverLetter}
                    onChange={(e) => setApplyForm({ ...applyForm, coverLetter: e.target.value })}
                    required
                  />
                </div>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={loading}>
                    Submit Bid
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ flex: 1 }}
                    onClick={() => {
                      setShowApplyModal(false);
                      setApplyJobId(null);
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
