import { Button, toast, Input, Label } from "@renderer/components/ui";
import { useContext, useEffect, useState } from "react";
import { AppSettingsProviderContext } from "@renderer/context";
import { t } from "i18next";

export const EmailLoginForm = () => {
  const [activeCode, setActiveCode] = useState<string>("");
  const [code, setCode] = useState<string>("");
  const [codeSent, setCodeSent] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number>(0);
  const { login, webApi } = useContext(AppSettingsProviderContext);

  useEffect(() => {
    let timeout: NodeJS.Timeout;

    if (countdown > 0) {
      timeout = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
    }

    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [countdown]);

  return (
    <div className="w-full">
      <div className="w-full grid gap-4 mb-6">
        <div className="grid gap-2">
        <Label htmlFor="text">{t("activeCode")}</Label>
          <Input
            id="activeCode"
            className="h-10"
            type="email"
            placeholder="m@example.com"
            required
            value={activeCode}
            disabled={countdown > 0}
            onChange={(e) => setActiveCode(e.target.value)}
          />
        </div>

        <div className="grid gap-2 hidden">
          <Label htmlFor="code">{t("verificationCode")}</Label>
          <Input
            id="code"
            className="h-10"
            type="text"
            required
            minLength={5}
            maxLength={5}
            placeholder={t("verificationCode")}
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <Button
          variant="secondary"
          size="lg"
          className="w-full hidden"
          disabled={!activeCode || countdown > 0}
          onClick={() => {
            webApi
              .loginCode({ email:activeCode })
              .then(() => {
                toast.success(t("codeSent"));
                setCodeSent(true);
                setCountdown(120);
              })
              .catch((err) => {
                toast.error(err.message);
              });
          }}
        >
          {countdown > 0 && <span className="mr-2">{countdown}</span>}
          <span>{codeSent ? t("resend") : t("sendCode")}</span>
        </Button>

        <Button
          variant="default"
          size="lg"
          className="w-full"
          disabled={!activeCode || activeCode.length < 5}
          onClick={() => {
            webApi
              .auth({ provider: "activeCode", activeCode:activeCode })
              .then((user) => {
                if (user?.id && user?.accessToken) {
                  login(user);
                } else {
                  toast.error(user.name);
                }
              })
              .catch((err) => {
                toast.error(err.message);
              });
          }}
        >
          {t("login")}
        </Button>
      </div>
    </div>
  );
};
