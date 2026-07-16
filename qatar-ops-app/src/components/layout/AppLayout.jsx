import { useEffect, useState } from 'react';
import { Navigate, Outlet, Link, useLocation } from 'react-router-dom';
import { authService } from '../../services/authService.js';

const navigation = [
  { label: 'Dashboard', path: '/dashboard' },
  { label: 'Sites', path: '/sites' },
  { label: 'Chargers', path: '/chargers' },
  { label: 'Faults', path: '/faults' },
  { label: 'Maintenance', path: '/maintenance' },
  { label: 'Site Visits', path: '/visits' },
  { label: 'Users', path: '/users' }
];

function AppLayout() {
  const location = useLocation();
  const [currentUser, setCurrentUser] = useState(authService.getCurrentUser());
  const [isCheckingSession, setIsCheckingSession] = useState(!currentUser);

  useEffect(() => {
    let active = true;
    authService.restoreSession()
      .then((user) => {
        if (active) setCurrentUser(user);
      })
      .finally(() => {
        if (active) setIsCheckingSession(false);
      });
    const subscription = authService.onAuthStateChange((user) => {
      if (active) setCurrentUser(user);
    });
    return () => {
      active = false;
      subscription?.unsubscribe?.();
    };
  }, []);

  if (isCheckingSession) {
    return <div className="login-screen"><div className="login-card"><h1>Checking session...</h1><p>Verifying your Supabase session.</p></div></div>;
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  const onLogout = async () => {
    await authService.logout();
    window.location.assign('/login');
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <h2>Qatar Operations</h2>
          <p style={{ color: '#b9c7d8', marginTop: '6px' }}>Internal EV operations portal</p>
        </div>
        <nav className="nav-list">
          {navigation.map((item) => (
            <Link key={item.path} to={item.path} className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-footer">
          <p>Authenticated with Supabase. User access is controlled by the profile role and account status.</p>
          <button className="secondary-btn" style={{ width: '100%', marginTop: '10px' }} onClick={onLogout}>Logout</button>
        </div>
      </aside>
      <main className="main-panel">
        <header className="topbar">
          <div>
            <h1 className="page-title">Qatar Operations Website</h1>
            <p className="page-subtitle">Manual operational records for EV charging sites in Qatar</p>
          </div>
          <div className="user">
            <div className="avatar">{currentUser.fullName.split(' ').map((part) => part[0]).join('').slice(0, 2)}</div>
            <div>
              <strong>{currentUser.fullName}</strong>
              <div style={{ color: '#53657a', fontSize: '0.92rem' }}>{currentUser.role}</div>
            </div>
          </div>
        </header>
        <section className="content">
          <Outlet />
        </section>
      </main>
    </div>
  );
}

export default AppLayout;
