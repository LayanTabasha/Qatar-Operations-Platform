import { useEffect, useMemo, useState } from 'react';
import { storageService } from '../services/storageService.js';

function DashboardPage() {
  const [state, setState] = useState(storageService.loadState());
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let active = true;
    storageService.loadStateAsync()
      .then((loadedState) => {
        if (active) setState(loadedState);
      })
      .catch((error) => {
        if (active) setLoadError(error.message || 'Unable to load dashboard data.');
      });
    return () => {
      active = false;
    };
  }, []);

  const metrics = useMemo(() => {
    const openFaults = state.faults.filter((fault) => ['Open', 'In Progress', 'Assigned'].includes(fault.status)).length;
    const completedMaintenance = state.maintenance.filter((item) => item.status === 'Completed').length;
    const totalVisits = state.visits.length;
    const recentActivities = state.activities.slice(0, 5);

    return { openFaults, completedMaintenance, totalVisits, recentActivities };
  }, [state]);

  return (
    <div>
      <h2 className="page-title">Dashboard</h2>
      <p className="page-subtitle">KPI values are calculated from Supabase records when configured. Local seed data is only a development fallback.</p>
      {loadError && <div className="error-text">{loadError}</div>}
      <div className="card-grid" style={{ marginTop: '16px' }}>
        <div className="card">
          <h3>Total sites</h3>
          <p className="metric">{state.sites.length}</p>
          <p>Tracked operational sites</p>
        </div>
        <div className="card">
          <h3>Total chargers</h3>
          <p className="metric">{state.chargers.length}</p>
          <p>Across Qatar active sites</p>
        </div>
        <div className="card">
          <h3>Open faults</h3>
          <p className="metric">{metrics.openFaults}</p>
          <p>Open or actively assigned faults</p>
        </div>
        <div className="card">
          <h3>Completed maintenance</h3>
          <p className="metric">{metrics.completedMaintenance}</p>
          <p>Completed maintenance records</p>
        </div>
        <div className="card">
          <h3>Total site visits</h3>
          <p className="metric">{metrics.totalVisits}</p>
          <p>Recorded site visits</p>
        </div>
      </div>

      <div className="card-grid" style={{ marginTop: '16px' }}>
        <div className="card">
          <h3>Recent activity</h3>
          <table className="table">
            <thead>
              <tr><th>Action</th><th>Record</th><th>Time</th></tr>
            </thead>
            <tbody>
              {metrics.recentActivities.map((item) => (
                <tr key={item.id}>
                  <td>{item.action}</td>
                  <td>{item.recordType} {item.recordId}</td>
                  <td>{new Date(item.timestamp).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h3>Recent faults</h3>
          <table className="table">
            <thead>
              <tr><th>ID</th><th>Site</th><th>Status</th></tr>
            </thead>
            <tbody>
              {state.faults.slice(0, 5).map((fault) => (
                <tr key={fault.id}>
                  <td>{fault.id}</td>
                  <td>{state.sites.find((site) => site.id === fault.siteId)?.name || 'Unknown'}</td>
                  <td><span className={`badge ${fault.status.toLowerCase().replace(/\s+/g, '')}`}>{fault.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;
