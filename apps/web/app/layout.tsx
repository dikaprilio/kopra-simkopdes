import type { Metadata } from "next";
import { Fraunces, Poppins, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { MotionProviders } from "./components/motion/providers";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Kopra — Asisten Digital Koperasi",
  description:
    "Asisten digital untuk Koperasi Desa Merah Putih: kelola anggota, simpanan, pinjaman, dan pembukuan dengan mudah dan transparan.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${jakarta.variable} ${fraunces.variable} ${poppins.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <MotionProviders>{children}</MotionProviders>
      </body>
    </html>
  );
}
