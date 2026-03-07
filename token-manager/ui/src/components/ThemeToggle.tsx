import { useEffect, useState } from "react";
import { Button } from "@heroui/react";
import { Moon, Sun } from "lucide-react";

export default function ThemeToggle() {
  const [dark, setDark] = useState(() => {
    return localStorage.getItem("theme") !== "light";
  });

  useEffect(() => {
    const root = document.documentElement;
    if (dark) {
      root.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [dark]);

  return (
    <Button
      isIconOnly
      size="sm"
      variant="light"
      onPress={() => setDark(!dark)}
      aria-label="Cambiar tema"
    >
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </Button>
  );
}
