"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mic } from "lucide-react";

export default function MCLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    try {
      const res = await fetch("/api/auth/mc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Đăng nhập thất bại");
        return;
      }

      router.push("/mc/dashboard");
    } catch (err) {
      setError("Lỗi kết nối");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      {/* Blurred background */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "url('/system/CHXD.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          filter: "blur(8px)",
          transform: "scale(1.1)",
        }}
      />
      <div className="absolute inset-0 bg-black/20" />
      <div className="relative z-10 bg-gradient-to-br from-gray-800/90 to-gray-900/90 border border-gray-700 rounded-lg p-8 w-full max-w-md shadow-xl">
        <div className="text-center mb-6">
          <Mic size={48} className="mx-auto mb-4 text-blue-500" />
          <h1 className="text-2xl font-bold text-white">MC Login</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-gray-300 mb-2">Tên đăng nhập</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded text-white"
              required
            />
          </div>

          <div>
            <label className="block text-gray-300 mb-2">Mật khẩu</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded text-white"
              required
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold transition-colors"
          >
            Đăng nhập
          </button>
        </form>
      </div>
    </div>
  );
}

