const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from the project root
app.use(express.static(path.join(__dirname, '..')));

// Serve the web version at the root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Handle SPA routing - send all requests to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Node View Calibrator web server running at http://localhost:${PORT}`);
  console.log('Press Ctrl+C to stop the server');
});
