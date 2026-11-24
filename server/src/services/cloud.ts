import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import { getState, saveState, addEventLog, type CloudConfig, type ReverseProxyRule } from '../store.js';

export function getCloudConfig(): CloudConfig {
  return getState().cloud;
}

export function updateCloudConfig(updates: Partial<CloudConfig>, actor: string): CloudConfig {
  const state = getState();
  state.cloud = {
    ...state.cloud,
    ...updates,
    proxyRules: updates.proxyRules ?? state.cloud.proxyRules,
  };
  saveState(state);
  addEventLog(
    'info',
    'Cloud',
    actor,
    `Updated myQNAPcloud DDNS settings (${state.cloud.provider.toUpperCase()}: ${state.cloud.domain})`
  );
  return state.cloud;
}

export function addProxyRule(
  input: Omit<ReverseProxyRule, 'id'>,
  actor: string
): ReverseProxyRule {
  const state = getState();
  const rule: ReverseProxyRule = {
    ...input,
    id: `px-${crypto.randomUUID().slice(0, 8)}`,
  };
  state.cloud.proxyRules.push(rule);
  saveState(state);
  addEventLog(
    'success',
    'Cloud',
    actor,
    `Added reverse proxy rule: ${rule.domain} -> ${rule.targetHost}:${rule.targetPort}`
  );
  return rule;
}

export function toggleProxyRule(id: string, enabled: boolean, actor: string): ReverseProxyRule | null {
  const state = getState();
  const rule = state.cloud.proxyRules.find((r) => r.id === id);
  if (!rule) return null;
  rule.enabled = enabled;
  saveState(state);
  addEventLog(
    'info',
    'Cloud',
    actor,
    `${enabled ? 'Enabled' : 'Disabled'} reverse proxy rule ${rule.domain}`
  );
  return rule;
}

export function deleteProxyRule(id: string, actor: string): boolean {
  const state = getState();
  const idx = state.cloud.proxyRules.findIndex((r) => r.id === id);
  if (idx === -1) return false;
  const [removed] = state.cloud.proxyRules.splice(idx, 1);
  saveState(state);
  addEventLog('warning', 'Cloud', actor, `Deleted reverse proxy rule ${removed.domain}`);
  return true;
}

export function generateCaddyfile(cloud: CloudConfig): string {
  const enabledRules = cloud.proxyRules.filter((r) => r.enabled && r.domain.trim());
  if (enabledRules.length === 0) {
    return '# No enabled reverse proxy rules configured yet.\n';
  }
  return enabledRules
    .map((r) => {
      const scheme = r.httpsEnabled ? '' : 'http://';
      return [
        `# ${r.name}`,
        `${scheme}${r.domain} {`,
        `  reverse_proxy ${r.targetHost}:${r.targetPort}`,
        `}`,
      ].join('\n');
    })
    .join('\n\n');
}

export function generateNginxConfig(cloud: CloudConfig): string {
  const enabledRules = cloud.proxyRules.filter((r) => r.enabled && r.domain.trim());
  if (enabledRules.length === 0) {
    return '# No enabled reverse proxy rules configured yet.\n';
  }
  return enabledRules
    .map((r) =>
      [
        `# ${r.name}`,
        `server {`,
        `  listen ${r.httpsEnabled ? '443 ssl http2' : '80'};`,
        `  server_name ${r.domain};`,
        `  location / {`,
        `    proxy_pass http://${r.targetHost}:${r.targetPort};`,
        `    proxy_set_header Host $host;`,
        `    proxy_set_header X-Real-IP $remote_addr;`,
        r.websockets
          ? `    proxy_http_version 1.1;\n    proxy_set_header Upgrade $http_upgrade;\n    proxy_set_header Connection "upgrade";`
          : '',
        `  }`,
        `}`,
      ]
        .filter(Boolean)
        .join('\n')
    )
    .join('\n\n');
}

async function detectPublicIp(): Promise<string> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const res = await fetch('https://api.ipify.org?format=text', { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) {
      return (await res.text()).trim();
    }
  } catch {
    // offline fallback
  }
  const nets = os.networkInterfaces();
  for (const addrs of Object.values(nets)) {
    if (!addrs) continue;
    for (const a of addrs) {
      if (a.family === 'IPv4' && !a.internal) return `${a.address} (LAN)`;
    }
  }
  return '127.0.0.1';
}

