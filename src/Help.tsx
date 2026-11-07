import { translate as uiText } from "./i18n";
export default function Help() {
  return (
    <section className="panel settings-panel">
      <h2>{uiText("Help & app information")}</h2>
      <details>
        <summary>{uiText("How do I start?")}</summary>
        <p>
          {uiText(
            "Create an account, save your recovery key, verify your email, then complete your care profile. Add your own memories, familiar people and daily reminders. New accounts start empty.",
          )}
        </p>
      </details>
      <details>
        <summary>{uiText("Where are verification emails?")}</summary>
        <p>
          {uiText(
            "In this local build, open the local inbox at localhost:58025. Real email delivery will be configured before deployment.",
          )}
        </p>
      </details>
      <details>
        <summary>{uiText("What if I forget my password?")}</summary>
        <p>
          {uiText(
            "Use Forgot password. You need both the emailed link and your saved recovery key. Without a password, usable passkey, remembered device or recovery key, your care content cannot be recovered by support.",
          )}
        </p>
      </details>
      <details>
        <summary>{uiText("Can we use this for a diagnosis?")}</summary>
        <p>
          {uiText(
            "No. Activities support gentle practice. They do not identify brain damage, measure dementia severity, or prove that neuron damage has slowed. Speak to a qualified clinician about symptoms or treatment.",
          )}
        </p>
      </details>
      <details>
        <summary>{uiText("Privacy notice — local development build")}</summary>
        <p>
          {uiText(
            "Care content and images are encrypted in your browser before storage. The service stores email addresses, authentication verifiers, membership links and usage metadata. It has no routine decryption key. An unlocked device or a malicious software update can still expose content.",
          )}
        </p>
        <p>
          {uiText(
            "Remembered sign-in stores an encrypted key on this device. Sign out on shared devices. Invited caregivers can retain what they previously accessed even after their access is removed. Account deletion removes live owned records; backups must follow an agreed retention policy before launch.",
          )}
        </p>
        <p>
          {uiText(
            "No analytics or third-party crash tracker is installed. AI replies are generated on your device after you opt into a model download. Downloads contact the model hosting service; conversation text is not sent to it.",
          )}
        </p>
      </details>
      <details>
        <summary>{uiText("Report a problem privately")}</summary>
        <p>
          {uiText(
            "Describe the screen, action and error to the project maintainer. Never send a password, recovery key, invitation link, photos or medical information in a bug report. A public support address and legal terms must be configured before launch.",
          )}
        </p>
        <button
          className="secondary"
          onClick={() => {
            const url = URL.createObjectURL(
              new Blob(
                [
                  JSON.stringify(
                    {
                      app: "SmritiSaathi",
                      version: "1.0.0-local",
                      online: navigator.onLine,
                      issue: "Describe the issue without personal information",
                    },
                    null,
                    2,
                  ),
                ],
                { type: "application/json" },
              ),
            );
            const a = document.createElement("a");
            a.href = url;
            a.download = "SmritiSaathi-feedback-template.json";
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          {uiText("Download safe feedback template")}
        </button>
      </details>
      <p className="muted small">
        {uiText(
          "Version 1.0.0-local · Not a medical device · Not publicly deployed",
        )}
      </p>
    </section>
  );
}
