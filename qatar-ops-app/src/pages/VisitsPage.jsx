import { useMemo, useState } from 'react';
import { storageService } from '../services/storageService.js';

function VisitsPage() {
  const [state] = useState(storageService.loadState());
  const [search, setSearch] = useState('');
  const [siteFilter, setSiteFilter] = useState('All');

  const filteredVisits = useMemo(() => {
    return state.visits.filter((visit) => {
      const siteName = state.sites.find((site) => site.id === visit.siteId)?.name || '';
      const matchesSearch = `${visit.visitor} ${visit.purpose}`.toLowerCase().includes(search.toLowerCase());
      const matchesSite = siteFilter === 'All' || siteName === siteFilter;
      return matchesSearch && matchesSite;
    });
  }, [search, siteFilter, state.sites, state.visits]);

  return (
    <div>
      <h2 className="page-title">Site visits</h2>
      <p className="page-subtitle">Capture visits, findings, recommendations, and follow-up actions.</p>
      <div className="card" style={{ marginTop: '16px' }}>
        <div className="form-grid" style={{ gridTemplateColumns: '2fr 1fr 1fr' }}>
          <label>
            Search
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search visits" />
          </label>
          <label>
            Site
            <select value={siteFilter} onChange={(event) => setSiteFilter(event.target.value)}>
              <option value="All">All</option>
              {state.sites.map((site) => <option key={site.id} value={site.name}>{site.name}</option>)}
            </select>
          </label>
          <button className="primary-btn" type="button">Record visit</button>
        </div>
      </div>
      <div className="card" style={{ marginTop: '16px' }}>
        <table className="table">
          <thead>
            <tr><th>ID</th><th>Site</th><th>Visitor</th><th>Date</th><th>Status</th></tr>
          </thead>
          <tbody>
            {filteredVisits.map((visit) => (
              <tr key={visit.id}>
                <td>{visit.id}</td>
                <td>{state.sites.find((site) => site.id === visit.siteId)?.name}</td>
                <td>{visit.visitor}</td>
                <td>{visit.visitDate}</td>
                <td>{visit.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default VisitsPage;
