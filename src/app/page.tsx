"use client";

import { useEffect } from "react";
import { wsManager } from "../lib/websocket";

export default function Home() {
  useEffect(() => {
    wsManager.connect();

    wsManager.onMessage((msg) => {
      console.log("Received:", msg);
    });

    return () => {
      wsManager.disconnect();
    };
  }, []);

  return (
    <main
      style={{
        padding: 40,
        fontFamily: "sans-serif",
      }}
    >
      <h1>Agent Console</h1>

      <button
        onClick={() => {
          wsManager.sendUserMessage("Hello Agent");
        }}
      >
        Send Message
      </button>
    </main>
  );
}