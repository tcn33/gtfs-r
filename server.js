require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const crypto = require('crypto');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const PTV_USER_ID = process.env.PTV_USER_ID;
const PTV_API_KEY = process.env.PTV_API_KEY;
const STOP_ID = process.env.STOP_ID;
const ROUTE_TYPE = 2; // Bus

const PTV_BASE_URL = 'https://timetableapi.ptv.vic.gov.au';

// Cache to avoid hitting API too frequently
let cache = {
  data: null,
  timestamp: 0
};
const CACHE_TTL = 25000; // 25 seconds

app.use(express.static(path.join(__dirname, 'public')));

function buildSignedUrl(requestPath) {
  const separator = requestPath.includes('?') ? '&' : '?';
  const pathWithDevId = `${requestPath}${separator}devid=${PTV_USER_ID}`;

  const signature = crypto
    .createHmac('sha1', PTV_API_KEY)
    .update(pathWithDevId)
    .digest('hex')
    .toUpperCase();

  return `${PTV_BASE_URL}${pathWithDevId}&signature=${signature}`;
}

function formatArrivalTime(isoString) {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-AU', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

function getMinutesUntil(isoString) {
  const now = Date.now();
  const arrivalTime = new Date(isoString).getTime();
  return Math.round((arrivalTime - now) / 60000);
}

async function fetchDepartures() {
  const now = Date.now();

  if (cache.data && (now - cache.timestamp) < CACHE_TTL) {
    return cache.data;
  }

  const requestPath = `/v3/departures/route_type/${ROUTE_TYPE}/stop/${STOP_ID}?max_results=5&expand=route&expand=direction`;
  const url = buildSignedUrl(requestPath);
  const response = await fetch(url);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`PTV API error: ${response.status} - ${text}`);
  }

  const data = await response.json();

  cache.data = data;
  cache.timestamp = now;

  return data;
}

app.get('/api/arrivals', async (req, res) => {
  if (!PTV_USER_ID || !PTV_API_KEY || !STOP_ID) {
    return res.status(500).json({
      error: 'Missing configuration. Please set PTV_USER_ID, PTV_API_KEY, and STOP_ID in .env'
    });
  }

  try {
    const data = await fetchDepartures();
    const arrivals = [];

    for (const departure of data.departures || []) {
      const scheduled = departure.scheduled_departure_utc;
      const estimated = departure.estimated_departure_utc;
      const arrivalTime = estimated || scheduled;

      if (!arrivalTime) continue;

      // Skip departures in the past
      if (new Date(arrivalTime).getTime() < Date.now()) continue;

      const routeId = departure.route_id;
      const route = data.routes?.[routeId];
      const routeName = route?.route_number || route?.route_name || `Route ${routeId}`;

      const directionId = departure.direction_id;
      const direction = data.directions?.[directionId];
      const destination = direction?.direction_name || '';

      // Only show buses to Mitcham
      if (destination !== 'Mitcham') continue;

      let delayMinutes = 0;
      if (estimated && scheduled) {
        const diff = new Date(estimated).getTime() - new Date(scheduled).getTime();
        delayMinutes = Math.round(diff / 60000);
      }

      arrivals.push({
        routeId: routeName,
        destination,
        arrivalTime: arrivalTime,
        arrivalTimeFormatted: formatArrivalTime(arrivalTime),
        minutesUntil: getMinutesUntil(arrivalTime),
        delayMinutes,
        atPlatform: departure.at_platform || false
      });
    }

    // Sort by arrival time and take next 3
    arrivals.sort((a, b) => new Date(a.arrivalTime) - new Date(b.arrivalTime));
    const nextArrivals = arrivals.slice(0, 3);

    res.json({
      stopId: STOP_ID,
      arrivals: nextArrivals,
      lastUpdated: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching arrivals:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/config', (req, res) => {
  res.json({
    stopId: STOP_ID,
    configured: !!(PTV_USER_ID && PTV_API_KEY && STOP_ID)
  });
});

app.listen(PORT, () => {
  console.log(`Bus arrival display running at http://localhost:${PORT}`);
  if (!PTV_USER_ID || !PTV_API_KEY || !STOP_ID) {
    console.warn('Warning: PTV_USER_ID, PTV_API_KEY, and/or STOP_ID not set in .env file');
  }
});
