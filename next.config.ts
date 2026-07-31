import type { NextConfig } from "next";

const config: NextConfig = {
  // ponytail: проект на TypeScript 7 — сборке нужен его CLI, а не старое API компилятора
  experimental: { useTypeScriptCli: true },
};

export default config;
