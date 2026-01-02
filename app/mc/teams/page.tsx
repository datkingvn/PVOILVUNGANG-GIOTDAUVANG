"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/useToast";
import { useConfirm } from "@/hooks/useConfirm";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { Plus, Edit, Trash2, Key, Users } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { motion } from "framer-motion";

interface Team {
  _id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export default function MCTeamsPage() {
  const router = useRouter();
  const [teams, setTeams] = useState<Team[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [formData, setFormData] = useState({ name: "", password: "" });
  const { showToast } = useToast();
  const { confirm, isOpen, message, close, handleConfirm } = useConfirm();

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/mc", { method: "GET" });
        if (!res.ok) {
          router.push("/login/mc");
        }
      } catch {
        router.push("/login/mc");
      }
    }
    checkAuth();
    loadTeams();
  }, [router]);

  async function loadTeams() {
    try {
      const res = await fetch("/api/teams");
      if (res.ok) {
        const data = await res.json();
        setTeams(data);
      }
    } catch (error) {
      console.error("Failed to load teams:", error);
    }
  }

  async function handleCreate() {
    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        showToast(data.error || "Tạo đội thất bại", "error");
        return;
      }

      showToast("Tạo đội thành công", "success");
      setIsCreateModalOpen(false);
      setFormData({ name: "", password: "" });
      loadTeams();
    } catch (error) {
      showToast("Lỗi kết nối", "error");
    }
  }

  async function handleUpdate() {
    if (!editingTeam) return;

    try {
      const res = await fetch(`/api/teams/${editingTeam._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        showToast(data.error || "Cập nhật đội thất bại", "error");
        return;
      }

      showToast("Cập nhật đội thành công", "success");
      setIsEditModalOpen(false);
      setEditingTeam(null);
      setFormData({ name: "", password: "" });
      loadTeams();
    } catch (error) {
      showToast("Lỗi kết nối", "error");
    }
  }

  async function handleDelete(teamId: string, teamName: string) {
    confirm(`Bạn có chắc chắn muốn xóa đội "${teamName}"?`, async () => {
      try {
        const res = await fetch(`/api/teams/${teamId}`, {
          method: "DELETE",
        });

        if (!res.ok) {
          showToast("Xóa đội thất bại", "error");
          return;
        }

        showToast("Xóa đội thành công", "success");
        loadTeams();
      } catch (error) {
        showToast("Lỗi kết nối", "error");
      }
    });
  }

  function openEditModal(team: Team) {
    setEditingTeam(team);
    setFormData({ name: team.name, password: "" });
    setIsEditModalOpen(true);
  }

  return (
    <div className="p-8 text-white">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-bold mb-2 text-white">
            Quản lý đội
          </h1>
          <p className="text-gray-400">Tạo và quản lý các đội chơi</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsCreateModalOpen(true)}
          className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 rounded-xl font-semibold text-white shadow-lg hover:shadow-xl transition-all flex items-center gap-2"
        >
          <Plus size={20} />
          Tạo đội mới
        </motion.button>
      </div>

      {teams.length === 0 ? (
        <div className="text-center py-16">
          <Users size={64} className="mx-auto mb-4 text-gray-600" />
          <p className="text-gray-400 text-lg">Chưa có đội nào. Hãy tạo đội mới!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {teams.map((team, index) => (
            <motion.div
              key={team._id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="p-6 bg-gradient-to-br from-gray-800/90 to-gray-900/90 border border-gray-700/50 hover:border-emerald-500/50 transition-all shadow-lg hover:shadow-xl">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 rounded-lg">
                        <Users size={20} className="text-emerald-400" />
                      </div>
                      <h3 className="text-xl font-bold text-white">{team.name}</h3>
                    </div>
                    <div className="flex items-center gap-2 text-gray-400 text-sm">
                      <Key size={14} />
                      <span>Tạo: {new Date(team.createdAt).toLocaleDateString("vi-VN")}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-2 mt-4 pt-4 border-t border-gray-700/50">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => openEditModal(team)}
                    className="flex-1 py-2.5 bg-gradient-to-br from-blue-600/20 to-indigo-600/20 hover:from-blue-600/40 hover:to-indigo-600/40 border border-blue-500/30 hover:border-blue-400/50 rounded-lg text-blue-300 hover:text-blue-200 transition-all flex items-center justify-center gap-2 font-medium"
                  >
                    <Edit size={18} />
                    Chỉnh sửa
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleDelete(team._id, team.name)}
                    className="flex-1 py-2.5 bg-gradient-to-br from-red-600/20 to-rose-600/20 hover:from-red-600/40 hover:to-rose-600/40 border border-red-500/30 hover:border-red-400/50 rounded-lg text-red-300 hover:text-red-200 transition-all flex items-center justify-center gap-2 font-medium"
                  >
                    <Trash2 size={18} />
                    Xóa
                  </motion.button>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setFormData({ name: "", password: "" });
        }}
        title="Tạo đội mới"
      >
        <div className="space-y-5">
          <div>
            <label className="block text-white font-semibold mb-2">Tên đội</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-3 bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
              placeholder="Nhập tên đội"
            />
          </div>
          <div>
            <label className="block text-white font-semibold mb-2">Mật khẩu</label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-4 py-3 bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
              placeholder="Nhập mật khẩu"
            />
          </div>
          <button
            onClick={handleCreate}
            className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all"
          >
            Tạo đội
          </button>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingTeam(null);
          setFormData({ name: "", password: "" });
        }}
        title="Chỉnh sửa đội"
      >
        <div className="space-y-5">
          <div>
            <label className="block text-white font-semibold mb-2">Tên đội</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-3 bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
              placeholder="Nhập tên đội"
            />
          </div>
          <div>
            <label className="block text-white font-semibold mb-2">
              Mật khẩu mới <span className="text-gray-400 text-sm font-normal">(để trống nếu không đổi)</span>
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-4 py-3 bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
              placeholder="Nhập mật khẩu mới"
            />
          </div>
          <button
            onClick={handleUpdate}
            className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all"
          >
            Cập nhật
          </button>
        </div>
      </Modal>

      <ConfirmModal />
    </div>
  );
}
