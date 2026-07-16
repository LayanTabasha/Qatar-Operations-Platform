import { useMemo, useState } from 'react';
import { storageService } from '../services/storageService.js';

function MaintenancePage() {
  const [state] = useState(storageService.loadState());
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');

  const filteredMaintenance = useMemo(() => {
    return state.maintenance.filter((item) => {
      const matchesSearch = `${item.id} ${item.type}`.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'All' || item.status === statusFilter;
      const matchesType = typeFilter === 'All' || item.type === typeFilter;
      return matchesSearch && matchesStatus && matchesType;
    });
  }, [search, state.maintenance, statusFilter, typeFilter]);

  return (
    <div>
      <h2 className="page-title">Maintenance</h2>
      <p className="page-subtitle">Record preventive, corrective, and scheduled maintenance work.</p>
      <div className="card" style={{ marginTop: '16px' }}>
        <div className="form-grid" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr' }}>
          <label>
            Search
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search maintenance" />
          </label>
          <label>
            Status
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="All">All</option>
              <option value="Scheduled">Scheduled</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </label>
          <label>
            Type
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
              <option value="All">All</option>
              <option value="Preventive">Preventive</option>
              <option value="Corrective">Corrective</option>
              <option value="Scheduled">Scheduled</option>
              <option value="Emergency">Emergency</option>
            </select>
          </label>
          <button className="primary-btn" type="button">Log maintenance</button>
        </div>
      </div>
      <div className="card" style={{ marginTop: '16px' }}>
        <table className="table">
          <thead>
            <tr><th>ID</th><th>Type</th><th>Status</th><th>Scheduled date</th><th>Assigned to</th></tr>
          </thead>
          <tbody>
            {filteredMaintenance.map((item) => (
              <tr key={item.id}>
                <td>{item.id}</td>
                <td>{item.type}</td>
                <td>{item.status}</td>
                <td>{item.scheduledDate}</td>
                <td>{item.assignedTo}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default MaintenancePage;
