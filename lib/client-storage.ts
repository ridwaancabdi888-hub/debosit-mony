/**
 * Storage keys and the pre-hydration theme script.
 *
 * This module deliberately has NO "use client" directive. Every export of a
 * "use client" module becomes a *client reference* when a server component
 * imports it — a proxy, not the value — so a key defined in a client component
 * silently arrives as an unusable object in `cookies().get(...)`, and a script
 * string arrives as a reference rather than inlineable JavaScript. Keeping these
 * plain values here means both the server and the client read the real thing.
 */

export const LANGUAGE_STORAGE_KEY = "sandbox-money-language";
export const THEME_STORAGE_KEY = "sandbox-money-theme";

/**
 * Runs before React hydrates so the correct theme class is on <html> for the
 * very first paint. Kept in sync with ThemeProvider.
 */
export const THEME_INIT_SCRIPT = `(function(){try{
var s=localStorage.getItem("${THEME_STORAGE_KEY}");
var d=s==="dark"||(!s&&window.matchMedia("(prefers-color-scheme: dark)").matches);
document.documentElement.classList.toggle("dark",d);
}catch(e){}})();`;
