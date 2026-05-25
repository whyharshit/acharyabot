import type { NextConfig } from "next";

const config: NextConfig = {
  serverExternalPackages: ["telegraf", "@google/generative-ai"],
};

export default config;
