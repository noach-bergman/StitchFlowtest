#!/usr/bin/env node

import process from 'node:process';

const url = (process.env.NIIMBOT_BLE_AGENT_URL || 'http://127.0.0.1:9131').replace(/\/+$/, '');
const token = (process.env.NIIMBOT_BLE_AGENT_TOKEN || '').trim();

if (!token) {
  console.error('[niimbot-ble-pair] NIIMBOT_BLE_AGENT_TOKEN is required');
  process.exit(1);
}

try {
  const response = await fetch(`${url}/pair`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });

  const payload = await response.text();
  if (!response.ok) {
    console.error('[niimbot-ble-pair] Pair failed:', payload);
    process.exit(1);
  }

  console.log('[niimbot-ble-pair] Pair response:', payload);
} catch (error) {
  console.error('[niimbot-ble-pair] Request failed:', error?.message || error);
  process.exit(1);
}
