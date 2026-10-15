/** Build-time switch: `VITE_AI=false` (see .env.pages) ships a static, AI-free build. */
export const AI_ENABLED = import.meta.env.VITE_AI !== "false";
