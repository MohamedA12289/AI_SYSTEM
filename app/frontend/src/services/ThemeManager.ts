export type Theme = "light" | "dark" | "high-contrast";

type ThemeChangeCallback = (theme: Theme) => void;

class ThemeManagerClass {
  private currentTheme: Theme = "dark";
  private listeners: ThemeChangeCallback[] = [];

  constructor() {
    this.loadTheme();
    this.applyTheme(this.currentTheme);
  }

  private loadTheme() {
    const stored = localStorage.getItem("cubos_theme");
    if (stored && this.isValidTheme(stored)) {
      this.currentTheme = stored as Theme;
    } else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      this.currentTheme = prefersDark ? "dark" : "light";
    }
  }

  private isValidTheme(value: string): boolean {
    return ["light", "dark", "high-contrast"].includes(value);
  }

  private applyTheme(theme: Theme) {
    const root = document.documentElement;

    root.classList.remove("light", "dark", "high-contrast");
    root.classList.add(theme);

    if (theme === "light") {
      root.style.setProperty("--background", "0 0% 97%");
      root.style.setProperty("--foreground", "0 0% 9%");
      root.style.setProperty("--sidebar-background", "0 0% 98%");
      root.style.setProperty("--activity-bar", "0 0% 96%");
      root.style.setProperty("--panel", "0 0% 99%");
      root.style.setProperty("--surface", "0 0% 95%");
      root.style.setProperty("--accent", "0 0% 94%");
      root.style.setProperty("--border", "0 0% 89%");
      root.style.setProperty("--muted-foreground", "0 0% 45%");
      root.style.setProperty("--card", "0 0% 100%");
      root.style.setProperty("--secondary", "0 0% 93%");
      root.style.setProperty("--muted", "0 0% 94%");
      root.style.setProperty("--input", "0 0% 89%");
      root.style.setProperty("--ring", "0 0% 15%");
    } else if (theme === "dark") {
      root.style.setProperty("--background", "0 0% 7%");
      root.style.setProperty("--foreground", "0 0% 90%");
      root.style.setProperty("--sidebar-background", "0 0% 6%");
      root.style.setProperty("--activity-bar", "0 0% 7%");
      root.style.setProperty("--panel", "0 0% 9%");
      root.style.setProperty("--surface", "0 0% 11%");
      root.style.setProperty("--accent", "0 0% 14%");
      root.style.setProperty("--border", "0 0% 16%");
      root.style.setProperty("--muted-foreground", "0 0% 50%");
      root.style.setProperty("--card", "0 0% 10%");
      root.style.setProperty("--secondary", "0 0% 14%");
      root.style.setProperty("--muted", "0 0% 14%");
      root.style.setProperty("--input", "0 0% 16%");
      root.style.setProperty("--ring", "0 0% 85%");
      root.style.setProperty("--primary", "0 0% 90%");
      root.style.setProperty("--primary-foreground", "0 0% 7%");
    } else if (theme === "high-contrast") {
      root.style.setProperty("--background", "0 0% 0%");
      root.style.setProperty("--foreground", "0 0% 100%");
      root.style.setProperty("--sidebar-background", "0 0% 5%");
      root.style.setProperty("--activity-bar", "0 0% 3%");
      root.style.setProperty("--panel", "0 0% 5%");
      root.style.setProperty("--surface", "0 0% 10%");
      root.style.setProperty("--accent", "0 0% 15%");
      root.style.setProperty("--border", "0 0% 20%");
      root.style.setProperty("--muted-foreground", "0 0% 70%");
      root.style.setProperty("--card", "0 0% 5%");
      root.style.setProperty("--secondary", "0 0% 12%");
      root.style.setProperty("--muted", "0 0% 12%");
      root.style.setProperty("--input", "0 0% 20%");
      root.style.setProperty("--ring", "0 0% 100%");
      root.style.setProperty("--primary", "0 0% 100%");
      root.style.setProperty("--primary-foreground", "0 0% 0%");
    }
  }

  getTheme(): Theme {
    return this.currentTheme;
  }

  setTheme(theme: Theme) {
    if (!this.isValidTheme(theme)) {
      console.warn(`Invalid theme: ${theme}`);
      return;
    }

    this.currentTheme = theme;
    this.applyTheme(theme);
    localStorage.setItem("cubos_theme", theme);
    this.notifyListeners();
  }

  onChange(callback: ThemeChangeCallback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  private notifyListeners() {
    this.listeners.forEach(callback => callback(this.currentTheme));
  }
}

export const ThemeManager = new ThemeManagerClass();
