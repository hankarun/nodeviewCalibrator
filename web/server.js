const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from the web directory (web-renderer.js, web-styles.css, etc.)
app.use(express.static(__dirname));

// Serve static files from the project root (renderer-core.js, styles.css, etc.)
app.use(express.static(path.join(__dirname, '..')));

app.listen(PORT, () => {
  console.log(`Node View Calibrator web server running at http://localhost:${PORT}`);
  console.log('Press Ctrl+C to stop the server');
});
