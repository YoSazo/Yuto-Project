# Implementation Plan: Onboarding Split Step Pixel-Perfect

## Overview

Replace the existing simplified `step === 2` block in `OnboardingScreen.tsx` with a two-phase experience: a SplitScreen-style friend picker followed by a pixel-perfect YutoGroupScreen SVG jar visualization with simulated payment animations. All data is hardcoded (Salah, Amina, Brian), no API calls, no supabase imports.

## Tasks

- [x] 1. Implement the Friend Picker Phase
  - [x] 1.1 Add state variables and constants for the split step
    - Add `splitSubPhase` state (`"picker" | "jar"`)
    - Add `splitAmount`, `splitDescription`, `selectedDemoFriends` state with pre-filled defaults ("2400", "Friday Dinner 🍕", all three selected)
    - Add `paidMembers` (Set<string>) and `showPayoutModal` state
    - Define `DEMO_FRIENDS` constant array with Salah, Amina, Brian (id, name, initial)
    - Add computed values: `totalPeople`, `totalAmount`, `perPerson`, `allMembers`
    - Import `YutoLogo` from `../components/YutoLogo`
    - Remove old `splitPhase` number state (replaced by new states)
    - _Requirements: 1.6, 9.1, 9.2_

  - [x] 1.2 Implement the friend picker UI (SplitScreen-style layout)
    - Render amount input with "KSH" label, 56px font, numeric-only filtering (`replace(/\D/g, "")`)
    - Render description text input with rounded-full styling matching SplitScreen
    - Render "Split with" label and demo friend pill buttons (rounded-full, border-2, px-4, py-2.5) with avatar initial and name
    - Implement toggle logic: selected = bg-black text-white, deselected = bg-white border-gray-200
    - Show per-person summary pill when amount > 0 and at least one friend selected
    - Render Split CTA button: disabled when invalid, active label "Split KSH {totalAmount}"
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [x] 2. Implement the Jar Visualization Phase
  - [x] 2.1 Implement the SVG graph structure (pixel-perfect YutoGroupScreen replica)
    - Use SVG viewBox "0 0 380 420", preserveAspectRatio "xMidYMid meet"
    - Render three concentric circles: r=85 (stroke #f0f0f0, width 1), r=155 (stroke #f0f0f0, width 1, dasharray "4 6", orbitSpin 60s linear infinite, transformOrigin "190px 210px"), r=120 (stroke #f7f7f7, width 0.5)
    - Render pulse rings when not all paid: two circles animating r 40→85, 2s, opacity 0.3→0 and 0.2→0, staggered 1s
    - Implement `getMemberPosition(index, total)` using angle = (i × 2π / n) + π/4, radius 185 from center (190, 210)
    - _Requirements: 3.1, 3.2, 3.4, 5.1, 5.2, 5.3, 5.4_

  - [x] 2.2 Implement rope lines with flowing dots
    - Implement `getRopePath(memberIndex, total)` with jar corners [230,162], [150,258], [150,162], [230,258] cycling by index % 4
    - Calculate control points: cpX = (corner.x + endX) / 2 + cos(angle) × 30, cpY = (corner.y + endY) / 2 + 40
    - Render unpaid rope: stroke #d1d5db, strokeWidth 2, strokeDasharray "7 5"
    - Render paid rope: stroke #22c55e, strokeWidth 3, no dash + glow path (strokeWidth 8, opacity 0.12)
    - Render flowing dots for unpaid members: circle r=3.5, fill #5493b3, animateMotion dur 1.5s, begin staggered (index × 0.4)s
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 2.3 Implement the center jar with fill animation
    - Render 160×195px container with rounded-[28px], border-2, centered
    - Include YutoLogo at 72×72px
    - Implement green gradient fill (from-green-500 to-green-400) with height = (paidCount / totalMembers) × 100%, transition 1000ms ease-out
    - Show per-person amount when not all paid; switch text to white when fill > 50%
    - Show "All paid! 🎉" and total when all paid; border-green-400 shadow-green-300/40
    - _Requirements: 3.3, 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 2.4 Implement member nodes on the orbit ring
    - Render each member as 76×76px (w-[76px] h-[76px]) rounded-full, border-[3px]
    - Position using absolute left-1/2 top-1/2 with transform translate
    - Unpaid style: bg-white border-gray-300 text-black shadow-lg, show initial letter
    - Paid style: bg-black border-green-500 text-white node-glow shadow-xl shadow-green-500/25, show green checkmark badge at bottom-right
    - Display member name below node
    - _Requirements: 3.4, 3.5, 7.3, 7.4_

- [x] 3. Implement the Simulated Payment Flow and Payout Modal
  - [x] 3.1 Implement the payment simulation timer sequence
    - On transition from picker to jar (Split CTA tap), set `splitSubPhase` to "jar"
    - After ~800ms, mark "you" as paid in `paidMembers` Set
    - After ~1.2s intervals, mark each remaining demo friend as paid sequentially
    - Use `useEffect` with cleanup to clear all `setTimeout` handles on unmount
    - _Requirements: 2.1, 7.1, 7.2, 9.3_

  - [x] 3.2 Implement the Pay Out button and payout modal
    - Show "Pay Out" button (bg-green-500, text-white, rounded-2xl) only when all members paid
    - Render payout modal as fixed inset-0 bottom-sheet (bg-black/50 backdrop-blur-sm, rounded-t-3xl content)
    - Display total collected amount and payout destination options text (till, Paybill, bank, Yuto user)
    - "Continue" button dismisses modal and transitions to Step 3 (`setStep(3)`)
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [ ] 4. Checkpoint - Verify build compiles
  - Ensure all tests pass, ask the user if questions arise.

- [ ]* 4.1 Write property tests for share calculation and geometry
    - **Property 2: Per-person share calculation** — verify Math.ceil(amount / (selectedCount + 1)) for random amounts (1–999999) and friend selections (1–3)
    - **Validates: Requirements 1.4**
    - **Property 4: Rope line geometry correctness** — verify path starts from JAR_CORNERS[i % 4] and ends at correct orbit position for random indices and counts
    - **Validates: Requirements 3.4, 4.1, 4.5**

- [ ]* 4.2 Write property tests for visual state logic
    - **Property 7: Jar fill percentage** — verify (paidCount / totalMembers) × 100 for random paidCount (0–4) and totalMembers (1–4)
    - **Validates: Requirements 6.1**
    - **Property 8: Jar text color threshold** — verify text is white when fill > 50%, black otherwise
    - **Validates: Requirements 6.5**

- [x] 5. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- All changes go in `src/pages/OnboardingScreen.tsx` — no new files needed
- Existing CSS keyframes (`orbitSpin`, `nodeGlow`, `nodeSnapIn`) from `index.css` are reused
- The old `splitPhase` number state and simplified step 2 block are fully replaced
- No supabase imports or API calls for step 2
- Property tests validate pure computational logic (share math, geometry, state-dependent styling)

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "2.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.4"] },
    { "id": 3, "tasks": ["3.1", "3.2"] },
    { "id": 4, "tasks": ["4.1", "4.2"] }
  ]
}
```
