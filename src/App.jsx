import React, { useState, useEffect, useCallback } from "react";
import {
  Search, Shield, ShieldAlert, ShieldCheck, Flag, Clock, Users, GitCompare,
  ChevronDown, ChevronUp, Lock, AlertTriangle, CheckCircle2, XCircle, Loader2,
  MessageCircle, Fingerprint, Globe2, ExternalLink, Trash2
} from "lucide-react";

/* ---------------------------------------------------------
   TOKENS & STYLES
--------------------------------------------------------- */
const C = {
  ink: "#0D1117",
  panel: "#141A22",
  panelRaised: "#1A222C",
  line: "#2A3440",
  paper: "#ECE7DA",
  text: "#E7E9EC",
  muted: "#8B96A3",
  trust: "#2E7BEC",
  safe: "#2FB673",
  warn: "#E8A63C",
  danger: "#E5484D",
};

const FONT_DISPLAY = "'Fraunces', serif";
const FONT_BODY = "'Inter', sans-serif";
const FONT_MONO = "'IBM Plex Mono', monospace";

const BRANDS = {
  bca: "bca.co.id",
  bri: "bri.co.id",
  bni: "bni.co.id",
  mandiri: "bankmandiri.co.id",
  shopee: "shopee.co.id",
  tokopedia: "tokopedia.com",
  gojek: "gojek.com",
  dana: "dana.id",
  ovo: "ovo.id",
};

const COMPETITORS = [
  { name: "TrustLink", us: true },
  { name: "CheckPhish", us: false },
  { name: "VirusTotal", us: false },
  { name: "ScamAdviser", us: false },
  { name: "CekRekening.id", us: false },
];

const FEATURE_MATRIX = [
  { label: "Pindai URL & pesan", vals: [true, true, true, true, false] },
  { label: "Pratinjau sandbox (screenshot aman)", vals: [true, true, false, false, false] },
  { label: "Kemiripan visual brand Indonesia", vals: [true, false, false, false, false] },
  { label: "Analisis NLP Bahasa Indonesia / gaul", vals: [true, false, false, false, false] },
  { label: "Pemantauan typosquat proaktif", vals: [true, true, false, false, false] },
  { label: "Titik masuk WhatsApp", vals: [true, false, false, false, false] },
  { label: "Crowdsource lokal terverifikasi", vals: [true, false, false, false, true] },
  { label: "Skor risiko dengan alasan (explainable)", vals: [true, "sebagian", false, "sebagian", false] },
];

/* ---------------------------------------------------------
   HELPERS
--------------------------------------------------------- */
function colorForScore(score) {
  if (score > 65) return C.danger;
  if (score > 35) return C.warn;
  return C.safe;
}
function extractDomainish(input) {
  const m = input.match(/([a-z0-9-]+\.[a-z]{2,}(?:\.[a-z]{2,})?)/i);
  return m ? m[1].toLowerCase() : null;
}
function detectBrand(input) {
  const lower = input.toLowerCase();
  for (const key of Object.keys(BRANDS)) {
    if (lower.includes(key)) return { key, official: BRANDS[key] };
  }
  return null;
}
function diffChars(official, scanned) {
  return scanned.split("").map((ch, i) => ({ ch, bad: official[i] !== ch }));
}

const RAW_API_BASE = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";
const API_BASE = RAW_API_BASE.replace(/\/$/, "");

function getDeviceId() {
  if (typeof window === "undefined") return "unknown";
  let id = localStorage.getItem("trustlink_device_id");
  if (!id) {
    id = "dev_" + Math.random().toString(36).substring(2, 10) + Date.now();
    localStorage.setItem("trustlink_device_id", id);
  }
  return id;
}

async function loadJSON(key, isShared, defaultValue) {
  try {
    if (key === "community-reports") {
      try {
        const res = await fetch(`${API_BASE}/reports`);
        if (res.ok) {
          const data = await res.json();
          return data.map(r => ({
            id: r.id, input: r.input, score: r.score || 0,
            status: r.status === "menunggu_verifikasi" ? "menunggu verifikasi" : r.status,
            timestamp: new Date(r.created_at).toLocaleString("id-ID"),
          }));
        }
      } catch (err) { console.warn("Backend unavailable, fallback ke localStorage", err); }
    }

    if (key === "scan-history") {
      try {
        const res = await fetch(`${API_BASE}/history?device_id=${getDeviceId()}`);
        if (res.ok) {
          const data = await res.json();
          return data.map(h => ({
            id: h.id, input: h.input, score: h.score, verdict: h.verdict,
            timestamp: new Date(h.created_at).toLocaleString("id-ID"),
          }));
        }
      } catch (err) { console.warn("Backend unavailable, fallback ke localStorage", err); }
    }

    const storage = typeof window !== "undefined" && window.storage ? window.storage : localStorage;
    const val = typeof storage.getItem === "function" ? storage.getItem(key) : storage[key];
    return val ? JSON.parse(val) : defaultValue;
  } catch (e) {
    return defaultValue;
  }
}

