"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Bell,
  Check,
  FlaskConical,
  GripVertical,
  Moon,
  Receipt,
  Search,
  Stethoscope,
  Sun,
  UserRound,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

const NAV = [
  { id: "principles", label: "Principles" },
  { id: "color", label: "Color" },
  { id: "typography", label: "Typography" },
  { id: "spacing", label: "Spacing" },
  { id: "radius", label: "Radius" },
  { id: "buttons", label: "Buttons" },
  { id: "forms", label: "Forms" },
  { id: "badges", label: "Badges" },
  { id: "cards", label: "Cards" },
  { id: "kanban", label: "Kanban" },
  { id: "tables", label: "Tables" },
  { id: "icons", label: "Icons" },
  { id: "elevation", label: "Elevation" },
  { id: "motion", label: "Motion" },
];

export function DesignGallery() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-56 border-r border-border bg-surface-1 lg:flex lg:flex-col">
        <div className="border-b border-border px-4 py-4">
          <p className="text-[13px] font-medium text-fg-muted">Clinic CMS</p>
          <p className="text-sm font-semibold">Design system</p>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
          {NAV.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className="block rounded-md px-2.5 py-1.5 text-[13px] text-fg-secondary hover:bg-surface-2 hover:text-foreground"
            >
              {item.label}
            </a>
          ))}
        </nav>
      </aside>

      <main className="lg:pl-56">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/95 px-6 py-3 backdrop-blur">
          <div>
            <h1 className="text-[24px] leading-[1.3] font-semibold">
              Clinic design system
            </h1>
            <p className="text-[13px] text-fg-muted">
              shadcn/ui · Tailwind CSS · compact staff density
            </p>
          </div>
          <Button variant="outline" onClick={() => setDark((v) => !v)}>
            {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
            {dark ? "Light mode" : "Dark mode"}
          </Button>
        </header>

        <div className="mx-auto max-w-[1200px] px-6 pb-20">
          <Principles />
          <Color />
          <Typography />
          <Spacing />
          <Radius />
          <Buttons />
          <Forms />
          <Badges />
          <Cards />
          <Kanban />
          <Tables />
          <Icons />
          <Elevation />
          <Motion />
        </div>
      </main>
    </div>
  );
}

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-20 space-y-5 border-b border-border py-10 last:border-b-0"
    >
      <div>
        <h2 className="text-[18px] leading-[1.35] font-semibold">{title}</h2>
        {description ? (
          <p className="mt-1 max-w-2xl text-[13px] leading-[1.5] text-fg-secondary">
            {description}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function Principles() {
  const items = [
    {
      title: "Clarity over decoration",
      body: "No gradients, no card shadows, no visual noise. Flat surfaces and hairline borders.",
    },
    {
      title: "Color carries meaning",
      body: "Red, amber, and green are reserved for clinical and billing states. Never decorative.",
    },
    {
      title: "One primary action",
      body: "Each screen has one near-black primary button. Everything else is secondary or ghost.",
    },
    {
      title: "Compact density",
      body: "Staff dashboards stay tight: 36px controls, 44px table rows, 14px body text.",
    },
  ];

  return (
    <Section
      id="principles"
      title="Principles"
      description="This is a clinical tool used under time pressure. The UI should stay calm, readable, and obvious."
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <div
            key={item.title}
            className="rounded-xl border border-border bg-surface-2 p-4"
          >
            <p className="text-[15px] font-medium">{item.title}</p>
            <p className="mt-1 text-[13px] text-fg-secondary">{item.body}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

function Swatch({
  name,
  token,
  className,
  hex,
}: {
  name: string;
  token: string;
  className: string;
  hex: string;
}) {
  return (
    <div className="min-w-0">
      <div className={`h-16 rounded-lg border border-border ${className}`} />
      <p className="mt-2 text-[13px] font-medium">{name}</p>
      <p className="font-mono text-[12px] text-fg-muted">{token}</p>
      <p className="font-mono text-[12px] text-fg-muted">{hex}</p>
    </div>
  );
}

function Color() {
  return (
    <Section
      id="color"
      title="Color"
      description="Tokens only — never hardcode hex in components. Semantic roles are for clinical and billing states."
    >
      <h3 className="text-[15px] font-medium">Base neutrals</h3>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Swatch name="Background" token="--background" className="bg-background" hex="#FFFFFF" />
        <Swatch name="Surface 1" token="--surface-1" className="bg-surface-1" hex="#F7F7F5" />
        <Swatch name="Surface 2" token="--surface-2" className="bg-surface-2" hex="#FFFFFF" />
        <Swatch name="Border" token="--border" className="bg-border" hex="#E5E4DF" />
        <Swatch name="Border strong" token="--border-strong" className="bg-border-strong" hex="#D3D1C7" />
        <Swatch name="Text primary" token="--text-primary" className="bg-foreground" hex="#1A1A18" />
        <Swatch name="Text secondary" token="--text-secondary" className="bg-fg-secondary" hex="#5F5E5A" />
        <Swatch name="Text muted" token="--text-muted" className="bg-fg-muted" hex="#888780" />
      </div>

      <h3 className="pt-2 text-[15px] font-medium">Semantic roles</h3>
      <div className="overflow-x-auto rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-[12px] font-medium text-fg-secondary">Role</TableHead>
              <TableHead className="text-[12px] font-medium text-fg-secondary">Meaning</TableHead>
              <TableHead className="text-[12px] font-medium text-fg-secondary">Tint</TableHead>
              <TableHead className="text-[12px] font-medium text-fg-secondary">Text</TableHead>
              <TableHead className="text-[12px] font-medium text-fg-secondary">Fill</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <RoleRow role="Danger" meaning="Abnormal, overdue, cancelled" bg="bg-danger-bg" text="bg-danger-text" fill="bg-danger-fill" />
            <RoleRow role="Warning" meaning="Pending, waiting, partial pay" bg="bg-warning-bg" text="bg-warning-text" fill="bg-warning-fill" />
            <RoleRow role="Success" meaning="Normal, paid, completed" bg="bg-success-bg" text="bg-success-text" fill="bg-success-fill" />
            <RoleRow role="Clinical" meaning="Active visit, links, selected" bg="bg-clinical-bg" text="bg-clinical-text" fill="bg-clinical-fill" />
            <RoleRow role="Neutral" meaning="Queued, draft, archived" bg="bg-neutral-bg" text="bg-neutral-text" fill="bg-neutral-fill" />
            <RoleRow role="Info" meaning="Admin / audit / system" bg="bg-info-bg" text="bg-info-text" fill="bg-info-fill" />
          </TableBody>
        </Table>
      </div>
    </Section>
  );
}

function RoleRow({
  role,
  meaning,
  bg,
  text,
  fill,
}: {
  role: string;
  meaning: string;
  bg: string;
  text: string;
  fill: string;
}) {
  return (
    <TableRow>
      <TableCell className="font-medium">{role}</TableCell>
      <TableCell className="text-fg-secondary">{meaning}</TableCell>
      <TableCell>
        <span className={`inline-block size-6 rounded-md border border-border ${bg}`} />
      </TableCell>
      <TableCell>
        <span className={`inline-block size-6 rounded-md border border-border ${text}`} />
      </TableCell>
      <TableCell>
        <span className={`inline-block size-6 rounded-md border border-border ${fill}`} />
      </TableCell>
    </TableRow>
  );
}

function Typography() {
  return (
    <Section
      id="typography"
      title="Typography"
      description="Inter for UI. JetBrains Mono for patient IDs, invoice numbers, and lab codes. Weights: 400 and 500/600 only."
    >
      <div className="space-y-4 rounded-xl border border-border bg-surface-2 p-5">
        <TypeRow token="text-title" spec="24 / 600 / 1.3" className="text-[24px] leading-[1.3] font-semibold">
          Maria Chen — Visit #7
        </TypeRow>
        <TypeRow token="text-h2" spec="18 / 600 / 1.35" className="text-[18px] leading-[1.35] font-semibold">
          Lab results
        </TypeRow>
        <TypeRow token="text-h3" spec="15 / 500 / 1.4" className="text-[15px] leading-[1.4] font-medium">
          Card labels
        </TypeRow>
        <TypeRow token="text-body" spec="14 / 400 / 1.6" className="text-[14px] leading-[1.6]">
          Default UI text, table cells, and form labels.
        </TypeRow>
        <TypeRow token="text-sm" spec="13 / 400 / 1.5" className="text-[13px] leading-[1.5] text-fg-secondary">
          Secondary text, metadata, timestamps
        </TypeRow>
        <TypeRow token="text-xs" spec="12 / 500 / 1.4" className="text-[12px] leading-[1.4] font-medium text-fg-secondary">
          Badges, pills, table headers
        </TypeRow>
        <TypeRow token="text-metric" spec="24 / 600 / 1.2 · tabular" className="text-[24px] leading-[1.2] font-semibold tabular-nums">
          1,248
        </TypeRow>
        <TypeRow token="font-mono" spec="IDs and codes" className="font-mono text-[14px]">
          PT-00482 · INV-1094 · CBC-12
        </TypeRow>
      </div>
    </Section>
  );
}

function TypeRow({
  token,
  spec,
  className,
  children,
}: {
  token: string;
  spec: string;
  className: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-[160px_1fr]">
      <div>
        <p className="font-mono text-[12px] text-fg-muted">{token}</p>
        <p className="text-[12px] text-fg-muted">{spec}</p>
      </div>
      <p className={className}>{children}</p>
    </div>
  );
}

function Spacing() {
  const spaces = [
    { token: "xs", px: 4, className: "w-1" },
    { token: "sm", px: 8, className: "w-2" },
    { token: "md", px: 12, className: "w-3" },
    { token: "lg", px: 16, className: "w-4" },
    { token: "xl", px: 24, className: "w-6" },
    { token: "2xl", px: 32, className: "w-8" },
  ];

  return (
    <Section
      id="spacing"
      title="Spacing"
      description="4px base. Map to Tailwind 1, 2, 3, 4, 6, 8. Page content max-width 680–1200px with 24px gutters."
    >
      <div className="space-y-3">
        {spaces.map((space) => (
          <div key={space.token} className="flex items-center gap-4">
            <span className="w-24 font-mono text-[12px] text-fg-muted">
              {space.token} · {space.px}px
            </span>
            <div className={`h-3 bg-clinical-fill ${space.className}`} />
          </div>
        ))}
      </div>
    </Section>
  );
}

function Radius() {
  return (
    <Section
      id="radius"
      title="Radius"
      description="Calm corners. Pills are for status only — never for buttons."
    >
      <div className="flex flex-wrap gap-6">
        <RadiusDemo label="sm · 6px" className="rounded-md" />
        <RadiusDemo label="default · 8px" className="rounded-lg" />
        <RadiusDemo label="card · 12px" className="rounded-xl" />
        <RadiusDemo label="pill · 999px" className="rounded-full" />
      </div>
    </Section>
  );
}

function RadiusDemo({ label, className }: { label: string; className: string }) {
  return (
    <div className="space-y-2">
      <div className={`size-20 border border-border-strong bg-surface-1 ${className}`} />
      <p className="text-[12px] text-fg-secondary">{label}</p>
    </div>
  );
}

function Buttons() {
  return (
    <Section
      id="buttons"
      title="Buttons"
      description="Rectangular, 36px tall, 8px corners. One primary action per screen. Pills are never used for actions."
    >
      <div className="flex flex-wrap items-center gap-3">
        <Button>Complete visit</Button>
        <Button variant="outline">Order lab test</Button>
        <Button variant="ghost">View</Button>
        <Button variant="destructive">Void invoice</Button>
        <Button disabled>Unavailable</Button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button size="lg">Patient-facing CTA · 40px</Button>
        <Button size="icon" aria-label="Search">
          <Search className="size-4" />
        </Button>
      </div>
      <p className="text-[13px] text-fg-muted">
        Primary is near-black, not blue. Blue is reserved for active clinical state and links.
      </p>
    </Section>
  );
}

function Forms() {
  return (
    <Section
      id="forms"
      title="Forms"
      description="36px inputs, 6px radius, accent ring on focus. Errors always include a message — never color alone."
    >
      <div className="grid max-w-xl gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="patient-name" className="text-[14px] font-normal">
            Full name
          </Label>
          <Input id="patient-name" placeholder="Maria Chen" defaultValue="Maria Chen" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="phone" className="text-[14px] font-normal">
            Phone number
          </Label>
          <Input
            id="phone"
            placeholder="Search by phone"
            aria-invalid
            defaultValue="07"
          />
          <p className="text-[13px] text-danger-text">Enter a valid 10-digit phone number.</p>
        </div>
        <div className="grid gap-1.5">
          <Label className="text-[14px] font-normal">Assigned doctor</Label>
          <Select defaultValue="osei">
            <SelectTrigger className="h-9 w-full">
              <SelectValue placeholder="Select doctor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="osei">Dr. Osei</SelectItem>
              <SelectItem value="mensah">Dr. Mensah</SelectItem>
              <SelectItem value="kofi">Dr. Kofi</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="notes" className="text-[14px] font-normal">
            Examination notes
          </Label>
          <Textarea id="notes" placeholder="Chief complaint, findings…" />
        </div>
        <div className="flex items-center gap-2">
          <Checkbox id="allergy" defaultChecked />
          <Label htmlFor="allergy" className="text-[14px] font-normal">
            Known drug allergy
          </Label>
        </div>
        <RadioGroup defaultValue="routine" className="gap-3">
          <div className="flex items-center gap-2">
            <RadioGroupItem value="routine" id="routine" />
            <Label htmlFor="routine" className="text-[14px] font-normal">
              Routine
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="urgent" id="urgent" />
            <Label htmlFor="urgent" className="text-[14px] font-normal">
              Urgent
            </Label>
          </div>
        </RadioGroup>
      </div>
    </Section>
  );
}

function Badges() {
  return (
    <Section
      id="badges"
      title="Status badges"
      description="Pills use bg + text from the same role. Never mix roles in one pill. Always include a text label."
    >
      <div className="flex flex-wrap gap-2">
        <StatusBadge role="success">Normal</StatusBadge>
        <StatusBadge role="danger">High</StatusBadge>
        <StatusBadge role="warning">Pending</StatusBadge>
        <StatusBadge role="success">Paid</StatusBadge>
        <StatusBadge role="danger">Overdue</StatusBadge>
        <StatusBadge role="warning">Partial</StatusBadge>
        <StatusBadge role="clinical">In consultation</StatusBadge>
        <StatusBadge role="neutral">In queue</StatusBadge>
        <StatusBadge role="info">Audit</StatusBadge>
      </div>
      <div className="flex items-center gap-4 text-[13px] text-fg-secondary">
        <span className="inline-flex items-center gap-2">
          <span className="size-2 rounded-full bg-neutral-fill" />
          In queue
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="size-2 rounded-full bg-clinical-fill" />
          In consultation
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="size-2 rounded-full bg-success-fill" />
          Completed
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="size-2 rounded-full bg-danger-fill" />
          Cancelled
        </span>
      </div>
    </Section>
  );
}

function Cards() {
  return (
    <Section
      id="cards"
      title="Cards"
      description="No box-shadow on in-flow cards. Separation comes from a hairline border and surface contrast."
    >
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg bg-surface-1 p-4">
          <p className="text-[13px] text-fg-secondary">Today’s visits</p>
          <p className="mt-1 text-[24px] leading-[1.2] font-semibold tabular-nums">48</p>
          <p className="mt-1 text-[12px] text-fg-muted">Metric card · surface-1 · no border</p>
        </div>
        <Card className="rounded-xl py-4 shadow-none ring-0 ring-offset-0">
          <CardContent className="space-y-1">
            <p className="text-[15px] font-medium">Patient info</p>
            <p className="font-mono text-[12px] text-fg-muted">PT-00482</p>
            <p className="text-[13px] text-fg-secondary">34F · Dr. Osei · Room 3</p>
            <p className="pt-2 text-[12px] text-fg-muted">Content card · 12px radius · hairline border</p>
          </CardContent>
        </Card>
        <div className="rounded-xl border border-border bg-surface-2 p-4 transition-colors hover:border-border-strong">
          <div className="flex items-start justify-between">
            <p className="text-[14px] font-medium">Maria Chen</p>
            <span className="size-2 rounded-full bg-clinical-fill" />
          </div>
          <p className="font-mono text-[12px] text-fg-muted">PT-00482 · 34F</p>
          <p className="mt-3 text-[13px]">Dr. Osei · Room 3</p>
          <p className="text-[12px] text-warning-text">Waiting 12 min</p>
        </div>
      </div>
    </Section>
  );
}

function Kanban() {
  const columns = [
    {
      title: "Checked in",
      count: 2,
      cards: [
        { name: "Ama Boateng", meta: "PT-00490 · 41F", detail: "Dr. Mensah · Room 1", wait: "Waiting 6 min", waitTone: "muted", dot: "bg-neutral-fill" },
        { name: "Kwame Asare", meta: "PT-00491 · 29M", detail: "Dr. Osei · Room 3", wait: "Waiting 22 min", waitTone: "warning", dot: "bg-neutral-fill" },
      ],
    },
    {
      title: "In consultation",
      count: 1,
      cards: [
        { name: "Maria Chen", meta: "PT-00482 · 34F", detail: "Dr. Osei · Room 3", wait: "In room 8 min", waitTone: "muted", dot: "bg-clinical-fill" },
      ],
    },
    {
      title: "Awaiting lab",
      count: 1,
      cards: [
        { name: "Yaw Mensah", meta: "PT-00477 · 52M", detail: "CBC · urgent", wait: "Result pending", waitTone: "warning", dot: "bg-warning-fill" },
      ],
    },
    {
      title: "Ready for billing",
      count: 1,
      cards: [
        { name: "Efua Darko", meta: "PT-00470 · 38F", detail: "Consult + CBC + amox", wait: "Ready", waitTone: "muted", dot: "bg-warning-fill" },
      ],
    },
    {
      title: "Completed",
      count: 1,
      cards: [
        { name: "Kofi Addo", meta: "PT-00461 · 61M", detail: "Paid · GHS 185.00", wait: "Closed 14:22", waitTone: "muted", dot: "bg-success-fill" },
      ],
    },
  ];

  return (
    <Section
      id="kanban"
      title="Kanban"
      description="Fixed columns, 280px wide. Cards are white with a status dot. Time-in-stage turns amber past the wait threshold."
    >
      <div className="flex gap-3 overflow-x-auto pb-2">
        {columns.map((column) => (
          <div
            key={column.title}
            className="w-[280px] shrink-0 rounded-xl bg-surface-1 p-3"
          >
            <div className="mb-3 flex items-center justify-between border-b border-border pb-2">
              <p className="text-[13px] font-medium">{column.title}</p>
              <span className="text-[12px] text-fg-muted">{column.count}</span>
            </div>
            <div className="space-y-2">
              {column.cards.map((card) => (
                <div
                  key={card.name}
                  className="rounded-xl border border-border bg-surface-2 p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <GripVertical className="size-3.5 text-fg-muted" />
                      <p className="text-[14px] font-medium">{card.name}</p>
                    </div>
                    <span className={`mt-1 size-2 shrink-0 rounded-full ${card.dot}`} />
                  </div>
                  <p className="mt-1 font-mono text-[12px] text-fg-muted">{card.meta}</p>
                  <p className="mt-2 text-[13px]">{card.detail}</p>
                  <p
                    className={`text-[12px] ${
                      card.waitTone === "warning" ? "text-warning-text" : "text-fg-muted"
                    }`}
                  >
                    {card.wait}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function Tables() {
  return (
    <Section
      id="tables"
      title="Tables"
      description="Compact 44px rows, sticky sentence-case headers, tabular figures on numeric columns, ghost actions on hover."
    >
      <div className="overflow-hidden rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-11 text-[12px] font-medium text-fg-secondary">
                Patient
              </TableHead>
              <TableHead className="h-11 text-[12px] font-medium text-fg-secondary">
                Visit
              </TableHead>
              <TableHead className="h-11 text-[12px] font-medium text-fg-secondary">
                Status
              </TableHead>
              <TableHead className="h-11 text-right text-[12px] font-medium text-fg-secondary">
                Total
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow className="h-11">
              <TableCell className="font-medium">Maria Chen</TableCell>
              <TableCell className="font-mono text-[13px] text-fg-secondary">
                V-1007
              </TableCell>
              <TableCell>
                <StatusBadge role="clinical">In consultation</StatusBadge>
              </TableCell>
              <TableCell className="text-right tabular-nums">—</TableCell>
            </TableRow>
            <TableRow className="h-11">
              <TableCell className="font-medium">Efua Darko</TableCell>
              <TableCell className="font-mono text-[13px] text-fg-secondary">
                V-1004
              </TableCell>
              <TableCell>
                <StatusBadge role="warning">Ready for billing</StatusBadge>
              </TableCell>
              <TableCell className="text-right tabular-nums">GHS 240.00</TableCell>
            </TableRow>
            <TableRow className="h-11">
              <TableCell className="font-medium">Kofi Addo</TableCell>
              <TableCell className="font-mono text-[13px] text-fg-secondary">
                V-0998
              </TableCell>
              <TableCell>
                <StatusBadge role="success">Paid</StatusBadge>
              </TableCell>
              <TableCell className="text-right tabular-nums">GHS 185.00</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </Section>
  );
}

function Icons() {
  const icons = [
    { icon: UserRound, label: "Patient" },
    { icon: Stethoscope, label: "Doctor" },
    { icon: FlaskConical, label: "Lab" },
    { icon: Receipt, label: "Billing" },
    { icon: Search, label: "Search" },
    { icon: Bell, label: "Alerts" },
    { icon: AlertTriangle, label: "Abnormal" },
    { icon: Check, label: "Complete" },
  ];

  return (
    <Section
      id="icons"
      title="Icons"
      description="Lucide outline icons. 16px inline, 20px in buttons. Inherit text color unless the icon is a semantic alert."
    >
      <div className="flex flex-wrap gap-6">
        {icons.map(({ icon: Icon, label }) => (
          <div key={label} className="flex flex-col items-center gap-2 text-fg-secondary">
            <Icon className="size-5" strokeWidth={1.75} />
            <span className="text-[12px]">{label}</span>
          </div>
        ))}
      </div>
    </Section>
  );
}

function Elevation() {
  return (
    <Section
      id="elevation"
      title="Elevation"
      description="Cards have no shadow. Popovers and dialogs are the only elevated surfaces."
    >
      <div className="flex flex-wrap items-start gap-4">
        <div className="rounded-xl border border-border bg-surface-2 p-4">
          <p className="text-[14px] font-medium">None</p>
          <p className="text-[12px] text-fg-muted">In-flow cards and tables</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">Open popover</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Print receipt</DropdownMenuItem>
            <DropdownMenuItem>View visit</DropdownMenuItem>
            <DropdownMenuItem variant="destructive">Cancel visit</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">Open dialog</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Void invoice?</DialogTitle>
              <DialogDescription>
                This cannot be undone. The visit stays closed and an audit entry is recorded.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline">Keep invoice</Button>
              <Button variant="destructive">Void invoice</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Section>
  );
}

function Motion() {
  return (
    <Section
      id="motion"
      title="Motion"
      description="120–180ms for hover, 200–250ms for panels. Opacity and transform only. Respect reduced motion."
    >
      <div className="flex flex-wrap gap-4">
        <div className="rounded-xl border border-border bg-surface-2 p-4 transition duration-150 ease-out hover:scale-[1.02] hover:shadow-popover">
          <p className="text-[14px] font-medium">Kanban drag preview</p>
          <p className="text-[12px] text-fg-muted">Hover to see scale 1.02 + shadow</p>
        </div>
        <div className="rounded-xl border border-border bg-surface-2 p-4">
          <p className="text-[14px] font-medium">Focus ring</p>
          <Input className="mt-2 max-w-xs" placeholder="Tab here to see the ring" />
        </div>
      </div>
    </Section>
  );
}
