import { Inter, Newsreader } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-serif",
  weight: ["400", "600", "700"],
});

export const metadata = {
  title: "Sachin Ganpule | Research Archive",
  description:
    "Master of Applied Data Science at University of Michigan. Multi-agent systems, LLM optimization, and MLOps.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${newsreader.variable}`}>{children}</body>
    </html>
  );
}
