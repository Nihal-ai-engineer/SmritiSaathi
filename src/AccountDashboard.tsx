import { translate as uiText } from "./i18n";
import type { User, Profile } from "./api";
import AccountControls from "./AccountControls";
import { regionalLanguages } from "./regionalLanguages";
import {
  languageOptions,
  regionLanguageCodes,
  isAppLanguage,
  translationCoverage,
  type AppLanguage,
} from "./i18n";

export default function AccountDashboard({
  user,
  profile,
  vault,
  language,
  onLanguage,
  onLogout,
  onCare,
}: {
  user: User;
  profile: Profile;
  vault: Uint8Array<ArrayBuffer>;
  language: AppLanguage;
  onLanguage: (value: AppLanguage) => void;
  onLogout: () => void;
  onCare: () => void;
}) {
  const hi = language === "hi";
  const suggested = regionLanguageCodes[profile.cultureRegion || ""];
  const coverage = translationCoverage(language);
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{uiText("YOUR ACCOUNT", "आपका खाता")}</span>
          <h1>{uiText("Account & language", "खाता और भाषा")}</h1>
          <p>
            {uiText(
              "Your login details, language and security in one place.",
              "लॉगिन जानकारी, भाषा और सुरक्षा एक जगह।",
            )}
          </p>
        </div>
        <button className="secondary" onClick={onLogout}>
          {uiText("Sign out", "साइन आउट")}
        </button>
      </div>
      <div className="settings-grid">
        <section className="panel settings-panel">
          <h2>{uiText("Login information", "लॉगिन जानकारी")}</h2>
          <dl>
            <dt>{uiText("Email", "ईमेल")}</dt>
            <dd style={{ overflowWrap: "anywhere" }}>{user.email}</dd>
            <dt>{uiText("Email status", "ईमेल की स्थिति")}</dt>
            <dd>
              {user.email_verified
                ? uiText("Verified", "सत्यापित")
                : uiText("Not verified", "सत्यापन बाकी")}
            </dd>
            <dt>{uiText("Account role", "खाते की भूमिका")}</dt>
            <dd>
              {user.role === "caregiver"
                ? uiText("Caregiver", "देखभाल करने वाला")
                : uiText("Personal support", "स्वयं के लिए सहायता")}
            </dd>
            <dt>
              {uiText("Current care profile", "वर्तमान देखभाल प्रोफ़ाइल")}
            </dt>
            <dd>{profile.name}</dd>
            <dt>{uiText("Region", "क्षेत्र")}</dt>
            <dd>{profile.cultureRegion}</dd>
          </dl>
          <button className="secondary" onClick={onCare}>
            {uiText("Manage care profile", "देखभाल प्रोफ़ाइल खोलें")}
          </button>
        </section>
        <section className="panel settings-panel">
          <h2>{uiText("App language", "ऐप की भाषा")}</h2>
          <label>
            {uiText("Language on this browser", "इस ब्राउज़र की भाषा")}
            <select
              value={language}
              onChange={(e) => {
                if (isAppLanguage(e.target.value)) onLanguage(e.target.value);
              }}
            >
              {languageOptions.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.name}
                </option>
              ))}
              {Object.entries(regionalLanguages).map(
                ([state, name]) =>
                  !isAppLanguage(regionLanguageCodes[state]) && (
                    <option key={state} disabled value={state}>
                      {name} ({state}
                      {uiText(") — translation pack needed")}
                    </option>
                  ),
              )}
            </select>
          </label>
          <p className="small muted">
            {uiText(
              "Draft translations — native-speaker review needed. Missing text stays in English.",
            )}{" "}
            {coverage.translated}/{coverage.total}{" "}
            {uiText("catalog entries translated")}
          </p>
          <div className="notice">
            <strong>
              {regionalLanguages[profile.cultureRegion || ""]} ·{" "}
              {profile.cultureRegion}
            </strong>
            <p>
              {isAppLanguage(suggested) ? (
                <button
                  className="secondary"
                  onClick={() => onLanguage(suggested)}
                >
                  {uiText("Use my regional language")}
                </button>
              ) : (
                uiText("Regional translation awaiting review.")
              )}
            </p>
          </div>
          <p className="small muted">
            {uiText(
              "Your memories and names are not automatically translated or sent to a translation service.",
              "आपकी यादें और नाम अपने आप अनुवाद नहीं किए जाते।",
            )}
          </p>
        </section>
        <AccountControls user={user} vault={vault} onDeleted={onLogout} />
      </div>
    </>
  );
}
