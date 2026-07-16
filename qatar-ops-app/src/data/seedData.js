export const seedUsers = [
  {
    id: 'USR-001',
    fullName: 'Amina Al-Sayed',
    email: 'admin@qatarops.dev',
    passwordHash: '04445e6487736590d1ef50186b414e737e0164683cbbec64e00e73c000fd3bef',
    role: 'Administrator',
    region: 'Qatar',
    status: 'Active',
    lastLogin: '2026-07-10'
  },
  {
    id: 'USR-002',
    fullName: 'Rashid Khan',
    email: 'ops@qatarops.dev',
    passwordHash: 'abe134291041e7e7821b1cb15fc5b5fb803bf8a0f0768408e939dd7abe35fc88',
    role: 'Operations Manager',
    region: 'Qatar',
    status: 'Active',
    lastLogin: '2026-07-11'
  },
  {
    id: 'USR-003',
    fullName: 'Samir Haddad',
    email: 'engineer@qatarops.dev',
    passwordHash: '52d7b1b005c0adb56a5238435dccb406c57e2f211d1388d1f17b215a14e5d0b4',
    role: 'Engineer',
    region: 'Qatar',
    status: 'Active',
    lastLogin: '2026-07-09'
  },
  {
    id: 'USR-004',
    fullName: 'Nabil Faris',
    email: 'tech@qatarops.dev',
    passwordHash: 'c922fbda970d02fd957758ce511c990dc77d6b295828cf9b30477a7bfd113338',
    role: 'Technician',
    region: 'Qatar',
    status: 'Active',
    lastLogin: '2026-07-08'
  },
  {
    id: 'USR-005',
    fullName: 'Leila Rahman',
    email: 'viewer@qatarops.dev',
    passwordHash: '84bd33e1efcecc56227f908cda37a344cab0f2662819990937c2add50a0a260a',
    role: 'Viewer',
    region: 'Qatar',
    status: 'Active',
    lastLogin: '2026-07-07'
  }
];

export const seedSites = [
  { id: 'SITE-001', name: 'Mowasalat', status: 'Active', location: 'Doha', operator: 'Mowasalat', contactPerson: 'Ali Rahman', contactDetails: '+974 4444 1111', notes: 'Primary urban deployment.' },
  { id: 'SITE-002', name: 'Msheireb', status: 'Active', location: 'Msheireb', operator: 'Msheireb', contactPerson: 'Sara Hussain', contactDetails: '+974 4444 2222', notes: 'Dense city charging hub.' },
  { id: 'SITE-003', name: 'Al Mana', status: 'Active', location: 'Doha', operator: 'Al Mana', contactPerson: 'Omar Youssef', contactDetails: '+974 4444 3333', notes: 'Mixed-use site with multiple chargers.' }
];

export const seedChargers = [
  { id: 'CH-001', siteId: 'SITE-001', name: 'MOW-CH-001', status: 'Operational', type: 'DC', manufacturer: 'ABB', model: 'Terra 54', serialNumber: 'MOW-001' },
  { id: 'CH-002', siteId: 'SITE-001', name: 'MOW-CH-002', status: 'Maintenance', type: 'DC', manufacturer: 'ABB', model: 'Terra 54', serialNumber: 'MOW-002' },
  { id: 'CH-003', siteId: 'SITE-002', name: 'MSH-CH-001', status: 'Operational', type: 'DC', manufacturer: 'ChargePoint', model: 'Express 250', serialNumber: 'MSH-001' },
  { id: 'CH-004', siteId: 'SITE-002', name: 'MSH-CH-002', status: 'Offline', type: 'DC', manufacturer: 'ChargePoint', model: 'Express 250', serialNumber: 'MSH-002' },
  { id: 'CH-005', siteId: 'SITE-003', name: 'ALM-CH-001', status: 'Operational', type: 'DC', manufacturer: 'Delta', model: 'EVO', serialNumber: 'ALM-001' },
  { id: 'CH-006', siteId: 'SITE-003', name: 'ALM-CH-002', status: 'Operational', type: 'DC', manufacturer: 'Delta', model: 'EVO', serialNumber: 'ALM-002' }
];

export const seedFaults = [
  { id: 'FLT-0001', siteId: 'SITE-002', chargerId: 'CH-003', title: 'Charging gun reset issue', priority: 'High', status: 'Resolved', reportedBy: 'USR-003', assignedTo: 'USR-004' },
  { id: 'FLT-0002', siteId: 'SITE-001', chargerId: 'CH-002', title: 'Connector communication loss', priority: 'Medium', status: 'In Progress', reportedBy: 'USR-004', assignedTo: 'USR-003' },
  { id: 'FLT-0003', siteId: 'SITE-003', chargerId: 'CH-005', title: 'Network dropout', priority: 'Low', status: 'Open', reportedBy: 'USR-002', assignedTo: 'USR-004' }
];

export const seedMaintenance = [
  { id: 'MTN-0001', siteId: 'SITE-001', chargerId: 'CH-001', type: 'Preventive', status: 'Completed', scheduledDate: '2026-06-22', assignedTo: 'USR-004' },
  { id: 'MTN-0002', siteId: 'SITE-002', chargerId: 'CH-004', type: 'Scheduled', status: 'Scheduled', scheduledDate: '2026-06-28', assignedTo: 'USR-003' }
];

export const seedVisits = [
  { id: 'VIS-0001', siteId: 'SITE-001', visitor: 'Rashid Khan', visitDate: '2026-06-22', purpose: 'Operational check', status: 'Completed' },
  { id: 'VIS-0002', siteId: 'SITE-002', visitor: 'Samir Haddad', visitDate: '2026-06-28', purpose: 'Connectivity review', status: 'Completed' },
  { id: 'VIS-0003', siteId: 'SITE-002', visitor: 'Nabil Faris', visitDate: '2026-06-15', purpose: 'Routine inspection', status: 'Completed' }
];

export const seedActivities = [
  { id: 'ACT-001', user: 'Amina Al-Sayed', action: 'Created site', recordType: 'Site', recordId: 'SITE-001', description: 'Initialized Mowasalat site record.', timestamp: '2026-07-10T10:00:00' },
  { id: 'ACT-002', user: 'Rashid Khan', action: 'Reported fault', recordType: 'Fault', recordId: 'FLT-0002', description: 'Connector communication loss noted.', timestamp: '2026-07-10T11:15:00' },
  { id: 'ACT-003', user: 'Nabil Faris', action: 'Completed maintenance', recordType: 'Maintenance', recordId: 'MTN-0001', description: 'Preventive maintenance completed.', timestamp: '2026-07-11T08:30:00' }
];
