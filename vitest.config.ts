import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "server-only": path.resolve(__dirname, "tests/stubs/server-only.ts"),
    },
  },
  test: {
    include: ["src/**/*.test.ts", "tests/**/*.test.ts", "scripts/**/*.test.ts"],
    passWithNoTests: true,
    // Tests never use real keys: AI and DB are disabled so fallbacks are exercised.
    env: {
      GEMINI_API_KEY: "",
      NEXT_PUBLIC_SUPABASE_URL: "",
      SUPABASE_SERVICE_ROLE_KEY: "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
      TELEGRAM_WEBHOOK_SECRET: "test-secret",
      CRON_SECRET: "test-cron",
      ORG_DASHBOARD_ACCESS_CODE: "test-org",
    },
    coverage: {
      provider: "v8",
      include: ["src/lib/scoring/**"],
    },
  },
});
