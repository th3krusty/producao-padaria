import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "/producao/" faz os assets (JS/CSS) resolverem corretamente
// quando o app é acessado em tkone.com.br/producao via rewrite do Vercel.
export default defineConfig({
  plugins: [react()],
  base: "/producao-app/",
});
