import "./globals.css";

export const metadata = {
  title: "LINE Group Manager",
  description: "LINE 群組管理系統 MVP"
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
