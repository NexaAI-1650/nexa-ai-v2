# Design Guidelines - React Application

## Design Approach
**System-Based Approach**: Modern minimal web design with clean, functional aesthetics inspired by contemporary SaaS products. Focus on clarity, usability, and responsive layouts.

## Typography
- **Primary Font**: Inter (Google Fonts) - `font-sans`
- **Headings**: 
  - H1: `text-5xl font-bold` (Hero)
  - H2: `text-3xl font-semibold` (Section headers)
  - H3: `text-xl font-medium` (Component titles)
- **Body**: `text-base leading-relaxed`
- **Small Text**: `text-sm` (captions, metadata)

## Layout System
**Spacing Units**: Tailwind scale - 2, 4, 6, 8, 12, 16, 20, 24
- Component padding: `p-6` or `p-8`
- Section spacing: `py-16` or `py-20`
- Element gaps: `gap-4` or `gap-6`
- Container: `max-w-7xl mx-auto px-6`

## Component Library

### Navigation
- Fixed header with `h-16`
- Logo left, navigation items center/right
- Mobile: Hamburger menu with slide-in drawer
- Spacing: `gap-8` between nav items

### Cards
- Rounded corners: `rounded-lg`
- Shadow: `shadow-md hover:shadow-lg transition-shadow`
- Padding: `p-6`
- Border: `border border-gray-200`

### Buttons
- Primary: `px-6 py-3 rounded-lg font-medium`
- Secondary: `px-6 py-3 rounded-lg border-2`
- Small: `px-4 py-2 text-sm`

### Forms
- Input fields: `px-4 py-3 rounded-lg border`
- Labels: `text-sm font-medium mb-2`
- Field spacing: `space-y-4`

### Grid Layouts
- Desktop: `grid-cols-3 gap-8`
- Tablet: `md:grid-cols-2`
- Mobile: `grid-cols-1`

## Animations
Minimal, functional only:
- Hover transitions: `transition-all duration-200`
- Page transitions: Simple fade-in
- No scroll animations or complex effects

## Images
**Hero Section**: Full-width hero with centered content overlay
- Height: `h-[600px]`
- Image: Abstract tech/gradient background
- Overlay: Semi-transparent gradient for text readability
- Buttons on hero: Backdrop blur `backdrop-blur-sm bg-white/10`

**Feature Sections**: Small accent images/icons alongside content, not dominant

## Accessibility
- Focus states: `focus:ring-2 focus:ring-offset-2`
- Semantic HTML throughout
- ARIA labels for interactive elements
- Consistent form validation patterns

This creates a clean, professional foundation ready for rapid development.