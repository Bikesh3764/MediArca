---
name: emil-design-eng
description: >-
  Emil Kowalski's Design Engineering framework for creating tactile, fluid, and polished micro-interactions, spring animations, physical touch feedback, and component craft. Use whenever refining UI components, interactive states, transitions, buttons, modals, or animated feedback.
---

# Emil Kowalski Design Engineering Framework (`emil-design-eng`)

Inspired by Emil Kowalski (Vercel, creator of Sonner and *Animations on the Web*), this skill guides the creation of user interfaces that feel tactile, physical, responsive, and crafted with obsession.

---

## 1. Core Philosophy: The Physicality of Software

Software should feel like an extension of the real world:
- **Instant Response**: Any click, tap, or hover must produce instantaneous visual feedback (<16ms).
- **Physical Resistance & Spring**: Interactive elements should compress slightly on press and release naturally (`active:scale-[0.98]` or `active:scale-[0.97]`).
- **Ambient Lighting & Layered Shadows**: Real objects do not have flat black drop shadows. They cast ambient, multi-layered, ultra-soft shadows that sit close to the surface.

---

## 2. Interaction Standards & Micro-States

### Buttons & Interactive Controls
```tsx
// Kowalski Tactile Button Pattern
<button
  className="h-9 px-4 rounded-full font-medium text-xs text-white bg-[#0066cc] 
             hover:bg-[#0071e3] active:scale-[0.97] active:brightness-95 
             transition-all duration-150 ease-out cursor-pointer select-none
             shadow-[0_1px_2px_rgba(0,0,0,0.06),0_2px_8px_rgba(0,102,204,0.15)]
             focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0066cc]/40"
>
  Action
</button>
```

### Key Interactive Rules:
1. **Always add `active:scale-[0.97]` or `active:scale-[0.98]`** on clickable pills, cards, and buttons to give physical tactile feedback on click.
2. **Transition Duration**: Keep micro-interactions at **150ms–200ms** with `ease-out`. Avoid sluggish 400ms+ transitions for simple button states.
3. **Cursor Precision**: Every clickable element MUST have `cursor-pointer`. Elements with disabled states must have `cursor-not-allowed` and appropriate opacity reduction (`opacity-60`).
4. **Prevent Text Selection**: Add `select-none` on buttons, segmented pills, tabs, and counters so rapid clicking does not trigger accidental text selection.

---

## 3. Shadows & Surface Lighting (No Tacky Slop Shadows)

Avoid generic harsh shadows like `shadow-lg` or `shadow-xl`. Instead use soft, dual-layer ambient shadows:

```css
/* Card Ambient Shadow */
box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03), 0 8px 24px rgba(0, 0, 0, 0.03);

/* Floating Popover / Dialog Shadow */
box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04), 0 20px 48px rgba(0, 0, 0, 0.08);

/* Subtle Border Hairline */
border: 1px solid rgba(0, 0, 0, 0.06); /* or #e5e5ea */
```

---

## 4. Layout Transitions & Zero Layout Shift

1. **Skeleton Loaders**: Skeletons must match the exact dimensions, aspect ratio, and border radius of the incoming cards.
2. **Tab Switching**: Tab switches must be instant and clean without awkward vertical page jumps.
3. **Modal & Drawer Physics**: Modals should enter with subtle scale (`scale-95` to `scale-100`) and soft backdrop blur (`backdrop-blur-md bg-black/20`).

---

## 5. Checklist for Any Component Polish
- [ ] Does it react instantly to hover and press?
- [ ] Is there tactile feedback (`active:scale-[0.97]`)?
- [ ] Is the cursor set explicitly (`cursor-pointer`)?
- [ ] Is text selection disabled on the interactive container (`select-none`)?
- [ ] Are shadows multi-layered and whisper-quiet?
- [ ] Are borders crisp hairline dividers (`#e5e5ea` or `rgba(0,0,0,0.06)`)?
