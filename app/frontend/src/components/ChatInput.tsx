import { useState, useRef, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { Send, Plus, Square, Mic, MicOff, FileText, Image, FolderOpen, FileArchive, Link, Tag, X, Loader2 } from "lucide-react";
import { api } from "@/services/api";

interface Props {
  placeholder?: string;
  onSend?: (msg: string, attachments?: File[]) => void;
  onStop?: () => void;
  isGenerating?: boolean;
}

const FILE_TYPE_GROUPS = {
  docs: [
    '.txt', '.md', '.rst', '.log', '.json', '.yaml', '.yml', '.toml', '.xml', '.csv', '.tsv', '.ini', '.env',
    '.pdf', '.doc', '.docx', '.rtf', '.odt', '.ppt', '.pptx', '.odp', '.xls', '.xlsx', '.ods'
  ],
  images: [
    '.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.tiff', '.svg', '.ico'
  ],
  code: [
    '.py', '.js', '.jsx', '.ts', '.tsx', '.java', '.go', '.rs', '.cpp', '.c', '.cs', '.php', '.rb', '.swift', '.kt', '.sql', '.html', '.css'
  ],
  archives: [
    '.zip', '.7z', '.tar', '.gz', '.bz2'
  ],
  audio: [
    '.mp3', '.wav', '.m4a', '.flac'
  ],
  video: [
    '.mp4', '.mov', '.mkv', '.avi', '.webm'
  ],
  data: [
    '.parquet', '.sqlite', '.db'
  ]
};

const ALL_EXTENSIONS = Object.values(FILE_TYPE_GROUPS).flat();

const attachmentTypes = [
  { icon: FileText, label: "Document", tag: "docs", accept: FILE_TYPE_GROUPS.docs.join(','), color: "text-gray-400" },
  { icon: Image, label: "Image", tag: "images", accept: FILE_TYPE_GROUPS.images.join(','), color: "text-emerald-400" },
  { icon: FolderOpen, label: "Folder", tag: "folder", accept: "", directory: true, color: "text-amber-400" },
  { icon: FileArchive, label: "ZIP Archive", tag: "archive", accept: FILE_TYPE_GROUPS.archives.join(','), color: "text-purple-400" },
  { icon: Link, label: "Link / URL", tag: "link", accept: "", color: "text-gray-400" },
  { icon: Tag, label: "All Files", tag: "tagged", accept: ALL_EXTENSIONS.join(','), color: "text-rose-400" },
];

function getFileTypeInfo(file: File) {
  const ext = '.' + file.name.split('.').pop()?.toLowerCase();

  if (FILE_TYPE_GROUPS.archives.includes(ext)) {
    return { icon: '📦', label: 'Zip Archive', color: 'bg-purple-500/10 border-purple-500/20', isImage: false };
  }
  if (FILE_TYPE_GROUPS.images.includes(ext)) {
    return { icon: '🖼️', label: 'Image', color: 'bg-emerald-500/10 border-emerald-500/20', isImage: true };
  }
  if (FILE_TYPE_GROUPS.code.includes(ext)) {
    return { icon: '💻', label: 'Code File', color: 'bg-gray-500/10 border-gray-500/20', isImage: false };
  }
  if (FILE_TYPE_GROUPS.docs.includes(ext)) {
    return { icon: '📄', label: 'Document', color: 'bg-gray-500/10 border-gray-500/20', isImage: false };
  }
  if (FILE_TYPE_GROUPS.audio.includes(ext)) {
    return { icon: '🎵', label: 'Audio', color: 'bg-pink-500/10 border-pink-500/20', isImage: false };
  }
  if (FILE_TYPE_GROUPS.video.includes(ext)) {
    return { icon: '🎬', label: 'Video', color: 'bg-red-500/10 border-red-500/20', isImage: false };
  }
  if (file.name.endsWith('.url')) {
    return { icon: '🔗', label: 'Link', color: 'bg-gray-500/10 border-gray-500/20', isImage: false };
  }

  return { icon: '📄', label: 'File', color: 'bg-gray-500/10 border-gray-500/20', isImage: false };
}

function ImagePreview({ file }: { file: File }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  if (!src) return <div className="w-14 h-14 bg-secondary rounded-md animate-pulse" />;
  return <img src={src} alt={file.name} className="w-14 h-14 object-cover rounded-md border border-border" />;
}

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export function ChatInput({ placeholder = "Type a message...", onSend, onStop, isGenerating }: Props) {
  const [value, setValue] = useState("");
  const [attachOpen, setAttachOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const attachRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentAcceptRef = useRef<string>("");
  const isDirectoryRef = useRef<boolean>(false);
  const recognitionRef = useRef<any>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const params = useParams<{ projectId?: string; pid?: string }>();
  const projectName = params.projectId || params.pid || "";

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (attachRef.current && !attachRef.current.contains(event.target as Node)) {
        setAttachOpen(false);
      }
    };

    if (attachOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [attachOpen]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch {} }
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, []);

  const handleSend = () => {
    if (value.trim() || attachments.length > 0) {
      onSend?.(value.trim(), attachments);
      setValue("");
      setAttachments([]);
      setShowLinkInput(false);
      setLinkUrl("");
    }
  };

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch {} recognitionRef.current = null; }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try { mediaRecorderRef.current.stop(); } catch {}
    }
    if (mediaStreamRef.current) {
      try { mediaStreamRef.current.getTracks().forEach(t => t.stop()); } catch {}
      mediaStreamRef.current = null;
    }
    if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
    setIsRecording(false);
    setIsTranscribing(false);
    setRecordingSeconds(0);
  }, []);

  const startMediaRecorder = useCallback(async () => {
    if (!projectName) {
      alert("Voice input requires an active project.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      alert("Voice input is not supported in this environment.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const mimeCandidates = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
      const mimeType = mimeCandidates.find(m => MediaRecorder.isTypeSupported(m)) || "";
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        setIsRecording(false);
        if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
        setRecordingSeconds(0);
        const chunks = audioChunksRef.current;
        audioChunksRef.current = [];
        if (mediaStreamRef.current) {
          try { mediaStreamRef.current.getTracks().forEach(t => t.stop()); } catch {}
          mediaStreamRef.current = null;
        }
        if (chunks.length === 0) { setIsTranscribing(false); return; }
        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        const ext = (recorder.mimeType || "audio/webm").includes("mp4") ? "m4a" : "webm";
        const file = new File([blob], `voice_${Date.now()}.${ext}`, { type: blob.type });
        setIsTranscribing(true);
        try {
          const result = await api.media.transcribeUpload(projectName, file);
          const text = (result?.transcription?.text || result?.text || "").trim();
          if (text) setValue(prev => (prev ? prev + " " : "") + text);
        } catch (err: any) {
          alert("Transcription failed: " + (err?.message || String(err)));
        } finally {
          setIsTranscribing(false);
        }
      };
      recorder.start();
      setIsRecording(true);
      setIsTranscribing(false);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => setRecordingSeconds(s => s + 1), 1000);
    } catch (err: any) {
      alert("Microphone access denied or unavailable: " + (err?.message || String(err)));
      if (mediaStreamRef.current) {
        try { mediaStreamRef.current.getTracks().forEach(t => t.stop()); } catch {}
        mediaStreamRef.current = null;
      }
    }
  }, [projectName]);

  const toggleRecording = useCallback(() => {
    if (isRecording) { stopRecording(); return; }

    const isElectron = !!(window as any).cubosDesktop || /Electron/i.test(navigator.userAgent);
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    // SpeechRecognition does not work reliably in Electron; prefer MediaRecorder there.
    if (isElectron || !SpeechRecognition) {
      void startMediaRecorder();
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    let finalTranscript = '';

    recognition.onstart = () => {
      setIsRecording(true);
      setIsTranscribing(false);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => setRecordingSeconds(s => s + 1), 1000);
    };

    recognition.onresult = (event: any) => {
      setIsTranscribing(true);
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalTranscript += t + ' ';
        else interim += t;
      }
      setValue(finalTranscript + interim);
    };

    recognition.onerror = () => stopRecording();
    recognition.onend = () => { stopRecording(); setValue(prev => prev.trimEnd()); };

    recognitionRef.current = recognition;
    recognition.start();
  }, [isRecording, stopRecording, startMediaRecorder]);

  const handleAttachmentClick = async (type: typeof attachmentTypes[0]) => {
    if (type.tag === 'link') {
      setShowLinkInput(true);
      setAttachOpen(false);
      return;
    }

    setAttachOpen(false);

    if ((window as any).cubosDesktop?.showOpenDialog) {
      const isDir = type.directory || false;
      const result = await (window as any).cubosDesktop.showOpenDialog({
        title: `Select ${type.label}`,
        properties: isDir ? ['openDirectory', 'multiSelections'] : ['openFile', 'multiSelections'],
        filters: type.accept
          ? [{ name: type.label, extensions: type.accept.split(',').map((e: string) => e.replace('.', '').trim()).filter(Boolean) }]
          : [],
      });
      if (!result.canceled && result.filePaths.length > 0) {
        const electronFiles: File[] = [];
        for (const p of result.filePaths) {
          const name = p.split(/[\\/]/).pop() || p;
          const ext = '.' + name.split('.').pop()?.toLowerCase();
          const isImage = FILE_TYPE_GROUPS.images.includes(ext);
          if (isImage && (window as any).cubosDesktop?.readFileBase64) {
            const res = await (window as any).cubosDesktop.readFileBase64(p);
            if (res?.ok && res.data) {
              const mimeMap: Record<string, string> = {
                '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
                '.gif': 'image/gif', '.webp': 'image/webp', '.bmp': 'image/bmp',
                '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.tiff': 'image/tiff',
              };
              const mimeType = mimeMap[ext] || 'image/png';
              const byteChars = atob(res.data);
              const bytes = new Uint8Array(byteChars.length);
              for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
              electronFiles.push(new File([bytes], name, { type: mimeType }));
              continue;
            }
          }
          electronFiles.push(new File([], name, { type: '' }));
          (window as any)._cubosElectronFilePaths = [...((window as any)._cubosElectronFilePaths || []), p];
        }
        setAttachments(prev => [...prev, ...electronFiles]);
        const nonImagePaths = result.filePaths.filter((p: string) => {
          const n = p.split(/[\\/]/).pop() || p;
          const e = '.' + n.split('.').pop()?.toLowerCase();
          return !FILE_TYPE_GROUPS.images.includes(e);
        });
        if (nonImagePaths.length > 0) {
          (window as any)._cubosElectronFilePaths = [...((window as any)._cubosElectronFilePaths || []), ...nonImagePaths];
        }
      }
      return;
    }

    currentAcceptRef.current = type.accept;
    isDirectoryRef.current = type.directory || false;

    if (fileInputRef.current) {
      fileInputRef.current.accept = type.accept;
      if (type.directory) {
        (fileInputRef.current as any).webkitdirectory = true;
      } else {
        (fileInputRef.current as any).webkitdirectory = false;
      }
      fileInputRef.current.click();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setAttachments(prev => [...prev, ...Array.from(files)]);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleLinkAdd = () => {
    if (linkUrl.trim()) {
      const linkFile = new File([linkUrl], `link_${Date.now()}.url`, { type: 'text/uri-list' });
      setAttachments(prev => [...prev, linkFile]);
      setLinkUrl("");
      setShowLinkInput(false);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const formatSeconds = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <div className="border-t border-border bg-background p-4">
      {attachments.length > 0 && (
        <div className="max-w-3xl mx-auto mb-2 flex flex-wrap gap-2">
          {attachments.map((file, index) => {
            const fileInfo = getFileTypeInfo(file);
            return (
              <div
                key={index}
                className={`relative flex items-center gap-2 ${fileInfo.color} border text-foreground text-xs rounded-lg overflow-hidden ${fileInfo.isImage ? 'p-1' : 'px-3 py-2'}`}
              >
                {fileInfo.isImage ? (
                  <div className="flex flex-col items-center gap-1">
                    <ImagePreview file={file} />
                    <span className="text-[10px] text-muted-foreground max-w-[56px] truncate text-center px-1">{file.name}</span>
                  </div>
                ) : (
                  <>
                    <span className="text-base">{fileInfo.icon}</span>
                    <div className="flex flex-col">
                      <span className="font-medium max-w-[200px] truncate">{file.name}</span>
                      <span className="text-[10px] text-muted-foreground">{fileInfo.label}</span>
                    </div>
                  </>
                )}
                <button
                  onClick={() => removeAttachment(index)}
                  className={`${fileInfo.isImage ? 'absolute top-0.5 right-0.5' : 'ml-1'} hover:text-destructive p-0.5 hover:bg-background/50 rounded`}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {showLinkInput && (
        <div className="max-w-3xl mx-auto mb-2 flex items-center gap-2 bg-secondary p-2 rounded-lg">
          <input
            type="text"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleLinkAdd(); }}
            placeholder="Enter URL..."
            className="flex-1 bg-background border border-border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            autoFocus
          />
          <button onClick={handleLinkAdd} className="px-3 py-1.5 bg-primary text-primary-foreground rounded text-xs hover:opacity-90">Add</button>
          <button onClick={() => { setShowLinkInput(false); setLinkUrl(""); }} className="p-1.5 hover:bg-background rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {isRecording && (
        <div className="max-w-3xl mx-auto mb-2 flex items-center gap-3 bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-2.5">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
            <span className="text-[12px] font-medium text-destructive">Recording</span>
          </div>
          <span className="text-[11px] text-muted-foreground font-mono">{formatSeconds(recordingSeconds)}</span>
          {isTranscribing && (
            <div className="flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
              <span className="text-[11px] text-muted-foreground">Transcribing…</span>
            </div>
          )}
          <div className="flex items-center gap-0.5 ml-auto">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="w-0.5 rounded-full bg-destructive animate-bounce" style={{ height: `${6 + (i % 3) * 4}px`, animationDelay: `${i * 0.1}s` }} />
            ))}
          </div>
          <button onClick={stopRecording} className="ml-2 text-[11px] text-destructive hover:text-destructive/80 font-medium">Stop</button>
        </div>
      )}

      <div className="flex items-end gap-2 max-w-3xl mx-auto relative">
        <input ref={fileInputRef} type="file" multiple onChange={handleFileSelect} className="hidden" />

        <div className="relative" ref={attachRef}>
          <button
            onClick={() => setAttachOpen(!attachOpen)}
            className={`flex-shrink-0 p-2 rounded-lg transition-colors ${attachOpen ? "bg-secondary text-foreground" : "hover:bg-secondary text-muted-foreground hover:text-foreground"}`}
          >
            <Plus className={`w-4 h-4 transition-transform duration-200 ${attachOpen ? "rotate-45" : ""}`} />
          </button>

          {attachOpen && (
            <div className="absolute bottom-full left-0 mb-2 bg-card border border-border rounded-xl shadow-lg overflow-hidden animate-scale-in origin-bottom-left z-50">
              <div className="p-2 min-w-[200px]">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium px-2 py-1 block">Attach</span>
                <div className="mt-1 space-y-0.5">
                  {attachmentTypes.map((type) => (
                    <button
                      key={type.tag}
                      onClick={() => handleAttachmentClick(type)}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[12px] text-foreground hover:bg-secondary/70 transition-colors"
                    >
                      <type.icon className={`w-3.5 h-3.5 ${type.color}`} />
                      <span>{type.label}</span>
                      <span className="ml-auto text-[9px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded-md font-mono">{type.tag}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder={isRecording ? "Listening…" : placeholder}
          rows={1}
          className="flex-1 resize-none rounded-lg bg-surface border border-border px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring/30 transition-all"
        />

        <button
          onClick={toggleRecording}
          className={`flex-shrink-0 p-2 rounded-lg transition-all ${isRecording ? "bg-destructive text-destructive-foreground" : "hover:bg-secondary text-muted-foreground hover:text-foreground"}`}
          title={isRecording ? "Stop recording" : "Voice input"}
        >
          {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>

        {isGenerating ? (
          <button onClick={onStop} className="flex-shrink-0 p-2 rounded-lg bg-destructive text-destructive-foreground hover:opacity-90 transition-all" title="Stop generating">
            <Square className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!value.trim() && attachments.length === 0}
            className="flex-shrink-0 p-2 rounded-lg bg-foreground text-background hover:opacity-90 transition-all disabled:opacity-30"
          >
            <Send className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
