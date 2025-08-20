"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useEdgeStore } from "@/lib/edgestore";
import emailjs from "@emailjs/browser";
import { Mic, Play, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export default function VoiceRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isAgreed, setIsAgreed] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendStatus, setSendStatus] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const { edgestore } = useEdgeStore();

  useEffect(() => {
    // Initialize EmailJS
    if (process.env.NEXT_PUBLIC_EMAILJS_USER_ID) {
      emailjs.init(process.env.NEXT_PUBLIC_EMAILJS_USER_ID);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      const chunks: BlobPart[] = [];
      mediaRecorder.ondataavailable = (event) => {
        chunks.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/wav" });
        setAudioBlob(blob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      setSendStatus(null);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error("Error accessing microphone:", error);
      setSendStatus({
        success: false,
        message: "خطأ في الوصول إلى الميكروفون",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const playRecording = () => {
    if (audioBlob && !isPlaying) {
      const audioUrl = URL.createObjectURL(audioBlob);
      audioRef.current = new Audio(audioUrl);
      audioRef.current.play();
      setIsPlaying(true);

      audioRef.current.onended = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(audioUrl);
      };
    }
  };

  const refreshRecording = () => {
    setAudioBlob(null);
    setRecordingTime(0);
    setIsPlaying(false);
    setSendStatus(null);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const sendRecording = async () => {
    if (!audioBlob || !isAgreed) return;

    setIsSending(true);
    setSendStatus(null);

    const audioFile = new File([audioBlob], "recording.wav", {
      type: "audio/wav",
      lastModified: Date.now(),
    });

    const res = await edgestore.publicFiles.upload({
      file: audioFile,
      options: {},
    });

    console.log(res);

    const download_link = res.url;

    try {
      await emailjs.send(
        process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID || "",
        process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID || "",
        {
          download_link,
        }
      );

      setSendStatus({
        success: true,
        message: "تم إرسال التسجيل بنجاح!",
      });
    } catch (error) {
      console.error("Error sending email:", error);
      setSendStatus({
        success: false,
        message: "فشل إرسال التسجيل. يرجى المحاولة مرة أخرى.",
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="lg:max-w-[500px] mx-auto w-full overflow-hidden bg-black text-white p-8 rounded-lg">
      {/* Arabic Quote */}
      <div className="text-right mb-8 max-w-sm">
        <div className="text-4xl text-right">&quot;</div>
        <p className="text-3xl leading-relaxed text-center -mt-7" dir="rtl">
          وش تفكر فيه وأنت تسوق؟
        </p>
        <div className="text-4xl text-left">&quot;</div>
      </div>

      {/* Microphone Button */}
      <div className="flex justify-center mb-6">
        <button
          onClick={toggleRecording}
          className={`w-20 h-20 rounded-full flex items-center justify-center transition-colors ${
            isRecording
              ? "bg-red-500 hover:bg-red-600"
              : "bg-gray-300 hover:bg-gray-400"
          }`}
        >
          <Mic
            className={`w-8 h-8 ${
              isRecording ? "text-white" : "text-gray-700"
            }`}
          />
        </button>
      </div>

      {/* Timer */}
      <div className="text-center mb-6">
        <span className="text-lg font-mono">{formatTime(recordingTime)}</span>
      </div>

      {/* Status Message */}
      {sendStatus && (
        <div
          className={`mb-4 p-3 rounded text-center ${
            sendStatus.success
              ? "bg-green-800 text-green-100"
              : "bg-red-800 text-red-100"
          }`}
        >
          {sendStatus.message}
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center justify-between mb-8">
        {/* Play Button */}
        <button
          onClick={playRecording}
          disabled={!audioBlob || isPlaying}
          className="flex items-center gap-2 disabled:opacity-50"
        >
          <Play className="w-6 h-6" />
        </button>

        {/* Progress Bar */}
        <div className="flex-1 mx-4">
          <div className="w-full h-2 bg-gray-600 rounded-full">
            <div
              className="h-full bg-gray-300 rounded-full transition-all duration-300"
              style={{ width: audioBlob ? "100%" : "0%" }}
            />
          </div>
        </div>

        {/* Send Button */}
        <Button
          onClick={sendRecording}
          disabled={!isAgreed || !audioBlob || isSending}
          className={`px-6 py-2 rounded-lg transition-colors ${
            isAgreed && audioBlob && !isSending
              ? "bg-white text-black hover:bg-gray-200"
              : "bg-gray-600 text-gray-400 cursor-not-allowed"
          }`}
        >
          {isSending ? "جاري الإرسال..." : "ارسال"}
        </Button>
      </div>

      {/* Refresh Button */}
      <div className="flex justify-start mb-6">
        <button
          onClick={refreshRecording}
          className="text-gray-400 hover:text-white transition-colors"
        >
          <RotateCcw className="w-5 h-5" />
        </button>
      </div>

      {/* Checkbox and Agreement */}
      <div className="space-y-4">
        <div className="flex items-start gap-3" dir="rtl">
          <Checkbox
            id="agreement"
            checked={isAgreed}
            onCheckedChange={(checked) => setIsAgreed(checked as boolean)}
            className="mt-1 border-white/70"
          />
          <label
            htmlFor="agreement"
            className="text-sm leading-relaxed cursor-pointer"
          >
            أوافق
          </label>
        </div>

        <p className="text-xs text-gray-400 leading-relaxed" dir="rtl">
          بالضغط على إرسال، فإنك توافق على معالجة التسجيل الصوتي لتحسين تجربة
          المستخدم - قد يتم حفظ أو مراجعة أو حذف التسجيل حسب سياسة الخصوصية
        </p>
      </div>
    </div>
  );
}
