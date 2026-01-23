import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server as SocketIOServer } from "socket.io";
import express from "express";
import { networkInterfaces } from "os";
import path from "path";
import fs from "fs";

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

// Create Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Get LAN IP addresses
function getLANIPs(): string[] {
  const interfaces = networkInterfaces();
  const ips: string[] = [];

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      // Skip internal (loopback) and non-IPv4 addresses
      // Handle both string ("IPv4") and number (4) family formats
      const isIPv4 = iface.family === "IPv4" || iface.family === 4;
      if (isIPv4 && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }

  return ips;
}

app.prepare().then(() => {
  const expressApp = express();
  const server = createServer(expressApp);

  // Create Socket.IO server with CORS for LAN
  const io = new SocketIOServer(server, {
    cors: {
      origin: "*", // Allow all origins for LAN
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  // Make io available globally for API routes
  (global as any).io = io;

  // Serve static files from /uploads
  const uploadsDir = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  expressApp.use("/uploads", express.static(uploadsDir));

  // Socket.IO connection handling
  io.on("connection", (socket) => {
    console.log(`Client connected: ${socket.id}`);
    
    socket.on("disconnect", () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });

  // Next.js request handler - catch all routes
  expressApp.use((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  server.listen(port, hostname, () => {
    const lanIPs = getLANIPs();
    console.log(`\n🚀 Server ready on:`);
    console.log(`   Local:   http://localhost:${port}`);
    if (lanIPs.length > 0) {
      console.log(`   LAN IPs:`);
      lanIPs.forEach((ip) => {
        console.log(`   - http://${ip}:${port}`);
      });
    } else {
      console.log(`   ⚠️  No LAN IPs detected`);
    }
    console.log(`\n📡 Socket.IO server running\n`);
  });
});
