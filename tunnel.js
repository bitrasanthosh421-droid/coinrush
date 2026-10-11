const localtunnel = require("localtunnel");
const https = require("https");

function getPublicIp() {
  return new Promise((resolve) => {
    https.get("https://api.ipify.org", (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve(data.trim()));
    }).on("error", () => resolve("N/A"));
  });
}

async function startTunnel() {
  const publicIp = await getPublicIp();

  async function connect() {
    try {
      const tunnel = await localtunnel({ port: 3000 });
      console.log("==========================================");
      console.log("🌐 YOUR PUBLIC INTERNET URL IS LIVE!");
      console.log(`🔗 Dashboard: ${tunnel.url}/index.html`);
      console.log(`🔗 Login:     ${tunnel.url}/login.html`);
      console.log("==========================================");
      if (publicIp !== "N/A") {
        console.log(`🔑 Password / Endpoint IP: ${publicIp}`);
        console.log("==========================================");
      }

      tunnel.on("close", () => {
        console.log("⚠️ Tunnel closed, reconnecting in 5s...");
        setTimeout(connect, 5000);
      });

      tunnel.on("error", (err) => {
        console.error("Tunnel error:", err.message);
      });
    } catch (err) {
      console.error("Failed to connect tunnel, retrying in 5s...", err.message);
      setTimeout(connect, 5000);
    }
  }

  connect();

  // Keep the process alive indefinitely
  setInterval(() => {}, 1000 * 60 * 60);
}

startTunnel();
