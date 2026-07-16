import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService.js';

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isConfigured = authService.isConfigured();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      await authService.login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Unable to sign in.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <h1>Qatar Operations Website</h1>
        <p>Internal operations management for EV charging sites. Sign in with your company account.</p>
        {!isConfigured && (
          <div className="error-text">
            Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to qatar-ops-app/.env.
          </div>
        )}
        <form className="form-grid" onSubmit={handleSubmit}>
          <label>
            Email
            <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" />
          </label>
          <label>
            Password
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter password" />
          </label>
          <div className="form-actions">
            <button className="primary-btn" type="submit" disabled={isSubmitting || !isConfigured}>{isSubmitting ? 'Signing in...' : 'Sign in'}</button>
          </div>
          <div className="error-text">{error}</div>
        </form>
        <div className="note">No public signup. Accounts must be created or invited by an Administrator in Supabase.</div>
      </div>
    </div>
  );
}

export default LoginPage;
