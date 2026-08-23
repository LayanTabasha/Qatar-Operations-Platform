export async function insertActivityLog(client, { userId, action, entityType, entityId, description, context = {}, ipAddress, requestId }) {
  await client.query(
    `
      INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details, ip_address, request_id)
      VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
    `,
    [
      userId,
      action,
      entityType,
      entityId,
      JSON.stringify({ description, ...context }),
      ipAddress || null,
      requestId || null,
    ],
  );
}
