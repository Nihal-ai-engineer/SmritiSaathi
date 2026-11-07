import { translate as uiText } from "./i18n";
import { useEffect, useState } from "react";
export default function ConnectionStatus() {
  const [offline, setOffline] = useState(!navigator.onLine);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    addEventListener("online", update);
    addEventListener("offline", update);
    return () => {
      removeEventListener("online", update);
      removeEventListener("offline", update);
    };
  }, []);
  return offline ? (
    <div className="global-notice" role="status">
      {uiText(
        "You’re offline. Loaded games still work. Saving, photos and sign-in need your local server connection.",
      )}
    </div>
  ) : null;
}
