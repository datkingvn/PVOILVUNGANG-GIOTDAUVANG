"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Mic, Users, Eye } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 xl:p-8 relative">
      {/* Blurred background */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "url('/system/ninh-dong.jpg')",
          backgroundSize: "cover",
          // Đẩy nội dung chính của ảnh sang bên phải màn hình (dịch nhẹ sang trái) và lên trên một chút
          backgroundPosition: "15% 20%",
          backgroundRepeat: "no-repeat",
          filter: "blur(0px)",
          transform: "scale(1)",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-white/10" />

      {/* Logo and PVOIL text - positioned above GIỌT DẦU VÀNG */}
      <div className="relative z-10 text-center mb-8 -mt-16 xl:-mt-24">
        <img
          src="/system/logo.png"
          alt="PVOIL Logo"
          className="h-16 md:h-20 xl:h-24 mx-auto mb-2"
        />
        <p className="font-semibold text-lg xl:text-2xl" style={{ color: "#354085" }}>
          PVOIL VŨNG ÁNG
        </p>
      </div>

      <div className="relative z-10 text-center mb-12">
        <h1 className="text-5xl md:text-7xl xl:text-8xl 2xl:text-9xl font-bold mb-4">
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 xl:gap-10 w-full max-w-6xl xl:max-w-7xl relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Link href="/login/mc">
            <div className="bg-gradient-to-br from-blue-600/90 to-blue-800/90 border-2 border-blue-500/50 rounded-xl p-8 xl:p-10 2xl:p-12 text-center cursor-pointer hover:scale-105 transition-transform shadow-xl">
              <Mic size={64} className="mx-auto mb-4 text-white" />
              <h2 className="text-2xl xl:text-3xl font-bold text-white mb-2">
                MC
              </h2>
              <p className="text-blue-100 xl:text-lg">Điều khiển trò chơi</p>
            </div>
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Link href="/login/team">
            <div className="bg-gradient-to-br from-green-600/90 to-green-800/90 border-2 border-green-500/50 rounded-xl p-8 xl:p-10 2xl:p-12 text-center cursor-pointer hover:scale-105 transition-transform shadow-xl">
              <Users size={64} className="mx-auto mb-4 text-white" />
              <h2 className="text-2xl xl:text-3xl font-bold text-white mb-2">
                Đội chơi
              </h2>
              <p className="text-green-100 xl:text-lg">Đăng nhập để thi</p>
            </div>
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Link href="/guest">
            <div className="bg-gradient-to-br from-purple-600/90 to-purple-800/90 border-2 border-purple-500/50 rounded-xl p-8 xl:p-10 2xl:p-12 text-center cursor-pointer hover:scale-105 transition-transform shadow-xl">
              <Eye size={64} className="mx-auto mb-4 text-white" />
              <h2 className="text-2xl xl:text-3xl font-bold text-white mb-2">
                Khách
              </h2>
              <p className="text-purple-100 xl:text-lg">Xem trực tiếp</p>
            </div>
          </Link>
        </motion.div>
      </div>
    </div>
  );
}

