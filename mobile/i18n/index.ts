import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import * as Localization from "expo-localization";
import en from "./en.json";
import ml from "./ml.json";
import hi from "./hi.json";

const locale = Localization.getLocales()[0]?.languageCode || "en";

void i18n.use(initReactI18next).init({
  compatibilityJSON: "v4",
  lng: ["en", "ml", "hi"].includes(locale) ? locale : "en",
  fallbackLng: "en",
  resources: {
    en: { translation: en },
    ml: { translation: ml },
    hi: { translation: hi },
  },
  interpolation: { escapeValue: false },
});

export default i18n;
