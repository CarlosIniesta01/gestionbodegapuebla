import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";
import { supabase } from "@/integrations/supabase/client";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error("[errorMiddleware]", error);
    const msg = (error as any)?.stack ?? String(error);
    return new Response(
      `<pre style="white-space:pre-wrap;padding:1rem;font:12px monospace">${msg.replace(/</g, "&lt;")}</pre>`,
      { status: 500, headers: { "content-type": "text/html; charset=utf-8" } },
    );
  }
});

const refreshSupabaseAuth = createMiddleware({ type: "function" }).client(async ({ next }) => {
  const { error } = await supabase.auth.getUser();
  if (error) await supabase.auth.signOut();
  return next();
});

export const startInstance = createStart(() => ({
  requestMiddleware: [errorMiddleware],
  functionMiddleware: [refreshSupabaseAuth, attachSupabaseAuth],
}));
