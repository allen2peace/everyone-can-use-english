import {
  AppSettingsProviderContext,
  AISettingsProviderContext,
} from "@renderer/context";
import OpenAI from "openai";
import { useContext } from "react";
import { t } from "i18next";
import { AI_WORKER_ENDPOINT } from "@/constants";
import * as sdk from "microsoft-cognitiveservices-speech-sdk";
import axios from "axios";
import { AlignmentResult } from "echogarden/dist/api/API.d.js";
import { useAiCommand } from "./use-ai-command";

export const useTranscribe = () => {
  const { EnjoyApp, user, webApi } = useContext(AppSettingsProviderContext);
  const { whisperConfig, openai } = useContext(AISettingsProviderContext);
  const { punctuateText } = useAiCommand();

  //把传入的 audio 转化为 wav 格式
  const transcode = async (src: string | Blob): Promise<string> => {
    console.log(`transcode-- src== ${src}`);
    if (src instanceof Blob) {
      console.log(`transcode-- src instanceof Blob== ${src}`);
      src = await EnjoyApp.cacheObjects.writeFile(
        `${Date.now()}.${src.type.split("/")[1].split(";")[0]}`,
        await src.arrayBuffer()
      );
    }
    console.log(`transcode-- src22== ${src}`);
    const output = await EnjoyApp.echogarden.transcode(src);
    console.log(`transcode-- output== ${output}`);
    return output;
  };

  //把传入的 audio 转化为 wav 格式，再传给 openai 或者 local 去语音转文本；
  //然后把生成文本和 audio 文件传入align 方法中对齐；
  const transcribe = async (
    mediaSrc: string,
    params?: {
      targetId?: string;
      targetType?: string;
      originalText?: string;
    }
  ): Promise<{
    engine: string;
    model: string;
    alignmentResult: AlignmentResult;
    originalText?: string;
  }> => {
    console.log(`transcribe mediaSrc== ${mediaSrc}`);
    const url = await transcode(mediaSrc);
    console.log(`transcribe url== ${url}`);
    const { targetId, targetType, originalText } = params || {};
    console.log(`transcribe url== ${url}, targetId== ${targetId}, targetType== ${targetType}, originalText== ${originalText}`);
    const blob = await (await fetch(url)).blob();
  console.log(`transcribe url== ${url}, service== ${whisperConfig.service}, originalText== ${originalText}`);
    let result;
    if (originalText) {
      result = {
        engine: "original",
        model: "original",
      };
    } else if (whisperConfig.service === "local") {
      result = await transcribeByLocal(url);
    } else if (whisperConfig.service === "cloudflare") {
      result = await transcribeByCloudflareAi(blob);
    } else if (whisperConfig.service === "openai") {
      result = await transcribeByOpenAi(blob);
    } else if (whisperConfig.service === "azure") {
      result = await transcribeByAzureAi(blob, { targetId, targetType });
    } else {
      throw new Error(t("whisperServiceNotSupported"));
    }
    console.log(`after transcribe result==${result}, originalText==${originalText}`)
    let transcript = originalText || result.text;
    // if the transcript does not contain any punctuation, use AI command to add punctuation
    if (!transcript.match(/\w[.,!?](\s|$)/)) {
      try {
        transcript = await punctuateText(transcript);
      } catch (err) {
        console.warn(err.message);
      }
    }
    console.log(`before align transcript==${transcript}`)
    const alignmentResult = await EnjoyApp.echogarden.align(
      new Uint8Array(await blob.arrayBuffer()),
      transcript
    );
    console.log(`after align alignmentResult==${alignmentResult}`)

    return {
      ...result,
      originalText,
      alignmentResult,
    };
  };

  const transcribeByLocal = async (url: string) => {
    const res = await EnjoyApp.whisper.transcribe(
      {
        file: url,
      },
      {
        force: true,
        extra: ["--prompt", `"Hello! Welcome to listen to this audio."`],
      }
    );

    return {
      engine: "whisper",
      model: res.model.type,
      text: res.transcription.map((segment) => segment.text).join(" "),
    };
  };

  const transcribeByOpenAi = async (blob: Blob) => {
    if (!openai?.key) {
      throw new Error(t("openaiKeyRequired"));
    }

    const client = new OpenAI({
      apiKey: openai.key,
      baseURL: openai.baseUrl,
      dangerouslyAllowBrowser: true,
    });

    const res: { text: string } = (await client.audio.transcriptions.create({
      file: new File([blob], "audio.wav"),
      model: "whisper-1",
      response_format: "json",
    })) as any;

    return {
      engine: "openai",
      model: "whisper-1",
      text: res.text,
    };
  };

  const transcribeByCloudflareAi = async (blob: Blob) => {
    const res: CfWhipserOutputType = (
      await axios.postForm(`${AI_WORKER_ENDPOINT}/audio/transcriptions`, blob, {
        headers: {
          Authorization: `Bearer ${user.accessToken}`,
        },
        timeout: 1000 * 60 * 5,
      })
    ).data;

    return {
      engine: "cloudflare",
      model: "@cf/openai/whisper",
      text: res.text,
    };
  };

  const transcribeByAzureAi = async (
    blob: Blob,
    params?: {
      targetId?: string;
      targetType?: string;
    }
  ): Promise<{
    engine: string;
    model: string;
    text: string;
  }> => {
    const { token, region } = await webApi.generateSpeechToken(params);
    const config = sdk.SpeechConfig.fromAuthorizationToken(token, region);
    const audioConfig = sdk.AudioConfig.fromWavFileInput(
      new File([blob], "audio.wav")
    );
    // setting the recognition language to English.
    config.speechRecognitionLanguage = "en-US";
    config.requestWordLevelTimestamps();
    config.outputFormat = sdk.OutputFormat.Detailed;

    // create the speech recognizer.
    const reco = new sdk.SpeechRecognizer(config, audioConfig);

    let results: SpeechRecognitionResultType[] = [];

    return new Promise((resolve, reject) => {
      reco.recognizing = (_s, e) => {
        console.log(e.result.text);
      };

      reco.recognized = (_s, e) => {
        const json = e.result.properties.getProperty(
          sdk.PropertyId.SpeechServiceResponse_JsonResult
        );
        const result = JSON.parse(json);
        results = results.concat(result);
      };

      reco.canceled = (_s, e) => {
        if (e.reason === sdk.CancellationReason.Error) {
          return reject(new Error(e.errorDetails));
        }

        reco.stopContinuousRecognitionAsync();
      };

      reco.sessionStopped = (_s, _e) => {
        reco.stopContinuousRecognitionAsync();

        resolve({
          engine: "azure",
          model: "whisper",
          text: results.map((result) => result.DisplayText).join(' '),
        });
      };

      reco.startContinuousRecognitionAsync();
    });
  };

  return {
    transcode,
    transcribe,
  };
};