function saveJSON(key, isShared, value) {
  try {
    const storage = typeof window !== "undefined" && window.storage ? window.storage : localStorage;
    const str = JSON.stringify(value);
    if (typeof storage.setItem === "function") {
      storage.setItem(key, str);
    } else {
      storage[key] = str;
    }
  } catch (e) {
    console.error("Error saving to storage", e);
  }
}

/* ---------------------------------------------------------
   SMALL UI PRIMITIVES
--------------------------------------------------------- */
function Pill({ children, color }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs"
      style={{ fontFamily: FONT_MONO, color, border: `1px solid ${color}` }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      {children}
    </span>
  );
}

function RiskGauge({ score, animate }) {
  const circumference = 490;
  const color = colorForScore(score);
  const offset = animate ? circumference - (score / 100) * circumference : circumference;
  return (
    <div className="relative mx-auto" style={{ width: 170, height: 170 }}>
      <svg width="170" height="170" viewBox="0 0 180 180" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="90" cy="90" r="78" fill="none" stroke={C.panelRaised} strokeWidth="12" />
        <circle
          cx="90" cy="90" r="78" fill="none" stroke={color} strokeWidth="12" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(.16,1,.3,1), stroke .5s" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div style={{ fontFamily: FONT_MONO, fontSize: 32, fontWeight: 600, color }}>{score}%</div>
        <div style={{ fontFamily: FONT_MONO, fontSize: 9, letterSpacing: "0.1em", color: C.muted }}>TINGKAT RISIKO</div>
      </div>
    </div>
  );
}

function LayerRow({ icon, name, detail, score }) {
  const color = colorForScore(score);
  return (
    <div className="rounded-md p-4 flex items-center gap-3 md:gap-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
      <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: color }}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold" style={{ color: C.text }}>{name}</div>
        <div className="text-xs mt-0.5 leading-snug" style={{ color: C.muted }}>{detail}</div>
        <div className="h-1.5 rounded-full mt-2 overflow-hidden" style={{ background: C.panelRaised }}>
          <div className="h-full rounded-full" style={{ width: `${score}%`, background: color, transition: "width 0.9s cubic-bezier(.16,1,.3,1)" }} />
        </div>
      </div>
      <div style={{ fontFamily: FONT_MONO, fontSize: 17, fontWeight: 600, color }}>{score}%</div>
    </div>
  );
}

