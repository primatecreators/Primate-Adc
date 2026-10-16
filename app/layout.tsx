import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Primate ADC — Influencer Management", description: "Conexiones comerciales entre creadores, marcas y partners.", icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" } };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="es"><body>{children}</body></html>; }