export async function syncDdnsNow(actor: string): Promise<CloudConfig> {
  const state = getState();
  const cloud = state.cloud;
  const ip = await detectPublicIp();
  cloud.detectedWanIp = ip;
  cloud.lastSyncAt = new Date().toISOString();

  if (cloud.provider === 'duckdns') {
    if (!cloud.domain || !cloud.token) {
      cloud.lastSyncStatus = 'error';
      cloud.lastSyncMessage = 'DuckDNS domain and token are required before syncing.';
      saveState(state);
      return cloud;
    }
    const subdomain = cloud.domain.replace(/\.duckdns\.org$/i, '').trim();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);
      const url = `https://www.duckdns.org/update?domains=${encodeURIComponent(
        subdomain
      )}&token=${encodeURIComponent(cloud.token.trim())}&ip=`;
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      const text = (await res.text()).trim();
      if (text === 'OK') {
        cloud.lastSyncStatus = 'ok';
        cloud.lastSyncMessage = `DuckDNS updated ${subdomain}.duckdns.org -> ${ip}`;
        addEventLog('success', 'Cloud', actor, cloud.lastSyncMessage);
      } else {
        cloud.lastSyncStatus = 'error';
        cloud.lastSyncMessage = `DuckDNS returned "${text}" (verify subdomain & token)`;
        addEventLog('warning', 'Cloud', actor, cloud.lastSyncMessage);
      }
    } catch (err) {
      cloud.lastSyncStatus = 'error';
      cloud.lastSyncMessage = `DuckDNS network error: ${(err as Error).message}`;
    }
  } else if (cloud.provider === 'cloudflare') {
    if (!cloud.zoneId || !cloud.token || !cloud.recordName) {
      cloud.lastSyncStatus = 'error';
      cloud.lastSyncMessage = 'Cloudflare Zone ID, API Token, and Record Name are required.';
      saveState(state);
      return cloud;
    }
    try {
      const headers = {
        Authorization: `Bearer ${cloud.token.trim()}`,
        'Content-Type': 'application/json',
      };
      const lookupRes = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${encodeURIComponent(
          cloud.zoneId.trim()
        )}/dns_records?type=A&name=${encodeURIComponent(cloud.recordName.trim())}`,
        { headers }
      );
      const lookupData = (await lookupRes.json()) as {
        success?: boolean;
        result?: { id: string }[];
        errors?: { message: string }[];
      };
      if (!lookupData.success) {
        throw new Error(lookupData.errors?.[0]?.message || 'Cloudflare lookup failed');
      }
      const cleanIp = ip.replace(/\s*\(LAN\)$/, '');
      const existingId = lookupData.result?.[0]?.id;
      const endpoint = existingId
        ? `https://api.cloudflare.com/client/v4/zones/${encodeURIComponent(
            cloud.zoneId.trim()
          )}/dns_records/${existingId}`
        : `https://api.cloudflare.com/client/v4/zones/${encodeURIComponent(
            cloud.zoneId.trim()
          )}/dns_records`;
      const upsertRes = await fetch(endpoint, {
        method: existingId ? 'PUT' : 'POST',
        headers,
        body: JSON.stringify({
          type: 'A',
          name: cloud.recordName.trim(),
          content: cleanIp,
          ttl: 120,
          proxied: false,
        }),
      });
      const upsertData = (await upsertRes.json()) as {
        success?: boolean;
        errors?: { message: string }[];
      };
      if (!upsertData.success) {
        throw new Error(upsertData.errors?.[0]?.message || 'Cloudflare DNS update failed');
      }
      cloud.lastSyncStatus = 'ok';
      cloud.lastSyncMessage = `Cloudflare A record ${cloud.recordName} -> ${cleanIp}`;
      addEventLog('success', 'Cloud', actor, cloud.lastSyncMessage);
    } catch (err) {
      cloud.lastSyncStatus = 'error';
      cloud.lastSyncMessage = `Cloudflare error: ${(err as Error).message}`;
    }
  } else {
    cloud.lastSyncStatus = 'ok';
    cloud.lastSyncMessage = `Verified local/WAN endpoint (${ip}) for ${cloud.domain}`;
    addEventLog('info', 'Cloud', actor, cloud.lastSyncMessage);
  }

  // On Linux, also export Caddyfile if /etc/caddy exists and is writable
  if (os.platform() === 'linux') {
    try {
      const caddyPath = '/etc/caddy/Caddyfile.openqts';
      if (fs.existsSync('/etc/caddy')) {
        fs.writeFileSync(caddyPath, generateCaddyfile(cloud), 'utf-8');
      }
    } catch {
      // non-root ignore
    }
  }

  saveState(state);
  return cloud;
}
