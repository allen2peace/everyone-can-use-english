import { useEffect, useContext, useState } from "react";
import { MediaPlayerProviderContext } from "@renderer/context";
import {
  MediaProvider,
  MediaTranscription,
  MediaInfoPanel,
  MediaRecordings,
} from "@renderer/components";
import { ScrollArea } from "@renderer/components/ui";
import { t } from "i18next";

export const MediaTabs = () => {
  const { media, decoded } = useContext(MediaPlayerProviderContext);
  const [tab, setTab] = useState("provider");

  useEffect(() => {
    if (!decoded) return;

    setTab("transcription");
  }, [decoded]);

  if (!media) return null;

  return (
    <ScrollArea className="h-full">
      //这三个是顶部的tab切换按钮,分别是 语音文本 、我的练习 和 资源信息
      <div
        className={`p-1 bg-muted rounded-t-lg mb-2 text-sm sticky top-0 z-[1] grid gap-4 ${media?.mediaType === "Video" ? "grid-cols-4" : "grid-cols-3"
          }`}
      >
        {media.mediaType === "Video" && (
          <div
            className={`rounded cursor-pointer px-2 py-1 text-sm text-center capitalize truncate ${tab === "provider" ? "bg-background" : ""
              }`}
            onClick={() => setTab("provider")}
          >
            {t("player")}
          </div>
        )}

        <div
          className={`rounded cursor-pointer px-2 py-1 text-sm text-center capitalize truncate ${tab === "transcription" ? "bg-background" : ""
            }`}
          onClick={() => setTab("transcription")}
        >
          {t("transcription")}
        </div>
        <div
          className={`rounded cursor-pointer px-2 py-1 text-sm text-center capitalize truncate ${tab === "recordings" ? "bg-background" : ""
            }`}
          onClick={() => setTab("recordings")}
        >
          {t("myRecordings")}
        </div>
        <div
          className={`rounded cursor-pointer px-2 py-1 text-sm text-center capitalize truncate ${tab === "info" ? "bg-background" : ""
            }`}
          onClick={() => setTab("info")}
        >
          {t("mediaInfo")}
        </div>
      </div>

      <div className={tab === "provider" ? "" : "hidden"}>
        <MediaProvider />//视频的时候显示的是播放器
      </div>
      <div className={tab === "recordings" ? "" : "hidden"}>
        <MediaRecordings />//我的练习内容
      </div>
      <div className={tab === "transcription" ? "" : "hidden"}>
        <MediaTranscription />//语音文本内容
      </div>
      <div className={tab === "info" ? "" : "hidden"}>
        <MediaInfoPanel />//资源信息内容
      </div>
    </ScrollArea>
  );
};
