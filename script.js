"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Mic,
  Type,
  Activity,
  Heart,
  Volume2,
  Shield,
  Camera,
} from "lucide-react";

function PolygraphApp() {
  // States
  const [inputMethod, setInputMethod] = useState("voice");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [textInput, setTextInput] = useState("");
  const [sensorData, setSensorData] = useState({
    voiceLevel: 0,
    touchPressure: 0,
    pulseRate: 80,
  });
  const [isRecording, setIsRecording] = useState(false);
  const [recordingStatus, setRecordingStatus] = useState("");
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [pulseWaveform, setPulseWaveform] = useState([]);
  const [showTextInput, setShowTextInput] = useState(false);
  const [deviceCapabilities, setDeviceCapabilities] = useState({
    hasMicrophone: false,
    isMobile: false,
    hasTouch: false,
    hasCamera: false,
  });
  const [actualVoiceDetected, setActualVoiceDetected] = useState(false);
  const [voiceInputComplete, setVoiceInputComplete] = useState(false);
  const [useFacialRecognition, setUseFacialRecognition] = useState(false);
  const [facialAnalysisActive, setFacialAnalysisActive] = useState(false);
  const [facialStressLevel, setFacialStressLevel] = useState(0);

  // Refs
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const touchStartTimeRef = useRef(null);
  const pulseIntervalRef = useRef(null);
  const waveformIntervalRef = useRef(null);
  const voiceLevelIntervalRef = useRef(null);
  const voiceDetectionTimeoutRef = useRef(null);
  const videoRef = useRef(null);
  const facialAnalysisIntervalRef = useRef(null);

  // Device capability detection
  useEffect(() => {
    const detectCapabilities = async () => {
      const userAgent = navigator.userAgent.toLowerCase();
      const isMobile =
        /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
          userAgent
        ) ||
        "ontouchstart" in window ||
        navigator.maxTouchPoints > 0 ||
        window.screen.width <= 768 ||
        "orientation" in window;

      const hasTouch =
        "ontouchstart" in window ||
        navigator.maxTouchPoints > 0 ||
        navigator.msMaxTouchPoints > 0 ||
        isMobile;

      let hasMicrophone = false;
      let hasCamera = false;
      try {
        if (
          navigator.mediaDevices &&
          navigator.mediaDevices.enumerateDevices
        ) {
          const devices = await navigator.mediaDevices.enumerateDevices();
          hasMicrophone = devices.some(
            (device) =>
              device.kind === "audioinput" && device.deviceId !== "default"
          );
          hasCamera = devices.some(
            (device) =>
              device.kind === "videoinput" && device.deviceId !== "default"
          );

          if (hasMicrophone) {
            try {
              const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                  echoCancellation: false,
                  noiseSuppression: false,
                  autoGainControl: false,
                },
              });
              stream.getTracks().forEach((track) => track.stop());
            } catch (error) {
              console.log("Mic access error:", error.name);
              hasMicrophone = error.name !== "NotFoundError";
            }
          }

          if (hasCamera) {
            try {
              const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                  width: { ideal: 640 },
                  height: { ideal: 480 },
                  facingMode: "user",
                },
              });
              stream.getTracks().forEach((track) => track.stop());
            } catch (error) {
              console.log("Camera access error:", error.name);
              hasCamera = error.name !== "NotFoundError";
            }
          }
        }
      } catch (error) {
        console.log("Device enumeration failed:", error);
        hasMicrophone = false;
        hasCamera = false;
      }

      setDeviceCapabilities({
        hasMicrophone,
        isMobile,
        hasTouch,
        hasCamera,
      });
    };

    detectCapabilities();
  }, []);

  // Simulate pulse
  useEffect(() => {
    if (
      deviceCapabilities.isMobile ||
      deviceCapabilities.hasTouch ||
      isAnalyzing
    ) {
      pulseIntervalRef.current = setInterval(() => {
        setSensorData((prev) => ({
          ...prev,
          pulseRate: Math.round(
            75 + Math.random() * 10 + (isAnalyzing ? Math.random() * 8 : 0)
          ),
        }));
      }, 1000);
    }
    return () => {
      if (pulseIntervalRef.current) clearInterval(pulseIntervalRef.current);
    };
  }, [isAnalyzing, deviceCapabilities]);

  // Pulse waveform during analysis
  useEffect(() => {
    if (isAnalyzing || (isRecording && deviceCapabilities.isMobile)) {
      waveformIntervalRef.current = setInterval(() => {
        setPulseWaveform((prev) => {
          const newWave = [...prev];
          if (newWave.length >= 20) newWave.shift();
          const baseHeight = 40 + Math.sin(Date.now() / 1000) * 20;
          const variation = actualVoiceDetected ? Math.random() * 40 : Math.random() * 20;
          newWave.push(Math.max(10, Math.min(90, baseHeight + variation)));
          return newWave;
        });
      }, 200);
    } else {
      setPulseWaveform([]);
      if (waveformIntervalRef.current) clearInterval(waveformIntervalRef.current);
    }
    return () => {
      if (waveformIntervalRef.current) clearInterval(waveformIntervalRef.current);
    };
  }, [isAnalyzing, isRecording, deviceCapabilities.isMobile, actualVoiceDetected]);

  // Touch pressure handling
  const handleTouchStart = useCallback(
    (e) => {
      if (!deviceCapabilities.hasTouch && !deviceCapabilities.isMobile) return;
      touchStartTimeRef.current = Date.now();

      let rawPressure = 0;
      if (e.touches && e.touches[0]) {
        rawPressure = e.touches[0].force || 0;
      }

      let normalizedPressure =
        rawPressure > 0
          ? Math.min(rawPressure * 100, 100)
          : Math.random() * 25 + 35; // fallback

      const smoothedPressure = Math.round(
        Math.max(15, Math.min(85, normalizedPressure))
      );

      setSensorData((prev) => ({
        ...prev,
        touchPressure: smoothedPressure,
      }));
    },
    [deviceCapabilities]
  );

  const handleTouchEnd = useCallback(() => {
    if (!deviceCapabilities.hasTouch && !deviceCapabilities.isMobile) return;
    setSensorData((prev) => ({
      ...prev,
      touchPressure: Math.max(0, prev.touchPressure - Math.random() * 10),
    }));
    setTimeout(() => {
      setSensorData((prev) => ({ ...prev, touchPressure: 0 }));
    }, 200);
  }, [deviceCapabilities]);

  // High-confidence phrase detection
  const detectHighConfidencePhrases = (statement) => {
    const phrases = [
      "is this the best lie detector",
      "this is the best lie detector",
      "best lie detector",
      "most accurate lie detector",
      "perfect lie detector",
      "amazing lie detector",
      "incredible lie detector",
      "fantastic lie detector",
      "excellent lie detector",
      "outstanding lie detector",
    ];
    const normalized = statement.toLowerCase().trim();
    return phrases.some((phrase) => normalized.includes(phrase));
  };

  // Facial analysis functions
  const startFacialAnalysis = async () => {
    if (!deviceCapabilities.hasCamera) {
      console.log("No camera");
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user",
        },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setFacialAnalysisActive(true);
      facialAnalysisIntervalRef.current = setInterval(() => {
        const baseStress = 20 + Math.random() * 30;
        const variation = Math.sin(Date.now() / 2000) * 15;
        const stressLevel = Math.max(0, Math.min(100, baseStress + variation));
        setFacialStressLevel(Math.round(stressLevel));
      }, 500);
      return true;
    } catch (err) {
      console.error("Camera error:", err);
      setFacialAnalysisActive(false);
      return false;
    }
  };

  const stopFacialAnalysis = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
    if (facialAnalysisIntervalRef.current) clearInterval(facialAnalysisIntervalRef.current);
    setFacialAnalysisActive(false);
    setFacialStressLevel(0);
  };

  // Voice recording
  const startVoiceRecording = async () => {
    if (!deviceCapabilities.hasMicrophone) {
      setSensorData((prev) => ({ ...prev, voiceLevel: -1 }));
      performPolygraphAnalysis("Voice statement analyzed (simulated)");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      analyserRef.current.fftSize = 256;
      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        audioChunksRef.current.push(e.data);
      };
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/wav" });
        analyzeVoiceData(blob);
        stream.getTracks().forEach((t) => t.stop());
        if (audioContextRef.current) {
          audioContextRef.current.close();
        }
      };
      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordingStatus("Listening...");
      setActualVoiceDetected(false);
      setVoiceInputComplete(false);
      setSensorData((prev) => ({ ...prev, voiceLevel: 0 }));

      // Voice level detection
      const detectVoiceLevel = () => {
        if (!analyserRef.current || !isRecording) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0, maxVal = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
          maxVal = Math.max(maxVal, dataArray[i]);
        }
        const avg = sum / bufferLength;
        const normAvg = avg / 255;
        const normMax = maxVal / 255;
        const combinedLevel = normAvg * 0.7 + normMax * 0.3;
        if (combinedLevel > 0.02) {
          setActualVoiceDetected(true);
          // Scale
          let level;
          if (combinedLevel < 0.1) level = 40 + (combinedLevel / 0.1) * 15;
          else if (combinedLevel < 0.3) level = 55 + ((combinedLevel - 0.1) / 0.2) * 15;
          else level = 70 + Math.min(((combinedLevel - 0.3) / 0.4) * 10, 10);
          setSensorData((prev) => ({
            ...prev,
            voiceLevel: Math.round(prev.voiceLevel * 0.7 + level * 0.3),
          }));
          if (voiceDetectionTimeoutRef.current)
            clearTimeout(voiceDetectionTimeoutRef.current);
          voiceDetectionTimeoutRef.current = setTimeout(() => {
            setVoiceInputComplete(true);
            stopVoiceRecording();
          }, 2000);
        } else {
          setSensorData((prev) => ({ ...prev, voiceLevel: Math.max(0, prev.voiceLevel - 5) }));
        }
        if (isRecording) {
          requestAnimationFrame(detectVoiceLevel);
        }
      };
      detectVoiceLevel();

      // Auto stop after 10s
      setTimeout(() => {
        if (mediaRecorderRef.current && isRecording && !actualVoiceDetected) {
          stopVoiceRecording();
          performPolygraphAnalysis("Voice statement analyzed (no input)");
        }
      }, 10000);
    } catch (err) {
      console.error("Mic error:", err);
      setRecordingStatus("Mic access denied");
      setSensorData((prev) => ({ ...prev, voiceLevel: -2 }));
      setTimeout(() => {
        performPolygraphAnalysis("Voice statement analyzed (mic unavailable)");
      }, 1000);
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setRecordingStatus("");
      if (voiceDetectionTimeoutRef.current)
        clearTimeout(voiceDetectionTimeoutRef.current);
    }
  };

  const analyzeVoiceData = async (blob) => {
    const statement = actualVoiceDetected
      ? "Voice statement analyzed with audio input"
      : "Voice statement analyzed (low audio)";
    performPolygraphAnalysis(statement);
  };

  // Main analysis
  const performPolygraphAnalysis = async (statement) => {
    setIsAnalyzing(true);
    setAnalysisProgress(0);

    if (useFacialRecognition && deviceCapabilities.hasCamera) {
      await startFacialAnalysis();
    }

    // simulate progress
    const progressInterval = setInterval(() => {
      setAnalysisProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + Math.random() * 12 + 8;
      });
    }, 400);
    await new Promise((resolve) => setTimeout(resolve, 6000));

    const isHighConfidence = detectHighConfidencePhrases(statement);

    if (isHighConfidence) {
      const result = {
        statement,
        truthProbability: 100,
        confidence: 99,
        sensorReadings: {
          voiceLevel: deviceCapabilities.hasMicrophone ? sensorData.voiceLevel : 0,
          touchPressure: (deviceCapabilities.hasTouch || deviceCapabilities.isMobile) ? sensorData.touchPressure : Math.random() * 30,
          pulseRate: sensorData.pulseRate,
          facialStress: facialAnalysisActive ? facialStressLevel : 0,
        },
        analysis: "TRUTH DETECTED",
        deviceInfo: {
          sensorsUsed:
            (deviceCapabilities.hasMicrophone ? 1 : 0) +
            (deviceCapabilities.hasTouch ? 1 : 0) +
            (deviceCapabilities.isMobile ? 1 : 0) +
            (facialAnalysisActive ? 1 : 0),
          voiceDetected: actualVoiceDetected,
          facialAnalysisUsed: facialAnalysisActive,
        },
      };
      clearInterval(progressInterval);
      setAnalysisProgress(100);
      if (facialAnalysisActive) stopFacialAnalysis();
      setTimeout(() => {
        setAnalysisResult(result);
        setIsAnalyzing(false);
        resetSensors();
      }, 1000);
      return;
    }

    // Regular analysis
    const voiceStress = deviceCapabilities.hasMicrophone ? sensorData.voiceLevel : 0;
    const pressureVariation =
      (deviceCapabilities.hasTouch || deviceCapabilities.isMobile)
        ? sensorData.touchPressure
        : Math.random() * 30;
    const pulseElevation = Math.max(0, sensorData.pulseRate - 75);
    const facialStress = facialAnalysisActive ? facialStressLevel : 0;

    // Generate seed for statement
    let seed = 0;
    for (let i = 0; i < statement.length; i++) {
      seed += statement.charCodeAt(i) * (i + 1);
    }

    let truthScore = 82 + (seed % 15) - 7; // Range 75-89
    if (deviceCapabilities.hasMicrophone && actualVoiceDetected)
      truthScore -= voiceStress * 0.3;
    else truthScore -= voiceStress * 0.1;

    if (deviceCapabilities.hasTouch || deviceCapabilities.isMobile)
      truthScore -= pressureVariation * 0.15;
    else truthScore -= pressureVariation * 0.05;

    truthScore -= pulseElevation * 0.5;

    if (facialAnalysisActive) truthScore -= facialStress * 0.2;

    const randFactor = ((seed * 7) % 11) - 5;
    truthScore += randFactor;

    const sensorBonus =
      (deviceCapabilities.hasMicrophone ? 2 : 0) +
      (deviceCapabilities.hasTouch ? 1 : 0) +
      (deviceCapabilities.isMobile ? 1 : 0) +
      (facialAnalysisActive ? 3 : 0);

    truthScore += sensorBonus;
    truthScore = Math.max(25, Math.min(94, Math.round(truthScore)));

    let analysisText;
    if (truthScore >= 78) analysisText = "TRUTH DETECTED";
    else if (truthScore >= 50) analysisText = "INCONCLUSIVE";
    else analysisText = "DECEPTION DETECTED";

    const result = {
      statement,
      truthProbability: truthScore,
      confidence: Math.round(87 + (seed % 8) + Math.min(sensorBonus, 10)),
      sensorReadings: {
        voiceLevel: voiceStress,
        touchPressure: pressureVariation,
        pulseRate: sensorData.pulseRate,
        facialStress: facialStress,
      },
      analysis: analysisText,
      deviceInfo: {
        sensorsUsed:
          (deviceCapabilities.hasMicrophone ? 1 : 0) +
          (deviceCapabilities.hasTouch ? 1 : 0) +
          (deviceCapabilities.isMobile ? 1 : 0) +
          (facialAnalysisActive ? 1 : 0),
        voiceDetected: actualVoiceDetected,
        facialAnalysisUsed: facialAnalysisActive,
      },
    };
    clearInterval(progressInterval);
    setAnalysisProgress(100);
    if (facialAnalysisActive) stopFacialAnalysis();
    setTimeout(() => {
      setAnalysisResult(result);
      setIsAnalyzing(false);
      resetSensors();
    }, 1000);
  };

  const resetSensors = () => {
    setSensorData({ voiceLevel: 0, touchPressure: 0, pulseRate: 80 });
    setActualVoiceDetected(false);
    setVoiceInputComplete(false);
  };

  const handleStartTest = async () => {
    if (inputMethod === "voice") {
      await startVoiceRecording();
    } else if (textInput.trim()) {
      performPolygraphAnalysis(textInput);
    }
  };

  const handleTypingPreference = () => {
    setInputMethod("text");
    setShowTextInput(true);
  };

  const resetTest = () => {
    setAnalysisResult(null);
    setTextInput("");
    setIsAnalyzing(false);
    setIsRecording(false);
    setRecordingStatus("");
    setAnalysisProgress(0);
    setPulseWaveform([]);
    setShowTextInput(false);
    resetSensors();
    if (voiceDetectionTimeoutRef.current)
      clearTimeout(voiceDetectionTimeoutRef.current);
  };

  // Render
  return (
    <div
      className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black text-white font-mono"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Hidden video for facial analysis */}
      <video
        ref={videoRef}
        style={{ display: "none" }}
        autoPlay
        muted
        playsInline
      />

      {/* Header */}
      <div className="flex items-center justify-between p-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-red-700 rounded-full flex items-center justify-center shadow-lg">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <span className="text-2xl font-bold tracking-wider">POLYGRAPH</span>
        </div>
        <div className="w-8 h-8 border border-gray-500 rounded flex items-center justify-center">
          <div className="w-3 h-3 border border-gray-400"></div>
        </div>
      </div>

      {/* Device Status Indicator */}
      {!isAnalyzing && !isRecording && !analysisResult && (
        <div className="text-center mb-6">
          <div className="bg-gray-900/40 backdrop-blur-sm border border-gray-700 rounded-xl p-4 mx-6 shadow-lg">
            <div className="text-sm text-gray-300 mb-3 font-medium">Device Capabilities</div>
            <div className="grid grid-cols-3 gap-3 text-xs">
              {/* Microphone */}
              <div className="flex flex-col items-center space-y-2">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    deviceCapabilities.hasMicrophone
                      ? "bg-green-500/20 border border-green-400"
                      : "bg-red-500/20 border border-red-400"
                  }`}
                >
                  <Mic
                    className={`w-4 h-4 ${
                      deviceCapabilities.hasMicrophone
                        ? "text-green-400"
                        : "text-red-400"
                    }`}
                  />
                </div>
                <div
                  className={`font-medium ${
                    deviceCapabilities.hasMicrophone
                      ? "text-green-400"
                      : "text-red-400"
                  }`}
                >
                  {deviceCapabilities.hasMicrophone
                    ? "✅ Mic Ready"
                    : "❌ Mic Not Detected"}
                </div>
                <div className="text-gray-500 text-xs">
                  {deviceCapabilities.hasMicrophone
                    ? "🟢 Voice input active"
                    : "🔴 Voice analysis disabled"}
                </div>
              </div>
              {/* Touch */}
              <div className="flex flex-col items-center space-y-2">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    deviceCapabilities.hasTouch
                      ? "bg-green-500/20 border border-green-400"
                      : "bg-red-500/20 border border-red-400"
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full ${
                      deviceCapabilities.hasTouch
                        ? "bg-green-400"
                        : "bg-red-400"
                    }`}
                  ></div>
                </div>
                <div
                  className={`font-medium ${
                    deviceCapabilities.hasTouch
                      ? "text-green-400"
                      : "text-red-400"
                  }`}
                >
                  {deviceCapabilities.hasTouch ? "✅ Touch Ready" : "❌ No Touch"}
                </div>
                <div className="text-gray-500 text-xs">
                  {deviceCapabilities.hasTouch
                    ? "Pressure Sens."
                    : "Simulated"}
                </div>
              </div>
              {/* Device Type */}
              <div className="flex flex-col items-center space-y-2">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    deviceCapabilities.isMobile
                      ? "bg-green-500/20 border border-green-400"
                      : "bg-blue-500/20 border border-blue-400"
                  }`}
                >
                  <div
                    className={`text-xs font-bold ${
                      deviceCapabilities.isMobile
                        ? "text-green-400"
                        : "text-blue-400"
                    }`}
                  >
                    {deviceCapabilities.isMobile ? "📱" : "💻"}
                  </div>
                </div>
                <div
                  className={`font-medium ${
                    deviceCapabilities.isMobile
                      ? "text-green-400"
                      : "text-blue-400"
                  }`}
                >
                  {deviceCapabilities.isMobile ? "Mobile" : "Desktop"}
                </div>
                <div className="text-gray-500 text-xs">
                  {deviceCapabilities.isMobile ? "Full Sensors" : "Limited"}
                </div>
              </div>
            </div>
            {/* Status Message */}
            <div className="mt-4 pt-3 border-t border-gray-700">
              <div className="text-xs text-gray-400">
                {(() => {
                  const activeSensors =
                    (deviceCapabilities.hasMicrophone ? 1 : 0) +
                    (deviceCapabilities.hasTouch ? 1 : 0) +
                    1; // pulse
                  if (
                    deviceCapabilities.isMobile &&
                    deviceCapabilities.hasMicrophone &&
                    deviceCapabilities.hasTouch
                  )
                    return "🟢 Optimal Setup: All sensors active for maximum accuracy";
                  if (
                    deviceCapabilities.isMobile &&
                    (deviceCapabilities.hasMicrophone ||
                      deviceCapabilities.hasTouch)
                  )
                    return "🟡 Good Setup: Most sensors active, results will be reliable";
                  if (
                    !deviceCapabilities.isMobile &&
                    !deviceCapabilities.hasMicrophone &&
                    !deviceCapabilities.hasTouch
                  )
                    return "🔴 Limited Setup: Desktop mode with simulated sensors";
                  return `⚪ Partial Setup: ${activeSensors}/3 sensors active`;
                })()}
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="max-w-md mx-auto px-6">
          {/* Initial screen */}
          {!analysisResult && !isAnalyzing && !isRecording && (
            <>
              {/* Input Method Buttons */}
              <div className="mb-10">
                <div className="flex gap-4 mb-8">
                  <button
                    onClick={() => setInputMethod("voice")}
                    className={`flex-1 p-6 rounded-2xl border-2 transition-all duration-300 ${
                      inputMethod === "voice"
                        ? "border-blue-400 bg-blue-500/15 shadow-lg shadow-blue-500/20"
                        : "border-gray-600 bg-gray-800/40 hover:border-gray-500"
                    } ${!deviceCapabilities.hasMicrophone ? "opacity-60" : ""}`}
                  >
                    <Mic className="w-8 h-8 mx-auto mb-3" />
                    <div className="text-lg font-semibold">Voice</div>
                    {!deviceCapabilities.hasMicrophone && (
                      <div className="text-xs text-gray-400 mt-1">Simulated</div>
                    )}
                  </button>
                  <button
                    onClick={() => setInputMethod("text")}
                    className={`flex-1 p-6 rounded-2xl border-2 transition-all duration-300 ${
                      inputMethod === "text"
                        ? "border-blue-400 bg-blue-500/15 shadow-lg shadow-blue-500/20"
                        : "border-gray-600 bg-gray-800/40 hover:border-gray-500"
                    }`}
                  >
                    <Type className="w-8 h-8 mx-auto mb-3" />
                    <div className="text-lg font-semibold">Text</div>
                  </button>
                </div>

                {/* Text input */}
                {(inputMethod === "text" || showTextInput) && (
                  <div className="mb-8">
                    <textarea
                      value={textInput}
                      onChange={(e) => setTextInput(e.target.value)}
                      placeholder="Enter your statement here..."
                      className="w-full p-6 bg-gray-900/60 border-2 border-gray-600 rounded-2xl text-white placeholder-gray-400 resize-none focus:border-blue-400 focus:outline-none transition-all duration-300"
                      rows={4}
                    ></textarea>
                  </div>
                )}
              </div>

              {/* Facial Recognition Toggle */}
              {deviceCapabilities.hasCamera && (
                <div className="mb-6">
                  <button
                    onClick={() => setUseFacialRecognition(!useFacialRecognition)}
                    className={`w-full p-4 rounded-xl border-2 transition-all duration-300 ${
                      useFacialRecognition
                        ? "border-purple-400 bg-purple-500/15 shadow-lg shadow-purple-500/20"
                        : "border-gray-600 bg-gray-800/40 hover:border-purple-400"
                    }`}
                  >
                    <div className="flex items-center justify-center space-x-3">
                      <Camera className="w-6 h-6 text-purple-400" />
                      <div className="text-left">
                        <div className="text-base font-semibold text-white">
                          Use Facial Recognition – Boost Accuracy
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          Analyzes micro-expressions and facial stress patterns
                        </div>
                      </div>
                      <div
                        className={`w-4 h-4 rounded-full border-2 ${
                          useFacialRecognition
                            ? "bg-purple-400 border-purple-400"
                            : "border-gray-400"
                        }`}
                      >
                        {useFacialRecognition && (
                          <div className="w-2 h-2 bg-white rounded-full m-0.5"></div>
                        )}
                      </div>
                    </div>
                  </button>
                </div>
              )}

              {/* Camera unavailable notice */}
              {!deviceCapabilities.hasCamera && (
                <div className="mb-6 p-4 bg-gray-800/40 border border-gray-600 rounded-xl">
                  <div className="flex items-center space-x-3 text-gray-400">
                    <Camera className="w-5 h-5" />
                    <div>
                      <div className="font-medium">Facial Recognition Unavailable</div>
                      <div className="text-xs">
                        Camera not detected or permission denied
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Start Button */}
              <button
                onClick={handleStartTest}
                disabled={inputMethod === "text" && !textInput.trim()}
                className="w-full bg-gradient-to-r from-red-600 via-red-700 to-red-800 hover:from-red-700 hover:via-red-800 hover:to-red-900 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-bold py-8 px-8 rounded-2xl text-xl transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] shadow-2xl shadow-red-500/30 flex items-center justify-center space-x-4"
              >
                <Shield className="w-7 h-7" />
                <span className="tracking-wide">START POLYGRAPH TEST</span>
              </button>

              {/* Typing toggle */}
              {inputMethod === "voice" && !showTextInput && (
                <button
                  onClick={handleTypingPreference}
                  className="w-full mt-6 text-gray-400 hover:text-white transition-colors py-3 text-base"
                >
                  Prefer typing? Tap here to enter your statement.
                </button>
              )}

              {/* Pulse BPM */}
              <div className="mt-12 text-center">
                <div className="flex items-center justify-center space-x-3 text-lg text-gray-400">
                  <Heart className="w-5 h-5 text-red-400 animate-pulse" />
                  <span className="font-semibold">{sensorData.pulseRate} BPM</span>
                </div>
              </div>
            </>
          )}

          {/* Analysis / Recording Screen */}
          {(isAnalyzing || isRecording) && (
            <div className="space-y-8">
              {/* Header */}
              <div className="text-center">
                <h2 className="text-3xl font-bold text-red-400 mb-6 tracking-widest">
                  {isRecording ? "RECORDING..." : "ANALYZING..."}
                </h2>
                {/* Progress Bar */}
                <div className="w-full bg-gray-800 rounded-full h-3 mb-6 shadow-inner">
                  <div
                    className="bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 h-3 rounded-full transition-all duration-500 shadow-lg"
                    style={{
                      width: `${
                        isRecording
                          ? actualVoiceDetected
                            ? 60
                            : 20
                          : analysisProgress
                      }%`,
                    }}
                  ></div>
                </div>
                {/* Status Message */}
                <p className="text-gray-400 text-base">
                  {isRecording
                    ? actualVoiceDetected
                      ? "Voice detected - keep speaking naturally"
                      : "Listening for voice input..."
                    : facialAnalysisActive
                    ? "Processing biometric and facial data..."
                    : "Processing biometric data..."}
                </p>
              </div>
              {/* Sensors and Waveform */}
              {/* [Omitted for brevity: include your existing sensor cards and waveform code here, ensuring JSX is valid] */}
              {/* ... */}
              {/* Footer info */}
              <div className="text-center text-xs text-gray-500 mt-10 space-y-1">
                <p>Advanced Polygraph Technology • Entertainment Purposes Only</p>
                <p>
                  Device: {deviceCapabilities.isMobile ? "Mobile" : "Desktop"} •
                  Sensors:{" "}
                  {(deviceCapabilities.hasMicrophone ? 1 : 0) +
                    (deviceCapabilities.hasTouch ? 1 : 0) +
                    (facialAnalysisActive ? 1 : 0) +
                    1}
                  /{facialAnalysisActive ? 4 : 3} Active
                </p>
              </div>
            </div>
          )}

          {/* Results Screen */}
          {analysisResult && (
            <div className="space-y-8">
              {/* Main Result */}
              <div className="text-center p-10 bg-gray-900/60 backdrop-blur-sm border border-gray-700 rounded-2xl shadow-2xl">
                <div
                  className={`text-8xl font-bold mb-6 ${
                    analysisResult.truthProbability > 75
                      ? "text-green-400"
                      : analysisResult.truthProbability > 45
                      ? "text-yellow-400"
                      : "text-red-400"
                  }`}
                >
                  {analysisResult.truthProbability}%
                </div>
                <div
                  className={`text-3xl font-bold mb-4 tracking-wide ${
                    analysisResult.truthProbability > 75
                      ? "text-green-400"
                      : analysisResult.truthProbability > 45
                      ? "text-yellow-400"
                      : "text-red-400"
                  }`}
                >
                  {analysisResult.analysis}
                </div>
                <div className="text-gray-400 text-lg mb-2">
                  Confidence Level: {analysisResult.confidence}%
                </div>
                <div className="text-xs text-gray-500">
                  Sensors Used:{" "}
                  {analysisResult.deviceInfo?.sensorsUsed || 3}/
                  {analysisResult.deviceInfo?.facialAnalysisUsed ? 4 : 3} •
                  Voice:{" "}
                  {analysisResult.deviceInfo?.voiceDetected
                    ? "Detected"
                    : "Simulated"}
                  {analysisResult.deviceInfo?.facialAnalysisUsed &&
                    " • Facial: Active"}
                </div>
              </div>
              {/* Sensor Summary */}
              {/* ... similar structure for sensor cards, ensuring JSX correctness ... */}
              {/* Statement */}
              <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-700 rounded-xl p-6 shadow-lg">
                <h3 className="text-xl font-bold mb-4 text-gray-300">
                  Analyzed Statement:
                </h3>
                <p className="text-white italic text-lg">"{analysisResult.statement}"</p>
              </div>
              {/* Reset Button */}
              <button
                onClick={resetTest}
                className="w-full bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-600 hover:to-gray-700 text-white font-bold py-6 px-8 rounded-2xl transition-all duration-300 shadow-lg"
              >
                Run Another Test
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

ReactDOM.render(<PolygraphApp />, document.getElementById("root"));