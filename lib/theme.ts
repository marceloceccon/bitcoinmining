/** localStorage key for an explicit theme choice ("light" | "dark"); absent = follow the system. */
export const THEME_STORAGE_KEY = "mf-theme";

/** Inlined in <head> so an explicit choice is applied before first paint (no flash of the other theme). */
export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;
