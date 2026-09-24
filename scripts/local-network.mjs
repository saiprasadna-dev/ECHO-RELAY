import { networkInterfaces } from 'node:os';

export function isPrivateIPv4(address) {
  const parts = address.split('.');
  if (parts.length !== 4 || parts.some(part => !/^(0|[1-9]\d{0,2})$/.test(part) || Number(part) > 255)) return false;
  const [a, b] = parts.map(Number);
  return a === 10 || a === 192 && b === 168 || a === 172 && b >= 16 && b <= 31;
}

export function localNetworkConfig({ lan = false, port, interfaces = networkInterfaces() }) {
  const addresses = lan ? [...new Set(Object.values(interfaces).flat().filter(iface => iface && !iface.internal && iface.family === 'IPv4' && isPrivateIPv4(iface.address)).map(iface => iface.address))] : [];
  const hosts = new Set(['localhost', '127.0.0.1', ...addresses].map(host => `${host}:${port}`));
  return { bind: lan ? '0.0.0.0' : '127.0.0.1', addresses, acceptsHost: host => hosts.has(host) };
}
