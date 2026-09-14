"use client";

import { useTheme } from "next-themes";
import { Button } from "./button";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
    const { theme, setTheme } = useTheme();

    return (
        <Button
            variant={"ghost"}
            size={"icon"}
            onClick={() => setTheme(theme == "light" ? "dark" : "light")}
        >
            {theme === "dark" ? <Sun className="h-[1.2rem] w-[1.2rem]  transition-all " /> : <Moon className="h-[1.2rem] w-[1.2rem] transition-all  " />}
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
