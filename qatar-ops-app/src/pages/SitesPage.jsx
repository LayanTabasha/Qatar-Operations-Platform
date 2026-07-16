import { useMemo, useState } from 'react';
import { storageService } from '../services/storageService.js';

function SitesPage() {
  const [state, setState] = useState(storageService.loadState());
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedSite, setSelectedSite] = useState(null);

  const filteredSites = useMemo(() => {
    return state.sites.filter((site) => {
      const matchesSearch = `${site.name} ${site.location}`.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'All' || site.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [search, state.sites, statusFilter]);

  return (
    <div>
      <h2 className="page-title">Sites</h2>
      <p className="page-subtitle">Manage operational sites and view related assets.</p>
      <div className="card" style={{ marginTop: '16px' }}>
        <div className="form-grid" style={{ gridTemplateColumns: '2fr 1fr 1fr' }}>
          <label>
            Search
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search sites" />
          </label>
          <label>
            Status
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="All">All</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </label>
          <button className="primary-btn" type="button">Add site</button>
        </div>
      </div>

      <div className="card-grid" style={{ marginTop: '16px' }}>
        {filteredSites.map((site) => (
          <div className="card" key={site.id}>
            <h3>{site.name}</h3>
            <p><strong>Status:</strong> {site.status}</p>
            <p><strong>Location:</strong> {site.location}</p>
            <p><strong>Operator:</strong> {site.operator}</p>
            <div className="form-actions" style={{ marginTop: '12px' }}>
              <button className="secondary-btn" type="button" onClick={() => setSelectedSite(site)}>View details</button>
              <button className="ghost-btn" type="button">Edit</button>
            </div>
          </div>
        ))}
      </div>

      {selectedSite ? (
        <div className="card" style={{ marginTop: '16px' }}>
          <h3>{selectedSite.name} details</h3>
          <p><strong>Contact:</strong> {selectedSite.contactPerson} · {selectedSite.contactDetails}</p>
          <p><strong>Notes:</strong> {selectedSite.notes}</p>
          <p><strong>Related chargers:</strong> {state.chargers.filter((charger) => charger.siteId === selectedSite.id).length}</p>
        </div>
      ) : null}
    </div>
  );
}

export default SitesPage;
