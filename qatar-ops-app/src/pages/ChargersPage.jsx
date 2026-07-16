import { useMemo, useState } from 'react';
import { storageService } from '../services/storageService.js';

function ChargersPage() {
  const [state] = useState(storageService.loadState());
  const [search, setSearch] = useState('');
  const [siteFilter, setSiteFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  const filteredChargers = useMemo(() => {
    return state.chargers.filter((charger) => {
      const siteName = state.sites.find((site) => site.id === charger.siteId)?.name || '';
      const matchesSearch = `${charger.name} ${charger.serialNumber}`.toLowerCase().includes(search.toLowerCase());
      const matchesSite = siteFilter === 'All' || siteName === siteFilter;
      const matchesStatus = statusFilter === 'All' || charger.status === statusFilter;
      return matchesSearch && matchesSite && matchesStatus;
    });
  }, [search, siteFilter, state.chargers, state.sites, statusFilter]);

  return (
    <div>
      <h2 className="page-title">Chargers</h2>
      <p className="page-subtitle">View chargers assigned to each operational site.</p>
      <div className="card" style={{ marginTop: '16px' }}>
        <div className="form-grid" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr' }}>
          <label>
            Search
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search charger" />
          </label>
          <label>
            Site
            <select value={siteFilter} onChange={(event) => setSiteFilter(event.target.value)}>
              <option value="All">All</option>
              {state.sites.map((site) => <option key={site.id} value={site.name}>{site.name}</option>)}
            </select>
          </label>
          <label>
            Status
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="All">All</option>
              <option value="Operational">Operational</option>
              <option value="Offline">Offline</option>
              <option value="Maintenance">Maintenance</option>
            </select>
          </label>
          <button className="primary-btn" type="button">Add charger</button>
        </div>
      </div>
      <div className="card" style={{ marginTop: '16px' }}>
        <table className="table">
          <thead>
            <tr><th>Charger ID</th><th>Site</th><th>Status</th><th>Manufacturer</th><th>Model</th></tr>
          </thead>
          <tbody>
            {filteredChargers.map((charger) => (
              <tr key={charger.id}>
                <td>{charger.name}</td>
                <td>{state.sites.find((site) => site.id === charger.siteId)?.name}</td>
                <td><span className={`badge ${charger.status.toLowerCase()}`}>{charger.status}</span></td>
                <td>{charger.manufacturer}</td>
                <td>{charger.model}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ChargersPage;
