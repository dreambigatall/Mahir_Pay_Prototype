import re

with open("src/app/globals.css", "r") as f:
    content = f.read()

# I will just write the entire new content in this script and overwrite it.
new_css = """@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";

@custom-variant dark (&:is(.dark *));

:root {
  --radius: 12px;

  /* Neumorphism Cyan/Green Palette */
  --background: hsl(183 100% 96%);
  --foreground: hsl(196 64% 24%);
  --card: hsl(0 0% 100%);
  --card-foreground: hsl(196 64% 24%);
  --popover: hsl(0 0% 100%);
  --popover-foreground: hsl(196 64% 24%);
  
  --primary: hsl(191 91% 36%);
  --primary-foreground: hsl(0 0% 0%);
  
  --secondary: hsl(188 86% 53%);
  --secondary-foreground: hsl(222 47% 11%);
  
  --muted: hsl(201 41% 94%);
  --muted-foreground: hsl(215 19% 35%);
  
  --accent: hsl(161 94% 30%);
  --accent-foreground: hsl(0 0% 0%);
  
  --destructive: hsl(0 72% 51%);
  --destructive-foreground: hsl(0 0% 100%);
  
  --border: hsl(186 94% 82%);
  --input: hsl(186 94% 82%);
  --ring: hsl(191 91% 36%);

  /* Clinic Semantic Defaults */
  --surface-1: hsl(183 100% 96%);
  --surface-2: hsl(0 0% 100%);
  --text-secondary: hsl(215 19% 35%);
  --text-muted: hsl(215 19% 50%);
  --text-disabled: hsl(215 19% 75%);
  --border-strong: hsl(186 94% 65%);

  --danger-bg: hsl(0 100% 95%);
  --danger-text: hsl(0 72% 51%);
  --danger-fill: hsl(0 72% 51%);
  --warning-bg: hsl(38 100% 90%);
  --warning-text: hsl(38 92% 35%);
  --warning-fill: hsl(38 92% 50%);
  --success-bg: hsl(142 100% 92%);
  --success-text: hsl(142 76% 25%);
  --success-fill: hsl(142 76% 36%);
  --clinical-bg: hsl(191 100% 92%);
  --clinical-text: hsl(191 91% 25%);
  --clinical-fill: hsl(191 91% 36%);
  --neutral-bg: hsl(201 41% 94%);
  --neutral-text: hsl(196 64% 24%);
  --neutral-fill: hsl(215 19% 50%);
  --info-bg: hsl(188 100% 92%);
  --info-text: hsl(188 86% 25%);
  --info-fill: hsl(188 86% 53%);

  --chart-1: hsl(191 91% 36%);
  --chart-2: hsl(161 94% 30%);
  --chart-3: hsl(188 86% 53%);
  --chart-4: hsl(38 92% 50%);
  --chart-5: hsl(0 72% 51%);

  --sidebar: hsl(0 0% 100%);
  --sidebar-foreground: hsl(196 64% 24%);
  --sidebar-primary: hsl(191 91% 36%);
  --sidebar-primary-foreground: hsl(0 0% 0%);
  --sidebar-accent: hsl(183 100% 96%);
  --sidebar-accent-foreground: hsl(196 64% 24%);
  --sidebar-border: hsl(186 94% 82%);
  --sidebar-ring: hsl(191 91% 36%);
}

.dark {
  --background: hsl(222 47% 11%);
  --foreground: hsl(183 100% 96%);
  --card: hsl(215 28% 17%);
  --card-foreground: hsl(183 100% 96%);
  --popover: hsl(215 28% 17%);
  --popover-foreground: hsl(183 100% 96%);
  
  --primary: hsl(188 86% 53%);
  --primary-foreground: hsl(222 47% 11%);
  
  --secondary: hsl(191 91% 36%);
  --secondary-foreground: hsl(183 100% 96%);
  
  --muted: hsl(215 28% 17%);
  --muted-foreground: hsl(215 19% 65%);
  
  --accent: hsl(160 84% 39%);
  --accent-foreground: hsl(0 0% 100%);
  
  --destructive: hsl(0 62% 30%);
  --destructive-foreground: hsl(183 100% 96%);
  
  --border: hsl(196 64% 24%);
  --input: hsl(196 64% 24%);
  --ring: hsl(188 86% 53%);

  --surface-1: hsl(222 47% 11%);
  --surface-2: hsl(215 28% 17%);
  --text-secondary: hsl(215 19% 65%);
  --text-muted: hsl(215 19% 50%);
  --text-disabled: hsl(215 19% 35%);
  --border-strong: hsl(196 64% 40%);

  --danger-bg: hsl(0 62% 15%);
  --danger-text: hsl(0 72% 70%);
  --danger-fill: hsl(0 72% 51%);
  --warning-bg: hsl(38 92% 15%);
  --warning-text: hsl(38 92% 70%);
  --warning-fill: hsl(38 92% 50%);
  --success-bg: hsl(142 76% 15%);
  --success-text: hsl(142 76% 70%);
  --success-fill: hsl(142 76% 36%);
  --clinical-bg: hsl(191 91% 15%);
  --clinical-text: hsl(191 91% 70%);
  --clinical-fill: hsl(191 91% 36%);
  --neutral-bg: hsl(215 28% 17%);
  --neutral-text: hsl(215 19% 65%);
  --neutral-fill: hsl(215 19% 50%);
  --info-bg: hsl(188 86% 15%);
  --info-text: hsl(188 86% 70%);
  --info-fill: hsl(188 86% 53%);

  --sidebar: hsl(222 47% 11%);
  --sidebar-foreground: hsl(183 100% 96%);
  --sidebar-primary: hsl(188 86% 53%);
  --sidebar-primary-foreground: hsl(222 47% 11%);
  --sidebar-accent: hsl(215 28% 17%);
  --sidebar-accent-foreground: hsl(183 100% 96%);
  --sidebar-border: hsl(196 64% 24%);
  --sidebar-ring: hsl(188 86% 53%);
}

@theme inline {
  --font-sans: var(--font-figtree), "Helvetica Neue", Arial, sans-serif;
  --font-mono: var(--font-jetbrains), ui-monospace, monospace;
  --font-heading: var(--font-figtree), "Helvetica Neue", Arial, sans-serif;

  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);

  --color-surface-1: var(--surface-1);
  --color-surface-2: var(--surface-2);
  --color-border-strong: var(--border-strong);
  --color-fg-secondary: var(--text-secondary);
  --color-fg-muted: var(--text-muted);
  --color-fg-disabled: var(--text-disabled);

  --color-danger-bg: var(--danger-bg);
  --color-danger-text: var(--danger-text);
  --color-danger-fill: var(--danger-fill);
  --color-warning-bg: var(--warning-bg);
  --color-warning-text: var(--warning-text);
  --color-warning-fill: var(--warning-fill);
  --color-success-bg: var(--success-bg);
  --color-success-text: var(--success-text);
  --color-success-fill: var(--success-fill);
  --color-clinical-bg: var(--clinical-bg);
  --color-clinical-text: var(--clinical-text);
  --color-clinical-fill: var(--clinical-fill);
  --color-neutral-bg: var(--neutral-bg);
  --color-neutral-text: var(--neutral-text);
  --color-neutral-fill: var(--neutral-fill);
  --color-info-bg: var(--info-bg);
  --color-info-text: var(--info-text);
  --color-info-fill: var(--info-fill);

  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
  --radius-2xl: calc(var(--radius) + 8px);
  --radius-3xl: calc(var(--radius) + 12px);
  --radius-4xl: calc(var(--radius) + 16px);
  --radius-pill: 999px;

  /* Neumorphic Shadows */
  --shadow-sm: 0 1px 2px rgba(8, 145, 178, 0.05);
  --shadow-md: -4px -4px 10px rgba(255, 255, 255, 0.7), 4px 4px 10px rgba(8, 145, 178, 0.1);
  --shadow-lg: -6px -6px 15px rgba(255, 255, 255, 0.8), 6px 6px 15px rgba(8, 145, 178, 0.15);
  --shadow-xl: -10px -10px 20px rgba(255, 255, 255, 0.8), 10px 10px 20px rgba(8, 145, 178, 0.2);
  --shadow-inner: inset -3px -3px 7px rgba(255, 255, 255, 0.7), inset 3px 3px 7px rgba(8, 145, 178, 0.1);
  
  --shadow-popover: var(--shadow-lg);
  --shadow-modal: var(--shadow-xl);
  --shadow-focus: 0 0 0 1px var(--background), 0 0 0 3px var(--ring);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }

  html {
    @apply font-sans scroll-smooth;
  }

  body {
    background-color: var(--background);
    color: var(--foreground);
    @apply text-sm antialiased;
    font-feature-settings: "cv02", "cv03", "cv04", "cv11";
  }

  button,
  input,
  select,
  textarea {
    font: inherit;
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
"""

with open("src/app/globals.css", "w") as f:
    f.write(new_css)
