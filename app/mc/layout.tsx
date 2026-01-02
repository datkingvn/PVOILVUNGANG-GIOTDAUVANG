"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Menu, X, LayoutDashboard, Users, Settings, LogOut, FileQuestion } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function MCLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  }

  const menuItems = [
    { href: "/mc/dashboard", label: "Dashboard", icon: LayoutDashboard, color: "from-cyan-500 to-blue-600" },
    { href: "/mc/teams", label: "Quản lý đội", icon: Users, color: "from-emerald-500 to-teal-600" },
    { href: "/mc/questions", label: "Câu hỏi", icon: FileQuestion, color: "from-lime-500 to-green-600" },
    { href: "/mc/settings", label: "Cài đặt", icon: Settings, color: "from-amber-500 to-orange-600" },
  ];

  return (
    <div className="flex h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Sidebar */}
      <motion.div
        initial={false}
        animate={{
          width: sidebarOpen ? 280 : 0,
        }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className="relative bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 border-r border-gray-700/50 overflow-hidden shadow-2xl"
      >
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="h-full flex flex-col p-6"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
                    MC Control
                  </h1>
                  <p className="text-xs text-gray-400 mt-1">Điều khiển trò chơi</p>
                </div>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="p-2 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-lg transition-all"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Navigation */}
              <nav className="flex-1 space-y-2">
                {menuItems.map((item, index) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  return (
                    <motion.div
                      key={item.href}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <Link
                        href={item.href}
                        className={`group relative flex items-center gap-4 px-4 py-3 rounded-xl transition-all ${
                          isActive
                            ? `bg-gradient-to-r ${item.color} text-white shadow-lg`
                            : "text-gray-300 hover:bg-gray-700/50 hover:text-white"
                        }`}
                      >
                        <div className={`relative z-10 ${isActive ? "text-white" : "text-gray-400 group-hover:text-white transition-colors"}`}>
                          <Icon size={20} />
                        </div>
                        <span className={`relative z-10 font-medium ${isActive ? "text-white" : "text-gray-300 group-hover:text-white transition-colors"}`}>
                          {item.label}
                        </span>
                        {isActive && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="absolute right-3 w-2 h-2 bg-white rounded-full shadow-sm"
                          />
                        )}
                      </Link>
                    </motion.div>
                  );
                })}
              </nav>

              {/* Logout Button */}
              <motion.button
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                onClick={handleLogout}
                className="mt-6 w-full flex items-center justify-center gap-3 px-4 py-3 bg-gradient-to-r from-red-600/20 to-rose-600/20 hover:from-red-600/30 hover:to-rose-600/30 border border-red-500/30 hover:border-red-400/50 rounded-xl text-red-300 hover:text-red-200 transition-all font-medium"
              >
                <LogOut size={18} />
                <span>Đăng xuất</span>
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Main content */}
      <div className="flex-1 overflow-auto relative">
        {!sidebarOpen && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={() => setSidebarOpen(true)}
            className="fixed top-4 left-4 z-10 p-3 bg-gradient-to-br from-gray-800 to-gray-900 text-white rounded-xl shadow-lg hover:shadow-xl border border-gray-700/50 hover:border-cyan-500/50 transition-all"
          >
            <Menu size={20} />
          </motion.button>
        )}
        {children}
      </div>
    </div>
  );
}

