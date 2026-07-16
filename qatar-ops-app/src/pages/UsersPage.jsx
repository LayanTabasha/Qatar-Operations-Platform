import { useMemo, useState } from 'react';
import { seedUsers } from '../data/seedData.js';

function UsersPage() {
  const [roleFilter, setRoleFilter] = useState('All');
  const filteredUsers = useMemo(() => {
    return seedUsers.filter((user) => roleFilter === 'All' || user.role === roleFilter);
  }, [roleFilter]);

  return (
    <div>
      <h2 className="page-title">Users</h2>
      <p className="page-subtitle">Administrator-only management for internal accounts and roles.</p>
      <div className="card" style={{ marginTop: '16px' }}>
        <div className="form-grid" style={{ gridTemplateColumns: '2fr 1fr 1fr' }}>
          <label>
            Role
            <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
              <option value="All">All</option>
              <option value="Administrator">Administrator</option>
              <option value="Operations Manager">Operations Manager</option>
              <option value="Engineer">Engineer</option>
              <option value="Technician">Technician</option>
              <option value="Viewer">Viewer</option>
            </select>
          </label>
          <button className="primary-btn" type="button">Create user</button>
        </div>
      </div>
      <div className="card" style={{ marginTop: '16px' }}>
        <table className="table">
          <thead>
            <tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th></tr>
          </thead>
          <tbody>
            {filteredUsers.map((user) => (
              <tr key={user.id}>
                <td>{user.fullName}</td>
                <td>{user.email}</td>
                <td>{user.role}</td>
                <td>{user.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default UsersPage;
