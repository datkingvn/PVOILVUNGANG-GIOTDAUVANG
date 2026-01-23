"use client";

import { io, Socket } from "socket.io-client";

let socketInstance: Socket | null = null;

/**
 * Get or create Socket.IO client instance
 * Auto-detects server URL (LAN IP or localhost)
 */
export function getSocketClient(): Socket {
  if (socketInstance?.connected) {
    return socketInstance;
  }

  // Determine server URL
  // In browser, use current origin (same host as the page)
  const serverUrl = typeof window !== "undefined" 
    ? window.location.origin 
    : "http://localhost:3000";

  socketInstance = io(serverUrl, {
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: Infinity,
  });

  socketInstance.on("connect", () => {
    console.log("Socket.IO connected:", socketInstance?.id);
  });

  socketInstance.on("disconnect", () => {
    console.log("Socket.IO disconnected");
  });

  socketInstance.on("connect_error", (error) => {
    console.error("Socket.IO connection error:", error);
  });

  return socketInstance;
}

/**
 * Disconnect Socket.IO client
 */
export function disconnectSocket() {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
}

export default getSocketClient;
