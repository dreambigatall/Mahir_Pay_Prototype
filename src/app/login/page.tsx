"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Eye,
  EyeOff,
  Lock,
  Mail,
  Stethoscope,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { clinicName, roleHome } from "@/lib/nav";
import { staff } from "@/lib/mock-data";
import { useSession } from "@/lib/session";

/* ---------- Staff credentials map (prototype) ---------- */
const credentialsMap: Record<string, { password: string; staffIndex: number }> = {
  "ama@ridgeway.clinic": { password: "demo", staffIndex: 0 },
  "kwame@ridgeway.clinic": { password: "demo", staffIndex: 1 },
  "akosua@ridgeway.clinic": { password: "demo", staffIndex: 2 },
  "isaac@ridgeway.clinic": { password: "demo", staffIndex: 3 },
  "nadia@ridgeway.clinic": { password: "demo", staffIndex: 4 },
};

/* ---------- Typewriter Component ---------- */

function TypewriterText({ texts }: { texts: string[] }) {
  const [displayedText, setDisplayedText] = useState("");
  const [phase, setPhase] = useState<"typing" | "pausing" | "deleting" | "waiting">("typing");
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    const currentText = texts[index];

    switch (phase) {
      case "typing":
        if (displayedText.length < currentText.length) {
          timeout = setTimeout(() => {
            setDisplayedText(currentText.slice(0, displayedText.length + 1));
          }, 35); // Fast typing speed
        } else {
          timeout = setTimeout(() => setPhase("pausing"), 3000); // Wait 3s after typing finishes
        }
        break;
      case "pausing":
        setPhase("deleting");
        break;
      case "deleting":
        if (displayedText.length > 0) {
          timeout = setTimeout(() => {
            setDisplayedText(currentText.slice(0, displayedText.length - 1));
          }, 15); // Fast deletion speed
        } else {
          timeout = setTimeout(() => setPhase("waiting"), 500); // Brief wait before restarting
        }
        break;
      case "waiting":
        setIndex((prev) => (prev + 1) % texts.length);
        setPhase("typing");
        break;
    }

    return () => clearTimeout(timeout);
  }, [displayedText, phase, index, texts]);

  return (
    <span className="inline-block whitespace-nowrap">
      {displayedText}
      <span className="ml-[2px] inline-block w-[2px] h-[1.1em] align-middle bg-primary animate-pulse" />
    </span>
  );
}

/* ---------- Animated Medical SVG Illustration ---------- */

