import test from 'node:test';
import assert from 'node:assert/strict';
import { localNetworkConfig, isPrivateIPv4 } from '../scripts/local-network.mjs';

const interfaces = { wifi: [{ family: 'IPv4', internal: false, address: '192.168.29.195' }],
  public: [{ family: 'IPv4', internal: false, address: '203.0.113.9' }],
  ipv6: [{ family: 'IPv6', internal: false, address: 'fe80::1' }] };

test('default server remains loopback only, even when Wi-Fi is available', () => {
  const config = localNetworkConfig({ port: 8787, interfaces });
  assert.equal(config.bind, '127.0.0.1');
  assert.equal(config.acceptsHost('127.0.0.1:8787'), true);
  assert.equal(config.acceptsHost('localhost:8787'), true);
  assert.equal(config.acceptsHost('192.168.29.195:8787'), false);
});
test('Wi-Fi opt-in allows only actual private adapter addresses and the exact port', () => {
  const config = localNetworkConfig({ lan: true, port: 8788, interfaces });
  assert.equal(config.bind, '0.0.0.0');
  assert.deepEqual(config.addresses, ['192.168.29.195']);
  assert.equal(config.acceptsHost('192.168.29.195:8788'), true);
  for (const host of ['192.168.29.195:8787', '192.168.29.196:8788', '203.0.113.9:8788', 'evil.test:8788', '192.168.29.195.evil.test:8788'])
    assert.equal(config.acceptsHost(host), false, host);
});
test('private IPv4 detection handles boundaries and rejects ambiguous input', () => {
  for (const ip of ['10.0.0.1', '172.16.0.1', '172.31.255.254', '192.168.1.2']) assert.ok(isPrivateIPv4(ip), ip);
  for (const ip of ['172.15.1.1', '172.32.0.1', '192.169.1.1', '192.168.1.999', '192.168.01.1', '127.0.0.1', 'localhost', '10.1', '10.0.0.1.evil']) assert.equal(isPrivateIPv4(ip), false, ip);
});
