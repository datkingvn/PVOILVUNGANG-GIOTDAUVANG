import type { Metadata } from "next";
import "./globals.css";
import { ToastContainer } from "@/components/ui/toast";

export const metadata: Metadata = {
  title: "GIỌT DẦU VÀNG - Game Show",
  description: "Hệ thống game show real-time đa thiết bị",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body>
        {children}
        <ToastContainer />
      </body>
    </html>
  );
}

