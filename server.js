const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'names.json');

app.use(cors());
app.use(express.json());

let names = fs.existsSync(DATA_FILE) ? JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) : [];
let sseClients = [];

app.get('/api/ping', (_req, res) => {
  res.json({ message: 'Successfully hit endpoint' });
});

app.get('/api/names', (_req, res) => {
  res.json(names);
});

// Server-Sent Events: clients subscribe here and receive live updates
app.get('/api/names/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  sseClients.push(res);

  req.on('close', () => {
    sseClients = sseClients.filter(c => c !== res);
  });
});

app.post('/api/names', (req, res) => {
  const { name } = req.body;

  if (typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'name must be a non-empty string' });
  }

  names.push(name.trim());
  fs.writeFileSync(DATA_FILE, JSON.stringify(names));

  // Push updated list to every connected browser
  sseClients.forEach(client => {
    client.write(`data: ${JSON.stringify(names)}\n\n`);
  });

  return res.json(names);
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
