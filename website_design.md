
<high_level_design>
## 1. Brand & Art Direction Overview

MetaTiers is a competitive gaming leaderboard platform with a dark, sophisticated aesthetic. The design employs a deep dark navy/blue-black background (#0a0e1a, #0f1419) creating a premium, immersive gaming environment. The interface features a minimalist, data-dense layout optimized for displaying player rankings and tier information.

Visual hierarchy is established through:
- Bold yellow/gold accent color (#f4a623, #ffa500) for primary actions and highlights
- Subtle card-based layouts with dark blue backgrounds (#1a1f2e, #161b26)
- Clean typography with white (#ffffff) for primary text and muted grays (#9ca3af, #6b7280) for secondary information
- Gaming-themed iconography with pixelated/blocky Minecraft-style avatars
- Pill-shaped badges for tier indicators with mode-specific icons
- Smooth fade-in animations and hover states for interactivity

The overall aesthetic balances competitive gaming intensity with professional data presentation, using high contrast and clear information architecture.

## 2. Color Palette (Dark Theme)

| Token | HEX / RGB | Usage | Notes |
|-------|-----------|-------|-------|
| bg-primary | #0a0e1a | Main background | Deep navy-black base |
| bg-secondary | #0f1419 | Secondary background | Slightly lighter navy |
| bg-card | #1a1f2e | Card backgrounds | Table rows, category boxes |
| bg-card-hover | #1f2937 | Hover state | Interactive elements |
| bg-nav | #0d1117 | Navigation bar | Slightly transparent dark |
| accent-primary | #f4a623 | Primary accent | Buttons, active states, rank highlights |
| accent-gold | #ffa500 | Gold highlights | Category active, special ranks |
| text-primary | #ffffff | Primary text | Player names, headings |
| text-secondary | #9ca3af | Secondary text | Points, subtitles |
| text-muted | #6b7280 | Tertiary text | Less important info |
| region-eu | #10b981 | EU region badge | Green |
| region-na | #ef4444 | NA region badge | Red |
| region-as | #8b5cf6 | AS region badge | Purple |
| region-au | #f59e0b | AU region badge | Orange/gold |
| region-sa | #3b82f6 | SA region badge | Blue |
| region-du | #ec4899 | DU region badge | Pink |
| border-subtle | #1f2937 | Borders | Dividers, card edges |
| tier-pill-bg | rgba(31, 41, 55, 0.6) | Tier badge background | Semi-transparent dark |

## 3. Typography Scale

**Font Family:**
- Primary: System font stack (likely -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)
- Monospace: For rankings/numbers

**Type Scale:**

| Element | Size | Weight | Line Height | Color | Notes |
|---------|------|--------|-------------|-------|-------|
| Logo | 24px | 700 | 1.2 | #ffffff | Bold, uppercase |
| Nav Links | 14px | 500 | 1.5 | #9ca3af | Medium weight |
| Nav Links (hover) | 14px | 500 | 1.5 | #ffffff | White on hover |
| Table Header | 12px | 600 | 1.4 | #6b7280 | Uppercase, semi-bold |
| Rank Number | 18px | 700 | 1.3 | #f4a623 | Bold, gold color |
| Player Name | 16px | 600 | 1.4 | #ffffff | Semi-bold |
| Player Points | 13px | 400 | 1.4 | #9ca3af | Regular, muted |
| Region Badge | 11px | 600 | 1.2 | #ffffff | Bold, uppercase |
| Tier Badge | 11px | 600 | 1.2 | #ffffff | Bold, uppercase |
| Category Label | 13px | 500 | 1.4 | #ffffff | Medium |
| Search Input | 14px | 400 | 1.5 | #ffffff | Regular |
| Footer Text | 12px | 400 | 1.5 | #6b7280 | Small, muted |

## 4. Spacing & Layout Grid

**Container:**
- Max width: 1400px
- Padding: 20px (mobile), 40px (desktop)
- Centered with auto margins

**Grid System:**
- Table-based layout for rankings
- Flexbox for navigation and category boxes
- CSS Grid potential for responsive layouts

**Spacing Scale (in px):**
- xs: 4px
- sm: 8px
- md: 12px
- lg: 16px
- xl: 20px
- 2xl: 24px
- 3xl: 32px
- 4xl: 40px

**Component Spacing:**
- Nav bar height: 60px
- Nav bar padding: 12px 20px
- Category boxes gap: 12px
- Category box padding: 12px 16px
- Table row padding: 16px 12px
- Avatar size: 48px
- Tier pill padding: 4px 8px
- Tier pill gap: 6px
- Card border-radius: 8px
- Search input padding: 10px 16px

## 5. Visual Effects & Treatments

**Shadows:**
- Card shadow: 0 2px 8px rgba(0, 0, 0, 0.3)
- Nav shadow: 0 2px 4px rgba(0, 0, 0, 0.2)
- Hover elevation: 0 4px 12px rgba(0, 0, 0, 0.4)

**Border Radius:**
- Small (badges): 4px
- Medium (pills, inputs): 6px
- Large (cards, buttons): 8px
- Avatar: 6px
- Search button: 6px

**Borders:**
- Table rows: 1px solid rgba(31, 41, 55, 0.5)
- Card borders: 1px solid #1f2937
- Input borders: 1px solid #374151

**Gradients:**
- None explicitly, solid colors throughout

**Filters/Effects:**
- Backdrop blur on nav: blur(10px) with transparency
- Opacity transitions: 0.7 to 1.0 on hover
- Image rendering: Crisp edges for pixel art avatars

**Animations/Transitions:**
- Fade-in on page load: opacity 0 to 1, 0.5s ease
- Hover transitions: all 0.2s ease
- Category box hover: background-color 0.2s ease, transform scale(1.02)
- Table row hover: background-color 0.15s ease
- Loader animation: rotating dots with scale animation

**Loading States:**
- 3-dot loader with sequential animation
- Background overlay with blur
- Centered position with z-index layering

## 6. Component Styles

### Navigation Bar
- Background: #0d1117 with backdrop-filter blur
- Height: 60px
- Padding: 12px 20px
- Display: Flex, space-between, align-center
- Logo: 40px height, left-aligned
- Links: Flex row, gap 24px, icon + text layout
- Search: Right-aligned, 200px width input with icon button
- Sticky/fixed position at top

### Category Selector
- Background: transparent
- Display: Flex row, gap 12px, horizontal scroll
- Each box: 
  - Background: #1a1f2e
  - Padding: 12px 16px
  - Border-radius: 8px
  - Icon (24px) + Text layout
  - Active state: #f4a623 background, bold text
  - Hover: slight scale, lighter background

### Table/Rankings
- Background: transparent
- Full width, table layout
- Header: 
  - Background: #0f1419
  - Text: #6b7280, uppercase, 12px, semi-bold
  - Padding: 12px
- Rows:
  - Background: #1a1f2e
  - Border-bottom: 1px solid rgba(31, 41, 55, 0.5)
  - Padding: 16px 12px
  - Hover: #1f2937 background
  - Cursor: pointer
- Columns:
  - Rank: 60px width, gold color, bold
  - Player: Flex, avatar + name/points stack
  - Region: 80px width, centered badge
  - Tiers: Flex wrap, gap 6px, multiple pills

### Player Row
- Avatar: 48px circle, 6px border-radius, Minecraft skin render
- Name: 16px, white, semi-bold
- Points: 13px, muted gray, below name
- Hover effect: Background change, subtle elevation

### Region Badge
- Display: Inline-block
- Padding: 4px 10px
- Border-radius: 4px
- Font: 11px, bold, uppercase
- Colors: Dynamic based on region (EU green, NA red, etc.)
- Text: White

### Tier Pills
- Background: rgba(31, 41, 55, 0.6)
- Padding: 4px 8px
- Border-radius: 6px
- Display: Inline-flex, align-center, gap 4px
- Icon: 16px, mode-specific
- Text: 11px, white, bold, uppercase (HT1, LT3, etc.)
- Empty state: Semi-transparent placeholder

### Search Box
- Input:
  - Background: #1a1f2e
  - Border: 1px solid #374151
  - Padding: 10px 16px
  - Border-radius: 6px (left)
  - Color: white
  - Placeholder: #6b7280
- Button:
  - Background: #f4a623
  - Border: none
  - Padding: 10px 16px
  - Border-radius: 6px (right)
  - Icon: white magnifying glass
  - Hover: Darker gold

### Loader
- Full-screen overlay: rgba(10, 14, 26, 0.9)
- Centered container
- 3 dots: 
  - Size: 12px
  - Color: #f4a623
  - Animation: Sequential scale and opacity pulse
  - Timing: 0.6s infinite ease-in-out

### Footer
- Background: transparent or #0f1419
- Padding: 24px
- Text: 12px, #6b7280, centered
- Links: #9ca3af, hover to white

## 7. Site Sections

**Order of Sections:**

1. **Loader** (initial, fades out)
   - Full-screen overlay with 3-dot animation
   - Displays while page loads

2. **Navigation Bar** (fixed top)
   - Logo (left)
   - Rankings link
   - Discord link
   - Home link
   - Search box (right)

3. **Category Line** (below nav)
   - Horizontal scrollable list
   - Overall, Vanilla, Sword, UHC, DiaPot, NethPot, SMP, Axe, Mace
   - Active state indicates current view

4. **Rankings Table** (main content)
   - Table header: #, Player, Region, Tiers
   - Player rows: 
     - Rank number
     - Avatar + username + points
     - Region badge
     - Multiple tier pills
   - Infinite scroll or pagination
   - Displays 200+ players

5. **Footer** (bottom)
   - Copyright text
   - Developer credit
   - "Developed by Zzenoxz"

**Data Requirements:**
- Player ranking data (rank, username, points, UUID)
- Region information (EU, NA, AS, AU, SA, DU)
- Tier data per game mode (mode, tier level, points, icon)
- Avatar images (Minecraft skin renders from crafty.gg API)
- Mode icons (vanilla, sword, uhc, diapot, nethpot, smp, axe, mace)

**API Integration:**
- Player search endpoint
- Rankings by category endpoint (overall, specific modes)
- Real-time or cached data display
- External avatar API (https://render.crafty.gg/3d/bust/{username})
</high_level_design>

<theme>
dark
</theme>

<sections>
<clone_section>
    <file_path>src/components/sections/navigation-bar.tsx</file_path>
    <design_instructions>
Clone the top navigation bar with dark theme (#1a1d29 background) featuring the MetaTiers logo on the left, followed by navigation links (Rankings with trophy icon, Discord with Discord icon, Home with house icon) using white text and Font Awesome icons. Include a search form on the right with a dark input field (#252836 background), placeholder text "Search Player...", magnifying glass icon, and search error message ("Player not found") positioned absolutely below. Add subtle hover effects on navigation items and ensure proper spacing with flexbox layout. Navigation should have padding of 1rem vertically and 2rem horizontally, with items centered vertically. Logo image should be 40px height with auto width.
    </design_instructions>
    <assets>["https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/7746113a-94b4-445c-9e16-12fb2086c7cf-metatiers-com/assets/images/metatiers-1.png"]</assets>
  </clone_section>

  <clone_section>
    <file_path>src/components/sections/category-navigation.tsx</file_path>
    <design_instructions>
Clone the horizontal category navigation bar positioned below the main navigation, displaying game mode categories (Overall, Vanilla, Sword, UHC, DiaPot, NethPot, SMP, Axe, Mace) as clickable boxes. Each category box should have a dark background (#252836), rounded corners (0.5rem border-radius), padding of 0.75rem 1.5rem, display an icon image (24px size) followed by category text in white, and flex layout with 0.5rem gap between items. The active category (Overall) should have a golden/yellow background (#f59e0b). Implement hover effects with slight brightness increase. Container should use flexbox with 1rem gap between category boxes, wrap on mobile, and have horizontal padding of 2rem. Category icons should match their respective game modes.
    </design_instructions>
    <assets>["https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/7746113a-94b4-445c-9e16-12fb2086c7cf-metatiers-com/assets/icons/overall-1.png", "https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/7746113a-94b4-445c-9e16-12fb2086c7cf-metatiers-com/assets/icons/vanilla-2.png", "https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/7746113a-94b4-445c-9e16-12fb2086c7cf-metatiers-com/assets/icons/sword-3.png", "https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/7746113a-94b4-445c-9e16-12fb2086c7cf-metatiers-com/assets/icons/uhc-4.png", "https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/7746113a-94b4-445c-9e16-12fb2086c7cf-metatiers-com/assets/icons/diapot-5.png", "https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/7746113a-94b4-445c-9e16-12fb2086c7cf-metatiers-com/assets/icons/nethpot-6.png", "https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/7746113a-94b4-445c-9e16-12fb2086c7cf-metatiers-com/assets/icons/smp-7.png", "https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/7746113a-94b4-445c-9e16-12fb2086c7cf-metatiers-com/assets/icons/axe-8.png", "https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/7746113a-94b4-445c-9e16-12fb2086c7cf-metatiers-com/assets/icons/mace-9.png"]</assets>
  </clone_section>

  <clone_section>
    <file_path>src/components/sections/rankings-table.tsx</file_path>
    <design_instructions>
Clone the main rankings table with dark theme displaying player leaderboard data. Table should have four columns: Rank (#), Player (with avatar and info), Region, and Tiers. Use dark background (#0f1117) with slightly lighter row backgrounds (#1a1d29) that have 1px border (#252836). Table header should have uppercase text (0.75rem font-size, #6b7280 color) with left-aligned text. Player column should display 48px circular avatar images (from https://render.crafty.gg/3d/bust/{username}), player name in white bold text (1rem), and points below in gray (#9ca3af, 0.875rem). Region badges should be colored pills (EU: #10b981 green, NA: #ef4444 red, AS: #8b5cf6 purple, etc.) with 0.375rem padding, 9999px border-radius, and 0.75rem font-size. Tiers column should display horizontal tier pills with mode icons (16px) and tier text (HT1, LT3, etc.) in small badges with semi-transparent backgrounds. Implement proper spacing between rows (1rem padding), alternating row hover effects (slight brightness increase), and ensure mobile responsiveness with horizontal scroll on small screens. Data should be fetched from an API endpoint that returns player rankings with all necessary fields (rank, username, discord, region, modes array with tier info, total points, uuid).
    </design_instructions>
    <assets>["https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/7746113a-94b4-445c-9e16-12fb2086c7cf-metatiers-com/assets/icons/vanilla-2.png", "https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/7746113a-94b4-445c-9e16-12fb2086c7cf-metatiers-com/assets/icons/sword-3.png", "https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/7746113a-94b4-445c-9e16-12fb2086c7cf-metatiers-com/assets/icons/uhc-4.png", "https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/7746113a-94b4-445c-9e16-12fb2086c7cf-metatiers-com/assets/icons/diapot-5.png", "https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/7746113a-94b4-445c-9e16-12fb2086c7cf-metatiers-com/assets/icons/nethpot-6.png", "https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/7746113a-94b4-445c-9e16-12fb2086c7cf-metatiers-com/assets/icons/smp-7.png", "https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/7746113a-94b4-445c-9e16-12fb2086c7cf-metatiers-com/assets/icons/axe-8.png", "https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/7746113a-94b4-445c-9e16-12fb2086c7cf-metatiers-com/assets/icons/mace-9.png"]</assets>
  </clone_section>

  <clone_section>
    <file_path>src/components/sections/footer.tsx</file_path>
    <design_instructions>
Clone the footer section with dark background (#0f1117), centered text in gray (#9ca3af), displaying "© 2025 MetaTiers. All rights reserved. Developed by Zzenoxz." with 0.875rem font-size. Footer should have padding of 2rem vertically and 1rem horizontally, positioned at the bottom of the page with proper spacing from the table content above. Ensure responsive text sizing on mobile devices.
    </design_instructions>
    <assets>[]</assets>
  </clone_section>

  <clone_section>
    <file_path>src/components/sections/loading-spinner.tsx</file_path>
    <design_instructions>
Clone the loading spinner overlay that appears on page load with full viewport coverage (position: fixed, 100vw/100vh dimensions, z-index: 9999). Background should be semi-transparent dark (#0f1117 with 0.95 opacity). Display three animated dots in the center that pulse/bounce sequentially with timing delays (0s, 0.2s, 0.4s). Each dot should be circular (12px diameter), white (#ffffff), with smooth animation using CSS keyframes for scale and opacity changes. Container should use flexbox for perfect centering. Implement fade-out animation when loading completes and add "show" class to trigger visibility.
    </design_instructions>
    <assets>[]</assets>
  </clone_section>
</sections>
