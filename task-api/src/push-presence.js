function required(value, name) {
  if (!value) throw new Error(`${name} wajib diisi.`);
  return value;
}

function normalizeSubscription(subscription) {
  const endpoint = required(subscription?.endpoint, 'subscription.endpoint');
  const keys = subscription?.keys || {};
  return {
    endpoint,
    p256dh: required(keys.p256dh, 'subscription.keys.p256dh'),
    auth: required(keys.auth, 'subscription.keys.auth'),
    subscriptionJson: JSON.stringify(subscription)
  };
}

export async function savePushSubscription(db, input) {
  const familyId = required(input?.familyId, 'familyId');
  const normalized = normalizeSubscription(input?.subscription);
  await db.prepare(`
    INSERT INTO push_subscriptions (
      family_id, user_id, role, endpoint, p256dh, auth, subscription_json, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(endpoint) DO UPDATE SET
      family_id = excluded.family_id,
      user_id = excluded.user_id,
      role = excluded.role,
      p256dh = excluded.p256dh,
      auth = excluded.auth,
      subscription_json = excluded.subscription_json,
      updated_at = CURRENT_TIMESTAMP
  `).bind(
    familyId,
    input?.userId || null,
    input?.role || null,
    normalized.endpoint,
    normalized.p256dh,
    normalized.auth,
    normalized.subscriptionJson
  ).run();

  return { success: true, endpoint: normalized.endpoint };
}

export async function deletePushSubscription(db, input) {
  const endpoint = required(input?.endpoint, 'endpoint');
  const familyId = input?.familyId || null;
  const statement = familyId
    ? db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ? AND family_id = ?').bind(endpoint, familyId)
    : db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(endpoint);
  await statement.run();
  return { success: true, endpoint };
}

export async function touchPresence(db, input) {
  const familyId = required(input?.familyId, 'familyId');
  const sessionId = required(input?.sessionId, 'sessionId');
  const displayName = required(input?.displayName, 'displayName');
  await db.prepare(`
    INSERT INTO presence_sessions (
      family_id, session_id, user_id, role, display_name, visible, last_seen_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(family_id, session_id) DO UPDATE SET
      user_id = excluded.user_id,
      role = excluded.role,
      display_name = excluded.display_name,
      visible = excluded.visible,
      last_seen_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
  `).bind(
    familyId,
    sessionId,
    input?.userId || null,
    input?.role || null,
    displayName,
    input?.visible === false ? 0 : 1
  ).run();

  return listOnlinePresence(db, { familyId });
}

export async function listOnlinePresence(db, input) {
  const familyId = required(input?.familyId, 'familyId');
  const maxAgeSeconds = Number(input?.maxAgeSeconds || 90);
  const rows = await db.prepare(`
    SELECT display_name AS displayName, role, visible, last_seen_at AS lastSeenAt
    FROM presence_sessions
    WHERE family_id = ?
      AND datetime(last_seen_at) >= datetime('now', ?)
    ORDER BY last_seen_at DESC
  `).bind(familyId, `-${maxAgeSeconds} seconds`).all();

  const members = (rows.results || []).filter((row) => Number(row.visible) !== 0);
  return {
    type: 'presence_snapshot',
    onlineCount: members.length,
    members,
    updatedAt: new Date().toISOString()
  };
}

export async function purgeExpiredPresence(db, maxAgeSeconds = 300) {
  await db.prepare(`
    DELETE FROM presence_sessions
    WHERE datetime(last_seen_at) < datetime('now', ?)
  `).bind(`-${Number(maxAgeSeconds)} seconds`).run();
}
