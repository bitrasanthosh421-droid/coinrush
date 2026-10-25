const express = require("express");
const path = require("path");
const cors = require("cors");
const helmet = require("helmet");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// Configure Helmet with loose CSP so AdSense & Google Fonts load freely
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Disable caching for HTML pages to guarantee immediate updates
app.use((req, res, next) => {
  if (req.url.endsWith(".html") || req.url === "/" || !req.url.includes(".")) {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  }
  next();
});

// Serve static directory
app.use(express.static(__dirname, { etag: false, maxAge: 0 }));

// Clean routes
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/download-capcut", (req, res) => {
  res.sendFile(path.join(__dirname, "download-capcut.html"));
});

app.get("/about", (req, res) => {
  res.sendFile(path.join(__dirname, "about.html"));
});

app.get("/contact", (req, res) => {
  res.sendFile(path.join(__dirname, "contact.html"));
});

app.get("/privacy", (req, res) => {
  res.sendFile(path.join(__dirname, "privacy.html"));
});

app.get("/terms", (req, res) => {
  res.sendFile(path.join(__dirname, "terms.html"));
});

app.get("/disclaimer", (req, res) => {
  res.sendFile(path.join(__dirname, "disclaimer.html"));
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", app: "CoinRush Hub", timestamp: new Date().toISOString() });
});

// Start Server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`\n======================================================`);
  console.log(`🚀 CoinRush Link Hub server running on port ${PORT}:`);
  console.log(`💻 Local computer:         http://localhost:${PORT}`);
  console.log(`📱 Other devices on Wi-Fi: http://localhost:${PORT}/index.html`);
  console.log(`🌐 Live Custom Domain:     https://techtelugu.online`);
  console.log(`======================================================\n`);
});
