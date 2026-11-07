import { useState } from "react";
import {
  languageOptions,
  useLanguage,
  setLanguage,
  isAppLanguage,
  translate,
} from "./i18n";

export default function LanguagePicker() {
  const language = useLanguage();
  const [saved, setSaved] = useState(true);
  return (
    <label className="language-picker">
      {translate("App language")}
      <select
        value={language}
        onChange={(event) => {
          if (isAppLanguage(event.target.value))
            setSaved(setLanguage(event.target.value));
        }}
      >
        {languageOptions.map((option) => (
          <option key={option.code} value={option.code}>
            {option.name}
          </option>
        ))}
      </select>
      {language !== "en" && (
        <small>
          {translate(
            "Draft translations — native-speaker review needed. Missing text stays in English.",
          )}
        </small>
      )}
      {!saved && (
        <small role="status">
          {translate(
            "Language changed for this visit. Your browser could not save the preference.",
          )}
        </small>
      )}
    </label>
  );
}
