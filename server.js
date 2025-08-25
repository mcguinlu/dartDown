const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();

// Allowed domains (add your domains here)
const ALLOWED_ORIGINS = [
  'https://mcguinlu.github.io',
  'http://localhost:3000',  
  'http://localhost:8080',  
  'http://127.0.0.1:3000',   
  'http://127.0.0.1:5500'
];

// Configure CORS with origin checking
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    // Check if origin is in allowed list
    if (ALLOWED_ORIGINS.some(allowedOrigin => origin.startsWith(allowedOrigin))) {
      callback(null, true);
    } else {
      console.log(`Blocked request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true, // If you need cookies/auth headers
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Basic health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'CORS Proxy Server is running',
    usage: 'Send requests to /api/proxy?url=<target-url>',
    allowedOrigins: ALLOWED_ORIGINS
  });
});

// Simple proxy endpoint using fetch (better for serverless)
app.get('/api/proxy', async (req, res) => {
  const targetUrl = req.query.url;
  
  if (!targetUrl) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  // Basic URL validation
  try {
    new URL(targetUrl);
  } catch (e) {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  // Additional security: only allow specific APIs (optional)
  const allowedApis = [
    'api.irishrail.ie'
    // Add other APIs you want to allow
  ];
  
  const urlObj = new URL(targetUrl);
  if (!allowedApis.includes(urlObj.hostname)) {
    return res.status(403).json({ 
      error: 'API not allowed', 
      allowedApis: allowedApis 
    });
  }

  try {
    // Forward the request
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        'User-Agent': 'CORS-Proxy/1.0'
      }
    });

    // Copy response headers (except some that might cause issues)
    const responseHeaders = {};
    response.headers.forEach((value, key) => {
      if (!['content-encoding', 'transfer-encoding'].includes(key.toLowerCase())) {
        responseHeaders[key] = value;
      }
    });

    // CORS headers are already handled by the cors middleware above
    res.set(responseHeaders);

    // Get response body
    const body = await response.text();
    
    res.status(response.status).send(body);
  } catch (error) {
    res.status(500).json({ error: 'Proxy error', details: error.message });
  }
});

// Export for Vercel
module.exports = app;