---
name: impeccable-design
description: >-
  Paul Bakaus's Impeccable Design framework for ruthless visual hierarchy, mathematical spacing rhythm, strict typographic contrast, and production-grade frontend finish. Use when eliminating AI slop, organizing layouts, fixing visual chaos, and elevating UI polish.
---

# Impeccable Design Framework (`impeccable-design`)

Inspired by Paul Bakaus (creator of jQuery UI, former Google engineering lead), this skill provides strict aesthetic guardrails to prevent generic "AI Slop" and elevate frontend code to world-class product standards.

---

## 1. The Anti-Slop Principles

AI systems default to noisy, cookie-cutter, low-taste aesthetics. Impeccable Design ruthlessly eliminates:
- **No Neon Gradients**: Avoid tacky purple-to-pink or blue-to-violet linear gradients on text or card backgrounds.
- **No Meaningless Badges**: Eliminate fake badges like "PRO", "ACTIVE", "POPULAR", or "VERIFIED FACILITY" unless legally or clinically necessary.
- **No Three-Button Rows**: Never clutter cards or headers with 3 or 4 mismatched action buttons. Strictly limit to **one primary action** and optionally **one subtle secondary action**.
- **No Cramped Density**: Let elements breathe with consistent, intentional whitespace.

---

## 2. Typographic Hierarchy & Contrast

Never use arbitrary font sizes or random weights. Follow strict typographic scales:

| Role | Size | Weight | Tracking | Color |
| :--- | :--- | :--- | :--- | :--- |
| **Hero Title** | `text-3xl` / `text-4xl` | `font-bold` | `tracking-tight` | `#1d1d1f` (Ink) |
| **Section Header** | `text-xl` / `text-2xl` | `font-semibold` | `tracking-tight` | `#1d1d1f` |
| **Card Heading** | `text-base` / `text-sm` | `font-semibold` | `tracking-normal` | `#1d1d1f` |
| **Body Text** | `text-xs` / `text-sm` | `font-normal` | `tracking-normal` | `#48484a` |
| **Muted Metadata** | `text-[11px]` / `text-xs` | `font-normal` / `font-medium` | `tracking-normal` | `#86868b` (Secondary) |
| **Micro Labels** | `text-[10px]` | `font-semibold` | `tracking-wider uppercase` | `#86868b` |

---

## 3. Mathematical Spacing System (8-Point Grid)

All padding, margins, and gaps must follow the 8-point rhythm (or 4-point micro scale):
- Micro spacing: `gap-1` (4px), `gap-1.5` (6px), `gap-2` (8px)
- Component internal padding: `p-3` (12px), `p-4` (16px), `p-5` (20px), `p-6` (24px)
- Card corner radius: `rounded-[20px]` or `rounded-[24px]` for cards; `rounded-full` for action pills.
- Section spacing: `space-y-6` (24px), `space-y-8` (32px), `space-y-12` (48px).

---

## 4. Color Restraint: The 90-10 Rule

- **90% Neutral Canvas**: Pure white (`#ffffff`) surfaces, subtle slate canvas (`#f5f5f7`), and soft borders (`#e5e5ea`).
- **10% Intentional Accent**: Reserve the clinical blue accent (`#0066cc`) exclusively for interactive triggers (primary CTA, active navigation item, selected segment).
- Never scatter multiple competing bright colors (green, purple, red, yellow) in the same view.

---

## 5. Production Polish Checklist
- [ ] Has all fluff/marketing text been trimmed to essential facts?
- [ ] Is there exactly ONE dominant primary button per card?
- [ ] Is the primary text readable with high contrast (`#1d1d1f` on light)?
- [ ] Are all margins and paddings multiples of 4px/8px?
- [ ] Does the page maintain clean alignment across mobile and desktop?
