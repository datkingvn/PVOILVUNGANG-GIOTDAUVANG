"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Users } from "lucide-react";
import { Select } from "@/components/ui/select";

interface Team {
  _id: string;
  name: string;
}

export default function TeamLoginPage() {
  const router = useRouter();
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamId, setTeamId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/teams/public")
      .then((res) => res.json())
      .then(setTeams)
      .catch(console.error);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!teamId) {
      setError("Vui lòng chọn đội");
      return;
    }

    try {
      const res = await fetch("/api/auth/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Đăng nhập thất bại");
        return;
      }

      router.push("/player");
    } catch (err) {
      setError("Lỗi kết nối");
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        backgroundImage: "url('/system/bg-link.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 border border-gray-700 rounded-lg p-8 w-full max-w-md shadow-xl">
        <div className="text-center mb-6">
          <Users size={48} className="mx-auto mb-4 text-green-500" />
          <h1 className="text-2xl font-bold text-white">Đăng nhập đội chơi</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-gray-300 mb-2">Chọn đội</label>
            <Select
              options={teams.map((team) => ({
                value: team._id,
                label: team.name,
              }))}
              value={teamId}
              onChange={setTeamId}
              placeholder="Chọn đội của bạn"
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
            className="w-full py-2 bg-green-600 hover:bg-green-700 text-white rounded font-semibold transition-colors"
          >
            Đăng nhập
          </button>
        </form>
      </div>
    </div>
  );
}

