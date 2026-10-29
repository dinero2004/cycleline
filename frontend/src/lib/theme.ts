export type Theme = "dark" | "light";

export const THEME_STORAGE_KEY = "cycleline-theme";

/** Runs in <head> before paint: stored choice first, otherwise the system preference. */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t!=="dark"&&t!=="light"){t=matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"}document.documentElement.dataset.theme=t}catch(e){}})();`;