function MedicalHeroSvg() {
  return (
    <svg viewBox="0 0 800 600" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full max-h-[80vh]">
      {/* CSS Animations */}
      <style>{`
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
        @keyframes pulse { 0%,100%{opacity:.6} 50%{opacity:1} }
        @keyframes heartbeat { 0%,100%{transform:scale(1)} 15%{transform:scale(1.15)} 30%{transform:scale(1)} 45%{transform:scale(1.1)} 60%{transform:scale(1)} }
        @keyframes dash { to{stroke-dashoffset:0} }
        @keyframes fadein { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes rotate { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        .float-1{animation:float 4s ease-in-out infinite}
        .float-2{animation:float 5s ease-in-out infinite .5s}
        .float-3{animation:float 6s ease-in-out infinite 1s}
        .float-4{animation:float 4.5s ease-in-out infinite 1.5s}
        .float-5{animation:float 5.5s ease-in-out infinite 2s}
        .pulse-1{animation:pulse 3s ease-in-out infinite}
        .pulse-2{animation:pulse 3s ease-in-out infinite .8s}
        .pulse-3{animation:pulse 3s ease-in-out infinite 1.6s}
        .heartbeat{animation:heartbeat 1.5s ease-in-out infinite}
        .ecg-line{stroke-dasharray:300;stroke-dashoffset:300;animation:dash 2s linear infinite}
        .fade-1{animation:fadein .6s ease-out both}
        .fade-2{animation:fadein .6s ease-out .2s both}
        .fade-3{animation:fadein .6s ease-out .4s both}
        .spin-slow{animation:rotate 20s linear infinite;transform-origin:400px 300px}
      `}</style>

      {/* Background decorative ring (organic irregular loop) */}
      <path d="M 400 60 C 580 40 680 180 640 320 C 600 460 480 540 380 540 C 220 540 140 420 160 280 C 180 140 280 80 400 60 Z" stroke="hsl(270 33% 60%)" strokeWidth="1.5" strokeOpacity="0.4" fill="none" className="spin-slow" strokeDasharray="8 12" />
      <circle cx="400" cy="300" r="200" fill="hsl(270 100% 96%)" fillOpacity="0.5" />

      {/* Doctor figure - center */}
      <g className="float-1 fade-1" style={{ transformOrigin: '400px 280px' }}>
        {/* Lab coat body */}
        <rect x="355" y="240" width="90" height="120" rx="12" fill="white" stroke="hsl(270 33% 60%)" strokeWidth="2" />
        {/* Coat lapels */}
        <path d="M380 240 L400 270 L420 240" stroke="hsl(270 33% 60%)" strokeWidth="1.5" fill="none" />
        {/* Head */}
        <circle cx="400" cy="218" r="28" fill="hsl(270 100% 96%)" stroke="hsl(270 33% 60%)" strokeWidth="2" />
        {/* Face features */}
        <circle cx="392" cy="214" r="2" fill="hsl(270 33% 60%)" />
        <circle cx="408" cy="214" r="2" fill="hsl(270 33% 60%)" />
        <path d="M394 224 Q400 229 406 224" stroke="hsl(270 33% 60%)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        {/* Stethoscope */}
        <path d="M375 260 Q365 280 370 300 Q375 310 385 305" stroke="hsl(270 91% 36%)" strokeWidth="2" fill="none" strokeLinecap="round" />
        <circle cx="385" cy="305" r="5" fill="hsl(270 91% 36%)" fillOpacity="0.3" stroke="hsl(270 91% 36%)" strokeWidth="1.5" />
        {/* Pocket */}
        <rect x="405" y="290" width="20" height="15" rx="3" fill="hsl(270 100% 96%)" stroke="hsl(270 94% 82%)" strokeWidth="1" />
        {/* Name tag */}
        <rect x="380" y="340" width="40" height="12" rx="2" fill="hsl(270 33% 60%)" />
        <text x="400" y="349" textAnchor="middle" fill="white" fontSize="7" fontFamily="system-ui" fontWeight="600">DR.</text>
      </g>

      {/* Floating clipboard - left */}
      <g className="float-2" style={{ transformOrigin: '180px 220px' }}>
        <rect x="148" y="185" width="64" height="80" rx="6" fill="white" stroke="hsl(270 33% 60%)" strokeWidth="1.5" />
        <rect x="168" y="180" width="24" height="12" rx="4" fill="hsl(270 33% 60%)" />
        <line x1="160" y1="205" x2="200" y2="205" stroke="hsl(270 94% 82%)" strokeWidth="2" strokeLinecap="round" />
        <line x1="160" y1="215" x2="195" y2="215" stroke="hsl(270 94% 82%)" strokeWidth="2" strokeLinecap="round" />
        <line x1="160" y1="225" x2="188" y2="225" stroke="hsl(270 94% 82%)" strokeWidth="2" strokeLinecap="round" />
        <line x1="160" y1="235" x2="192" y2="235" stroke="hsl(270 94% 82%)" strokeWidth="2" strokeLinecap="round" />
        {/* Checkmarks */}
        <path d="M160 245 l3 3 l6-6" stroke="hsl(142 76% 36%)" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M160 255 l3 3 l6-6" stroke="hsl(142 76% 36%)" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>

      {/* Heart with pulse - right top */}
      <g className="float-3 heartbeat" style={{ transformOrigin: '620px 180px' }}>
        <path d="M620 195 C620 180 600 170 600 185 C600 200 620 215 620 215 C620 215 640 200 640 185 C640 170 620 180 620 195Z" fill="hsl(270 33% 60%)" fillOpacity="0.2" stroke="hsl(270 33% 60%)" strokeWidth="1.5" />
      </g>

      {/* ECG wave line */}
      <g className="pulse-1">
        <polyline points="500,180 520,180 530,180 535,160 540,200 545,170 550,185 560,180 580,180 590,180 595,160 600,200 605,170 610,185 620,180"
          stroke="hsl(270 91% 36%)" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="ecg-line" />
      </g>

      {/* DNA Helix - left side */}
      <g className="float-4" style={{ transformOrigin: '120px 400px' }}>
        <path d="M100 360 Q120 380 100 400 Q80 420 100 440 Q120 460 100 480" stroke="hsl(270 33% 60%)" strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d="M140 360 Q120 380 140 400 Q160 420 140 440 Q120 460 140 480" stroke="hsl(270 91% 36%)" strokeWidth="2" fill="none" strokeLinecap="round" />
        {/* Rungs */}
        <line x1="108" y1="370" x2="132" y2="370" stroke="hsl(270 94% 82%)" strokeWidth="1.5" />
        <line x1="100" y1="390" x2="140" y2="390" stroke="hsl(270 94% 82%)" strokeWidth="1.5" />
        <line x1="108" y1="410" x2="132" y2="410" stroke="hsl(270 94% 82%)" strokeWidth="1.5" />
        <line x1="100" y1="430" x2="140" y2="430" stroke="hsl(270 94% 82%)" strokeWidth="1.5" />
        <line x1="108" y1="450" x2="132" y2="450" stroke="hsl(270 94% 82%)" strokeWidth="1.5" />
        <line x1="100" y1="470" x2="140" y2="470" stroke="hsl(270 94% 82%)" strokeWidth="1.5" />
      </g>

      {/* Medicine bottle - right */}
      <g className="float-5" style={{ transformOrigin: '650px 380px' }}>
        <rect x="630" y="355" width="40" height="55" rx="6" fill="white" stroke="hsl(270 33% 60%)" strokeWidth="1.5" />
        <rect x="636" y="345" width="28" height="14" rx="4" fill="hsl(270 33% 60%)" />
        <text x="650" y="385" textAnchor="middle" fill="hsl(270 33% 60%)" fontSize="8" fontFamily="system-ui" fontWeight="700">Rx</text>
        <line x1="638" y1="395" x2="662" y2="395" stroke="hsl(270 94% 82%)" strokeWidth="1.5" strokeLinecap="round" />
      </g>

      {/* Microscope - bottom center */}
      <g className="float-2" style={{ transformOrigin: '400px 460px' }}>
        <rect x="385" y="470" width="30" height="6" rx="2" fill="hsl(270 33% 60%)" />
        <rect x="395" y="430" width="10" height="40" rx="2" fill="hsl(270 33% 60%)" fillOpacity="0.6" />
        <circle cx="400" cy="425" r="12" stroke="hsl(270 33% 60%)" strokeWidth="2" fill="hsl(270 100% 96%)" />
        <path d="M390 425 L370 440" stroke="hsl(270 33% 60%)" strokeWidth="2" strokeLinecap="round" />
        <circle cx="400" cy="425" r="4" fill="hsl(270 91% 36%)" fillOpacity="0.2" />
      </g>

      {/* Shield / protection icon - top left */}
      <g className="float-3" style={{ transformOrigin: '220px 120px' }}>
        <path d="M220 100 L245 110 L245 130 Q245 150 220 160 Q195 150 195 130 L195 110 Z" fill="hsl(270 33% 60%)" fillOpacity="0.1" stroke="hsl(270 33% 60%)" strokeWidth="1.5" />
        <path d="M212 128 l5 5 l12-12" stroke="hsl(270 91% 36%)" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>

      {/* Cross/plus symbols scattered */}
      <g className="pulse-2">
        <rect x="530" y="100" width="16" height="4" rx="2" fill="hsl(270 33% 60%)" fillOpacity="0.3" />
        <rect x="536" y="94" width="4" height="16" rx="2" fill="hsl(270 33% 60%)" fillOpacity="0.3" />
      </g>
      <g className="pulse-3">
        <rect x="280" y="450" width="12" height="3" rx="1.5" fill="hsl(270 91% 36%)" fillOpacity="0.25" />
        <rect x="284.5" y="445.5" width="3" height="12" rx="1.5" fill="hsl(270 91% 36%)" fillOpacity="0.25" />
      </g>
      <g className="pulse-1">
        <rect x="680" y="280" width="14" height="3.5" rx="1.75" fill="hsl(270 33% 60%)" fillOpacity="0.2" />
        <rect x="685.25" y="274.75" width="3.5" height="14" rx="1.75" fill="hsl(270 33% 60%)" fillOpacity="0.2" />
      </g>

      {/* Floating pills */}
      <g className="float-4" style={{ transformOrigin: '560px 430px' }}>
        <rect x="545" y="420" width="30" height="14" rx="7" fill="hsl(270 33% 60%)" fillOpacity="0.15" stroke="hsl(270 33% 60%)" strokeWidth="1" />
        <line x1="560" y1="420" x2="560" y2="434" stroke="hsl(270 33% 60%)" strokeWidth="0.8" />
      </g>
      <g className="float-1" style={{ transformOrigin: '300px 350px' }}>
        <rect x="285" y="342" width="26" height="12" rx="6" fill="hsl(270 91% 36%)" fillOpacity="0.12" stroke="hsl(270 91% 36%)" strokeWidth="1" transform="rotate(-30, 298, 348)" />
      </g>

      {/* Floating circles / particles */}
      <circle cx="170" cy="300" r="4" fill="hsl(270 33% 60%)" fillOpacity="0.15" className="pulse-1" />
      <circle cx="700" cy="160" r="5" fill="hsl(270 91% 36%)" fillOpacity="0.12" className="pulse-2" />
      <circle cx="500" cy="480" r="3" fill="hsl(270 33% 60%)" fillOpacity="0.2" className="pulse-3" />
      <circle cx="320" cy="140" r="3.5" fill="hsl(270 94% 82%)" fillOpacity="0.4" className="pulse-1" />
      <circle cx="680" cy="440" r="4.5" fill="hsl(270 94% 82%)" fillOpacity="0.3" className="pulse-2" />
      <circle cx="250" cy="500" r="3" fill="hsl(270 91% 36%)" fillOpacity="0.15" className="pulse-3" />

      {/* Text labels floating */}
      <g className="fade-2 float-3" style={{ transformOrigin: '620px 320px' }}>
        <rect x="590" y="308" width="60" height="22" rx="11" fill="hsl(270 33% 60%)" fillOpacity="0.1" />
        <text x="620" y="323" textAnchor="middle" fill="hsl(270 33% 60%)" fontSize="9" fontFamily="system-ui" fontWeight="600">HIPAA</text>
      </g>
      <g className="fade-3 float-5" style={{ transformOrigin: '200px 460px' }}>
        <rect x="168" y="448" width="64" height="22" rx="11" fill="hsl(270 91% 36%)" fillOpacity="0.1" />
        <text x="200" y="463" textAnchor="middle" fill="hsl(270 91% 36%)" fontSize="9" fontFamily="system-ui" fontWeight="600">HL7 FHIR</text>
      </g>
      <g className="fade-1 float-2" style={{ transformOrigin: '480px 120px' }}>
        <rect x="452" y="108" width="56" height="22" rx="11" fill="hsl(270 33% 60%)" fillOpacity="0.1" />
        <text x="480" y="123" textAnchor="middle" fill="hsl(270 33% 60%)" fontSize="9" fontFamily="system-ui" fontWeight="600">ICD-10</text>
      </g>
    </svg>
  );
}

