import fs from 'fs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const BASE_URL = 'http://localhost:5000/api/v1';
const SECRET = process.env.ACCESS_TOKEN_SECRET || 'secret';

// Real database user IDs
const CUSTOMER_ID = 'vepJxjhXYRf4LDNNrRu7kGSXgy0yUwZR';
const OWNER_ID = 'hIduDPTBQQjEzKiaTewkylTFhzMct3eD';
const ADMIN_ID = '03fd780c-74b9-4d0e-8fae-e2fc67ab9491';

const customerToken = jwt.sign({ userId: CUSTOMER_ID, role: 'CUSTOMER', email: 'tawhidislam1444@gmail.com' }, SECRET, { expiresIn: '1h' });
const ownerToken = jwt.sign({ userId: OWNER_ID, role: 'OWNER', email: 'tawhidislamweb@gmail.com' }, SECRET, { expiresIn: '1h' });
const adminToken = jwt.sign({ userId: ADMIN_ID, role: 'ADMIN', email: 'admin@jatra.com' }, SECRET, { expiresIn: '1h' });

const testCases = [
  { name: 'Public Automotive Centers', path: '/automotive-centers', auth: null },
  { name: 'Public Vehicles (All)', path: '/vehicles', auth: null },
  { name: 'Public Rental Fleet', path: '/vehicles?type=RENTAL_FLEET&page=1&limit=10', auth: null },
  { name: 'Vehicle Detail', path: '/vehicles/fda4a5bc-8ff5-41dd-b01d-78a8cd9797ad', auth: null },
  { name: 'Center Detail', path: '/automotive-centers/0e67c1eb-229c-4786-8947-d11bff584c70', auth: null },
  { name: 'Vehicle Calendar Availability', path: '/rental-bookings/vehicle/fda4a5bc-8ff5-41dd-b01d-78a8cd9797ad/availability', auth: null },
  { name: 'Center Slot Availability', path: '/service-requests/centers/0e67c1eb-229c-4786-8947-d11bff584c70/availability?date=2026-11-12', auth: null },
  { name: 'Customer Rental Bookings', path: '/rental-bookings', auth: customerToken },
  { name: 'Owner Rental Bookings', path: '/rental-bookings', auth: ownerToken },
  { name: 'Customer Service Requests', path: '/service-requests', auth: customerToken },
  { name: 'Owner Service Requests', path: '/service-requests', auth: ownerToken },
  { name: 'Customer Notifications', path: '/notifications', auth: customerToken },
  { name: 'Customer Wishlist', path: '/wishlist/my-wishlist', auth: customerToken },
  { name: 'Customer Conversations', path: '/conversations', auth: customerToken },
  { name: 'Owner Conversations', path: '/conversations', auth: ownerToken },
  { name: 'Customer Wallet', path: '/wallets/my-wallet', auth: customerToken },
];

async function runBenchmark() {
  console.log('Starting Baseline Performance Benchmark...\n');
  const results = [];

  for (const tc of testCases) {
    const headers = {};
    if (tc.auth) {
      headers['Authorization'] = `Bearer ${tc.auth}`;
    }

    const tStart = performance.now();
    try {
      const res = await fetch(`${BASE_URL}${tc.path}`, { headers });
      const tEnd = performance.now();
      const body = await res.text();

      const totalTime = Math.round((tEnd - tStart) * 100) / 100;
      const dbTimeHeader = res.headers.get('x-db-time') || 'N/A';
      const dbQueriesHeader = res.headers.get('x-db-queries') || '0';
      const sizeBytes = Buffer.byteLength(body, 'utf8');

      results.push({
        endpoint: tc.name,
        path: tc.path,
        status: res.status,
        totalTimeMs: totalTime,
        dbTimeMs: dbTimeHeader,
        dbQueries: Number(dbQueriesHeader),
        sizeBytes,
      });

      console.log(`✓ ${tc.name.padEnd(30)} | ${res.status} | Total: ${String(totalTime).padStart(7)}ms | DB: ${dbTimeHeader.padStart(8)} | Queries: ${String(dbQueriesHeader).padStart(2)} | Size: ${sizeBytes}b`);
    } catch (err) {
      console.error(`✗ ${tc.name}:`, err.message);
      results.push({
        endpoint: tc.name,
        path: tc.path,
        status: 'ERR',
        totalTimeMs: -1,
        dbTimeMs: 'N/A',
        dbQueries: 0,
        sizeBytes: 0,
      });
    }
  }

  fs.writeFileSync('benchmark_baseline.json', JSON.stringify(results, null, 2));
  console.log('\nBenchmark saved to benchmark_baseline.json');
}

runBenchmark().catch(console.error);
