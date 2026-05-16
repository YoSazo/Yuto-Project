# Requirements Document

## Introduction

Make the onboarding Step 2 (split demonstration) in OnboardingScreen.tsx a pixel-perfect replica of the real YutoGroupScreen.tsx experience. The step is split into two sequential phases: a SplitScreen-style friend picker phase where the user selects demo friends and enters an amount, followed by a YutoGroupScreen-exact jar visualization phase with simulated payment animations. After all members pay, a payout modal appears before transitioning to Step 3.

## Glossary

- **Onboarding_Screen**: The onboarding flow component (`OnboardingScreen.tsx`) that guides new users through a 3-step demo of Yuto features
- **Friend_Picker_Phase**: The first sub-phase of Step 2 where the user enters an amount, description, and selects demo friends to split with (replicating SplitScreen layout)
- **Jar_Visualization_Phase**: The second sub-phase of Step 2 showing the SVG graph with jar, rope lines, member nodes, and payment animations (replicating YutoGroupScreen layout)
- **Jar**: The central 160×195px rounded container that fills with green as members pay, displaying the YutoLogo and per-person amount
- **Member_Node**: A 76×76px circular node positioned on the orbit ring representing a split participant
- **Rope_Line**: A quadratic bezier SVG path connecting a jar corner to a member node, styled differently based on payment status
- **Orbit_Ring**: The dashed circular SVG ring (radius 155px from center) that rotates at 60s linear infinite using the `orbitSpin` keyframe
- **Flowing_Dot**: A blue (#5493b3) animated circle that travels along a rope line using SVG `animateMotion` (1.5s duration, staggered 0.4s per member)
- **Pulse_Ring**: Expanding SVG circles from the jar center (#5493b3, 2s duration) shown when not all members have paid
- **Payout_Modal**: A bottom-sheet modal explaining payout options, shown after all members have paid
- **Demo_Friend**: A hardcoded friend entry (e.g., Salah, Amina, Brian) used in the onboarding simulation without real API calls
- **Split_CTA**: The primary action button in the friend picker phase that initiates the split simulation

## Requirements

### Requirement 1: Friend Picker Phase Layout

**User Story:** As a new user, I want to see a familiar split-creation interface during onboarding, so that I understand how to create a split before seeing the visualization.

#### Acceptance Criteria

1. WHEN the user enters Step 2, THE Onboarding_Screen SHALL display the Friend_Picker_Phase with an amount input field labeled "KSH", a description text input, and a list of Demo_Friends as pill-shaped toggle buttons
2. THE Friend_Picker_Phase SHALL display each Demo_Friend as a rounded-full button containing an avatar initial and display name, matching the SplitScreen pill-button styling (border-2, px-4, py-2.5, rounded-full)
3. WHEN the user taps a Demo_Friend pill, THE Onboarding_Screen SHALL toggle that friend's selected state, changing the pill to a filled style (bg-black text-white) when selected and outlined style (bg-white border-gray-200) when deselected
4. WHEN at least one Demo_Friend is selected and the amount is greater than zero, THE Onboarding_Screen SHALL display a per-person summary showing the equal share (total amount divided by selected friends plus one, rounded up)
5. WHEN at least one Demo_Friend is selected and the amount is greater than zero, THE Split_CTA SHALL become active with the label "Split KSH {totalAmount}"
6. THE Friend_Picker_Phase SHALL pre-fill the amount with "2400" and description with "Friday Dinner 🍕" and pre-select all three Demo_Friends (Salah, Amina, Brian) so the user can immediately proceed

### Requirement 2: Transition to Jar Visualization

**User Story:** As a new user, I want a smooth transition from the friend picker to the jar visualization, so that the experience feels cohesive.

#### Acceptance Criteria

1. WHEN the user taps the Split_CTA button, THE Onboarding_Screen SHALL transition from the Friend_Picker_Phase to the Jar_Visualization_Phase
2. WHEN the Jar_Visualization_Phase appears, THE Onboarding_Screen SHALL display the SVG graph with all selected Demo_Friends as Member_Nodes positioned on the orbit ring

### Requirement 3: SVG Graph Layout (Pixel-Perfect YutoGroupScreen Replica)

**User Story:** As a new user, I want to see the exact same jar visualization used in real splits, so that the onboarding accurately represents the product experience.

#### Acceptance Criteria

1. THE Jar_Visualization_Phase SHALL use an SVG with viewBox "0 0 380 420" and preserveAspectRatio "xMidYMid meet" with center point at (190, 210)
2. THE Jar_Visualization_Phase SHALL render three concentric reference circles: an inner circle at radius 85px (stroke #f0f0f0, strokeWidth 1), an orbit ring at radius 155px (stroke #f0f0f0, strokeWidth 1, strokeDasharray "4 6", animated with orbitSpin 60s linear infinite, transformOrigin "190px 210px"), and an outer circle at radius 120px (stroke #f7f7f7, strokeWidth 0.5)
3. THE Jar SHALL be a 160×195px container with rounded-[28px] corners, border-2, centered in the graph, containing the YutoLogo component at 72×72px and displaying the per-person amount
4. THE Onboarding_Screen SHALL position each Member_Node at radius 185px from center (190, 210) using the formula: angle = (index × 2π / memberCount) + π/4, x = 190 + cos(angle) × 185, y = 210 + sin(angle) × 185
5. THE Onboarding_Screen SHALL render each Member_Node as a 76×76px (w-[76px] h-[76px]) rounded-full element with border-[3px], matching YutoGroupScreen node styling

### Requirement 4: Rope Lines and Flowing Dots

**User Story:** As a new user, I want to see animated rope connections between the jar and members, so that I understand the visual metaphor of money flowing into the jar.

#### Acceptance Criteria

1. THE Onboarding_Screen SHALL draw Rope_Lines as quadratic bezier SVG paths from jar corners ([230,162], [150,258], [150,162], [230,258] cycling by member index modulo 4) to each Member_Node position
2. WHEN a member has not paid, THE Rope_Line SHALL be rendered with stroke "#d1d5db", strokeWidth 2, and strokeDasharray "7 5"
3. WHEN a member has paid, THE Rope_Line SHALL be rendered with stroke "#22c55e", strokeWidth 3, no dash array, plus a glow path with strokeWidth 8 and opacity 0.12
4. WHILE a member has joined but not paid, THE Onboarding_Screen SHALL render a Flowing_Dot (radius 3.5, fill "#5493b3") along the rope path using SVG animateMotion with dur "1.5s", repeatCount "indefinite", and begin staggered by (index × 0.4)s
5. THE Rope_Line control point SHALL be calculated as: cpX = (corner.x + endX) / 2 + cos(angle) × 30, cpY = (corner.y + endY) / 2 + 40

### Requirement 5: Pulse Rings

**User Story:** As a new user, I want to see a pulsing animation on the jar while waiting for payments, so that I understand the jar is actively collecting money.

#### Acceptance Criteria

1. WHILE not all members have paid, THE Onboarding_Screen SHALL render two Pulse_Rings centered at (190, 210) with stroke "#5493b3"
2. THE first Pulse_Ring SHALL animate from radius 40 to 85 over 2s with opacity from 0.3 to 0, strokeWidth 1.5, repeating indefinitely
3. THE second Pulse_Ring SHALL animate from radius 40 to 85 over 2s with opacity from 0.2 to 0, strokeWidth 1, beginning at 1s offset, repeating indefinitely
4. WHEN all members have paid, THE Onboarding_Screen SHALL stop rendering the Pulse_Rings

### Requirement 6: Jar Fill Animation

**User Story:** As a new user, I want to see the jar fill up as members pay, so that I understand the progress of the split collection.

#### Acceptance Criteria

1. THE Jar SHALL display a green gradient fill (from-green-500 to-green-400) at the bottom, with height percentage equal to (paidCount / totalMembers) × 100
2. THE Jar fill height SHALL transition with duration 1000ms and ease-out timing
3. WHEN all members have paid, THE Jar border SHALL change to border-green-400 with shadow-green-300/40
4. WHEN all members have paid, THE Jar SHALL display "All paid! 🎉" text and the total amount in white
5. WHILE not all members have paid, THE Jar SHALL display the per-person amount and "per person" label, switching text color to white when fill exceeds 50%

### Requirement 7: Simulated Payment Flow

**User Story:** As a new user, I want to see members pay one by one automatically, so that I understand how the split collection works in real time.

#### Acceptance Criteria

1. WHEN the Jar_Visualization_Phase begins, THE Onboarding_Screen SHALL simulate the current user ("You") paying first after a short delay
2. WHEN the user has paid, THE Onboarding_Screen SHALL simulate remaining Demo_Friends paying one by one at intervals (approximately 1.2 seconds apart)
3. WHEN a Member_Node transitions to paid status, THE Member_Node SHALL change to bg-black border-green-500 with a green checkmark badge and shadow-xl shadow-green-500/25 (node-glow class)
4. WHEN a Member_Node is in paid state, THE Member_Node SHALL display a green checkmark icon in a circular badge at the bottom-right position

### Requirement 8: Payout Modal

**User Story:** As a new user, I want to understand what happens after everyone pays, so that I know I can send the collected money anywhere.

#### Acceptance Criteria

1. WHEN all members have paid, THE Onboarding_Screen SHALL display a "Pay Out" button (bg-green-500, text-white, rounded-2xl)
2. WHEN the user taps the "Pay Out" button, THE Onboarding_Screen SHALL display the Payout_Modal as a bottom-sheet (fixed inset-0, bg-black/50 backdrop-blur-sm, rounded-t-3xl content panel)
3. THE Payout_Modal SHALL display the total collected amount and explain that funds can be sent to a till number, Paybill, bank account, or another Yuto user
4. WHEN the user taps "Continue" in the Payout_Modal, THE Onboarding_Screen SHALL dismiss the modal and transition to Step 3

### Requirement 9: No External Dependencies

**User Story:** As a new user on first launch, I want the onboarding split demo to work without network connectivity, so that I can complete onboarding regardless of connection status.

#### Acceptance Criteria

1. THE Onboarding_Screen Step 2 SHALL use only hardcoded Demo_Friend data (name, initial) without making any API calls or network requests
2. THE Onboarding_Screen Step 2 SHALL not import or call any functions from the supabase library
3. THE Onboarding_Screen Step 2 SHALL use timer-based animations (setTimeout/setInterval) to simulate payment events rather than listening to real-time database changes