export default function LoginPage() {
  const { login } = useSession();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = () => {
    setError("");
    const cred = credentialsMap[email.trim().toLowerCase()];
    if (!cred || cred.password !== password) {
      setError("Invalid email or password. Try any staff email with password 'demo'");
      return;
    }
    setLoading(true);
    const person = staff[cred.staffIndex];
    setTimeout(() => {
      login(person);
      router.push(roleHome[person.role]);
    }, 400);
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Left Panel — Animated Medical SVG (3/4 width) */}
      <div className="hidden lg:flex flex-col flex-1 items-center justify-center bg-surface-1 relative overflow-hidden">
        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-clinical-fill/5" />
        <div className="absolute inset-0 bg-gradient-to-t from-surface-1 via-transparent to-surface-1/50" />

        {/* Top text overlay */}
        <div className="relative z-10 text-center px-8 mb-4 mt-[-4rem]">
          <h2 className="text-5xl font-bold font-heading text-foreground tracking-tight">
            Streamlined clinical workflows
          </h2>
          <p className="mt-4 text-lg text-fg-secondary mx-auto h-[28px] whitespace-nowrap">
            <TypewriterText texts={[
              "Real-time patient management, diagnostic tracking, and unified billing in one integrated platform.",
              "Secure, HIPAA-compliant electronic health records with instant clinical history access.",
              "Seamless laboratory integration for rapid results and automated doctor notifications.",
              "Intelligent queue management and automated billing to reduce wait times and boost revenue."
            ]} />
          </p>
        </div>

        <div className="relative z-10 w-full max-w-3xl px-12">
          <MedicalHeroSvg />
        </div>

        {/* Corner decorative shapes */}
        <svg className="absolute bottom-0 left-0 w-64 h-64 text-primary/5" viewBox="0 0 200 200" fill="currentColor">
          <circle cx="0" cy="200" r="180" />
        </svg>
        <svg className="absolute top-0 right-0 w-48 h-48 text-clinical-fill/5" viewBox="0 0 200 200" fill="currentColor">
          <circle cx="200" cy="0" r="160" />
        </svg>
      </div>

      {/* Right Panel — Login Form */}
      <div className="w-full lg:w-[45%] lg:min-w-[420px] lg:max-w-[600px] flex flex-col justify-center px-8 py-10 lg:px-12 border-l border-border/40 bg-background relative z-10">
        <div className="w-full max-w-md mx-auto">
          {/* Brand Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
                <Stethoscope className="size-5.5 text-white" strokeWidth={2} />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground tracking-tight">{clinicName}</h1>
                <p className="text-[12px] text-fg-muted">Clinical management system</p>
              </div>
            </div>
            <h2 className="text-[18px] font-semibold text-foreground">
              Sign in to your account
            </h2>
            <p className="mt-1 text-[13px] text-fg-secondary leading-relaxed">
              Enter your credentials to access the clinical workspace.
            </p>
          </div>

          {/* Login Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleLogin();
            }}
            className="space-y-4"
          >
            {/* Email */}
            <div className="grid gap-1.5">
              <Label htmlFor="login-email" className="text-[13px]">
                Email address
              </Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-muted" />
                <Input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(""); }}
                  placeholder="you@ridgeway.clinic"
                  className="h-10 pl-9 bg-background text-[13px]"
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Password */}
            <div className="grid gap-1.5">
              <Label htmlFor="login-password" className="text-[13px]">
                Password
              </Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-muted" />
                <Input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  placeholder="Enter password"
                  className="h-10 pl-9 pr-10 bg-background text-[13px]"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute top-1/2 right-3 -translate-y-1/2 text-fg-muted hover:text-foreground cursor-pointer"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="rounded-lg bg-danger-bg px-3 py-2 text-[12px] text-danger-text">
                {error}
              </div>
            )}

            {/* Submit */}
            <Button type="submit" className="w-full h-10 gap-2" disabled={loading}>
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in…
                </span>
              ) : (
                "Sign in"
              )}
            </Button>
          </form>

          {/* Quick access hint */}
          <div className="mt-6 rounded-xl border border-border/60 bg-surface-1/50 p-3.5">
            <p className="text-[11px] font-semibold text-fg-muted uppercase tracking-wider mb-2">
              Demo credentials
            </p>
            <div className="space-y-1 text-[12px] text-fg-secondary">
              <p><span className="font-mono text-foreground">ama@ridgeway.clinic</span> — Receptionist</p>
              <p><span className="font-mono text-foreground">kwame@ridgeway.clinic</span> — Doctor</p>
              <p><span className="font-mono text-foreground">isaac@ridgeway.clinic</span> — Lab</p>
              <p><span className="font-mono text-foreground">nadia@ridgeway.clinic</span> — Admin</p>
              <p className="mt-1.5 text-fg-muted">Password for all: <span className="font-mono text-foreground">demo</span></p>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-6 pt-4 border-t border-border/40">
            <p className="text-center text-[11px] text-fg-muted">
              {clinicName} · Halid Clinical System
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
