# Bus Arrival Display

Shows next buses to Mitcham from a configured PTV stop with real-time departure estimates.

## Features

- Real-time departure estimates from PTV Timetable API v3
- Route numbers and destinations
- Delay status (on time / late / early)
- 30-second refresh (slows to 5 minutes when no buses running)

## Setup

```bash
git clone https://github.com/tcn33/gtfs-r.git
cd gtfs-r
npm install
```

Create `.env` with your PTV API credentials and stop ID:

```
PTV_USER_ID=your-user-id
PTV_API_KEY=your-api-key
STOP_ID=12632
```

## Running

```bash
# Foreground
npm start

# Background (survives logout)
nohup npm start &

# With pm2
pm2 start server.js
```

Access at `http://localhost:3847`

## Configuration

| Variable | Description |
|----------|-------------|
| `PTV_USER_ID` | Your PTV API user ID |
| `PTV_API_KEY` | Your PTV API key |
| `STOP_ID` | PTV stop ID to monitor |
| `PORT` | Server port (default: 3847) |
