"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Mic, Users, Eye } from "lucide-react";

export default function HomePage() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4 relative"
      style={{
        backgroundImage: "url('/system/bg-link.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-white/10" />

      <div className="relative z-10 text-center mb-12">
        <h1 className="text-5xl md:text-7xl font-bold mb-4">
          <span style={{ color: "#354085" }}>GIỌT DẦU</span>{" "}
          <span
            style={{
              color: "#FFD700",
              WebkitTextStroke: "2px #FF0000",
              textShadow: "0 0 10px rgba(255,0,0,0.5)",
            }}
          >
            VÀNG
          </span>
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 w-full max-w-6xl relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Link href="/login/mc">
            <div className="bg-gradient-to-br from-blue-600/90 to-blue-800/90 border-2 border-blue-500/50 rounded-xl p-8 text-center cursor-pointer hover:scale-105 transition-transform shadow-xl">
              <Mic size={64} className="mx-auto mb-4 text-white" />
              <h2 className="text-2xl font-bold text-white mb-2">MC</h2>
              <p className="text-blue-100">Điều khiển trò chơi</p>
            </div>
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Link href="/login/team">
            <div className="bg-gradient-to-br from-green-600/90 to-green-800/90 border-2 border-green-500/50 rounded-xl p-8 text-center cursor-pointer hover:scale-105 transition-transform shadow-xl">
              <Users size={64} className="mx-auto mb-4 text-white" />
              <h2 className="text-2xl font-bold text-white mb-2">Đội chơi</h2>
              <p className="text-green-100">Đăng nhập để thi</p>
            </div>
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Link href="/guest">
            <div className="bg-gradient-to-br from-purple-600/90 to-purple-800/90 border-2 border-purple-500/50 rounded-xl p-8 text-center cursor-pointer hover:scale-105 transition-transform shadow-xl">
              <Eye size={64} className="mx-auto mb-4 text-white" />
              <h2 className="text-2xl font-bold text-white mb-2">Khách</h2>
              <p className="text-purple-100">Xem trực tiếp</p>
            </div>
          </Link>
        </motion.div>
      </div>

      <div className="mt-12 relative z-10 text-center">
        <img
          src="/system/logo.png"
          alt="PVOIL Logo"
          className="h-16 md:h-20 mx-auto mb-2"
        />
        <p className="text-gray-800 font-semibold text-lg">PVOIL VŨNG ÁNG</p>
      </div>
    </div>
  );
}

