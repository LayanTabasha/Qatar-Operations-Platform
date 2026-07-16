import { requireSupabase } from './supabaseClient.js';

const bucketByDocumentType = {
  site_image: 'site-images',
  charger_image: 'site-images',
  charger_document: 'charger-documents',
  site_visit_report: 'site-visit-reports',
  fault_photo: 'fault-photos',
  weekly_report: 'weekly-reports',
  troubleshooting_guide: 'troubleshooting-guides',
  needs_classification: 'preview-files'
};

export function bucketForDocumentType(documentType) {
  return bucketByDocumentType[documentType] || 'preview-files';
}

export async function uploadOperationalFile({ file, documentType, siteId, chargerId, relatedRecordId, metadata = {} }) {
  const client = requireSupabase();
  const bucketName = bucketForDocumentType(documentType);
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '-');
  const storagePath = `${siteId || 'unassigned'}/${chargerId || 'general'}/${relatedRecordId || 'unlinked'}/${Date.now()}-${safeName}`;

  const upload = await client.storage.from(bucketName).upload(storagePath, file, {
    cacheControl: '3600',
    upsert: false
  });
  if (upload.error) throw upload.error;

  const { data, error } = await client
    .from('files')
    .insert({
      bucket_name: bucketName,
      original_file_name: file.name,
      storage_path: storagePath,
      mime_type: file.type || 'application/octet-stream',
      file_size: file.size,
      site_id: siteId,
      charger_id: chargerId,
      related_record_id: relatedRecordId,
      document_type: documentType,
      metadata
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function createSignedPreviewUrl(fileId, expiresIn = 300) {
  const client = requireSupabase();
  const { data: fileRecord, error } = await client.from('files').select('*').eq('id', fileId).single();
  if (error) throw error;

  const signed = await client.storage
    .from(fileRecord.bucket_name)
    .createSignedUrl(fileRecord.storage_path, expiresIn);
  if (signed.error) throw signed.error;

  return {
    ...fileRecord,
    signedUrl: signed.data.signedUrl,
    expiresIn
  };
}
