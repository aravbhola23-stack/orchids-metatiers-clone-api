"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Script from "next/script";

type Theme = "light" | "dark";
type Role = "user" | "assistant";

type ChatAttachment = {
  name: string;
  mimeType: string;
  dataBase64: string;
};

type ChatMessage = {
  id: string;
  role: Role;
  content: string;
  createdAt: string;
};

type QueuedPrompt = {
  text: string;
  attachments: ChatAttachment[];
};

type ModelProvider = "auto" | "codex" | "openrouter";

type ModelOption = {
  label: string;
  value: string;
  icon: string;
  provider: ModelProvider;
  modelId?: string;
};

type ChatSession = {
  id: string;
  title: string;
  messages: ChatMessage[];
  vfs: Record<string, string>;
  systemPrompt: string;
  updatedAt: string;
};

declare global {
  interface Window {
    marked?: { parse: (md: string) => string };
  }
}

const STORAGE_KEYS = {
  apiKey: "uai_openrouter_key",
  model: "uai_selected_model",
  theme: "uai_theme",
  chats: "uai_chats",
  activeChatId: "uai_active_chat_id",
  backendUrl: "uai_backend_url",
  globalSystemPrompt: "uai_global_system_prompt",
  modelId: "uai_custom_model_id",
};

const SUPPORT_EMAIL = "support@aiassistantallinone.com";
const STATUS_URL = "https://status.openrouter.ai/";
const CODEX_DEVICE_CODE_RE = /^[A-Z0-9]{4}-[A-Z0-9]{5}$/;

const BASE_MODEL_OPTIONS: ModelOption[] = [
  { label: "Auto (smart routing)", value: "auto", icon: "auto", provider: "auto" },
  { label: "ChatGPT Codex (connected account)", value: "codex-chatgpt", icon: "gpt", provider: "codex", modelId: "gpt-5.2-codex" },
  { label: "Llama 3.2 3B Instruct (Free)", value: "openrouter-llama-3.2-3b-free", icon: "llama", provider: "openrouter", modelId: "meta-llama/llama-3.2-3b-instruct:free" },
  { label: "GPT-4o Mini", value: "openrouter-gpt-4o-mini", icon: "gpt", provider: "openrouter", modelId: "openai/gpt-4o-mini" },
];

const MODEL_LOGO_URLS: Record<string, string> = {
  gpt: "https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/render/image/public/project-uploads/7746113a-94b4-445c-9e16-12fb2086c7cf/chat-gpt-logo-png-1771931924012.png?width=8000&height=8000&resize=contain",
  deepseek: "https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/render/image/public/project-uploads/7746113a-94b4-445c-9e16-12fb2086c7cf/deepseek-ai-logo-1771931987193.png?width=8000&height=8000&resize=contain",
};

const MODEL_ICON_STYLE: Record<string, { glyph: string; bg: string }> = {
  gemini: { glyph: "✦", bg: "linear-gradient(135deg, #1a73e8, #8e63ff)" },
  llama: { glyph: "L", bg: "linear-gradient(135deg, #0ea5e9, #2563eb)" },
  auto: { glyph: "A", bg: "linear-gradient(135deg, #6366f1, #8b5cf6)" },
};


const defaultVfs = (): Record<string, string> => ({
  "index.html": `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>My App</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <div class="container">
    <h1>Hello from Universal AI IDE</h1>
    <p>Ask the AI to build something amazing here.</p>
  </div>
  <script src="script.js"><\/script>
</body>
</html>`,
  "style.css": `* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: Inter, system-ui, sans-serif; background: #f8fafc; color: #0f172a; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
.container { text-align: center; padding: 2rem; }
h1 { font-size: 2.5rem; font-weight: 800; color: #4f46e5; margin-bottom: 1rem; }
p { color: #64748b; font-size: 1.1rem; }`,
  "script.js": `console.log('preview ready');`,
});

const createChat = (title = "New Chat"): ChatSession => ({
  id: crypto.randomUUID(),
  title,
  messages: [],
  vfs: defaultVfs(),
  systemPrompt: "",
  updatedAt: new Date().toISOString(),
});

const safeParse = <T,>(raw: string | null, fallback: T): T => {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; }
  catch { return fallback; }
};

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const modelOptionText = (option: ModelOption): string => option.label;

const AUTO_CANDIDATE_IDS = BASE_MODEL_OPTIONS
  .filter(m => m.provider === "openrouter")
  .map(m => m.modelId ?? m.value);

const MODEL_OPTION_BY_VALUE = new Map(BASE_MODEL_OPTIONS.map(option => [option.value, option]));

const resolveModelId = (selectedValue: string): string => {
  const option = MODEL_OPTION_BY_VALUE.get(selectedValue);
  if (!option) return selectedValue;
  return option.modelId ?? option.value;
};

const renderModelIcon = (icon: string, size = 16): React.ReactNode => {
  const logoUrl = MODEL_LOGO_URLS[icon];
  if (logoUrl) {
      return (
        <img
          src={logoUrl}
          alt=""
          aria-hidden
          referrerPolicy="no-referrer"
          draggable={false}
          style={{
            width: size,
            height: size,
            borderRadius: Math.max(4, Math.floor(size * 0.28)),
            objectFit: "contain",
            display: "block",
            flexShrink: 0,
          }}
        />
      );
  }

  const fallback = MODEL_ICON_STYLE[icon] ?? { glyph: "*", bg: "linear-gradient(135deg, #64748b, #475569)" };
  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: Math.max(4, Math.floor(size * 0.35)),
        background: fallback.bg,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        fontSize: Math.max(9, size * 0.58),
        fontWeight: 700,
        lineHeight: 1,
        flexShrink: 0,
      }}
    >
      {fallback.glyph}
    </span>
  );
};


const LEGACY_MODEL_VALUE_MAP: Record<string, string> = {
  "openai/gpt-5.3": "codex-chatgpt",
  "openai/gpt-5.2": "codex-chatgpt",
  "gpt-5.3": "codex-chatgpt",
  "gpt-5.2": "codex-chatgpt",
  "gpt-5.2-codex": "codex-chatgpt",
  "codex-gpt-5.3": "codex-chatgpt",
  "codex-gpt-5.2": "codex-chatgpt",
  "meta-llama/llama-3.2-3b-instruct:free": "openrouter-llama-3.2-3b-free",
  "openai/gpt-4o-mini": "openrouter-gpt-4o-mini",
};

const normalizeSelectedModelValue = (value: string): string => {
  if (MODEL_OPTION_BY_VALUE.has(value)) return value;
  return LEGACY_MODEL_VALUE_MAP[value] ?? "openrouter-llama-3.2-3b-free";
};

const pickAutoModel = (prompt: string, codexReady: boolean): string => {
  const n = prompt.toLowerCase();
  if (codexReady && /reason|math|analysis|think|plan|logic|code|debug|typescript|python|api|refactor|bug|error|html|css|js/.test(n)) {
    return "gpt-5.2-codex";
  }
  if (/image|vision|photo|screenshot/.test(n)) return "openai/gpt-4o-mini";
  return codexReady ? "gpt-5.2-codex" : "openai/gpt-4o-mini";
};

const buildPreviewHtml = (vfs: Record<string, string>): string => {
  let html = vfs["index.html"] || "<!DOCTYPE html><html><head></head><body></body></html>";
  const css = vfs["style.css"] || "";
  const js = vfs["script.js"] || "";
  html = html.includes("</head>") ? html.replace("</head>", `<style>${css}</style></head>`) : `<style>${css}</style>${html}`;
  html = html.includes("</body>") ? html.replace("</body>", `<script>${js}<\/script></body>`) : `${html}<script>${js}<\/script>`;
  return html;
};

const extractCodeBlocks = (markdown: string): Record<string, string> => {
  const regex = /```([\w./-]+)\n([\s\S]*?)```/g;
  const updates: Record<string, string> = {};
  let match: RegExpExecArray | null;
  while ((match = regex.exec(markdown)) !== null) {
    updates[match[1].trim()] = match[2];
  }
  return updates;
};

const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "").replace(/\x1b\[[0-9;]*[A-Za-z]/g, "");

const fileToAttachment = async (file: File): Promise<ChatAttachment> => {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
    reader.readAsDataURL(file);
  });
  const splitAt = dataUrl.indexOf(",");
  if (splitAt < 0) throw new Error(`Could not parse data URL for ${file.name}`);
  return {
    name: file.name,
    mimeType: file.type || "application/octet-stream",
    dataBase64: dataUrl.slice(splitAt + 1),
  };
};

