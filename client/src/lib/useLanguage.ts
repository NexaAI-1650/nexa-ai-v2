import { useMemo } from "react";
import { localStorageManager } from "./localStorage";
import { translations, type Language } from "./translations";

export function useLanguage() {
  const language = useMemo(() => {
    const lang = localStorageManager.getLanguage();
    return (lang in translations ? lang : "ja") as Language;
  }, []);

  const t = (key: keyof (typeof translations)["ja"]): string => {
    return translations[language][key] || key;
  };

  return { language, t };
}