/* ---------------------------------------------------------
   NAV
--------------------------------------------------------- */
function Nav({ tab, setTab }) {
  const items = [
    { id: "scan", label: "Periksa", icon: Search },
    { id: "riwayat", label: "Riwayat", icon: Clock },
    { id: "komunitas", label: "Komunitas", icon: Users },
    { id: "perbandingan", label: "Perbandingan", icon: GitCompare },
    { id: "cara-kerja", label: "Cara Kerja", icon: Shield },
  ];
  return (
    <header
      className="flex flex-col md:flex-row md:items-center justify-between px-5 md:px-12 py-4 md:py-5 sticky top-0 z-20 gap-3 md:gap-0"
      style={{ borderBottom: `1px solid ${C.line}`, background: "rgba(13,17,23,0.92)", backdropFilter: "blur(6px)" }}
    >
      <div className="flex items-center gap-2.5 cursor-pointer shrink-0" onClick={() => setTab("scan")}>
        <div className="w-2.5 h-2.5 rounded-full" style={{ background: C.safe, boxShadow: `0 0 0 3px rgba(47,182,115,0.15)` }} />
        <span style={{ fontFamily: FONT_MONO, fontWeight: 600, fontSize: 17, color: C.text }}>
          TRUST<span style={{ color: C.trust }}>LINK</span>
        </span>
      </div>
      {/* Mobile scrollable Nav */}
      <nav className="flex items-center gap-1.5 overflow-x-auto no-scrollbar w-full md:w-auto pb-1 md:pb-0">
        {items.map((it) => {
          const Icon = it.icon;
          const active = tab === it.id;
          return (
            <button
              key={it.id}
              onClick={() => setTab(it.id)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-md text-[11px] md:text-xs transition-colors shrink-0"
              style={{
                fontFamily: FONT_MONO, letterSpacing: "0.06em", textTransform: "uppercase",
                color: active ? C.text : C.muted,
                background: active ? C.panelRaised : "transparent",
                border: `1px solid ${active ? C.line : "transparent"}`,
              }}
            >
              <Icon size={13} /> {it.label}
            </button>
          );
        })}
      </nav>
    </header>
  );
}

/* ---------------------------------------------------------
   SCAN TAB
--------------------------------------------------------- */
function ScanTab({ history, setHistory, reports, setReports }) {
  const [input, setInput] = useState("");
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null);
  const [showTech, setShowTech] = useState(false);
  const [reported, setReported] = useState(false);
  const [copied, setCopied] = useState(false);

  const examples = [
    "bca-verifikasi-akun.xyz/login-cepat?ref=wa9921",
    "www.bca.co.id",
    "shopee-hadiahspesial.info/klaim?id=88231",
    "Selamat! Paket kamu tertahan di gudang, klik untuk verifikasi ongkir: jne-cekresi.info",
  ];

  const runScan = useCallback(async () => {
    const val = input.trim();
    if (!val) return;
    setScanning(true);
    setResult(null);
    setShowTech(false);
    setReported(false);

    const looksLikeUrl = /[a-z0-9-]+\.[a-z]{2,}/i.test(val);

    try {
      const res = await fetch(`${API_BASE}/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: val, input_type: looksLikeUrl ? "url" : "message", device_id: getDeviceId() }),
      });
      const data = await res.json();

      if (!res.ok) {
        alert(data.error || data.detail || "Gagal memproses pemindaian.");
        setScanning(false);
        return;
      }

      const isTrusted = data.layers.domain_url.score === 0;
      const brand = detectBrand(val.toLowerCase());
      let typo = null;

      if (brand && !isTrusted) {
        const domainish = extractDomainish(val.toLowerCase()) || val.toLowerCase();
        if (domainish !== brand.official) {
          typo = { official: brand.official, scanned: domainish, diff: diffChars(brand.official, domainish) };
        }
      }

      const res_obj = {
        id: data.id,
        input: data.input,
        score: data.score,
        verdict: data.verdict,
        explanation: data.explanation,
        timestamp: new Date(data.created_at).toLocaleString("id-ID"),
        isTrusted,
        typo,
        layers: [
          { score: data.layers.domain_url.score, detail: data.layers.domain_url.note },
          { score: data.layers.visual.score, detail: data.layers.visual.note },
          { score: data.layers.nlp.score, detail: data.layers.nlp.note },
        ],
        tech: {
          domainAge: data.tech.domain_age_days != null ? `${data.tech.domain_age_days} hari` : "Tidak diketahui",
          ssl: data.tech.ssl?.valid ? `Valid (${data.tech.ssl.issuer})` : "Tidak valid / tidak diketahui",
          redirects: "-",
          hosting: "-",
        },
        screenshotUrl: data.screenshot_url ? `${API_BASE}${data.screenshot_url}` : null,
      };

      setResult(res_obj);

      const newHistory = [{ id: res_obj.id, input: res_obj.input, score: res_obj.score, verdict: res_obj.verdict, timestamp: res_obj.timestamp }, ...history].slice(0, 15);
      setHistory(newHistory);
      saveJSON("scan-history", false, newHistory);
    } catch (e) {
      alert("Gagal konek ke backend. Pastikan server FastAPI jalan di localhost:8000");
    } finally {
      setScanning(false);
    }
  }, [input, history, setHistory]);

  const submitReport = useCallback(async () => {
    if (!result) return;
    try {
      await fetch(`${API_BASE}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scan_id: result.id, input: result.input }),
      });
      setReported(true);

      const newReport = {
        id: `r-${Date.now()}`,
        input: result.input,
        score: result.score,
        status: "menunggu verifikasi",
        timestamp: new Date().toLocaleString("id-ID"),
      };
      const newReports = [newReport, ...reports];
      setReports(newReports);
      saveJSON("community-reports", true, newReports);
    } catch (e) {
      alert("Gagal mengirim laporan, cek koneksi ke backend.");
    }
  }, [result, reports, setReports]);

  return (
    <div className="max-w-5xl mx-auto px-5 md:px-12 w-full flex-1">
      {/* HERO */}
      <section className="grid lg:grid-cols-2 gap-8 lg:gap-12 py-10 lg:py-12" style={{ borderBottom: `1px solid ${C.line}` }}>
        <div>
          <Pill color={C.danger}>5,5 miliar serangan siber terdeteksi — Indonesia 2025</Pill>
          <h1 className="mt-5 mb-4 text-3xl md:text-4xl lg:text-[44px]" style={{ fontFamily: FONT_DISPLAY, fontWeight: 400, lineHeight: 1.1, color: C.text }}>
            Sebelum kamu klik,<br /><em style={{ fontStyle: "italic", color: C.trust, fontWeight: 500 }}>periksa dulu.</em>
          </h1>
          <p className="mb-8" style={{ color: C.muted, fontSize: 14.5, lineHeight: 1.7, maxWidth: 440 }}>
            TrustLink membaca tautan dan pesan seperti orang Indonesia membacanya — termasuk bahasa gaul, klaim hadiah palsu, dan tiruan tampilan bank atau e-commerce lokal.
          </p>
          <div className="flex gap-6 md:gap-8 flex-wrap">
            <div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 20, fontWeight: 600, color: C.text }}>Rp9,1T</div>
              <div style={{ fontSize: 11, color: C.muted, maxWidth: 130 }}>kerugian penipuan digital Nov 2024–Jan 2026</div>
            </div>
            <div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 20, fontWeight: 600, color: C.text }}>70%</div>
              <div style={{ fontSize: 11, color: C.muted, maxWidth: 130 }}>pengambilalihan akun berawal dari WhatsApp</div>
            </div>
          </div>
        </div>

        <div className="rounded-md p-5 md:p-6 relative flex flex-col justify-center" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
          <div className="flex flex-col sm:flex-row gap-2 mb-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runScan()}
              placeholder="Tempel tautan atau pesan..."
              className="flex-1 rounded px-3.5 py-3 text-sm outline-none"
              style={{ background: C.panelRaised, border: `1px solid ${C.line}`, color: C.text, fontFamily: FONT_MONO }}
            />
            <button
              onClick={runScan}
              disabled={scanning}
              className="px-5 py-3 sm:py-0 rounded font-semibold text-sm flex justify-center items-center gap-2 shrink-0 transition-opacity hover:opacity-90 w-full sm:w-auto"
              style={{ background: C.trust, color: "#fff" }}
            >
              {scanning ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
              {scanning ? "Memeriksa" : "Periksa"}
            </button>
          </div>
          <div className="flex gap-2 flex-wrap">
            {["Contoh link phishing bank", "Contoh link resmi", "Contoh hadiah WA", "Contoh pesan JNE palsu"].map((label, i) => (
              <button
                key={i}
                onClick={() => setInput(examples[i])}
                className="text-[11px] md:text-xs rounded-full px-3 py-1.5 transition-colors hover:border-slate-500"
                style={{ border: `1px solid ${C.line}`, color: C.muted, fontFamily: FONT_MONO }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* RESULTS SECTION */}
      {(scanning || result) && (
        <section className="py-10 md:py-12" style={{ borderBottom: `1px solid ${C.line}` }}>
          <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 24, fontWeight: 400, color: C.text }}>Hasil Pemeriksaan</h2>
          {result && (
            <div style={{ fontFamily: FONT_MONO, fontSize: 12, color: C.muted, marginTop: 4, wordBreak: "break-all" }}>
              {result.input} · {result.timestamp}
            </div>
          )}

          <div className="grid lg:grid-cols-[260px_1fr] gap-5 md:gap-6 mt-6 items-start">
            {/* GAUGE CARD */}
            <div className="rounded-md p-6 flex flex-col items-center text-center h-full justify-center" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
              <RiskGauge score={result ? result.score : 0} animate={!!result} />
              {result && (
                <>
                  <div
                    className="mt-4 px-4 py-1.5 rounded text-sm font-semibold"
                    style={{ fontFamily: FONT_MONO, letterSpacing: "0.1em", color: colorForScore(result.score), border: `2px solid ${colorForScore(result.score)}`, transform: "rotate(-3deg)" }}
                  >
                    {result.verdict}
                  </div>
                  <div className="text-xs mt-3 leading-relaxed" style={{ color: C.muted }}>
                    {result.verdict === "BAHAYA" && "Indikasi kuat phishing. Jangan masukkan data pribadi apa pun."}
                    {result.verdict === "WASPADA" && "Beberapa indikator mencurigakan ditemukan. Periksa kembali sebelum lanjut."}
                    {result.verdict === "AMAN" && "Tidak ditemukan indikasi ancaman pada pemeriksaan saat ini. Tetap waspada karena hasil negatif palsu tetap mungkin terjadi."}
                  </div>
                </>
              )}
            </div>

            {/* DETAILS RIGHT SIDE */}
            <div className="flex flex-col gap-4">
              {result && result.explanation && (
                <div className="rounded-md p-4 md:p-5" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
                  <div className="text-sm font-semibold mb-2" style={{ color: C.text }}>Penjelasan</div>
                  <p className="text-[13px] md:text-sm leading-relaxed" style={{ color: C.muted }}>{result.explanation}</p>
                </div>
              )}

              <div className="flex flex-col gap-3">
                {result ? (
                  <>
                    <LayerRow icon={<Globe2 size={16} color={C.ink} />} name="Domain & URL Intelligence" detail={result.layers[0].detail} score={result.layers[0].score} />
                    <LayerRow icon={<Fingerprint size={16} color={C.ink} />} name="Visual Similarity Detection" detail={result.layers[1].detail} score={result.layers[1].score} />
                    <LayerRow icon={<MessageCircle size={16} color={C.ink} />} name="NLP Konteks Pesan (IndoBERT)" detail={result.layers[2].detail} score={result.layers[2].score} />
                  </>
                ) : (
                  <div className="text-sm p-8 text-center rounded-md" style={{ background: C.panel, color: C.muted }}>
                    <Loader2 size={20} className="animate-spin mx-auto mb-2" />
                    Menganalisis tiga lapisan deteksi...
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* TYPOSQUAT CHECK */}
          {result && !result.isTrusted && result.typo && (
            <div className="rounded-md p-4 md:p-5 mt-5" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
              <div className="text-sm font-semibold mb-3" style={{ color: C.text }}>Perbandingan Domain (Typosquat Check)</div>
              <div className="flex flex-col gap-2" style={{ fontFamily: FONT_MONO, fontSize: 13 }}>
                <div className="flex items-center gap-2 flex-wrap">
                  <CheckCircle2 size={14} color={C.safe} className="shrink-0" />
                  <span style={{ color: C.muted }}>Domain resmi:</span>
                  <span style={{ color: C.safe, wordBreak: "break-all" }}>{result.typo.official}</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <XCircle size={14} color={C.danger} className="shrink-0" />
                  <span style={{ color: C.muted }}>Domain diperiksa:</span>
                  <span style={{ wordBreak: "break-all" }}>
                    {result.typo.diff.map((d, i) => (
                      <span key={i} style={{ color: d.bad ? C.danger : C.text, background: d.bad ? "rgba(229,72,77,0.15)" : "transparent" }}>{d.ch}</span>
                    ))}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* FULL SCREEN & CLICKABLE SANDBOX PREVIEW */}
          {result && (
            <div className="rounded-md p-4 md:p-5 mt-5" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4">
                <div className="text-sm font-semibold" style={{ color: C.text }}>Pratinjau Sandbox</div>
                <Pill color={C.safe}>Aman — kamu tidak mengunjungi situs asli</Pill>
              </div>

              <div className="rounded-md overflow-hidden" style={{ background: C.panelRaised, border: `1px solid ${C.line}` }}>
                {/* Browser Header Bar */}
                <div className="flex items-center gap-2 px-3.5 py-2.5" style={{ background: "#10151C", borderBottom: `1px solid ${C.line}` }}>
                  <div className="flex gap-1.5 shrink-0">
                    {[C.danger, C.warn, C.safe].map((c, i) => <div key={i} className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />)}
                  </div>
                  <div className="flex-1 rounded px-3 py-1 text-[10px] md:text-xs flex items-center gap-1.5 truncate" style={{ background: C.panel, color: C.muted, fontFamily: FONT_MONO }}>
                    <Lock size={11} className="shrink-0" /> <span className="truncate">{result.input}</span>
                  </div>
                </div>

                {/* Clickable Sandbox Image Area */}
                <div
                  className={`relative flex items-center justify-center group ${result.screenshotUrl ? 'cursor-pointer' : ''} overflow-hidden`}
                  style={{ height: 320, background: "repeating-linear-gradient(135deg, #1D242E 0px, #1D242E 2px, #171D25 2px, #171D25 30px)" }}
                  onClick={() => result.screenshotUrl && window.open(result.screenshotUrl, "_blank")}
                >
                  {result.screenshotUrl ? (
                    <>
                      <img
                        src={result.screenshotUrl}
                        alt="Tangkapan layar situs"
                        className="w-full h-full object-cover object-top transition-transform duration-700 group-hover:scale-[1.02]"
                      />
                      {/* Hover Overlay */}
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/40 backdrop-blur-[2px]">
                        <div className="flex items-center gap-2 px-4 py-2 rounded-full text-xs md:text-sm font-semibold shadow-lg text-white" style={{ background: C.trust, fontFamily: FONT_MONO }}>
                          <ExternalLink size={15} /> Lihat Ukuran Penuh
                        </div>
                      </div>
                    </>
                  ) : (
                    // Fallback Sketch Container
                    <div className="rounded p-4 md:p-5 shadow-2xl w-[90%] sm:w-[70%] lg:w-[60%] h-auto aspect-video flex flex-col" style={{ background: C.paper, color: "#1a1a1a" }}>
                      <div className="flex justify-between items-center mb-3 md:mb-4">
                        <div style={{ fontWeight: 700, fontSize: 13, color: "#1a4d99" }} className="truncate pr-2">
                          {result.score > 50 ? "SITUS-TIDAK-DIKENAL" : (result.typo ? result.typo.official : "situs-resmi")}
                        </div>
                        <div className="text-white text-[9px] px-2.5 py-1 rounded shrink-0" style={{ background: "#1a4d99" }}>Masuk</div>
                      </div>
                      <div className="h-2 rounded mb-2" style={{ width: "70%", background: "#00000014" }} />
                      <div className="h-2 rounded mb-3 md:mb-4" style={{ width: "45%", background: "#00000014" }} />
                      <div className="h-6 md:h-8 rounded mb-2 bg-white" style={{ border: "1px solid #00000022" }} />
                      <div className="h-6 md:h-8 rounded bg-white" style={{ width: "60%", border: "1px solid #00000022" }} />
                      {result.score > 65 && (
                        <div className="absolute bottom-4 right-4 text-white text-[9px] md:text-[10px] px-2 py-1 rounded shadow-md" style={{ background: C.danger, fontFamily: FONT_MONO }}>
                          DOMAIN BARU · {result.tech.domainAge}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <p className="text-[11px] md:text-xs mt-3 leading-relaxed" style={{ color: C.muted }}>
                Halaman ini diambil oleh peramban headless terisolasi di server TrustLink lalu ditampilkan sebagai <b style={{ color: C.text }}>gambar statis</b>. Skrip dari situs asli tidak pernah berjalan di perangkatmu.
              </p>

              {/* Toggle Rincian Teknis */}
              <button onClick={() => setShowTech(!showTech)} className="flex items-center gap-1.5 text-xs mt-4" style={{ color: C.trust, fontFamily: FONT_MONO }}>
                {showTech ? <ChevronUp size={13} /> : <ChevronDown size={13} />} Rincian teknis
              </button>
              {showTech && (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px] md:text-xs p-4 rounded" style={{ background: C.panelRaised, fontFamily: FONT_MONO, color: C.muted }}>
                  <div>Usia domain: <span style={{ color: C.text }}>{result.tech.domainAge}</span></div>
                  <div>Sertifikat SSL: <span style={{ color: C.text }}>{result.tech.ssl}</span></div>
                  <div>Jumlah redirect: <span style={{ color: C.text }}>{result.tech.redirects}</span></div>
                  <div>Hosting: <span style={{ color: C.text }}>{result.tech.hosting}</span></div>
                </div>
              )}

              {/* ACTION BUTTONS WITH TOAST */}
              <div className="flex gap-2.5 mt-5 flex-col sm:flex-row relative">
                {copied && (
                  <div
                    className="absolute -top-12 left-0 right-0 sm:right-auto px-4 py-2 rounded-md text-xs flex items-center justify-center sm:justify-start gap-2 shadow-lg animate-bounce z-50"
                    style={{ background: C.safe, color: "#fff", fontFamily: FONT_MONO }}
                  >
                    <CheckCircle2 size={14} /> Ringkasan hasil disalin!
                  </div>
                )}

                <button
                  onClick={() => {
                    const textToShare = `🚨 [TrustLink Warning]\nAtas Pengecekan Target: ${result.input}\nSkor Risiko: ${result.score}% (${result.verdict})\n\nPenjelasan: ${result.explanation}\n\nPeriksa tautan Anda di TrustLink!`;
                    navigator.clipboard.writeText(textToShare);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 3000);
                  }}
                  className="w-full sm:flex-1 py-3.5 sm:py-3 rounded text-sm font-semibold transition-all hover:brightness-125"
                  style={{ background: C.panelRaised, border: `1px solid ${C.line}`, color: C.text }}
                >
                  Bagikan Hasil
                </button>

                <button
                  onClick={submitReport}
                  disabled={reported}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3.5 sm:py-3 rounded text-sm font-semibold transition-all hover:bg-red-500/10"
                  style={{ background: "transparent", border: `1px solid ${C.danger}`, color: C.danger, opacity: reported ? 0.6 : 1 }}
                >
                  <Flag size={14} /> {reported ? "Sudah dilaporkan" : "Laporkan sebagai Phishing"}
                </button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

/* ---------------------------------------------------------
   HISTORY TAB
--------------------------------------------------------- */
function HistoryTab({ history, setHistory }) {
  const clear = () => {
    setHistory([]);
    saveJSON("scan-history", false, []);
  };
  return (
    <div className="max-w-3xl mx-auto px-5 md:px-12 py-10 md:py-14 w-full flex-1">
      <div className="flex justify-between items-center mb-6 md:mb-8">
        <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 24, fontWeight: 400, color: C.text }}>Riwayat Pemeriksaanmu</h2>
        {history.length > 0 && (
          <button onClick={clear} className="flex items-center gap-1.5 text-[11px] md:text-xs transition-colors hover:text-red-400" style={{ color: C.muted, fontFamily: FONT_MONO }}>
            <Trash2 size={13} /> Hapus semua
          </button>
        )}
      </div>
      {history.length === 0 ? (
        <div className="text-sm py-16 text-center rounded-md px-4" style={{ color: C.muted, border: `1px dashed ${C.line}` }}>
          Belum ada riwayat. Hasil pemeriksaanmu tersimpan otomatis di sini — hanya terlihat olehmu.
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {history.map((h) => (
            <div key={h.id} className="flex items-center gap-3 md:gap-4 rounded-md p-3.5 md:p-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
              <div className="w-8 h-8 md:w-9 md:h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: colorForScore(h.score) }}>
                {h.verdict === "AMAN" ? <ShieldCheck size={16} color={C.ink} /> : <ShieldAlert size={16} color={C.ink} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] md:text-sm truncate" style={{ fontFamily: FONT_MONO, color: C.text }}>{h.input}</div>
                <div className="text-[11px] md:text-xs" style={{ color: C.muted }}>{h.timestamp}</div>
              </div>
              <div style={{ fontFamily: FONT_MONO, fontWeight: 600, color: colorForScore(h.score) }}>{h.score}%</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------
   COMMUNITY TAB
--------------------------------------------------------- */
function CommunityTab({ reports }) {
  return (
    <div className="max-w-3xl mx-auto px-5 md:px-12 py-10 md:py-14 w-full flex-1">
      <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 24, fontWeight: 400, color: C.text }}>Laporan Komunitas</h2>
      <p className="text-[13px] md:text-sm mt-2 mb-6 md:mb-8" style={{ color: C.muted, maxWidth: 520 }}>
        Tautan yang dilaporkan pengguna lain lewat tombol "Laporkan sebagai Phishing". Status "terverifikasi" berarti sudah dicek ulang oleh tim/model sebelum masuk basis data publik — mencegah laporan asal yang bisa merugikan domain sah.
      </p>
      {reports.length === 0 ? (
        <div className="text-sm py-16 text-center rounded-md px-4" style={{ color: C.muted, border: `1px dashed ${C.line}` }}>
          Belum ada laporan dari komunitas.
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {reports.map((r) => (
            <div key={r.id} className="flex items-center gap-3 md:gap-4 rounded-md p-3.5 md:p-4" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
              <Flag size={16} color={r.status === "terverifikasi" ? C.danger : C.warn} className="shrink-0 hidden sm:block" />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] md:text-sm truncate flex items-center gap-2" style={{ fontFamily: FONT_MONO, color: C.text }}>
                  <Flag size={12} color={r.status === "terverifikasi" ? C.danger : C.warn} className="shrink-0 sm:hidden" />
                  <span className="truncate">{r.input}</span>
                </div>
                <div className="text-[11px] md:text-xs" style={{ color: C.muted }}>{r.timestamp}</div>
              </div>
              <span
                className="text-[9px] md:text-[10px] px-2 py-1 md:px-2.5 rounded-full shrink-0"
                style={{ fontFamily: FONT_MONO, color: r.status === "terverifikasi" ? C.danger : C.warn, border: `1px solid ${r.status === "terverifikasi" ? C.danger : C.warn}` }}
              >
                {r.status}
              </span>
            </div>
          ))}
        </div>
      )}
      <p className="text-[11px] md:text-xs mt-6" style={{ color: C.muted }}>
        Data laporan di atas tersimpan permanen di database backend TrustLink.
      </p>
    </div>
  );
}

/* ---------------------------------------------------------
   COMPARISON TAB
--------------------------------------------------------- */
function ComparisonTab() {
  return (
    <div className="max-w-4xl mx-auto px-5 md:px-12 py-10 md:py-14 w-full flex-1">
      <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 24, fontWeight: 400, color: C.text }}>TrustLink vs. Tool yang Sudah Ada</h2>
      <p className="text-[13px] md:text-sm mt-2 mb-6 md:mb-8" style={{ color: C.muted, maxWidth: 560 }}>
        Berdasarkan riset terhadap tool pemeriksa link yang aktif digunakan saat ini. Tidak ada satu pun yang menggabungkan analisis visual, NLP Bahasa Indonesia, dan titik masuk WhatsApp sekaligus.
      </p>
      <div className="overflow-x-auto rounded-md no-scrollbar" style={{ border: `1px solid ${C.line}` }}>
        <table className="w-full text-sm min-w-[600px]" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: C.panel }}>
              <th className="text-left p-3.5 font-normal" style={{ color: C.muted, fontFamily: FONT_MONO, fontSize: 11 }}>FITUR</th>
              {COMPETITORS.map((c) => (
                <th key={c.name} className="text-center p-3.5 font-semibold" style={{ color: c.us ? C.trust : C.text, fontSize: 12.5 }}>{c.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {FEATURE_MATRIX.map((row, i) => (
              <tr key={i} style={{ borderTop: `1px solid ${C.line}`, background: i % 2 === 0 ? "transparent" : C.panel }}>
                <td className="p-3.5 text-[11px] md:text-xs" style={{ color: C.text }}>{row.label}</td>
                {row.vals.map((v, j) => (
                  <td key={j} className="text-center p-3.5">
                    {v === true && <CheckCircle2 size={16} color={C.safe} className="inline" />}
                    {v === false && <XCircle size={16} color={C.muted} className="inline" style={{ opacity: 0.4 }} />}
                    {v === "sebagian" && <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: C.warn }}>sebagian</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   HOW IT WORKS TAB
--------------------------------------------------------- */
function HowItWorksTab() {
  const cards = [
    { n: "01", title: "Domain & URL Intelligence", body: "Memeriksa usia domain, sertifikat SSL, entropi URL, dan mencocokkan dengan basis data ancaman seperti VirusTotal dan PhishTank." },
    { n: "02", title: "Visual Similarity Detection", body: "Mengambil tangkapan layar situs secara aman di sandbox, lalu membandingkannya dengan basis data visual brand perbankan & e-commerce Indonesia." },
    { n: "03", title: "NLP Konteks Pesan", body: "Model IndoBERT terlatih khusus mengenali pola manipulasi psikologis dan bahasa gaul scammer dalam Bahasa Indonesia." },
  ];
  return (
    <div className="max-w-4xl mx-auto px-5 md:px-12 py-10 md:py-14 w-full flex-1">
      <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 24, fontWeight: 400, color: C.text, maxWidth: 480 }}>
        Tiga lapisan berjalan paralel, hasilnya digabung jadi satu skor beralasan.
      </h2>
      <div className="grid md:grid-cols-3 gap-px mt-6 md:mt-8 rounded-md overflow-hidden" style={{ background: C.line, border: `1px solid ${C.line}` }}>
        {cards.map((c) => (
          <div key={c.n} className="p-5 md:p-6" style={{ background: C.ink }}>
            <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: C.muted, marginBottom: 16 }}>LAYER {c.n}</div>
            <h4 className="text-sm md:text-base font-semibold mb-2.5" style={{ color: C.text }}>{c.title}</h4>
            <p className="text-[11px] md:text-xs leading-relaxed" style={{ color: C.muted }}>{c.body}</p>
          </div>
        ))}
      </div>
      <div className="mt-8 md:mt-10 rounded-md p-5 md:p-6" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
        <div className="text-[13px] md:text-sm font-semibold mb-2" style={{ color: C.text }}>Status backend prototipe ini</div>
        <p className="text-[11px] md:text-xs leading-relaxed" style={{ color: C.muted }}>
          Skor dan pratinjau di atas dihasilkan oleh backend FastAPI terintegrasi. Riwayat & laporan komunitas disimpan secara permanen di database backend.
        </p>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   ROOT COMPONENT
--------------------------------------------------------- */
export default function TrustLinkPrototype() {
  const [tab, setTab] = useState("scan");
  const [history, setHistory] = useState([]);
  const [reports, setReports] = useState([]);

  useEffect(() => {
    (async () => {
      setHistory(await loadJSON("scan-history", false, []));
      setReports(await loadJSON("community-reports", true, []));
    })();
  }, []);

  return (
    <div className="flex flex-col min-h-screen" style={{ background: C.ink, fontFamily: FONT_BODY }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;1,9..144,500&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        * { box-sizing: border-box; }
        ::placeholder { color: #5A6472; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      <Nav tab={tab} setTab={setTab} />

      <main className="flex-1 flex flex-col">
        {tab === "scan" && <ScanTab history={history} setHistory={setHistory} reports={reports} setReports={setReports} />}
        {tab === "riwayat" && <HistoryTab history={history} setHistory={setHistory} />}
        {tab === "komunitas" && <CommunityTab reports={reports} />}
        {tab === "perbandingan" && <ComparisonTab />}
        {tab === "cara-kerja" && <HowItWorksTab />}
      </main>

      <footer className="flex flex-col md:flex-row justify-between items-center text-center md:text-left px-5 md:px-12 py-6 mt-auto gap-3 md:gap-2" style={{ borderTop: `1px solid ${C.line}`, color: C.muted, fontSize: 11, fontFamily: FONT_MONO, background: C.ink }}>
        <div>TRUSTLINK — Platform Deteksi Ancaman Phishing Lokal Indonesia</div>
        <div>Copyright 2026</div>
      </footer>
    </div>
  );
}