const formatTime = (iso: string) => {
  try { return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
  catch { return ""; }
};

// ── Icons ────────────────────────────────────────────────────────────
const I = {
  Plus: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>,
  Send: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" /></svg>,
  Menu: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h18M3 6h18M3 18h18" /></svg>,
  X: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>,
  Settings: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>,
  Sun: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" /></svg>,
  Moon: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>,
  Code: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>,
  Eye: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>,
  Chat: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>,
  Trash: () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>,
  Edit: () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>,
  Copy: () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>,
    Upload: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 16 12 12 8 16" /><line x1="12" y1="12" x2="12" y2="21" /><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" /></svg>,
    Attach: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-8.49 8.49a5 5 0 0 1-7.07-7.07l9.19-9.19a3.5 3.5 0 1 1 4.95 4.95L9.76 18.49a2 2 0 1 1-2.83-2.83l8.49-8.48" /></svg>,
  Bot: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="10" rx="2" /><circle cx="12" cy="5" r="2" /><path d="M12 7v4M8 15h.01M16 15h.01" /></svg>,
  User: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>,
  Sparkle: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.3L12 17l-6.2 4.2 2.4-7.3L2 9.4h7.6z" /></svg>,
};

// ── Theme tokens ──────────────────────────────────────────────────────
function tokens(isDark: boolean) {
  return {
    bg: isDark ? "#07090f" : "#f3f6fb",
    bgSurface: isDark ? "#121827" : "#ffffff",
    bgCard: isDark ? "#171e2d" : "#ffffff",
    bgHover: isDark ? "#242e45" : "#edf2fb",
    bgSidebar: isDark ? "#0c111d" : "#eaf0f9",
    bgInput: isDark ? "#141c2b" : "#ffffff",
    bgUserMsg: isDark ? "#7489a8" : "#6a809f",
    bgAsstMsg: isDark ? "#161f30" : "#f8fbff",
    border: isDark ? "#33405a" : "#cfdaed",
    borderStrong: isDark ? "#46587a" : "#b7c8e3",
    text: isDark ? "#eef3fb" : "#0f1728",
    textMuted: isDark ? "#b1bfd7" : "#556784",
    textSubtle: isDark ? "#8fa0ba" : "#7f8fa7",
    primary: isDark ? "#c3d1e5" : "#5f789b",
    primaryHover: isDark ? "#b6c7de" : "#4d678c",
    danger: isDark ? "#f87171" : "#dc2626",
    dangerBg: isDark ? "#351919" : "#fef2f2",
    success: "#10b981",
    codePreBg: isDark ? "#0d1626" : "#1f2937",
  };
}

export default function Page() {
  const [initialized, setInitialized] = useState(false);
  const [theme, setTheme] = useState<Theme>("light");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<"chat" | "code" | "app">("chat");

  const [apiKey, setApiKey] = useState("");
  const [selectedModel, setSelectedModel] = useState("openrouter-llama-3.2-3b-free");
  const [customModelId, setCustomModelId] = useState("");
  const [backendUrl, setBackendUrl] = useState("/api/chat");
  const [globalSystemPrompt, setGlobalSystemPrompt] = useState("");

  const [chats, setChats] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState("");
  const [activeFile, setActiveFile] = useState("index.html");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState("");

  const [prompt, setPrompt] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const [queuedPrompts, setQueuedPrompts] = useState<QueuedPrompt[]>([]);
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachment[]>([]);
  const [lastModelDecision, setLastModelDecision] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<{ ok: boolean; message: string; url?: string } | null>(null);
  const [publishCustomDomain, setPublishCustomDomain] = useState("");
  const [downloadingCode, setDownloadingCode] = useState(false);

  const [codexCode, setCodexCode] = useState("");
  const [codexUrl, setCodexUrl] = useState("https://auth.openai.com/codex/device");
  const [codexStatus, setCodexStatus] = useState("");
  const [codexLoading, setCodexLoading] = useState(false);
  const [codexAuthed, setCodexAuthed] = useState(false);
  const [codexCooldownUntil, setCodexCooldownUntil] = useState(0);
  const [stickToBottom, setStickToBottom] = useState(true);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const codexCooldownTimerRef = useRef<number | null>(null);
  const codexStatusPollTimerRef = useRef<number | null>(null);

  const activeChat = useMemo(() => chats.find(c => c.id === activeChatId) ?? null, [chats, activeChatId]);
  const activeVfs = activeChat?.vfs ?? defaultVfs();
  const modelOptions = useMemo(
    () => BASE_MODEL_OPTIONS.map(option => ({ ...option })),
    []
  );
  const selectedOption = useMemo(
    () => modelOptions.find(option => option.value === selectedModel) ?? modelOptions[0],
    [modelOptions, selectedModel]
  );

  const T = tokens(theme === "dark");

  const updateActiveChat = (updater: (c: ChatSession) => ChatSession) =>
    setChats(prev => prev.map(c => c.id !== activeChatId ? c : { ...updater(c), updatedAt: new Date().toISOString() }));

  const appendToMsg = (msgId: string, chunk: string) =>
    setChats(prev => prev.map(c => c.id !== activeChatId ? c : {
      ...c, messages: c.messages.map(m => m.id === msgId ? { ...m, content: m.content + chunk } : m)
    }));


  const renderMarkdown = (md: string): string => {
    const clean = md.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "");
    if (typeof window !== "undefined" && window.marked) {
      try { return window.marked.parse(clean); } catch { /* */ }
    }
    return `<pre style="white-space:pre-wrap;word-break:break-word">${escapeHtml(clean)}</pre>`;
  };

  // ── Init ──
  useEffect(() => {
    const storedTheme = (localStorage.getItem(STORAGE_KEYS.theme) as Theme | null) ?? "light";
    const storedApiKey = localStorage.getItem(STORAGE_KEYS.apiKey) ?? "";
    const storedModel = normalizeSelectedModelValue(localStorage.getItem(STORAGE_KEYS.model) ?? "openrouter-llama-3.2-3b-free");
    // Always use the Next.js proxy — ignore any stale localhost URL in localStorage
    const storedBackend = "/api/chat";
    localStorage.setItem(STORAGE_KEYS.backendUrl, storedBackend);
    const storedGlobal = localStorage.getItem(STORAGE_KEYS.globalSystemPrompt) ?? "";
    const storedCustomModel = localStorage.getItem(STORAGE_KEYS.modelId) ?? "";

    const storedChats = safeParse<ChatSession[]>(localStorage.getItem(STORAGE_KEYS.chats), []);
    const hydratedChats = storedChats.length > 0 ? storedChats : [{
      ...createChat("Welcome"),
      messages: [{
        id: crypto.randomUUID(),
        role: "assistant" as Role,
        content: "## Hi! I'm your AI assistant\n\nI can build web apps, write code, explain concepts, and more.\n\n**Quick start:**\n1. Click **Settings** (top right) and paste your [OpenRouter API key](https://openrouter.ai/keys)\n2. Pick a model from the dropdown below — all free options work great\n3. Ask me to build something: *\"Build me a todo app\"*",
        createdAt: new Date().toISOString(),
      }],
    }];

    const storedActiveId = localStorage.getItem(STORAGE_KEYS.activeChatId);
    const safeActiveId = hydratedChats.some(c => c.id === storedActiveId) ? storedActiveId! : hydratedChats[0].id;

    setTheme(storedTheme);
    setApiKey(storedApiKey);
    setSelectedModel(storedModel);
    setCustomModelId(storedCustomModel);
    setBackendUrl(storedBackend);
    setGlobalSystemPrompt(storedGlobal);
    setChats(hydratedChats);
    setActiveChatId(safeActiveId);
    setSidebarOpen(window.innerWidth > 900);
    setInitialized(true);
  }, []);

  useEffect(() => {
    if (!initialized) return;
    localStorage.setItem(STORAGE_KEYS.theme, theme);
    document.documentElement.style.colorScheme = theme;
  }, [theme, initialized]);

  useEffect(() => { if (initialized) localStorage.setItem(STORAGE_KEYS.apiKey, apiKey); }, [apiKey, initialized]);
  useEffect(() => { if (initialized) localStorage.setItem(STORAGE_KEYS.model, selectedModel); }, [selectedModel, initialized]);
  useEffect(() => { if (initialized) localStorage.setItem(STORAGE_KEYS.modelId, customModelId); }, [customModelId, initialized]);
  useEffect(() => { if (initialized) localStorage.setItem(STORAGE_KEYS.backendUrl, backendUrl); }, [backendUrl, initialized]);
  useEffect(() => { if (initialized) localStorage.setItem(STORAGE_KEYS.globalSystemPrompt, globalSystemPrompt); }, [globalSystemPrompt, initialized]);
  useEffect(() => { if (initialized) localStorage.setItem(STORAGE_KEYS.chats, JSON.stringify(chats)); }, [chats, initialized]);
  useEffect(() => { if (initialized && activeChatId) localStorage.setItem(STORAGE_KEYS.activeChatId, activeChatId); }, [activeChatId, initialized]);

  useEffect(() => {
    if (!scrollRef.current || !stickToBottom) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [activeChat?.messages, stickToBottom]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      if (codexCooldownTimerRef.current !== null) {
        window.clearTimeout(codexCooldownTimerRef.current);
      }
      if (codexStatusPollTimerRef.current !== null) {
        window.clearInterval(codexStatusPollTimerRef.current);
      }
    };
  }, []);


  // ── Chat ops ──
  const newChat = () => {
    const c = createChat();
    setChats(p => [c, ...p]);
    setActiveChatId(c.id);
    setActiveFile("index.html");
  };

  const deleteChat = (id: string) => {
    setChats(prev => {
      if (prev.length <= 1) return prev;
      const filtered = prev.filter(c => c.id !== id);
      if (id === activeChatId) setActiveChatId(filtered[0].id);
      return filtered;
    });
  };

  const startRename = (chat: ChatSession) => {
    setRenamingId(chat.id);
    setRenameVal(chat.title);
  };

  const commitRename = () => {
    if (!renamingId) return;
    const val = renameVal.trim();
    if (val) setChats(p => p.map(c => c.id === renamingId ? { ...c, title: val } : c));
    setRenamingId(null);
  };

  const setActiveFileContent = (val: string) => {
    if (!activeChat) return;
    updateActiveChat(c => ({ ...c, vfs: { ...c.vfs, [activeFile]: val } }));
  };

  const addFile = () => {
    const name = window.prompt("New filename (e.g. utils.js)")?.trim();
    if (!name || !activeChat) return;
    updateActiveChat(c => c.vfs[name] !== undefined ? c : { ...c, vfs: { ...c.vfs, [name]: "" } });
    setActiveFile(name);
  };

  const removeFile = (name: string) => {
    if (!activeChat) return;
    const entries = Object.keys(activeChat.vfs);
    if (entries.length <= 1) {
      setError("At least one file must remain.");
      return;
    }
    updateActiveChat(c => { const v = { ...c.vfs }; delete v[name]; return { ...c, vfs: v }; });
    if (activeFile === name) {
      const fallback = entries.find(file => file !== name) ?? "index.html";
      setActiveFile(fallback);
    }
  };

  const copyText = (text: string, key: string) => {
    void navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(""), 1800);
  };

  const stopResponding = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsStreaming(false);
  };

  const onAttachmentPick = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const picked = Array.from(files);
    const invalid = picked.find(file => !file.type.startsWith("image/"));
    if (invalid) {
      setError(`Only image uploads are supported. Invalid: ${invalid.name}`);
      return;
    }
    try {
      const attachments = await Promise.all(picked.map(fileToAttachment));
      setPendingAttachments(prev => [...prev, ...attachments]);
      setError("");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to read attachment.";
      setError(msg);
    }
  };

  const removeAttachment = (index: number) => {
    setPendingAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const recommendModel = async (
    message: string,
    candidates: string[]
  ): Promise<{ model: string | null; reason: string }> => {
    try {
      const res = await fetch("/api/models/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, candidates, api_key: apiKey.trim() || undefined }),
      });
      const data = await res.json() as { recommended?: string; reason?: string; error?: string };
      if (!res.ok) {
        return {
          model: null,
          reason: data.error || "Could not auto-rank models.",
        };
      }
      return {
        model: data.recommended ?? null,
        reason: data.reason ?? "Best match for your request.",
      };
    } catch {
      return {
        model: null,
        reason: "Could not auto-rank models, using built-in fallback.",
      };
    }
  };

  const downloadCodeArchive = async () => {
    if (!activeChat || downloadingCode) return;
    setDownloadingCode(true);
    try {
      const res = await fetch("/api/code/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vfs: activeChat.vfs }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Failed to create zip." }));
        setPublishResult({ ok: false, message: data.error ?? "Failed to create zip." });
        return;
      }
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = "project-files.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
    } catch (e) {
      setPublishResult({ ok: false, message: e instanceof Error ? e.message : "Download failed" });
    } finally {
      setDownloadingCode(false);
    }
  };

  const publishToVercel = async () => {
    if (!activeChat || publishing) return;
    setPublishing(true);
    setPublishResult(null);
    try {
      const res = await fetch("/api/publish/vercel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vfs: activeChat.vfs,
          custom_domain: publishCustomDomain.trim() || undefined,
        }),
      });
      const data = await res.json() as { ok?: boolean; url?: string; output?: string; error?: string; domain_message?: string };
      if (!res.ok || !data.ok) {
        setPublishResult({ ok: false, message: data.error ?? data.output ?? "Deploy failed" });
        return;
      }
      const successMessage = data.domain_message?.trim()
        ? `Deployment successful. ${data.domain_message}`
        : "Deployment successful";
      setPublishResult({ ok: true, message: successMessage, url: data.url });
    } catch (e) {
      setPublishResult({ ok: false, message: e instanceof Error ? e.message : "Publish failed" });
    } finally {
      setPublishing(false);
    }
  };

  // ── Codex ──
  const startCodexStatusPolling = () => {
    if (codexStatusPollTimerRef.current !== null) {
      window.clearInterval(codexStatusPollTimerRef.current);
    }
    codexStatusPollTimerRef.current = window.setInterval(() => {
      void checkCodexStatus({ silentIfNotAuthed: true });
    }, 800);
    window.setTimeout(() => {
      if (codexStatusPollTimerRef.current !== null) {
        window.clearInterval(codexStatusPollTimerRef.current);
        codexStatusPollTimerRef.current = null;
      }
    }, 180000);
  };

  const startCodexConnect = async () => {
    if (codexLoading) return;

    const now = Date.now();
    if (now < codexCooldownUntil) {
      const seconds = Math.max(1, Math.ceil((codexCooldownUntil - now) / 1000));
      setCodexStatus(`Too many attempts. Please wait ${seconds}s before retrying Connect.`);
      return;
    }

    setCodexLoading(true);
    setCodexStatus("Requesting device code…");
    try {
        const res = await fetch("/api/codex/device-auth/start", { cache: "no-store" });
        const data = await res.json() as { code?: string; verification_url?: string; output?: string; authenticated?: boolean; retry_after_seconds?: number };
        const receivedCode = (data.code ?? "").trim().toUpperCase();
        const hasValidCode = CODEX_DEVICE_CODE_RE.test(receivedCode);
        if (!res.ok || !hasValidCode) {
          const message = stripAnsi(data.output || "Unable to start device auth. Is the Python server running?");
          const statusMessage = !res.ok
            ? message
            : (message || `Backend returned an invalid device code format (${receivedCode || "empty"}). Click Connect again.`);
          setCodexStatus(statusMessage);
          setCodexCode("");

          if (res.status === 429 || /429|too many|rate limit/i.test(message)) {
            const retryAfterSeconds = typeof data.retry_after_seconds === "number" && data.retry_after_seconds > 0
              ? data.retry_after_seconds
              : 60;
            const retryAfterMs = retryAfterSeconds * 1000;
            const until = Date.now() + retryAfterMs;
            setCodexCooldownUntil(until);
            if (codexCooldownTimerRef.current !== null) {
              window.clearTimeout(codexCooldownTimerRef.current);
            }
            codexCooldownTimerRef.current = window.setTimeout(() => {
              setCodexCooldownUntil(0);
            }, retryAfterMs);
          }
        } else {
          setCodexCode(receivedCode);
          setCodexUrl(data.verification_url || "https://auth.openai.com/codex/device");
          setCodexStatus("Enter this exact 9-character code at auth.openai.com/codex/device.");
          void checkCodexStatus({ silentIfNotAuthed: true });
          startCodexStatusPolling();
        }

    } catch {
      setCodexStatus("Could not reach the backend server.");
    } finally {
      setCodexLoading(false);
    }
  };

  const checkCodexStatus = async (opts?: { silentIfNotAuthed?: boolean }) => {
    try {
      const res = await fetch("/api/codex/status", { cache: "no-store" });
      const data = await res.json() as { authenticated?: boolean; message?: string; code?: string; verification_url?: string };
      const authenticated = Boolean(data.authenticated);
      setCodexAuthed(authenticated);
      if (authenticated) {
        setCodexStatus("Connected");
        setCodexCode("");
        if (codexStatusPollTimerRef.current !== null) {
          window.clearInterval(codexStatusPollTimerRef.current);
          codexStatusPollTimerRef.current = null;
        }
        return;
      }

      if (data.code) {
        setCodexCode(data.code);
      }
      if (data.verification_url) {
        setCodexUrl(data.verification_url);
      }

      if (!opts?.silentIfNotAuthed || data.code) {
        setCodexStatus(stripAnsi(data.message || "Not authenticated."));
      }
    } catch {
        if (!opts?.silentIfNotAuthed) {
          setCodexStatus("Cannot reach Python backend. Start backend on http://127.0.0.1:8000 (python3 main.py) or update PYTHON_BACKEND_URL.");
        }

    }
  };

  const disconnectCodex = async () => {
    setCodexLoading(true);
    try {
      const res = await fetch("/api/codex/disconnect", { method: "POST" });
      const data = await res.json() as { ok?: boolean; message?: string };
      if (!res.ok || !data.ok) {
        setCodexStatus(stripAnsi(data.message || "Failed to disconnect Codex."));
        return;
      }
      setCodexAuthed(false);
      setCodexCode("");
      setCodexStatus("Disconnected");
    } catch {
      setCodexStatus("Could not disconnect Codex.");
    } finally {
      setCodexLoading(false);
    }
  };

  useEffect(() => {
    if (!settingsOpen) return;
    void checkCodexStatus();
  }, [settingsOpen]);

  // ── Send message ──
  const processPrompt = async (content: string, attachments: ChatAttachment[]) => {
    if (!activeChat) return;

    const attachmentText = attachments.length > 0
      ? `\n\n[Attached images: ${attachments.map(a => a.name).join(", ")}]`
      : "";

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: `${content}${attachmentText}`,
      createdAt: new Date().toISOString(),
    };
    const asstMsg: ChatMessage = { id: crypto.randomUUID(), role: "assistant", content: "", createdAt: new Date().toISOString() };

    updateActiveChat(c => ({
      ...c,
      title: c.messages.length === 0 ? content.slice(0, 42) || c.title : c.title,
      messages: [...c.messages, userMsg, asstMsg],
    }));

      try {
        let resolvedModel = resolveModelId(selectedModel);
        let selectedProvider: ModelProvider = selectedOption?.provider ?? "openrouter";

        if (selectedModel === "auto") {
          const candidates = [...AUTO_CANDIDATE_IDS];
          if (codexAuthed) {
            candidates.unshift("gpt-5.2-codex");
          }
          const customId = customModelId.trim();
          if (customId) candidates.unshift(customId);
          const recommendation = await recommendModel(content, candidates);
          resolvedModel = recommendation.model ?? pickAutoModel(content, codexAuthed);
          selectedProvider = resolvedModel.toLowerCase().includes("codex") ? "codex" : "openrouter";

          const autoProvider = selectedProvider === "codex" ? "ChatGPT Codex" : "OpenRouter";
          const source = recommendation.model ? recommendation.reason : `Fallback used: ${recommendation.reason}`;
          setLastModelDecision(`${autoProvider}: ${resolvedModel} - ${source}`);
        } else {
          resolvedModel = resolveModelId(selectedModel);
          selectedProvider = selectedOption?.provider ?? "openrouter";
          const providerLabel = selectedProvider === "codex" ? "ChatGPT Codex" : "OpenRouter";
          setLastModelDecision(`${providerLabel}: ${resolvedModel}`);
        }

        const requestedCodexModel = resolvedModel.toLowerCase().includes("codex");
        if (selectedProvider === "openrouter" && !apiKey.trim()) {
          throw new Error("Add your OpenRouter API key in Settings first.");
        }

        if (requestedCodexModel && !codexAuthed) {
          if (selectedProvider === "codex") {
            throw new Error("ChatGPT Codex is not connected. Connect it in Settings and try again.");
          }
          selectedProvider = "openrouter";
          resolvedModel = "openai/gpt-4o-mini";
          setLastModelDecision("OpenRouter fallback: ChatGPT Codex requested but Codex is not connected.");
        }

        const systemPrompt = activeChat.systemPrompt || globalSystemPrompt;
        setIsStreaming(true);
        abortControllerRef.current = new AbortController();
        const response = await fetch(backendUrl, {

        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortControllerRef.current.signal,
        body: JSON.stringify({
          message: content,
          vfs: activeChat.vfs,
          model: resolvedModel,
          model_provider: selectedProvider,
          api_key: apiKey,
          system_prompt: systemPrompt,
          attachments: attachments.map(a => ({
            name: a.name,
            mime_type: a.mimeType,
            data_base64: a.dataBase64,
          })),
        }),
      });

      if (!response.body) throw new Error("No response body from server.");
      if (!response.ok) {
        const errText = await response.text();
        let errMsg = `Server error ${response.status}`;
        try {
          const errJson = JSON.parse(errText) as { detail?: string; error?: string };
          errMsg = errJson.detail ?? errJson.error ?? errMsg;
        } catch { /* use status text */ }
        throw new Error(errMsg);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let fullText = "";
      let remainder = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        remainder += decoder.decode(value, { stream: true });
        const lines = remainder.split("\n");
        remainder = lines.pop() || "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const chunk = trimmed.slice(5).trim();
          if (!chunk || chunk === "[DONE]") continue;
          try {
            const parsed = JSON.parse(chunk) as { error?: string | { message?: string }; detail?: string; choices?: Array<{ delta?: { content?: string } }> };
            if (parsed.error) {
              const errMsg = typeof parsed.error === "string" ? parsed.error : (parsed.error?.message ?? "OpenRouter error");
              throw new Error(parsed.detail ? `${errMsg}: ${parsed.detail}` : errMsg);
            }
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) {
                for (const ch of delta) {
                  fullText += ch;
                  appendToMsg(asstMsg.id, ch);
                  await new Promise<void>(resolve => window.setTimeout(resolve, 8));
                }
              }

          } catch (parseErr) {
            if (parseErr instanceof Error && parseErr.message !== "Unexpected end of JSON input") throw parseErr;
          }
        }
      }

      const fileUpdates = extractCodeBlocks(fullText);
      if (Object.keys(fileUpdates).length > 0) {
        updateActiveChat(c => ({ ...c, vfs: { ...c.vfs, ...fileUpdates } }));
      }
          } catch (e) {
            if (e instanceof DOMException && e.name === "AbortError") {
              appendToMsg(asstMsg.id, "\n\n_Stopped by user._");
            } else {
              const msg = e instanceof Error ? e.message : "Unknown error";
              setLastModelDecision("API request failed");
              setError(`Primary AI backend failed (${msg}). Chat stayed inside this app using API-only mode.`);
              appendToMsg(asstMsg.id, `\n\n**Error:** ${msg}`);
            }
          } finally {

      abortControllerRef.current = null;
      setIsStreaming(false);
      setQueuedPrompts(prev => {
        const [next, ...rest] = prev;
        if (next) {
          window.setTimeout(() => { void processPrompt(next.text, next.attachments); }, 0);
        }
        return rest;
      });
    }
  };

  const sendMessage = async () => {
      if (!activeChat) return;
      const content = prompt.trim();
      if (!content && pendingAttachments.length === 0) return;

      const codexOnlySelected = selectedOption?.provider === "codex";
      const openRouterOnlySelected = selectedOption?.provider === "openrouter";
      if (openRouterOnlySelected && !apiKey.trim()) {
        setError("Add your OpenRouter API key in Settings first.");
        setSettingsOpen(true);
        return;
      }
      if (codexOnlySelected && !codexAuthed) {
        setError("ChatGPT Codex is not connected. Connect it in Settings first.");
        setSettingsOpen(true);
        return;
      }

      const payloadText = content || "Analyze the attached image(s).";
    const payloadAttachments = [...pendingAttachments];

    setPrompt("");
    setPendingAttachments([]);
    setError("");

    if (isStreaming) {
      setQueuedPrompts(prev => [...prev, { text: payloadText, attachments: payloadAttachments }]);
      return;
    }

    await processPrompt(payloadText, payloadAttachments);
  };

  if (!initialized) {
    return (
      <div style={{ minHeight: "100vh", background: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 32, height: 32, border: "3px solid #e5e7eb", borderTopColor: "#4f46e5", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const isDark = theme === "dark";
  const codexCooldownRemainingSeconds = Math.max(0, Math.ceil((codexCooldownUntil - Date.now()) / 1000));
  const codexConnectDisabled = codexLoading || codexCooldownRemainingSeconds > 0;

  // ── Shared input style ──
  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: T.bgInput,
    border: `1px solid ${T.border}`,
    borderRadius: 8,
    padding: "8px 12px",
    fontSize: 13,
    color: T.text,
    outline: "none",
    fontFamily: "inherit",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 11,
    fontWeight: 600,
    color: T.textMuted,
    marginBottom: 5,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  };

  const iconBtnStyle: React.CSSProperties = {
    background: T.bgHover,
    border: `1px solid ${T.border}`,
    borderRadius: 8,
    padding: "6px 9px",
    cursor: "pointer",
    color: T.textMuted,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  const premiumGlassStyle: React.CSSProperties = {
    background: isDark ? "rgba(17,23,35,0.82)" : "rgba(255,255,255,0.82)",
    border: `1px solid ${T.border}`,
    boxShadow: isDark ? "0 16px 40px rgba(0,0,0,0.34)" : "0 14px 36px rgba(30,41,59,0.14)",
    backdropFilter: "blur(14px)",
    WebkitBackdropFilter: "blur(14px)",
  };

  return (
    <div style={{ height: "100dvh", overflow: "hidden", background: `radial-gradient(circle at top right, ${isDark ? "rgba(148,163,184,0.26)" : "rgba(148,163,184,0.3)"}, transparent 34%), radial-gradient(circle at 16% 8%, ${isDark ? "rgba(203,213,225,0.16)" : "rgba(148,163,184,0.14)"}, transparent 38%), linear-gradient(180deg, ${T.bg} 0%, ${isDark ? "#070a10" : "#e8edf6"} 100%)`, color: T.text, fontFamily: "'Inter', system-ui, sans-serif", display: "flex", minHeight: 0 }}>
      {/* ── Sidebar ── */}
      <>
        {/* Mobile backdrop */}
        {sidebarOpen && (
          <div
            style={{ position: "fixed", inset: 0, zIndex: 19, background: "rgba(0,0,0,0.3)", display: "none" }}
            className="mob-backdrop"
            onClick={() => setSidebarOpen(false)}
          />
        )}

          <aside className={sidebarOpen ? "app-sidebar open" : "app-sidebar"} style={{
            width: sidebarOpen ? 260 : 0,
            minWidth: sidebarOpen ? 260 : 0,
            background: T.bgSidebar,
            borderRight: `1px solid ${T.border}`,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            transition: "width 0.2s ease, min-width 0.2s ease",
            flexShrink: 0,
            boxShadow: sidebarOpen ? (isDark ? "inset -1px 0 0 rgba(255,255,255,0.03)" : "inset -1px 0 0 rgba(255,255,255,0.7)") : "none",
          }}>
          <div style={{ width: 260, display: "flex", flexDirection: "column", height: "100%" }}>
            {/* Sidebar header */}
                <div style={{ padding: "14px 14px 10px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: 9,
                    background: "linear-gradient(135deg, #b8c4d6, #6e809a)",
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    boxShadow: "0 10px 24px rgba(100,116,139,0.28)",
                    color: "#fff",
                  }}>
                    <I.Bot />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: T.text, display: "block" }}>Universal AI Platinum</span>
                    <span style={{ fontSize: 11, color: T.textMuted }}>Premium workspace</span>
                  </div>
                </div>


            {/* New Chat button */}
            <div style={{ padding: "10px 12px 6px" }}>
              <button
                onClick={newChat}
                style={{
                  width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  background: T.primary, color: "#fff", border: "none", borderRadius: 10,
                  padding: "9px 0", fontWeight: 600, fontSize: 13, cursor: "pointer",
                  transition: "opacity 0.15s",
                }}
                onMouseEnter={e => (e.currentTarget.style.opacity = "0.88")}
                onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
              >
                <I.Plus /> New Chat
              </button>
            </div>

            {/* Chat list */}
            <div style={{ flex: 1, overflowY: "auto", padding: "4px 8px 8px" }}>
              {chats.map(chat => {
                const isActive = chat.id === activeChatId;
                return (
                  <div
                    key={chat.id}
                    style={{
                      borderRadius: 10, marginBottom: 2, overflow: "hidden",
                      background: isActive ? (isDark ? "#252840" : "#eef2ff") : "transparent",
                      border: `1px solid ${isActive ? T.primary + "44" : "transparent"}`,
                    }}
                  >
                    {renamingId === chat.id ? (
                      <input
                        autoFocus
                        value={renameVal}
                        onChange={e => setRenameVal(e.target.value)}
                        onBlur={commitRename}
                        onKeyDown={e => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setRenamingId(null); }}
                        style={{ width: "100%", background: T.bgInput, border: `1px solid ${T.primary}`, borderRadius: 8, padding: "7px 10px", fontSize: 13, color: T.text, outline: "none" }}
                      />
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                        <button
                          onClick={() => setActiveChatId(chat.id)}
                          style={{
                            flex: 1, display: "flex", alignItems: "center", gap: 7, background: "none", border: "none",
                            cursor: "pointer", padding: "8px 10px", textAlign: "left", color: isActive ? T.primary : T.text,
                            fontSize: 13, fontWeight: isActive ? 600 : 400, minWidth: 0,
                          }}
                        >
                          <I.Chat />
                          <span style={{ overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{chat.title}</span>
                        </button>
                        <button
                          onClick={() => startRename(chat)}
                          title="Rename"
                          style={{ background: "none", border: "none", cursor: "pointer", color: T.textSubtle, padding: "8px 4px", flexShrink: 0, display: "flex", alignItems: "center" }}
                        ><I.Edit /></button>
                        <button
                          onClick={() => deleteChat(chat.id)}
                          title="Delete"
                          disabled={chats.length <= 1}
                          style={{ background: "none", border: "none", cursor: "pointer", color: T.textSubtle, padding: "8px 6px", flexShrink: 0, display: "flex", alignItems: "center", opacity: chats.length <= 1 ? 0.3 : 1 }}
                        ><I.Trash /></button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
      </>

      {/* ── Main area ── */}
        <div className="app-main" style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: "100dvh", height: "100dvh", overflow: "hidden" }}>


        {/* ── Header ── */}
        <header style={{
          position: "sticky", top: 0, zIndex: 10,
          background: isDark ? "rgba(15,17,23,0.93)" : "rgba(255,255,255,0.93)",
          borderBottom: `1px solid ${T.border}`,
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 14px", height: 52, gap: 8, flexShrink: 0,
        }}>
          {/* Left */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={() => setSidebarOpen(v => !v)} style={iconBtnStyle} title="Toggle sidebar">
              <I.Menu />
            </button>
            {/* Panel tabs */}
            <div style={{ display: "flex", alignItems: "center", background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 10, padding: 3, gap: 2 }}>
              {(["chat", "code", "app"] as const).map(panel => (
                <button
                  key={panel}
                  onClick={() => setActivePanel(panel)}
                  style={{
                    display: "flex", alignItems: "center", gap: 5,
                    background: activePanel === panel ? (isDark ? "#2d3050" : "#ffffff") : "transparent",
                    color: activePanel === panel ? T.primary : T.textMuted,
                    border: activePanel === panel ? `1px solid ${T.border}` : "1px solid transparent",
                    borderRadius: 7, padding: "4px 12px", fontSize: 12, fontWeight: activePanel === panel ? 600 : 500,
                    cursor: "pointer", transition: "all 0.12s",
                    boxShadow: activePanel === panel ? "0 1px 3px rgba(0,0,0,0.07)" : "none",
                  }}
                >
                  {panel === "chat" && <I.Chat />}
                  {panel === "code" && <I.Code />}
                  {panel === "app" && <I.Eye />}
                  <span style={{ textTransform: "capitalize" }}>{panel === "app" ? "Preview" : panel}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Right */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  textDecoration: "none",
                  background: "linear-gradient(135deg, #c7d2e3, #778ba8)",
                  color: "#fff", border: "none",
                  borderRadius: 999, padding: "6px 12px", fontSize: 11, fontWeight: 700,
                  boxShadow: "0 8px 20px rgba(71,85,105,0.28)",
                }}
              >
                <I.Sparkle /><span>Premium Support</span>
              </a>
              <button
                onClick={() => setPublishOpen(true)}
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  background: T.bgHover, color: T.textMuted, border: `1px solid ${T.border}`,
                  borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer",
                }}
              >
                <I.Upload /><span>Publish</span>
              </button>
              <button
                onClick={() => setTheme(t => t === "dark" ? "light" : "dark")}
                style={iconBtnStyle}
                title={isDark ? "Light mode" : "Dark mode"}
              >
                {isDark ? <I.Sun /> : <I.Moon />}
              </button>
              <button onClick={() => setSettingsOpen(true)} style={iconBtnStyle} title="Settings">
                <I.Settings />
              </button>
            </div>
        </header>

        {/* ── Chat panel ── */}
        {activePanel === "chat" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
            {/* Messages */}
            <div
              ref={scrollRef}
              onScroll={(e) => {
                const el = e.currentTarget;
                const nearBottom = (el.scrollHeight - (el.scrollTop + el.clientHeight)) < 80;
                setStickToBottom(nearBottom);
              }}
              style={{ flex: 1, overflowY: "auto", padding: "20px 0", minHeight: 0 }}
            >
              <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 16px", display: "flex", flexDirection: "column", gap: 8 }}>
                {activeChat?.messages.map(msg => (
                  <div
                    key={msg.id}
                    style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start", gap: 10, alignItems: "flex-start" }}
                  >
                    {msg.role === "assistant" && (
                      <div style={{
                        width: 32, height: 32, flexShrink: 0, borderRadius: "50%",
                        background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                        display: "flex", alignItems: "center", justifyContent: "center", marginTop: 2,
                        color: "#fff",
                      }}>
                        <I.Bot />
                      </div>
                    )}

                    <div style={{
                      maxWidth: "78%",
                      borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "4px 18px 18px 18px",
                      padding: "11px 15px",
                      fontSize: 14, lineHeight: 1.7,
                      background: msg.role === "user"
                        ? "linear-gradient(135deg, #4f46e5, #7c3aed)"
                        : T.bgAsstMsg,
                      color: msg.role === "user" ? "#ffffff" : T.text,
                      border: msg.role === "assistant" ? `1px solid ${T.border}` : "none",
                      boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                    }}>
                      {msg.role === "assistant" ? (
                        msg.content ? (
                          <div
                            className="md-body"
                            dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                          />
                        ) : (
                          <span style={{ color: T.textSubtle, fontStyle: "italic" }}>thinking…</span>
                        )
                      ) : (
                        <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{msg.content}</p>
                      )}
                      <div style={{ marginTop: 4, fontSize: 11, color: msg.role === "user" ? "rgba(255,255,255,0.55)" : T.textSubtle, textAlign: "right" }}>
                        {formatTime(msg.createdAt)}
                      </div>
                    </div>

                    {msg.role === "user" && (
                      <div style={{
                        width: 32, height: 32, flexShrink: 0, borderRadius: "50%",
                        background: T.bgHover, border: `1px solid ${T.border}`,
                        display: "flex", alignItems: "center", justifyContent: "center", marginTop: 2, color: T.textMuted,
                      }}>
                        <I.User />
                      </div>
                    )}
                  </div>
                ))}

                {/* Typing dots */}
                {isStreaming && (activeChat?.messages.at(-1)?.content === "") && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
                      <I.Bot />
                    </div>
                    <div style={{ display: "flex", gap: 5, padding: "12px 16px", background: T.bgAsstMsg, borderRadius: "4px 18px 18px 18px", border: `1px solid ${T.border}` }}>
                      {[0, 1, 2].map(i => (
                        <span key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: T.primary, display: "inline-block", animation: `dot-bounce 1.1s ease-in-out ${i * 0.16}s infinite` }} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── Input bar ── */}
            <div style={{
              borderTop: `1px solid ${T.border}`,
              background: isDark ? "rgba(15,17,23,0.97)" : "rgba(255,255,255,0.97)",
              backdropFilter: "blur(14px)",
              WebkitBackdropFilter: "blur(14px)",
              padding: "12px 16px 14px",
              flexShrink: 0,
            }}>
                {error && (
                  <div style={{ maxWidth: 760, margin: "0 auto 10px", padding: "8px 12px", borderRadius: 8, background: T.dangerBg, border: `1px solid ${T.danger}44`, color: T.danger, fontSize: 12 }}>
                    {error}
                  </div>
                )}
                {pendingAttachments.length > 0 && (
                  <div style={{ maxWidth: 760, margin: "0 auto 8px", display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {pendingAttachments.map((attachment, idx) => (
                      <span key={`${attachment.name}-${idx}`} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 999, padding: "3px 10px", fontSize: 11, color: T.textMuted }}>
                        {attachment.name}
                        <button onClick={() => removeAttachment(idx)} style={{ background: "none", border: "none", color: T.danger, cursor: "pointer", padding: 0, display: "inline-flex" }}><I.X /></button>
                      </span>
                    ))}
                  </div>
                )}
                <div style={{ maxWidth: 760, margin: "0 auto" }}>

                <div style={{
                  background: T.bgInput, border: `1.5px solid ${T.borderStrong}`,
                  borderRadius: 14, overflow: "hidden",
                  boxShadow: isDark ? "0 2px 12px rgba(0,0,0,0.3)" : "0 2px 10px rgba(0,0,0,0.07)",
                  transition: "border-color 0.15s",
                }}>
                  <textarea
                    ref={textareaRef}
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendMessage(); } }}
                    rows={3}
                    placeholder="Message AI…  (Enter to send, Shift+Enter for newline)"
                    style={{
                      width: "100%", resize: "none", background: "transparent", border: "none", outline: "none",
                      padding: "13px 15px 4px", fontSize: 14, color: T.text, lineHeight: 1.6, fontFamily: "inherit",
                    }}
                  />
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 10px 9px", gap: 8 }}>
                    {/* Model picker */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                              <span title={selectedOption?.label} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 20, height: 20, borderRadius: 6, background: T.bgSurface, border: `1px solid ${T.border}` }}>
                                {renderModelIcon(selectedOption?.icon ?? "auto", 14)}
                              </span>
                              <select
                                value={selectedModel}
                                onChange={e => setSelectedModel(normalizeSelectedModelValue(e.target.value))}
                                style={{
                                  background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 8,
                                  padding: "4px 8px", fontSize: 12, color: T.textMuted, cursor: "pointer", outline: "none",
                                  maxWidth: 320,
                                }}
                              >
                                <option value="auto">{modelOptionText(modelOptions[0])}</option>
                                <optgroup label="Codex (ChatGPT connection)">
                                  {modelOptions.filter(m => m.provider === "codex").map(m => (
                                    <option key={m.value} value={m.value}>{modelOptionText(m)}</option>
                                  ))}
                                </optgroup>
                                <optgroup label="OpenRouter">
                                  {modelOptions.filter(m => m.provider === "openrouter").map(m => (
                                    <option key={m.value} value={m.value}>{modelOptionText(m)}</option>
                                  ))}
                                </optgroup>
                              </select>
                            </div>

                          {selectedModel === "auto" && lastModelDecision && (
                            <div style={{ fontSize: 11, color: T.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={lastModelDecision}>
                              AI model choice: {lastModelDecision}
                            </div>
                          )}

                      </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={e => { void onAttachmentPick(e.target.files); e.currentTarget.value = ""; }}
                        style={{ display: "none" }}
                      />
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          style={{ ...iconBtnStyle, borderRadius: 10 }}
                          title="Attach image"
                        >
                          <I.Attach />
                        </button>
                      {isStreaming ? (
                        <button
                          onClick={stopResponding}
                          style={{
                            display: "flex", alignItems: "center", gap: 6,
                            background: T.danger, color: "#fff",
                            border: "none", borderRadius: 10, padding: "7px 12px",
                            fontSize: 13, fontWeight: 700, cursor: "pointer",
                            transition: "all 0.15s", flexShrink: 0,
                          }}
                        >Stop</button>
                      ) : (
                        <button
                          onClick={() => void sendMessage()}
                          disabled={!prompt.trim() && pendingAttachments.length === 0}
                          style={{
                            display: "flex", alignItems: "center", gap: 6,
                            background: (!prompt.trim() && pendingAttachments.length === 0) ? T.bgHover : T.primary,
                            color: (!prompt.trim() && pendingAttachments.length === 0) ? T.textMuted : "#fff",
                            border: "none", borderRadius: 10, padding: "7px 16px",
                            fontSize: 13, fontWeight: 600, cursor: (!prompt.trim() && pendingAttachments.length === 0) ? "not-allowed" : "pointer",
                            transition: "all 0.15s", flexShrink: 0,
                          }}
                        >
                          <I.Send />{queuedPrompts.length > 0 ? `Send (${queuedPrompts.length} queued)` : "Send"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Code panel ── */}
        {activePanel === "code" && (
          <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>
            {/* File tree */}
            <div style={{ width: 190, borderRight: `1px solid ${T.border}`, background: T.bgSidebar, display: "flex", flexDirection: "column", flexShrink: 0 }}>
              <div style={{ padding: "10px 10px 8px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Files</span>
                <button
                  onClick={addFile}
                  style={{ background: T.primary, color: "#fff", border: "none", borderRadius: 6, width: 22, height: 22, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                  title="New file"
                ><I.Plus /></button>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: 6 }}>
                {Object.keys(activeVfs).map(file => (
                  <div key={file} style={{ display: "flex", alignItems: "center", gap: 2, marginBottom: 1 }}>
                    <button
                      onClick={() => setActiveFile(file)}
                      style={{
                        flex: 1, textAlign: "left",
                        background: file === activeFile ? (isDark ? "#252840" : "#eef2ff") : "transparent",
                        border: "none", borderRadius: 7, padding: "6px 8px", fontSize: 12,
                        color: file === activeFile ? T.primary : T.text,
                        cursor: "pointer", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis",
                        fontWeight: file === activeFile ? 600 : 400,
                      }}
                    >{file}</button>
                      {Object.keys(activeVfs).length > 1 && (
                        <button
                          onClick={() => removeFile(file)}
                          style={{ background: "none", border: "none", cursor: "pointer", color: T.danger, padding: 3, display: "flex", opacity: 0.7 }}
                          title="Delete"
                        ><I.Trash /></button>
                      )}

                  </div>
                ))}
              </div>
            </div>

            {/* Editor */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
              <div style={{ padding: "7px 14px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", background: T.bgSurface, flexShrink: 0 }}>
                <span style={{ fontSize: 12, fontFamily: "monospace", color: T.textMuted }}>{activeFile}</span>
                <button
                  onClick={() => setActivePanel("app")}
                  style={{ display: "flex", alignItems: "center", gap: 5, background: T.bgHover, border: `1px solid ${T.border}`, borderRadius: 7, padding: "4px 10px", fontSize: 12, color: T.textMuted, cursor: "pointer" }}
                ><I.Eye /> Preview</button>
              </div>
              <textarea
                value={activeVfs[activeFile] ?? ""}
                onChange={e => setActiveFileContent(e.target.value)}
                spellCheck={false}
                style={{
                  flex: 1, resize: "none", background: isDark ? "#0d0f16" : "#1e1e2e",
                  border: "none", outline: "none", padding: 16,
                  fontSize: 13, fontFamily: "ui-monospace, Menlo, monospace",
                  color: "#e2e8f0", lineHeight: 1.7, tabSize: 2, minHeight: 0,
                }}
              />
            </div>
          </div>
        )}

        {/* ── App preview panel ── */}
        {activePanel === "app" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: 16, gap: 10, minHeight: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>Live Preview</span>
              <button
                onClick={() => setActivePanel("code")}
                style={{ display: "flex", alignItems: "center", gap: 5, background: T.bgHover, border: `1px solid ${T.border}`, borderRadius: 8, padding: "5px 12px", fontSize: 12, color: T.textMuted, cursor: "pointer" }}
              ><I.Code /> Edit Code</button>
            </div>
            <iframe
              title="preview"
              srcDoc={buildPreviewHtml(activeVfs)}
              style={{ flex: 1, border: `1px solid ${T.border}`, borderRadius: 12, background: "#ffffff", minHeight: 0 }}
              sandbox="allow-scripts allow-same-origin"
            />
          </div>
        )}
      </div>

      {/* ── Settings modal ── */}
      {settingsOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.5)", backdropFilter: "blur(6px)", padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setSettingsOpen(false); }}>
            <div style={{ ...premiumGlassStyle, width: "100%", maxWidth: 640, maxHeight: "92vh", overflowY: "auto", borderRadius: 18 }}>
            {/* Modal header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px 16px", borderBottom: `1px solid ${T.border}`, position: "sticky", top: 0, background: T.bg, borderRadius: "18px 18px 0 0", zIndex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <I.Settings />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: T.text }}>Settings</div>
                  <div style={{ fontSize: 12, color: T.textMuted }}>API keys, model, integrations</div>
                </div>
              </div>
              <button onClick={() => setSettingsOpen(false)} style={iconBtnStyle}><I.X /></button>
            </div>

            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>

              {/* ── OpenRouter ── */}
              <section style={{ background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 18 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#6366f1" }} />
                  <span style={{ fontWeight: 700, fontSize: 14, color: T.text }}>OpenRouter API</span>
                  <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" style={{ fontSize: 11, color: T.primary, marginLeft: "auto" }}>Get free key →</a>
                </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div style={{ gridColumn: "span 2" }}>
                      <label style={labelStyle}>API Key</label>
                      <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="sk-or-v1-…" style={inputStyle} />
                    </div>
                      <div style={{ gridColumn: "span 2" }}>
                        <label style={labelStyle}>Model</label>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span title={selectedOption?.label} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 24, height: 24, borderRadius: 8, background: T.bgInput, border: `1px solid ${T.border}` }}>
                            {renderModelIcon(selectedOption?.icon ?? "auto", 16)}
                          </span>
                          <select value={selectedModel} onChange={e => setSelectedModel(normalizeSelectedModelValue(e.target.value))} style={{ ...inputStyle, flex: 1 }}>
                            <option value="auto">{modelOptionText(modelOptions[0])}</option>
                            <optgroup label="Codex (ChatGPT connection)">
                              {modelOptions.filter(m => m.provider === "codex").map(m => <option key={m.value} value={m.value}>{modelOptionText(m)}</option>)}
                            </optgroup>
                            <optgroup label="OpenRouter">
                              {modelOptions.filter(m => m.provider === "openrouter").map(m => <option key={m.value} value={m.value}>{modelOptionText(m)}</option>)}
                            </optgroup>
                          </select>
                        </div>
                      </div>

                      <div style={{ gridColumn: "span 2" }}>
                        <label style={labelStyle}>Custom Model ID (optional)</label>
                        <input value={customModelId} onChange={e => setCustomModelId(e.target.value)} placeholder="e.g. meta-llama/llama-3.2-3b-instruct:free" style={{ ...inputStyle, fontFamily: "monospace" }} />
                        <div style={{ marginTop: 4, fontSize: 11, color: T.textMuted }}>Optional override. Leave empty to use the selected model.</div>
                      </div>
                        <div style={{ gridColumn: "span 2", fontSize: 11, color: T.textMuted }}>
                          Chat responses stay inside Universal AI via API streaming. No external fallback tab is opened.
                        </div>

                    </div>

                </section>

                {/* ── Support ── */}
                <section style={{ background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 18 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#94a3b8" }} />
                    <span style={{ fontWeight: 700, fontSize: 14, color: T.text }}>Premium Support</span>
                  </div>
                  <div style={{ display: "grid", gap: 8, fontSize: 12, color: T.textMuted }}>
                    <div>
                      Need help during launch? Contact us at{" "}
                      <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: T.primary }}>{SUPPORT_EMAIL}</a>
                    </div>
                    <div>
                      Provider status: <a href={STATUS_URL} target="_blank" rel="noreferrer" style={{ color: T.primary }}>OpenRouter status page</a>
                    </div>
                      <div>
                        If a model is unavailable, Universal AI automatically retries using supported API models and keeps the chat in-app.
                      </div>

                  </div>
                </section>

                {/* ── System Prompts ── */}
                <section style={{ background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 18 }}>

                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#8b5cf6" }} />
                  <span style={{ fontWeight: 700, fontSize: 14, color: T.text }}>System Prompts</span>
                </div>
                <div style={{ display: "grid", gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Global System Prompt</label>
                    <textarea rows={3} value={globalSystemPrompt} onChange={e => setGlobalSystemPrompt(e.target.value)} placeholder="Default AI persona for all chats…" style={{ ...inputStyle, resize: "vertical" }} />
                  </div>
                  <div>
                    <label style={labelStyle}>This Chat Override</label>
                    <textarea rows={3} value={activeChat?.systemPrompt ?? ""} onChange={e => { if (!activeChat) return; updateActiveChat(c => ({ ...c, systemPrompt: e.target.value })); }} placeholder="Override global prompt for this chat only…" style={{ ...inputStyle, resize: "vertical" }} />
                  </div>
                </div>
              </section>

              {/* ── Codex ── */}
                <section style={{ background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 14, padding: 18 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981" }} />
                    <span style={{ fontWeight: 700, fontSize: 14, color: T.text }}>ChatGPT Codex</span>
                    <span style={{ marginLeft: "auto", fontSize: 11, color: codexAuthed ? T.success : T.textMuted, fontWeight: 600 }}>
                      {codexAuthed ? "Connected" : "Not connected"}
                    </span>
                  </div>
                  <p style={{ fontSize: 12, color: T.textMuted, marginBottom: 12 }}>
                    Connect your ChatGPT Plus/Pro account via device code. Requires Codex CLI installed on the backend server.
                  </p>

                  {!codexAuthed && (
                    <ol style={{ paddingLeft: 18, margin: "0 0 12px", color: T.textMuted, fontSize: 12, lineHeight: 1.9 }}>
                      <li>Enable <strong style={{ color: T.text }}>Device code authorization for Codex</strong> in your <a href="https://chat.openai.com/settings/security" target="_blank" rel="noreferrer" style={{ color: T.primary }}>ChatGPT Security Settings</a></li>
                      <li>Click <strong style={{ color: T.text }}>Connect</strong> below to get your code</li>
                      <li>Enter the full 9-character code (format: XXXX-XXXXX) at <a href="https://auth.openai.com/codex/device" target="_blank" rel="noreferrer" style={{ color: T.primary }}>auth.openai.com/codex/device</a></li>
                    </ol>
                  )}

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: codexCode ? 12 : 0 }}>
                      <button
                        onClick={() => void startCodexConnect()}
                        disabled={codexConnectDisabled}
                        style={{
                          background: codexAuthed ? T.success : T.primary,
                          color: "#fff",
                          border: "none",
                          borderRadius: 9,
                          padding: "8px 18px",
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: codexConnectDisabled ? "not-allowed" : "pointer",
                          opacity: codexConnectDisabled ? 0.7 : 1,
                        }}
                      >
                        {codexLoading
                          ? "Loading…"
                          : codexCooldownRemainingSeconds > 0
                            ? `Retry in ${codexCooldownRemainingSeconds}s`
                            : codexAuthed
                              ? "Reconnect"
                              : "Connect"}
                      </button>

                    <button
                      onClick={() => void checkCodexStatus()}
                      style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 9, padding: "8px 14px", fontSize: 12, color: T.textMuted, cursor: "pointer" }}
                    >Check Status</button>
                    <button
                      onClick={() => void disconnectCodex()}
                      disabled={codexLoading || !codexAuthed}
                      style={{
                        background: "transparent", border: `1px solid ${T.danger}66`, borderRadius: 9, padding: "8px 14px", fontSize: 12,
                        color: T.danger, cursor: codexLoading || !codexAuthed ? "not-allowed" : "pointer", opacity: codexLoading || !codexAuthed ? 0.6 : 1,
                      }}
                    >Disconnect</button>
                  </div>


                {codexCode && (
                  <div style={{ background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 10, padding: "12px 14px", marginTop: 8 }}>
                    <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 6 }}>Your device code — enter this at the verification URL:</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <code style={{ fontSize: 22, fontWeight: 800, color: T.primary, fontFamily: "monospace", letterSpacing: "0.14em" }}>{codexCode}</code>
                      <button onClick={() => copyText(codexCode, "codex")} style={{ ...iconBtnStyle, color: copied === "codex" ? T.success : T.textMuted }}>
                        {copied === "codex" ? "✓" : <I.Copy />}
                      </button>
                    </div>
                    <a href={codexUrl} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: 8, fontSize: 12, color: T.primary, textDecoration: "underline" }}>{codexUrl}</a>
                  </div>
                )}

                  {codexStatus && (
                    <div style={{ marginTop: 8, fontSize: 12, color: T.textMuted }}>{codexStatus}</div>
                  )}

                  {codexCooldownUntil > Date.now() && (
                    <div style={{ marginTop: 6, fontSize: 11, color: T.textMuted }}>
                      Connect is temporarily limited due to rate limiting. Wait about {Math.max(1, Math.ceil((codexCooldownUntil - Date.now()) / 1000))}s.
                    </div>
                  )}
              </section>



            </div>
          </div>
        </div>
      )}

      {/* ── Publish modal ── */}
      {publishOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.5)", backdropFilter: "blur(6px)", padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setPublishOpen(false); }}>
            <div style={{ ...premiumGlassStyle, width: "100%", maxWidth: 480, borderRadius: 18 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px 16px", borderBottom: `1px solid ${T.border}` }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, color: T.text }}>Publish to Vercel</div>
                <div style={{ fontSize: 12, color: T.textMuted }}>Deploy your app in seconds</div>
              </div>
              <button onClick={() => setPublishOpen(false)} style={iconBtnStyle}><I.X /></button>
            </div>
                  <div style={{ padding: "20px 24px 24px" }}>
                    <p style={{ margin: "0 0 8px", color: T.textMuted, fontSize: 13, lineHeight: 1.6 }}>
                      One-click deploy from your current editor files.
                    </p>
                    <div style={{ marginBottom: 14 }}>
                      <label style={labelStyle}>Custom domain (optional)</label>
                      <input
                        value={publishCustomDomain}
                        onChange={e => setPublishCustomDomain(e.target.value)}
                        placeholder="app.example.com"
                        style={inputStyle}
                      />
                      <div style={{ marginTop: 4, color: T.textMuted, fontSize: 11 }}>
                        If provided, deploy will try to add this domain automatically.
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>

                    <button
                      onClick={() => void publishToVercel()}
                      disabled={publishing}
                      style={{ display: "flex", alignItems: "center", gap: 7, background: publishing ? T.bgHover : T.primary, color: publishing ? T.textMuted : "#fff", border: "none", borderRadius: 10, padding: "10px 18px", fontSize: 13, fontWeight: 600, cursor: publishing ? "not-allowed" : "pointer" }}
                    >
                      {publishing ? "Publishing…" : "Publish now"}
                    </button>
                    <button
                      onClick={() => void downloadCodeArchive()}
                      disabled={downloadingCode}
                      style={{
                        display: "flex", alignItems: "center", gap: 7, background: "transparent", color: T.text,
                        border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 16px", fontSize: 13, fontWeight: 600,
                        cursor: downloadingCode ? "not-allowed" : "pointer", opacity: downloadingCode ? 0.7 : 1,
                      }}
                    >
                      {downloadingCode ? "Preparing ZIP…" : "Download code files"}
                    </button>
                  </div>
                  {publishResult && (
                    <div style={{ marginTop: 12, fontSize: 12, color: publishResult.ok ? T.success : T.danger, wordBreak: "break-word" }}>
                      {publishResult.message}
                      {publishResult.url && (
                        <>
                          {" "}
                          <a href={publishResult.url} target="_blank" rel="noreferrer" style={{ color: T.primary, textDecoration: "underline" }}>{publishResult.url}</a>
                        </>
                      )}
                    </div>
                  )}
                </div>


          </div>
        </div>
      )}

      <Script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js" strategy="afterInteractive" />

      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; padding: 0; }
        @keyframes dot-bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-5px); opacity: 1; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* Markdown body styles */
        .md-body { color: inherit; font-size: 14px; line-height: 1.7; }
        .md-body h1 { font-size: 1.35em; font-weight: 700; margin: 14px 0 6px; }
        .md-body h2 { font-size: 1.18em; font-weight: 700; margin: 12px 0 5px; }
        .md-body h3 { font-size: 1.05em; font-weight: 700; margin: 10px 0 4px; }
        .md-body p { margin: 5px 0; }
        .md-body ul, .md-body ol { padding-left: 20px; margin: 6px 0; }
        .md-body li { margin: 2px 0; }
        .md-body strong { font-weight: 700; }
        .md-body em { font-style: italic; }
        .md-body a { color: ${T.primary}; }
        .md-body code { font-family: ui-monospace,Menlo,monospace; font-size: 0.87em; background: ${isDark ? "rgba(99,102,241,0.15)" : "rgba(99,102,241,0.1)"}; border-radius: 4px; padding: 1px 5px; }
        .md-body pre { background: ${T.codePreBg}; border-radius: 10px; padding: 14px 16px; overflow-x: auto; margin: 10px 0; }
        .md-body pre code { background: none; padding: 0; font-size: 0.85em; color: #e2e8f0; }
        .md-body blockquote { border-left: 3px solid ${T.primary}; padding-left: 12px; margin: 8px 0; opacity: 0.8; }
        .md-body hr { border: none; border-top: 1px solid ${T.border}; margin: 14px 0; }
        .md-body table { border-collapse: collapse; width: 100%; margin: 10px 0; font-size: 13px; }
        .md-body th, .md-body td { border: 1px solid ${T.border}; padding: 6px 10px; text-align: left; }
        .md-body th { background: ${T.bgSurface}; font-weight: 700; }

        /* Scrollbar */
        * { scrollbar-width: thin; scrollbar-color: ${isDark ? "#2a2d3e transparent" : "#e5e7eb transparent"}; }
        *::-webkit-scrollbar { width: 5px; height: 5px; }
        *::-webkit-scrollbar-track { background: transparent; }
        *::-webkit-scrollbar-thumb { background: ${isDark ? "#2a2d3e" : "#e5e7eb"}; border-radius: 3px; }

        /* Select option bg */
        select option { background: ${T.bgInput}; color: ${T.text}; }

        /* Textarea focus */
        textarea:focus { box-shadow: none; }

        @media (max-width: 900px) {
          .mob-backdrop { display: block !important; }
          .app-sidebar {
            position: fixed !important;
            left: 0;
            top: 0;
            bottom: 0;
            z-index: 30;
            width: 260px !important;
            min-width: 260px !important;
            transform: translateX(-100%);
            transition: transform 0.22s ease;
            box-shadow: 0 18px 40px rgba(0, 0, 0, 0.35);
          }
          .app-sidebar.open {
            transform: translateX(0);
          }
          .app-main {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
