import { seedActivities, seedChargers, seedFaults, seedMaintenance, seedSites, seedVisits } from '../data/seedData.js';
import { isSupabaseConfigured, requireSupabase } from './supabaseClient.js';

const fallbackState = {
  sites: seedSites,
  chargers: seedChargers,
  faults: seedFaults,
  maintenance: seedMaintenance,
  visits: seedVisits,
  activities: seedActivities
};

function mapSite(row) {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    location: row.location,
    operator: row.client_organization,
    notes: row.notes
  };
}

function mapCharger(row) {
  return {
    id: row.id,
    siteId: row.site_id,
    name: row.name,
    status: row.status,
    type: row.type,
    manufacturer: row.manufacturer,
    model: row.model,
    serialNumber: row.serial_number
  };
}

function mapFault(row) {
  return {
    id: row.fault_id || row.id,
    siteId: row.site_id,
    chargerId: row.charger_id,
    title: row.fault_name || row.description || row.fault_code,
    priority: row.severity,
    status: row.status,
    reportedBy: row.uploaded_by
  };
}

function mapVisit(row) {
  return {
    id: row.id,
    siteId: row.site_id,
    chargerId: row.charger_id,
    visitor: row.engineer_name || row.technician_name || 'Operations',
    visitDate: row.visit_date,
    timeIn: row.time_in,
    timeOut: row.time_out,
    purpose: row.purpose,
    status: row.status
  };
}

function mapActivity(row) {
  return {
    id: row.id,
    user: row.user_name || 'System',
    action: row.action_type,
    recordType: row.entity_type,
    recordId: row.entity_id,
    description: row.description,
    timestamp: row.occurred_at
  };
}

export const storageService = {
  isConfigured() {
    return isSupabaseConfigured;
  },

  loadState() {
    return fallbackState;
  },

  async loadStateAsync() {
    if (!isSupabaseConfigured) return fallbackState;
    const client = requireSupabase();
    const [sites, chargers, faults, visits, activities] = await Promise.all([
      client.from('sites').select('*').order('name'),
      client.from('chargers').select('*').order('name'),
      client.from('faults').select('*').order('created_at', { ascending: false }),
      client.from('site_visits').select('*').order('created_at', { ascending: false }),
      client.from('activity_log').select('*').order('occurred_at', { ascending: false }).limit(20)
    ]);

    [sites, chargers, faults, visits, activities].forEach((result) => {
      if (result.error) throw result.error;
    });

    return {
      sites: sites.data.map(mapSite),
      chargers: chargers.data.map(mapCharger),
      faults: faults.data.map(mapFault),
      maintenance: [],
      visits: visits.data.map(mapVisit),
      activities: activities.data.map(mapActivity)
    };
  },

  async createSignedFileUrl(fileRecord, expiresIn = 300) {
    const client = requireSupabase();
    const { data, error } = await client.storage
      .from(fileRecord.bucket_name)
      .createSignedUrl(fileRecord.storage_path, expiresIn);
    if (error) throw error;
    return data.signedUrl;
  },

  async saveState() {
    throw new Error('Direct browser saveState is disabled. Use Supabase table-specific insert/update functions.');
  }
};
