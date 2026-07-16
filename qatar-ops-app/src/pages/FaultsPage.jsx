import { useMemo, useState } from 'react';
import { storageService } from '../services/storageService.js';

function FaultsPage() {
  const [state] = useState(storageService.loadState());
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');

  const filteredFaults = useMemo(() => {
    return state.faults.filter((fault) => {
      const siteName = state.sites.find((site) => site.id === fault.siteId)?.name || '';
      const matchesSearch = `${fault.id} ${fault.title}`.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'All' || fault.status === statusFilter;
      const matchesPriority = priorityFilter === 'All' || fault.priority === priorityFilter;
      return matchesSearch && matchesStatus && matchesPriority && siteName;
    });
  }, [priorityFilter, search, state.faults, state.sites, statusFilter]);

  return (
    <div>
      <h2 className="page-title">Faults</h2>
      <p className="page-subtitle">Track faults, prioritise resolution, and assign follow-up work.</p>
      <div className="card" style={{ marginTop: '16px' }}>
        <div className="form-grid" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr' }}>
          <label>
            Search
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search faults" />
          </label>
          <label>
            Status
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="All">All</option>
              <option value="Open">Open</option>
              <option value="Assigned">Assigned</option>
              <option value="In Progress">In Progress</option>
              <option value="Resolved">Resolved</option>
              <option value="Closed">Closed</option>
            </select>
          </label>
          <label>
            Priority
            <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}>
              <option value="All">All</option>
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Critical">Critical</option>
            </select>
          </label>
          <button className="primary-btn" type="button">Report fault</button>
        </div>
      </div>
      <div className="card" style={{ marginTop: '16px' }}>
        <table className="table">
          <thead>
            <tr><th>ID</th><th>Site</th><th>Title</th><th>Priority</th><th>Status</th></tr>
          </thead>
          <tbody>
            {filteredFaults.map((fault) => (
              <tr key={fault.id}>
                <td>{fault.id}</td>
                <td>{state.sites.find((site) => site.id === fault.siteId)?.name}</td>
                <td>{fault.title}</td>
                <td>{fault.priority}</td>
                <td><span className={`badge ${fault.status.toLowerCase().replace(/\s+/g, '')}`}>{fault.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default FaultsPage;
