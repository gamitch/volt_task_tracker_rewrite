# Astryx component API reference — generated 2026-07-12 from installed @astryxdesign/core. Place at docs/swarm/astryx-api.md. Per PRD DES-19, props not listed here are presumed hallucinated.
-e 
---

# AspectRatio

Maintains a fixed width-to-height ratio for its children, regardless of screen size. Use it for media containers like videos, images, thumbnails, or any content that needs consistent proportions.

## Example

```tsx
<AspectRatio ratio={1} shape="ellipse">
  <img src="avatar.jpg" alt="" style={{objectFit: 'cover'}} />
</AspectRatio>

<AspectRatio ratio={16 / 9}>
  <img src="image.jpg" alt="Widescreen image" style={{objectFit: 'cover'}} />
</AspectRatio>

<AspectRatio ratio={1} shape="ellipse">
  <img src="avatar.jpg" alt="" style={{objectFit: 'cover'}} />
</AspectRatio>
```

## Best Practices

- **Do:** Express the ratio as a fraction like `16/9` or `4/3` for readability.
- **Do:** Use for media that needs consistent proportions across screen sizes.
- **Don't:** Use for general layout containers; use standard layout components instead.
- **Don't:** Nest AspectRatio containers; one level is sufficient.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `ratio` | `number` | — | Aspect ratio as width/height (e.g. 16/9, 1). **(required)** |
| `children` | `ReactNode` | — | Content positioned absolutely to fill the container. **(required)** |
| `xstyle` | `StyleXStyles` | — | StyleX styles for layout customization (margins, positioning, sizing). Must be a stylex.create() value, not an inline style object like style={{}}. |

## Theming

| Component class | Preferred data attributes | Props | States |
|-----------------|---------------------------|-------|--------|
| `astryx-aspect-ratio` | `data-shape` | shape | — |

-e 
---

# Center

Center aligns content to the middle of its container. Use it for empty states, loading screens, login forms, or any content that should sit in the center of the available space.

## Example

```tsx
<Center width={300} height={200}>
  <Content />
</Center>
```

## Anatomy

| Element | Required | Description |
|---------|----------|-------------|
| Container | Yes | A flexbox wrapper that aligns its children to the center along the chosen axis. |
| Content | Yes | Any children passed to Center. Typically a card, form, spinner, or empty state message. |

## Best Practices

- **Do:** Use axis="horizontal" or axis="vertical" when you only need one direction. Both axes is the default but not always needed.
- **Do:** Set a height when centering vertically. Center needs a defined height to know what space to center within.
- **Do:** Use isInline to center small elements like icons or badges within a line of text without breaking the text flow.
- **Don't:** Wrap large page sections in Center. Use Layout or AppShell for page-level structure.
- **Don't:** Use Center for horizontal lists of items. Use Stack with hAlign="center" instead.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `axis` | `'both' | 'horizontal' | 'vertical'` | `'both'` | Which direction(s) to center. |
| `width` | `SizeValue` | — | Container width (px or CSS value). |
| `height` | `SizeValue` | — | Container height (px or CSS value). |
| `maxWidth` | `SizeValue` | — | Maximum container width (px or CSS value). |
| `minHeight` | `SizeValue` | — | Minimum container height (px or CSS value). |
| `isInline` | `boolean` | `false` | Use inline-flex (useful for text/icons). |
| `children` | `ReactNode` | — | Content to center. |
| `xstyle` | `StyleXStyles` | — | StyleX styles for layout customization (margins, positioning, sizing). Must be a stylex.create() value, not an inline style object like style={{}}. |

## Theming

| Component class | Preferred data attributes | Props | States |
|-----------------|---------------------------|-------|--------|
| `astryx-center` | `data-axis` | axis | — |

-e 
---

# Grid

A CSS grid layout container for arranging children in rows and columns. Use Grid for card galleries, dashboards, and any multi-column layout. Supports fixed column counts and responsive columns that reflow based on available width.

## Example

```tsx
<Grid columns={3} rowHeight={80} gap={3}>
  <GridSpan rows={4}>Tall</GridSpan>
  <GridSpan rows={2}>Short</GridSpan>
</Grid>

<Grid columns={3} gap={4}>
  <Item />
  <Item />
  <Item />
</Grid>

<Grid columns={3} gap={4}>
  <GridSpan columns={2}>Wide item</GridSpan>
  <div>Normal</div>
</Grid>
```

## Best Practices

- **Do:** Use responsive columns for layouts that should adapt to screen size: `columns={{minWidth: 280}}`.
- **Do:** Cap the column count with `max` to prevent rows from getting too wide on large screens.
- **Do:** Use `repeat: 'fill'` (the default) for consistent item widths. Use `'fit'` when items should stretch to fill leftover space.
- **Don't:** Write manual CSS grid; Grid handles spacing and responsive behavior for you.
- **Don't:** Use `HStack` with wrapping for grids; use Grid instead.
- **Do:** Track templates use CSS-variable indirection (not raw inline styles), so `xstyle` overrides of `gridTemplateColumns` (including inside `@media` queries) take effect.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `columns` | `number | {minWidth: number, max?: number, repeat?: 'fill' | 'fit'}` | — | Column configuration. Use a number for fixed columns (e.g. `columns={3}`). Use an object for responsive columns: `minWidth` sets the minimum column width in px, `repeat` controls track behavior (`"fill"` preserves empty tracks for consistent widths, `"fit"` collapses empty tracks so items stretch; defaults to `"fill"`), and `max` caps the maximum number of columns. |
| `minChildWidth` | `number` | — | Deprecated: use `columns={{minWidth: 280}}` instead. Minimum item width in px; enables responsive auto-fit. |
| `width` | `SizeValue` | — | Container width. Numbers are treated as pixels, strings are used as-is. |
| `height` | `SizeValue` | — | Container height. Numbers are treated as pixels, strings are used as-is. |
| `maxWidth` | `SizeValue` | — | Maximum container width. Numbers are treated as pixels, strings are used as-is. |
| `minHeight` | `SizeValue` | — | Minimum container height. Numbers are treated as pixels, strings are used as-is. |
| `gap` | `SpacingStep` | — | Spacing between all items. |
| `rowGap` | `SpacingStep` | — | Row spacing; overrides `gap` for the row axis. |
| `columnGap` | `SpacingStep` | — | Column spacing; overrides `gap` for the column axis. |
| `align` | `GridAlignment` | `'stretch'` | Vertical alignment of items. |
| `justify` | `GridAlignment` | `'stretch'` | Horizontal alignment of items. |
| `children` | `ReactNode` | — | Grid content. |
| `xstyle` | `StyleXStyles` | — | StyleX styles for layout customization (margins, positioning, sizing). Must be a stylex.create() value: not an inline style object like style={{}}. |

## Components

### GridSpan

undefined



## Theming

| Component class | Preferred data attributes | Props | States |
|-----------------|---------------------------|-------|--------|
| `astryx-grid` | `data-align`, `data-columns`, `data-gap`, `data-justify` | align, columns, gap, justify | — |
| `astryx-grid-span` | — | — | — |

-e 
---

# Layout

Layout provides composable components for building structured page shells with header, sidebar, content, and footer slots. Use Layout for full app layouts and HStack/VStack for simple directional stacking.

## Example

```tsx
<Layout
  header={<LayoutHeader hasDivider>App Name</LayoutHeader>}
  start={
    <LayoutPanel hasDivider width={240} role="navigation">
      <Navigation />
    </LayoutPanel>
  }
  content={
    <LayoutContent role="main">
      <MainContent />
    </LayoutContent>
  }
/>

<LayoutContainer variant="card">
  <Layout
    header={<LayoutHeader>Title</LayoutHeader>}
    content={<LayoutContent>Main body content</LayoutContent>}
  />
</LayoutContainer>
<LayoutContainer variant="card">
  <Layout
    content={
      <LayoutContent padding={0}>
        <Table />
      </LayoutContent>
    }
  />
</LayoutContainer>
<LayoutContainer variant="card">
  <Layout
    content={
      <LayoutContent isScrollable={false}>
        <StickyElement />
      </LayoutContent>
    }
  />
</LayoutContainer>

<LayoutContainer variant="card">
  <Layout
    content={<LayoutContent>...</LayoutContent>}
    footer={<LayoutFooter hasDivider>Actions</LayoutFooter>}
  />
</LayoutContainer>

<LayoutContainer variant="card">
  <Layout
    header={<LayoutHeader hasDivider>Page Title</LayoutHeader>}
    content={<LayoutContent>...</LayoutContent>}
  />
</LayoutContainer>

const sidebar = useResizable({ defaultSize: 250, minSizePx: 200 });
<LayoutPanel resizable={sidebar.props}>
  <Navigation />
</LayoutPanel>
<ResizeHandle resizable={sidebar.props} />

<LayoutContainer variant="card">
  <Layout
    start={
      <LayoutPanel hasDivider role="navigation">
        <Navigation />
      </LayoutPanel>
    }
    content={<LayoutContent>Main content</LayoutContent>}
    end={
      <LayoutPanel hasDivider role="complementary">
        <Sidebar />
      </LayoutPanel>
    }
  />
</LayoutContainer>
```

## Best Practices

- **Do:** Use Layout for page shells that need distinct zones like header, sidebar(s), content, and footer.
- **Do:** Use HStack and VStack for simple directional stacking within a content area.
- **Don't:** Use Layout for simple stacking layouts; use HStack or VStack instead.
- **Don't:** Nest multiple Layout components; use one per page shell and compose content within its slots.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `content` | `ReactNode` | — | Main content area (center). Children passed to `<Layout>` render here too: `<Layout>{main}</Layout>` is shorthand for `<Layout content={main} />`. |
| `header` | `ReactNode` | — | Header slot. |
| `footer` | `ReactNode` | — | Footer slot. |
| `start` | `ReactNode` | — | Start panel (left in LTR). |
| `end` | `ReactNode` | — | End panel (right in LTR). |
| `height` | `'fill' | 'auto'` | `'fill'` | Height behavior: fill the container or grow with content. |

## Components

### LayoutHeader

undefined



### LayoutContent

undefined



### LayoutFooter

undefined



### LayoutPanel

undefined



### Card

undefined



### Section

undefined



## Theming

| Component class | Preferred data attributes | Props | States |
|-----------------|---------------------------|-------|--------|
| `astryx-layout` | `data-height` | height | — |
| `astryx-layout-content` | — | — | — |
| `astryx-layout-footer` | — | — | — |
| `astryx-layout-header` | — | — | — |
| `astryx-layout-panel` | — | — | — |

-e 
---

# Stack

Stack arranges items in a row or column with consistent spacing. Use the gap prop to control the space between items.

## Example

```tsx
<Stack gap={2}>
  <Item />
  <Item />
</Stack>
<Stack direction="horizontal" gap={4} vAlign="center">
  <Item />
  <Item />
</Stack>

<HStack gap={2}>
  <StackItem size="static">Logo</StackItem>
  <StackItem size="fill">Content</StackItem>
  <StackItem size="static">Actions</StackItem>
</HStack>
```

## Best Practices

- **Do:** Use the gap prop for spacing between items; don't add margins manually.
- **Do:** Use StackItem with size="fill" to make one item stretch and fill the leftover space.
- **Don't:** Nest stacks inside stacks; try wrap="wrap" first to let items flow to the next line.

## Components

### HStack

Horizontal stack for arranging items left-to-right. Supports polymorphic rendering.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `gap` | `SpacingStep` | — | Spacing step (number literal): 0, 0.5, 1, 1.5, 2, 3, 4, 5, 6, 8, 10. Pass as a JSX number expression e.g. gap={4}, NOT a string like gap="4". |
| `padding` | `SpacingStep` | — | Inner padding on all sides, using the spacing scale (0, 0.5, 1, 1.5, 2, 3, 4, 5, 6, 8, 10). Matches the padding prop on Card, LayoutContent, and LayoutPanel. Pass as a JSX number expression e.g. padding={3}. |
| `paddingInline` | `SpacingStep` | — | Inline (horizontal) padding, using the spacing scale. Overrides padding on the inline axis when both are set. |
| `paddingBlock` | `SpacingStep` | — | Block (vertical) padding, using the spacing scale. Overrides padding on the block axis when both are set. |
| `isScrollable` | `boolean` | `false` | Enables scrollable overflow (overflow: auto). Matches isScrollable on LayoutContent and LayoutPanel. |
| `width` | `SizeValue` | — | Width of the stack container. Numbers are treated as pixels, strings are used as-is (e.g., '100%'). |
| `height` | `SizeValue` | — | Height of the stack container. Numbers are treated as pixels, strings are used as-is (e.g., '100%'). |
| `maxWidth` | `SizeValue` | — | Maximum width of the stack container. Numbers are treated as pixels, strings are used as-is (e.g., '100%'). |
| `minHeight` | `SizeValue` | — | Minimum height of the stack container. Numbers are treated as pixels, strings are used as-is (e.g., '100%'). |
| `hAlign` | `'start' | 'center' | 'end' | 'between' | 'around' | 'evenly'` | — | Horizontal (main-axis) alignment of items. |
| `vAlign` | `'start' | 'center' | 'end' | 'stretch'` | `'stretch'` | Vertical (cross-axis) alignment of items. |
| `justify` | `'start' | 'center' | 'end' | 'between' | 'around' | 'evenly'` | — | Main-axis alignment alias for hAlign. Mirrors CSS justify-content. |
| `align` | `'start' | 'center' | 'end' | 'stretch'` | — | Cross-axis alignment alias for vAlign. Mirrors CSS align-items. |
| `wrap` | `'nowrap' | 'wrap' | 'wrap-reverse'` | `'nowrap'` | Flex wrap behavior. |
| `as` | `ElementType` | `'div'` | HTML element to render as the stack container. |
| `children` | `ReactNode` | — | Stack content. |
| `xstyle` | `StyleXStyles` | — | StyleX styles for layout customization (margins, positioning, sizing). Must be a stylex.create() value, not an inline style object like style={{}}. |

### VStack

Vertical stack for arranging items top-to-bottom. Supports polymorphic rendering.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `gap` | `SpacingStep` | — | Spacing step (number literal): 0, 0.5, 1, 1.5, 2, 3, 4, 5, 6, 8, 10. Pass as a JSX number expression e.g. gap={4}, NOT a string like gap="4". |
| `padding` | `SpacingStep` | — | Inner padding on all sides, using the spacing scale (0, 0.5, 1, 1.5, 2, 3, 4, 5, 6, 8, 10). Matches the padding prop on Card, LayoutContent, and LayoutPanel. Pass as a JSX number expression e.g. padding={3}. |
| `paddingInline` | `SpacingStep` | — | Inline (horizontal) padding, using the spacing scale. Overrides padding on the inline axis when both are set. |
| `paddingBlock` | `SpacingStep` | — | Block (vertical) padding, using the spacing scale. Overrides padding on the block axis when both are set. |
| `isScrollable` | `boolean` | `false` | Enables scrollable overflow (overflow: auto). Matches isScrollable on LayoutContent and LayoutPanel. |
| `width` | `SizeValue` | — | Width of the stack container. Numbers are treated as pixels, strings are used as-is (e.g., '100%'). |
| `height` | `SizeValue` | — | Height of the stack container. Numbers are treated as pixels, strings are used as-is (e.g., '100%'). |
| `maxWidth` | `SizeValue` | — | Maximum width of the stack container. Numbers are treated as pixels, strings are used as-is (e.g., '100%'). |
| `minHeight` | `SizeValue` | — | Minimum height of the stack container. Numbers are treated as pixels, strings are used as-is (e.g., '100%'). |
| `hAlign` | `'start' | 'center' | 'end' | 'stretch'` | `'stretch'` | Horizontal (cross-axis) alignment of items. |
| `vAlign` | `'start' | 'center' | 'end' | 'between' | 'around' | 'evenly'` | — | Vertical (main-axis) alignment of items. |
| `justify` | `'start' | 'center' | 'end' | 'between' | 'around' | 'evenly'` | — | Main-axis alignment alias for vAlign. Mirrors CSS justify-content. |
| `align` | `'start' | 'center' | 'end' | 'stretch'` | — | Cross-axis alignment alias for hAlign. Mirrors CSS align-items. |
| `wrap` | `'nowrap' | 'wrap' | 'wrap-reverse'` | `'nowrap'` | Flex wrap behavior. |
| `as` | `ElementType` | `'div'` | HTML element to render as the stack container. |
| `children` | `ReactNode` | — | Stack content. |

### StackItem

Stack item for controlling individual item behavior within a stack. Supports polymorphic rendering.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `size` | `'static' | 'fill'` | `'static'` | Flex grow behavior: static keeps natural size, fill expands to consume remaining space. |
| `isScrollable` | `boolean` | `false` | Enables scrollable overflow (overflow: auto). StackItem already applies the flex min-height/min-width reset, so <StackItem size="fill" isScrollable> is a complete scroll region. Matches isScrollable on LayoutContent and LayoutPanel. |
| `crossAlignSelf` | `'start' | 'center' | 'end' | 'stretch'` | — | Override the cross-axis alignment for this individual item, ignoring the parent stack alignment. |
| `as` | `ElementType` | `'div'` | HTML element to render as the item wrapper. |
| `children` | `ReactNode` | — | Item content. |

## Theming

| Component class | Preferred data attributes | Props | States |
|-----------------|---------------------------|-------|--------|
| `astryx-stack` | `data-direction`, `data-gap`, `data-wrap` | direction, gap, wrap | — |
| `astryx-stack-item` | `data-size` | size | — |

-e 
---

# Avatar

Avatar represents a person or team with a profile photo, initials, or a default icon. Use it in comment headers, contact lists, chat messages, user cards, and anywhere you need to identify someone visually.

## Example

```tsx
getInitials('John Doe')
getInitials('Alice')

<Avatar src="/user.jpg" name="John Doe" />
<Avatar name="Jane Smith" size="large" />
<Avatar src="/user.jpg" status={<OnlineIndicator />} />

<AvatarStatusDot variant="success" label="Verified" icon={<CheckIcon />} />

<Avatar
  name="John Doe"
  size="medium"
  status={<AvatarStatusDot variant="success" label="Online" />}
/>
<Avatar
  name="Jane Smith"
  size="large"
  status={<AvatarStatusDot variant="success" label="Verified" icon={<CheckIcon />} />}
/>
```

## Anatomy

| Element | Required | Description |
|---------|----------|-------------|
| Photo | No | The profile image, loaded from the src URL. Shown when available. |
| Initials | No | One or two letters extracted from the name. Shown when no photo is available. |
| Default icon | No | A generic person silhouette. Shown when there is no photo or name. |
| Status dot | No | A small indicator in the bottom-right corner showing availability (online, away, busy). |

## Best Practices

- **Do:** Always pass a name so the avatar can show initials if the photo fails to load, and so screen readers can announce who it represents.
- **Do:** Pick a size that matches the context: tiny or xsmall for inline mentions, small or medium for lists and cards, large for profile headers.
- **Do:** Add a status dot when knowing someone's availability matters, like in chat or team views.
- **Don't:** Use Avatar for logos, product images, or anything that isn't a person or team. Use an image or icon instead.
- **Don't:** Force a square or custom shape. Avatars are always circular to stay consistent across the system.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `src` | `string` | — | Primary image source URL. |
| `fallbackSrc` | `string` | — | Fallback image when primary fails. |
| `name` | `string` | — | User name for initials and alt text. |
| `alt` | `string` | — | Alt text (falls back to name). |
| `size` | `'tiny' | 'xsmall' | 'small' | 'medium' | 'large' | number` | `'small'` | Avatar size. Use a named size ('tiny', 'xsmall', 'small', 'medium', 'large') or a numeric pixel value. Note: short names like 'sm', 'md', 'lg' are NOT valid; use the full words. |
| `status` | `ReactNode` | — | Corner content for status indicators. |

## Components

### AvatarStatusDot

undefined



## Theming

| Component class | Preferred data attributes | Props | States |
|-----------------|---------------------------|-------|--------|
| `astryx-avatar` | `data-size` | size | — |
| `astryx-avatar-status-dot` | `data-variant` | variant | — |

-e 
---

# Badge

Badge highlights a status or category at a glance. Use it sparingly: only when a value represents a distinct state (Active, Failed) or a grouping tag (Engineering, Design). Most metadata (dates, durations, counts, descriptions) should be plain description text, not badges.

## Example

```tsx
<Badge label="Active" />
<Badge variant="success" label="Active" />
<Badge variant="error" label="3" />
<Badge variant="purple" label="Engineering" />
```

## Anatomy

| Element | Required | Description |
|---------|----------|-------------|
| Icon | No | An optional leading icon that helps identify the badge type at a glance. |
| Label | Yes | The text or number shown inside the badge. |

## Best Practices

- **Do:** Every status badge steals attention. Only badge states where the user needs to notice or act: errors, warnings, items requiring follow-up. If no action is needed, plain text is fine.
- **Do:** Use success, warning, and error variants only for system status that demands attention: "Failed", "Degraded", "Action Required". These have bold solid backgrounds designed to stand out.
- **Do:** Use color variants (blue, purple, teal, etc.) for category tags that group or classify items: team names, content types, priority levels.
- **Do:** Keep labels to one or two words. If you need more detail, put it in surrounding text instead of the badge.
- **Do:** Add an icon when it helps identify the badge type quickly, but always include a text label alongside it.
- **Don't:** Apply a "success" badge to every healthy/active/normal item. If all rows show green "Active" badges, none stand out; the badge adds noise, not information. Show only the states that need user attention (errors, warnings, pending actions).
- **Don't:** Use badges for metadata. Durations ("6h window"), counts ("12 trigger types"), dates, and descriptions are not statuses or categories; use description text (Text with type="supporting") instead.
- **Don't:** Use semantic status variants (success, warning, error, info) for categories or informational content. These are visually loud and should only indicate system state.
- **Don't:** Repeat the same badge in every row of a table or list. If the same value appears in most rows, it's not adding information; use plain text for common states and reserve badges for the exceptional ones.
- **Don't:** Make badges clickable; they are read-only indicators. Use a button or link if the user needs to take action.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `'neutral' | 'info' | 'success' | 'warning' | 'error' | 'blue' | 'cyan' | 'green' | 'orange' | 'pink' | 'purple' | 'red' | 'teal' | 'yellow'` | `'neutral'` | Visual style variant. Semantic variants (neutral, info, success, warning, error) use solid backgrounds. Non-semantic color variants use tinted backgrounds with colored text for categorization and tagging. |
| `label` | `ReactNode` | — | Badge text content. |
| `icon` | `ReactNode` | — | Optional leading icon. |

## Theming

| Component class | Preferred data attributes | Props | States |
|-----------------|---------------------------|-------|--------|
| `astryx-badge` | `data-variant` | variant | — |

-e 
---

# Divider

A visual separator that divides content into distinct sections. Use to create clear boundaries between groups of related content, or to demarcate interactive regions within a layout.

## Example

```tsx
<Divider label="or" />
```

## Best Practices

- **Do:** Use subtle dividers between related content sections and strong dividers for high-contrast boundaries.
- **Do:** Add a label to the divider when sections need a visible category heading.
- **Don't:** Overuse dividers; rely on spacing and layout to separate content when possible.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `orientation` | `'horizontal' | 'vertical'` | `'horizontal'` | Orientation of the divider. |
| `label` | `ReactNode` | — | Optional label centered on the divider. |
| `variant` | `'subtle' | 'strong'` | `'subtle'` | Visual weight of the divider line. |
| `isFullBleed` | `boolean` | `false` | Extend the divider to container edges with negative margins. |
| `xstyle` | `StyleXStyles` | — | StyleX styles for layout customization (margins, positioning, sizing). Must be a stylex.create() value, not an inline style object like style={{}}. |

## Theming

| Component class | Preferred data attributes | Props | States |
|-----------------|---------------------------|-------|--------|
| `astryx-divider` | `data-orientation`, `data-variant` | orientation, variant | — |

-e 
---

# Icon

Icons are small visual symbols that represent actions, objects, or concepts. They improve scannability and reinforce meaning alongside text. Supports both direct SVG components and semantic icon names that adapt to the active theme.

## Example

```tsx
<Icon icon="close" size="md" color="primary" />

import { registerIcons } from '@astryxdesign/core';
import { brandIcons } from './brand-icons';
registerIcons(brandIcons);
```

## Best Practices

- **Do:** Use semantic icon names when available; they adapt to theme changes automatically.
- **Do:** Pair icons with text labels for accessibility; icon-only elements need an accessible label.
- **Do:** Use color tokens for icon colors, not hardcoded hex values.
- **Do:** Be mindful of context; decorative icons in compact components can distract rather than help.
- **Don't:** Use icons as the sole means of conveying meaning; always provide a text alternative.
- **Don't:** Resize icons with arbitrary pixel values; use the provided size props.
- **Don't:** Mix icon styles (e.g. outline and filled) within the same context.
- **Don't:** Render raw SVG elements; always wrap in Icon for consistent sizing and color.
- **Don't:** Pass a `name` prop; Icon uses `icon` (not `name`) to specify which icon to render.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `icon` | `IconName | ComponentType<SVGProps>` | — | Semantic icon name or SVG component. Valid semantic names: close, chevronDown, chevronLeft, chevronRight, check, success, error, warning, info, calendar, clock, externalLink, menu, moreHorizontal, search, arrowUp, arrowDown, arrowsUpDown, funnel, eyeSlash, viewColumns, copy, checkDouble, wrench, stop, microphone. For any icon not in this list, pass an SVG component directly (e.g. import from lucide-react or @heroicons/react). Note: this prop is called `icon`, not `name`. **(required)** |
| `color` | `'primary' | 'secondary' | 'tertiary' | 'disabled' | 'accent' | 'success' | 'error' | 'warning' | 'inherit'` | `'inherit'` | Color variant mapped to Astryx icon color tokens. |
| `size` | `'xsm' | 'sm' | 'md' | 'lg'` | `'md'` | Icon size. |

## Theming

| Component class | Preferred data attributes | Props | States |
|-----------------|---------------------------|-------|--------|
| `astryx-icon` | `data-color`, `data-size` | color, size | — |

-e 
---

# Skeleton

An animated shimmer placeholder that previews the shape of content while it loads. Use it to build loading screens that match the layout of the real content. For content with unknown dimensions, use Spinner instead.

## Example

```tsx
<Skeleton width={200} height={20} />
<Skeleton width={40} height={40} radius="rounded" />
<Skeleton width={300} height={16} index={0} />
<Skeleton width={280} height={16} index={1} />
```

## Best Practices

- **Do:** Match the size and shape of the content being loaded to create a realistic placeholder.
- **Do:** Stagger multiple skeletons with the `index` prop for a natural wave animation.
- **Don't:** Use when the content dimensions are unknown; use Spinner instead.
- **Don't:** Combine with a Spinner on the same content area; pick one loading pattern.
- **Don't:** Show skeletons indefinitely; if loading takes too long, show an error or empty state instead.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `width` | `number | string` | `'100%'` | Width in pixels (number) or CSS value (string). |
| `height` | `number | string` | `'100%'` | Height in pixels (number) or CSS value (string). |
| `radius` | `'none' | 0 | 1 | 2 | 3 | 4 | 'rounded'` | `3` | Border radius using design token scale. Use none for sharp corners, rounded for fully rounded (avatars, pills, circles). |
| `index` | `number` | `0` | Index for staggered animation timing. For element at index n, animation starts at DELAY_TIME + (STAGGER_TIME × n). |

## Theming

| Component class | Preferred data attributes | Props | States |
|-----------------|---------------------------|-------|--------|
| `astryx-skeleton` | — | — | — |

-e 
---

# Table

Table displays structured data in rows and columns with consistent dimensionality. It supports rich cell content, sorting, selection, pagination, and column management through a composable plugin system. Use Table for data sets with uniform structure; for simpler or inconsistent data, consider a list or card layout instead.

## Example

```tsx
<BaseTable
  data={[{ name: 'Alice', age: 30 }]}
  columns={[
    { key: 'name', header: 'Name' },
    { key: 'age', header: 'Age', width: pixel(80) },
  ]}
/>

<Table data={items} columns={columns} verticalAlign="top" />

<Table data={logs} columns={columns} textOverflow="wrap" />

<Table
  data={users}
  columns={[
    { key: 'name', header: 'Name', width: proportional(1), renderCell: (u) => (
      <HStack gap={2} align="center">
        <Avatar name={u.name} size="small" />
        <Text weight="semibold">{u.name}</Text>
      </HStack>
    )},
    { key: 'status', header: 'Status', width: proportional(1), renderCell: (u) => (
      <Badge variant={u.active ? 'success' : 'error'} label={u.active ? 'Active' : 'Inactive'} />
    )},
  ]}
  density="compact"
  dividers="grid"
  hasHover
/>

<TableRow>
  <TableCell>Alice</TableCell>
  <TableCell>30</TableCell>
</TableRow>

<thead>
  <tr>
    <TableHeaderCell>Name</TableHeaderCell>
    <TableHeaderCell>Age</TableHeaderCell>
  </tr>
</thead>

<Table>
  <TableRow>
    <TableCell>Alice</TableCell>
    <TableCell>30</TableCell>
  </TableRow>
</Table>
```

## Anatomy

| Element | Required | Description |
|---------|----------|-------------|
| Column Header | Yes | Displays titles, sorting controls, and bulk selection. |
| Body Rows | Yes | Rows with consistent data structure. |
| Footer | No | Displays summary or totals. |
| Top Bar | No | Contains title, toolbar, and filters. |
| Bottom Bar | No | Contains pagination controls. |
| Support Panels | No | Displays row details in a side panel. |

## Best Practices

- **Do:** Use density and divider variants to match the information density and scanning needs of your data.
- **Do:** Compose rich cell content with Astryx components like Badge, StatusDot, and Avatar via renderCell.
- **Do:** Set explicit width on every column using proportional() or pixel(). proportional(1) gives equal flex distribution with a 120px minimum that prevents columns from collapsing on narrow viewports. Omitting width skips the minimum.
- **Do:** Use the data-driven API from React Server Components: proportional(), pixel(), and column definitions without function props are server-safe. Columns using renderCell (or any function prop) need the table wrapped in a "use client" component, since functions cannot cross the server-client boundary.
- **Don't:** Use a table for data without consistent columns. Use a list or card layout for heterogeneous content.
- **Don't:** Enable every plugin at once. Add only the features your use case requires to keep the interface focused.
- **Don't:** Omit width on text-heavy columns; without an explicit proportional() width they have no minimum and can squish to near-zero on mobile.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `data` | `T[]` | — | Array of data items to render as rows. T must extend Record<string, unknown> (use `interface MyRow extends Record<string, unknown>` for custom types). |
| `columns` | `TableColumn<T>[]` | — | Column definitions: each column has {key, header, width?, align?, renderCell?}. The `header` field sets the column heading text. If omitted, columns are auto-generated from data object keys. |
| `idKey` | `(keyof T & string) | ((item: T) => string | number)` | — | Row key for React reconciliation. Pass a property name string or a function. Falls back to row index if omitted. |
| `density` | `'compact' | 'balanced' | 'spacious'` | `'balanced'` | Row density controlling cell padding and font size. |
| `dividers` | `'rows' | 'columns' | 'grid' | 'none'` | `'rows'` | Divider style rendered between cells. |
| `isStriped` | `boolean` | `false` | Applies a background wash to even-numbered rows. |
| `hasHover` | `boolean` | `false` | Applies a hover highlight background to rows on pointer devices. |
| `verticalAlign` | `'middle' | 'top' | 'bottom'` | `'middle'` | Vertical alignment for body row cells. Controls `vertical-align` on the `<td>` elements. |
| `textOverflow` | `'wrap' | 'truncate'` | `'wrap'` | How body cell text behaves when it exceeds the column width. 'wrap' lets text wrap and the row grow taller; 'truncate' clips with an ellipsis (default-rendered cells show a tooltip on hover when truncated). Header cells always truncate. |
| `plugins` | `Record<string, TablePlugin<T>>` | — | Named plugins that extend table behavior via the transform pipeline. Converted to an ordered array internally. |
| `children` | `ReactNode` | — | Children mode: render TableRow/TableCell directly instead of using data-driven rendering. |
| `xstyle` | `StyleXStyles` | — | StyleX styles for layout customization (margins, positioning, sizing). Must be a stylex.create() value: not an inline style object like style={{}}. |

## Components

### TableRow

undefined



### TableCell

undefined



### TableHeaderCell

undefined



### useTableSelection

undefined



### useTableSelectionState

undefined



### useTableSortable

undefined



### useTablePagination

undefined



### useTableColumnSettings

undefined



### useTableFiltering

undefined



### useTableFilterState

undefined



## Theming

| Component class | Preferred data attributes | Props | States |
|-----------------|---------------------------|-------|--------|
| `astryx-base-table` | — | — | — |
| `astryx-table-row` | — | — | — |
| `astryx-table-cell` | — | — | — |
| `astryx-table-header-cell` | — | — | — |

-e 
---

# Text

Text renders styled body text and headings from the theme. Use Text with a semantic type for body copy, labels, and captions, and Heading for section titles that output the correct h1–h6 element.

## Example

```tsx
<Text type="body">Body text</Text>
<Text type="large">Large body text</Text>
<Text type="label">Form label</Text>
<Text type="supporting">Helper text</Text>
<Text type="code">{'const x = 1;'}</Text>
<Text type="display-1" as="h1">Hero Title</Text>
<Text type="display-2">$1.2M Revenue</Text>
<Text type="body" maxLines={2}>Clamped text</Text>
```

## Best Practices

- **Do:** Pick a semantic type (body, label, supporting, large, code) instead of manually setting size and weight; the theme handles the details.
- **Do:** Set accessibilityLevel on Heading when the visual level differs from the document outline so screen readers announce the correct hierarchy.
- **Do:** Use maxLines with a number to truncate long content; a tooltip appears automatically on hover so no text is lost.
- **Do:** Enable hasTabularNumbers for columns of numeric data so digits align vertically across rows.
- **Don't:** Override size and weight when a semantic type already matches; extra overrides fight the theme and break when themes change.
- **Don't:** Skip heading levels in the document outline; go h1 then h2 then h3, never h1 then h3.
- **Don't:** Use raw HTML tags like <p>, <h1>–<h6>, or <span> for text; Text and Heading apply the correct theme tokens automatically.
- **Don't:** Pass a `variant` prop; Text does not have a `variant` prop. Use `type` for semantic styling (body, label, large, supporting, code) or use Heading for headings.
- **Don't:** Use Text for headings; use Heading with a `level` prop (1–6) for section titles and headings.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `type` | `'body' | 'large' | 'label' | 'supporting' | 'code' | 'display-1' | 'display-2' | 'display-3'` | `'body'` | Semantic text type. Determines size, weight, and line-height from the theme. Note: this prop is called `type`, not `variant`. |
| `children` | `ReactNode` | — | Text content. **(required)** |
| `size` | `'4xs' | '3xs' | '2xs' | 'xsm' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl'` | — | Explicit font size override. Overrides the size from `type` but preserves other type properties. Prefer using `type` alone. |
| `color` | `'primary' | 'secondary' | 'disabled' | 'placeholder' | 'accent' | 'inherit'` | — | Text color. Defaults to 'secondary' for the 'supporting' type, 'primary' for all others. |
| `weight` | `'normal' | 'medium' | 'semibold' | 'bold'` | — | Font weight override. |
| `display` | `'inline' | 'block'` | `'inline'` | Display type. Silently overridden to 'block' when maxLines > 0 or hasCapsize is true. |
| `as` | `'span' | 'p' | 'div' | 'label'` | `'span'` | HTML element to render. |
| `maxLines` | `number` | `0` | Maximum lines before truncation. 0 means no truncation. When set, shows a tooltip on hover if content is truncated. |
| `hasTruncateTooltip` | `boolean | 'above' | 'below' | 'start' | 'end'` | `true` | Controls tooltip behavior for truncated text. true shows the tooltip at the default position, false disables it, or a placement string ('above' | 'below' | 'start' | 'end') sets a specific position. |
| `wordBreak` | `'break-word' | 'break-all'` | — | Word break behavior when truncating. Defaults to 'break-all' for single-line truncation, 'break-word' otherwise. |
| `textWrap` | `'wrap' | 'nowrap' | 'balance' | 'pretty'` | — | Text wrapping behavior. |
| `justify` | `'start' | 'center' | 'end'` | `'start'` | Text alignment (justification). Uses logical values (start/end) for i18n/RTL compatibility. |
| `hasCapsize` | `boolean` | `false` | Enable optical alignment using text-box-trim. Forces block display. |
| `hasStrikethrough` | `boolean` | `false` | Apply strikethrough text decoration. |
| `hasTabularNumbers` | `boolean` | `false` | Use tabular (monospace) numbers for aligned numeric data. |
| `id` | `string` | — | HTML id attribute. |
| `xstyle` | `StyleXStyles` | — | StyleX styles for layout customization (margins, positioning, sizing). Must be a stylex.create() value: not an inline style object like style={{}}. |

## Components

### Heading

undefined



## Theming

| Component class | Preferred data attributes | Props | States |
|-----------------|---------------------------|-------|--------|
| `astryx-heading` | `data-level`, `data-color` | level, color | — |
| `astryx-text` | `data-type`, `data-size`, `data-color` | type, size, color | — |

-e 
---

# CheckboxInput

CheckboxInput toggles a single on/off value. Use it for settings like "Enable notifications", terms acceptance, or opt-in choices. For multiple checkboxes in a group, use CheckboxList instead.

## Example

```tsx
<CheckboxInput
  label="Accept terms"
  value={accepted}
  isDisabled
  disabledMessage="Terms are managed by your administrator"
/>

<CheckboxInput
  label="Accept terms"
  value={accepted}
  onChange={setAccepted}
/>
<CheckboxInput
  label="Subscribe"
  description="Receive weekly updates"
  value={subscribed}
  onChange={setSubscribed}
/>
```

## Anatomy

| Element | Required | Description |
|---------|----------|-------------|
| Checkbox | Yes | The check box itself: unchecked, checked, or indeterminate. |
| Label | Yes | Text describing what the checkbox controls. Always present for accessibility. |
| Description | No | Helper text below the label with additional context. |
| Status message | No | An error, warning, or success message below the checkbox. |

## Best Practices

- **Do:** Always provide a visible label so the user knows what they are toggling. Use isLabelHidden only when surrounding context makes it obvious.
- **Do:** Add a description for choices that need extra context, like explaining what "Share usage data" actually shares.
- **Do:** Use the indeterminate state for "select all" checkboxes when only some items in a group are selected.
- **Don't:** Use a checkbox for mutually exclusive choices; use RadioList when only one option can be selected.
- **Don't:** Use a checkbox for actions that take effect immediately; use a toggle switch or button instead.
- **Don't:** Wrap a disabled checkbox in Tooltip to explain why it is disabled; disabled controls swallow the hover events the wrapper needs. Use the disabledMessage prop instead.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `ref` | `React.Ref<HTMLInputElement>` | — | Ref forwarded to the underlying <input> element. |
| `label` | `string` | — | Label text for the checkbox (always rendered for accessibility). **(required)** |
| `isLabelHidden` | `boolean` | `false` | Whether to visually hide the label (still accessible to screen readers). |
| `description` | `string` | — | Description text displayed below the label. |
| `value` | `boolean | 'indeterminate'` | — | Whether the checkbox is checked, unchecked, or indeterminate. **(required)** |
| `onChange` | `(checked: boolean, e: ChangeEvent<HTMLInputElement>) => void` | — | Callback fired when the checkbox state changes. |
| `changeAction` | `(checked: boolean, e: ChangeEvent<HTMLInputElement>) => void | Promise<void>` | — | Async action on change. Fires after onChange if not prevented. Shows loading spinner while pending. |
| `isLoading` | `boolean` | `false` | Whether the checkbox is in a loading state. Shows spinner and prevents interaction. |
| `isDisabled` | `boolean` | `false` | Whether the checkbox is disabled. |
| `htmlName` | `string` | — | The HTML name attribute for the underlying checkbox input, useful for form submissions (submits "on" when checked). |
| `disabledMessage` | `string` | — | Explains why the checkbox is disabled. With isDisabled, shows a tooltip on hover/keyboard focus and keeps the checkbox focusable via aria-disabled (toggling stays blocked). Use this instead of wrapping a disabled CheckboxInput in Tooltip. Disabled controls swallow the hover events an external Tooltip needs. |
| `isReadOnly` | `boolean` | `false` | Whether the checkbox is read-only. Displays the current state at full opacity but prevents interaction. Unlike `isDisabled`, read-only checkboxes are not visually dimmed. |
| `isOptional` | `boolean` | `false` | Whether the field is optional. Mutually exclusive with isRequired. |
| `isRequired` | `boolean` | `false` | Whether the checkbox is required. Mutually exclusive with isOptional. |
| `size` | `'sm' | 'md'` | `'md'` | The size of the checkbox. sm for compact layouts, md for default. |
| `onFocus` | `(e: FocusEvent<HTMLInputElement>) => void` | — | Callback fired when the checkbox receives focus. |
| `onBlur` | `(e: FocusEvent<HTMLInputElement>) => void` | — | Callback fired when the checkbox loses focus. |
| `labelIcon` | `IconType` | — | Icon to display before the label text. See `npx astryx docs icons` for valid semantic names. |
| `status` | `{ type: 'error' | 'warning' | 'success', message: string }` | — | Status indicator. Displays a colored message box below the checkbox and sets aria-invalid for errors. |

## Theming

| Component class | Preferred data attributes | Props | States |
|-----------------|---------------------------|-------|--------|
| `astryx-checkbox-input` | `data-size` | size | — |
| `astryx-checkbox` | — | — | — |

-e 
---

# DateInput

DateInput lets the user type or pick a date from a calendar popover. Use it for scheduling, deadlines, booking dates, or any form field that needs a specific calendar date.

## Example

```tsx
<DateInput
  label="Event date"
  value={date}
  onChange={setDate}
  isDisabled
  disabledMessage="You need the Editor role to change this"
/>

<DateInput
  label="Event date"
  value={date}
  onChange={setDate}
/>
```

## Anatomy

| Element | Required | Description |
|---------|----------|-------------|
| Label | Yes | Text above the input describing what date is expected. |
| Text input | Yes | A field where the user can type a date directly. Parses common formats like MM/DD/YYYY. |
| Calendar icon | Yes | A button that opens the calendar popover for visual date picking. |
| Calendar popover | No | A month grid that appears when the icon is clicked or the input is focused. |
| Clear button | No | A × button that resets the date value. Shown when hasClear is true and a date is set. |
| Status message | No | An error, warning, or success message below the input. |

## Best Practices

- **Do:** Provide clear labels and descriptions so users understand what date is expected.
- **Do:** Use min, max, and dateConstraints to restrict selectable dates to valid ranges.
- **Do:** Use hasClear when the date is optional so the user can reset it.
- **Do:** Show a loading state with changeAction when the date triggers a server-side save.
- **Do:** Use DateInput inside InputGroup when adding a short static prefix or suffix, such as a due-date hint.
- **Don't:** Use a DateInput for free-form text that does not represent a calendar date.
- **Don't:** Hide the label without surrounding context that makes the field purpose obvious.
- **Don't:** Rely on the calendar alone; the text input lets users type dates directly, which is faster for known dates.
- **Don't:** Wrap a disabled DateInput in Tooltip to explain why it is disabled; disabled triggers swallow the hover events the wrapper needs. Use the disabledMessage prop instead.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | `string` | — | Label text. **(required)** |
| `isLabelHidden` | `boolean` | `false` | Visually hide the label. |
| `description` | `string` | — | Helper text displayed below the label. |
| `isOptional` | `boolean` | `false` | Show an "(optional)" indicator next to the label. |
| `isRequired` | `boolean` | `false` | Mark the field as required. |
| `isDisabled` | `boolean` | `false` | Disable the input and calendar. |
| `disabledMessage` | `string` | — | Explains why the input is disabled. With isDisabled, shows a tooltip on hover/keyboard focus and keeps the field focusable via aria-disabled (activation stays blocked). Use this instead of wrapping a disabled DateInput in Tooltip. Disabled controls swallow the hover events an external Tooltip needs. |
| `value` | `ISODateString` | — | Selected date in YYYY-MM-DD format. |
| `onChange` | `(value: ISODateString | undefined) => void` | — | Callback invoked when the selected date changes. |
| `changeAction` | `(value: ISODateString | undefined) => void | Promise<void>` | — | Async action fired after onChange. Drives optimistic UI updates via useTransition. |
| `isLoading` | `boolean` | `false` | Whether the input is in a loading state. Disables interaction and shows a spinner. |
| `min` | `ISODateString` | — | Minimum selectable date (YYYY-MM-DD). |
| `max` | `ISODateString` | — | Maximum selectable date (YYYY-MM-DD). |
| `dateConstraints` | `Array<(date: Date) => boolean>` | — | Array of custom constraint functions that disable specific dates. |
| `placeholder` | `string` | `'Select a date'` | Placeholder text shown in the text input. |
| `size` | `'sm' | 'md' | 'lg'` | `'md'` | Size of the input control. |
| `status` | `InputStatus` | — | Status indicator object for error, warning, or success states with a message. |
| `labelTooltip` | `string` | — | Tooltip text displayed via an info icon at the end of the label. |
| `hasClear` | `boolean` | `false` | Shows a clear (×) button when a date value is set. Clicking it clears the value and returns focus to the input. |
| `numberOfMonths` | `1 | 2` | `1` | Number of months displayed simultaneously in the calendar popover. |
| `xstyle` | `StyleXStyles` | — | StyleX styles for layout customization (margins, positioning, sizing). Must be a stylex.create() value, not an inline style object like style={{}}. |

## Theming

| Component class | Preferred data attributes | Props | States |
|-----------------|---------------------------|-------|--------|
| `astryx-date-input` | `data-size`, `data-status` | size, status | — |

-e 
---

# Field

Field is a low-level wrapper for custom, native, or third-party controls that do not already provide field label, description, and status UI. Use it when you need the Field shell around a control you own; use styled Astryx inputs like TextInput, Typeahead, and Select directly when they already expose label, description, and validation props.

## Example

```tsx
const id = useId();
const descID = useId();
<Field label="Email" description="We'll never share your email" inputID={id} descriptionID={descID}>
  <input id={id} aria-describedby={descID} />
</Field>

<FieldLabel label="Email" inputID={inputId} description="We won't share it" />
<FieldLabel label="Search" inputID={inputId} isLabelHidden />
```

## Anatomy

| Element | Required | Description |
|---------|----------|-------------|
| Label | Yes | Text identifying the field. Always rendered for accessibility, optionally hidden visually. |
| Description | No | Helper text between the label and input explaining what to enter. |
| Control slot | Yes | A custom, native, or third-party control that does not already render a field shell. |
| Status message | No | Inline validation feedback showing error, warning, or success with a message. |
| Optional/Required indicator | No | Badge next to the label showing whether the field is optional or required. |
| Label tooltip | No | Info icon at the end of the label with a tooltip explaining the field. |

## Best Practices

- **Do:** Wrap custom controls, native inputs, or third-party widgets that need labeling, helper text, optional/required indicators, or validation status.
- **Do:** Always provide a label for accessibility, even if visually hidden with isLabelHidden.
- **Do:** Use inputID and descriptionID to connect the label and description to the inner control with htmlFor and aria-describedby.
- **Don't:** Nest Field around styled inputs such as TextInput, Typeahead, Select, DateInput, or TextArea; those components already render their own Field shell.
- **Don't:** Use the attached status variant on non-bordered controls such as sliders, switches, or checkboxes; use detached so the message does not overlap the control.
- **Don't:** Set both isOptional and isRequired on the same field.
- **Don't:** Hide the label without providing an alternative way for the user to understand the field purpose.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | `string` | — | Label text for the field (always rendered for accessibility). **(required)** |
| `inputID` | `string` | — | ID for the input element (used for the label htmlFor attribute). **(required)** |
| `children` | `ReactNode` | — | The input or control to render. **(required)** |
| `isLabelHidden` | `boolean` | `false` | Visually hide the label (still accessible to screen readers). |
| `isDisabled` | `boolean` | `false` | Whether the associated input is disabled. Propagates disabled styling to the label. |
| `description` | `string` | — | Description text displayed between the label and input. |
| `descriptionID` | `string` | — | ID for the description element (use for aria-describedby on the input). |
| `isOptional` | `boolean` | `false` | Whether the field is optional (mutually exclusive with isRequired). |
| `isRequired` | `boolean` | `false` | Whether the field is required (mutually exclusive with isOptional). |
| `labelIcon` | `IconType` | — | Icon to display before the label text. See `npx astryx docs icons` for valid semantic names. |
| `labelTooltip` | `string` | — | Tooltip text to display in an info icon at the end of the label. |
| `status` | `FieldStatus` | — | Status indicator with type and optional message. When message is set, displays a colored status box. |
| `statusVariant` | `'attached' | 'detached'` | `'attached'` | How the status message renders relative to the input. Attached overlaps the input border; detached floats below. |
| `width` | `SizeValue` | — | Width of the field (number = pixels, string used as-is, e.g. "100%"). Sizes the whole field (label, control, and status) so they stay aligned. Prefer this over setting width via xstyle/className/style, which only size the inner control box. |
| `ref` | `React.Ref<HTMLDivElement>` | — | Ref forwarded to the root element. |
| `xstyle` | `StyleXStyles` | — | StyleX styles for layout customization (margins, positioning, sizing). Must be a stylex.create() value: not an inline style object like style={{}}. |
| `className` | `string` | — | CSS class name(s) appended to the root element. Prefer xstyle for StyleX deduplication. |
| `style` | `React.CSSProperties` | — | Inline styles applied to the root element. Takes priority over StyleX inline styles. |

## Components

### FieldLabel

undefined



### FieldStatus

undefined



## Theming

| Component class | Preferred data attributes | Props | States |
|-----------------|---------------------------|-------|--------|
| `astryx-field` | `data-layout` | layout | — |
| `astryx-field-label` | — | — | — |
| `astryx-field-status` | `data-type`, `data-variant` | type, variant | — |

-e 
---

# NumberInput

A form input for numeric values with built-in validation, min/max constraints, and step controls. Use NumberInput for quantities, measurements, percentages, and similar inputs.

## Example

```tsx
<NumberInput
  label="Quantity"
  value={quantity}
  isDisabled
  disabledMessage="Editing is locked while the order is processing"
/>

<NumberInput label="Quantity" value={quantity} onChange={setQuantity} />
<NumberInput label="Price" value={price} onChange={setPrice} min={0} step={0.01} />
```

## Anatomy

| Element | Required | Description |
|---------|----------|-------------|
| Label | Yes | The label for the number input. |
| Description | No | Additional description text below the label. |
| Icon | No | An optional icon within the input. |
| Placeholder | No | Placeholder text shown when the input is empty. |
| Spinner | No | Increment and decrement controls for the value. |

## Best Practices

- **Do:** Set min, max, and step to guide users toward valid values.
- **Do:** Show units (e.g. "%" or "GB") so users know what the number represents.
- **Don't:** Use NumberInput for free-form text that happens to contain numbers; use TextInput instead.
- **Don't:** Set both isOptional and isRequired on the same field.
- **Don't:** Wrap a disabled NumberInput in Tooltip to explain why it's disabled; disabled controls swallow the hover events the wrapper needs. Use the disabledMessage prop instead.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | `string` | — | Label text for the input (always rendered for accessibility). **(required)** |
| `value` | `number | null | undefined` | — | Current value of the input. **(required)** |
| `onChange` | `(value: number) => void` | — | Callback fired when input value changes (only on valid input). **(required)** |
| `size` | `'sm' | 'md' | 'lg'` | `'md'` | Size variant. |
| `isLabelHidden` | `boolean` | — | Visually hide the label (still accessible to screen readers). |
| `description` | `string` | — | Description text displayed between the label and input. |
| `isOptional` | `boolean` | — | Whether the field is optional (mutually exclusive with isRequired). |
| `isRequired` | `boolean` | — | Whether the field is required (mutually exclusive with isOptional). |
| `isDisabled` | `boolean` | — | Whether the input is disabled. |
| `disabledMessage` | `string` | — | Explains why the input is disabled. With isDisabled, shows a tooltip on hover/keyboard focus and keeps the input focusable via aria-disabled (the field becomes read-only). Use this instead of wrapping a disabled NumberInput in Tooltip. |
| `placeholder` | `string` | — | Placeholder text. |
| `labelTooltip` | `string` | — | Tooltip text to display in an info icon at the end of the label. |
| `startIcon` | `IconType` | — | Icon to display at the start of the input. See `npx astryx docs icons` for valid semantic names. |
| `labelIcon` | `IconType` | — | Icon to display before the label text. See `npx astryx docs icons` for valid semantic names. |
| `status` | `{type: 'error' | 'warning' | 'success', message?: string}` | — | Validation status with optional message. |
| `min` | `number | null` | — | Minimum value allowed. |
| `max` | `number | null` | — | Maximum value allowed. |
| `step` | `number | null` | `1` | Step increment for the input. |
| `units` | `string | null` | — | Units text to display at the end of the input (e.g., "%" or "GB"). |
| `isIntegerOnly` | `boolean` | — | Only allow integer values (no floating point). |
| `hasClear` | `boolean` | `false` | Shows a clear (×) button when the input has a value. When true, the onChange callback also accepts null to signal the user cleared the input. |
| `htmlName` | `string` | — | HTML name attribute for form submissions. |
| `autoComplete` | `string` | — | HTML autocomplete attribute. |
| `hasAutoFocus` | `boolean` | — | Whether to focus the input on mount. |
| `onFocus` | `(e: FocusEvent<HTMLInputElement>) => void` | — | Callback fired when the input receives focus. |
| `onBlur` | `(e: FocusEvent<HTMLInputElement>) => void` | — | Callback fired when the input loses focus. |
| `onEnter` | `() => void` | — | Callback fired when the user presses the Enter key. |

## Theming

| Component class | Preferred data attributes | Props | States |
|-----------------|---------------------------|-------|--------|
| `astryx-number-input` | `data-size`, `data-status` | size, status | — |

-e 
---

# RadioList

A group of options where only one can be selected at a time. All options are visible at once, making it easy to compare choices. Use it when users need to pick one option from a small set.

## Example

```tsx
<RadioList
  label="Notification preference"
  value={selected}
  onChange={setSelected}>
  <RadioListItem label="Email" value="email" />
  <RadioListItem label="SMS" value="sms" />
  <RadioListItem label="Push" value="push" />
</RadioList>

<RadioListItem label="Email" value="email" />
<RadioListItem
  label="SMS"
  value="sms"
  description="Standard messaging rates apply"
/>
```

## Anatomy

| Element | Required | Description |
|---------|----------|-------------|
| Header | No | Optional heading above the radio list. |
| Children | Yes | The radio list items rendered as selectable options. |
| Label/Value | Yes | The text label and associated value for each radio item. |

## Best Practices

- **Do:** Keep the number of options small: typically 2 to 7 choices.
- **Do:** Use clear, concise labels that differentiate each option at a glance.
- **Do:** Pre-select a default option when there's a sensible default; don't leave the group empty unless the choice is optional.
- **Don't:** Use when multiple selections are needed; use CheckboxList instead.
- **Don't:** Use for long lists; use Selector for better discoverability.
- **Don't:** Use horizontal layout with more than 4 options; it wraps awkwardly.
- **Don't:** Wrap a disabled RadioList in Tooltip to explain why it is disabled; disabled controls swallow the hover events the wrapper needs. Use the disabledMessage prop instead.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | `string` | — | Label text for the radio group (always rendered for accessibility). **(required)** |
| `value` | `string` | — | The currently selected value. **(required)** |
| `onChange` | `(value: string) => void` | — | Callback fired when the selected value changes. **(required)** |
| `children` | `ReactNode` | — | RadioListItem elements. **(required)** |
| `isLabelHidden` | `boolean` | `false` | Whether to visually hide the label. |
| `description` | `string` | — | Description text displayed below the label. |
| `orientation` | `'vertical' | 'horizontal'` | `'vertical'` | Layout direction of the radio items. |
| `isDisabled` | `boolean` | `false` | Whether all radio items are disabled. |
| `htmlName` | `string` | — | The HTML name attribute shared by the radio inputs, useful for form submissions. When omitted, a unique internal name still groups the radios. |
| `disabledMessage` | `string` | — | Explains why the group is disabled. Applies to the whole-group disabled state (isDisabled), not per item. With isDisabled, shows a tooltip on hover/keyboard focus and keeps the radios focusable via aria-disabled (selection stays blocked). Use this instead of wrapping a disabled RadioList in Tooltip. Disabled controls swallow the hover events an external Tooltip needs. |
| `isRequired` | `boolean` | `false` | Whether the radio group is required. |
| `isOptional` | `boolean` | `false` | Whether the field is optional (mutually exclusive with isRequired). |
| `status` | `InputStatus` | — | Status indicator ({ type, message }). |
| `size` | `'sm' | 'md'` | `'md'` | Size of the radio controls. |
| `labelTooltip` | `string` | — | Tooltip text for an info icon next to the label. |
| `xstyle` | `StyleXStyles` | — | StyleX styles for layout customization (margins, positioning, sizing). Must be a stylex.create() value: not an inline style object like style={{}}. |

## Components

### RadioListItem

undefined



## Theming

| Component class | Preferred data attributes | Props | States |
|-----------------|---------------------------|-------|--------|
| `astryx-radio-list` | `data-orientation`, `data-size` | orientation, size | — |
| `astryx-radio-list-item` | — | — | — |
| `astryx-radio` | `data-size`, `data-checked`, `data-disabled` | size | checked, disabled |
| `astryx-radio-dot` | `data-size` | size | — |

-e 
---

# Selector

A dropdown selector for choosing a single value from a list of options. Supports labels, validation, descriptions, and required/optional states. Use it in forms and settings when presenting a moderate number of options.

## Example

```tsx
<Selector
  label="Owner"
  options={owners}
  isDisabled
  disabledMessage="You need the Editor role to change this"
/>

<Selector
  label="Fruit"
  options={['Apple', 'Banana', 'Orange']}
  value={fruit}
  onChange={setFruit}
  placeholder="Select a fruit..."
/>

<Selector
  label="User"
  options={users}
  value={value}
  onChange={setValue}
  renderOption={option => (
    <SelectorOption
      icon={UserIcon}
      label={option.label}
      description={option.email}
    />
  )}
/>
```

## Anatomy

| Element | Required | Description |
|---------|----------|-------------|
| Label | No | Text label displayed above the selector. |
| Placeholder | No | Hint text shown when no value is selected. |
| Description | No | Helper text providing additional context. |
| Left Icon | No | Icon displayed to the left of the selected value. |
| Value | Yes | The currently selected item displayed in the selector. |
| List | Yes | The dropdown list of selectable options. |

## Best Practices

- **Do:** Provide a visible label so users understand what they are selecting.
- **Do:** Use sections and dividers to organize options when the list exceeds ~8 items.
- **Do:** Use renderOption for custom option rows. Do not pass SelectorOption directly as JSX children.
- **Do:** Set a meaningful placeholder that hints at the expected selection (e.g. "Choose a country" not "Select...").
- **Do:** Use inside InputGroup only when the selector needs a short prefix or suffix addon as part of one decorated input surface.
- **Don't:** Use for action menus; use Dropdown Menu for triggering commands or navigation.
- **Don't:** Use when there are only two options; use a SegmentedControl or radio buttons instead.
- **Don't:** Use Selector for navigation; links should be links, not dropdown options.
- **Don't:** Use for yes/no or on/off choices; use Switch or CheckboxInput instead.
- **Don't:** Put more than ~20 options without sections; consider Typeahead for large lists.
- **Don't:** Wrap a disabled Selector in Tooltip to explain why it is disabled; disabled triggers swallow the hover events the wrapper needs. Use the disabledMessage prop instead.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | `string` | — | Label text for accessibility. **(required)** |
| `options` | `SelectorOption[]` | — | Array of items: strings, objects with value/label/icon/disabled, dividers ({type: "divider"}), or sections ({type: "section", title, items}). **(required)** |
| `value` | `string` | — | Currently selected value. |
| `onChange` | `(value: string) => void` | — | Callback fired when the selection changes. |
| `hasClear` | `boolean` | `false` | Shows a clear (×) button when a value is selected. When true, onChange also accepts null to signal the user cleared the selection. |
| `hasSearch` | `boolean` | `false` | Whether to show a search input for filtering options. |
| `searchPlaceholder` | `string` | `'Search...'` | Placeholder text for the search input. |
| `placeholder` | `string` | `'Select...'` | Placeholder text shown when no value is selected. |
| `size` | `'sm' | 'md' | 'lg'` | `'md'` | Size variant for the selector. |
| `isDisabled` | `boolean` | `false` | Disables the selector. |
| `htmlName` | `string` | — | The HTML name attribute for form submissions. Renders a hidden input carrying the selected value, like a native select. |
| `disabledMessage` | `string` | — | Explains why the selector is disabled. With isDisabled, shows a tooltip on hover/keyboard focus and keeps the trigger focusable via aria-disabled (activation stays blocked). Use this instead of wrapping a disabled Selector in Tooltip. Disabled controls swallow the hover events an external Tooltip needs. |
| `isLabelHidden` | `boolean` | `false` | Visually hides the label while keeping it accessible. |
| `description` | `string` | — | Helper text displayed below the label. |
| `isOptional` | `boolean` | `false` | Marks the field as optional. |
| `isRequired` | `boolean` | `false` | Marks the field as required. |
| `status` | `{type: 'error' | 'warning' | 'success', message?: string}` | — | Validation status with an optional message. |
| `renderOption` | `(option: SelectorOptionData) => ReactNode` | — | Custom render function for each selectable option in the dropdown. Use this instead of JSX children; dividers and sections are rendered by the selector. |
| `xstyle` | `StyleXStyles` | — | StyleX styles for layout customization (margins, positioning, sizing). Must be a stylex.create() value: not an inline style object like style={{}}. |

## Components

### SelectorOption

undefined



## Theming

| Component class | Preferred data attributes | Props | States |
|-----------------|---------------------------|-------|--------|
| `astryx-selector` | `data-size`, `data-status` | size, status | — |
| `astryx-selector-option` | — | — | — |

-e 
---

# Slider

A draggable control for selecting a numeric value or range within defined bounds. Supports single value and range selection, tick marks, custom value formatting, and vertical orientation. Use it when users need to explore a continuous range, such as volume, price, or percentage.

## Example

```tsx
<Slider
  label="Volume"
  value={50}
  isDisabled
  disabledMessage="Volume is locked while sharing your screen"
/>

<Slider label="Volume" value={50} onChange={setValue} />
<Slider label="Price range" value={[20, 80]} onChange={setRange} />
```

## Best Practices

- **Do:** Always provide a label, even if visually hidden, so the slider is accessible to screen readers.
- **Do:** Format values with meaningful units like "$50" or "75%" instead of raw numbers.
- **Don't:** Use for precise numeric entry; pair with a text input or use NumberInput instead.
- **Don't:** Set a step size so large that only a few positions are possible; use SegmentedControl or radio buttons instead.
- **Don't:** Wrap a disabled slider in Tooltip to explain why it is disabled; disabled controls swallow the hover events the wrapper needs. Use the disabledMessage prop instead.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | `string` | — | Label text (always rendered for accessibility). **(required)** |
| `value` | `number | [number, number]` | — | Current value: a `number` for single thumb mode or `[number, number]` for range mode. **(required)** |
| `onChange` | `(value: number) => void | (value: [number, number]) => void` | — | Callback fired on value change during drag. |
| `onChangeEnd` | `(value: number) => void | (value: [number, number]) => void` | — | Callback fired when drag ends. |
| `min` | `number` | `0` | Minimum value. |
| `max` | `number` | `100` | Maximum value. |
| `step` | `number` | `1` | Step increment. |
| `orientation` | `'horizontal' | 'vertical'` | `'horizontal'` | Orientation of the slider. |
| `formatValue` | `(value: number) => string` | — | Custom value formatting function used for display and `aria-valuetext`. |
| `valueDisplay` | `'tooltip' | 'text' | 'none'` | `'tooltip'` | How the current value is displayed. |
| `marks` | `Array<{ value: number; label?: string }>` | — | Tick marks at specified positions with optional labels. |
| `minStepsBetweenThumbs` | `number` | `0` | Minimum number of steps between thumbs in range mode; prevents thumbs from overlapping. |
| `isDisabled` | `boolean` | `false` | Whether the slider is disabled. |
| `htmlName` | `string` | — | The HTML name attribute for form submissions. Renders hidden inputs carrying the current value (two entries in range mode). |
| `disabledMessage` | `string` | — | Explains why the slider is disabled. With isDisabled, shows a tooltip on hover/keyboard focus and keeps the thumb focusable via aria-disabled (value changes stay blocked). Use this instead of wrapping a disabled Slider in Tooltip. Disabled controls swallow the hover events an external Tooltip needs. |
| `isOptional` | `boolean` | `false` | Whether the field is optional. |
| `isRequired` | `boolean` | `false` | Whether the field is required. |
| `isLabelHidden` | `boolean` | `false` | Whether to visually hide the label. |
| `description` | `string` | — | Description text rendered below the label. |
| `status` | `InputStatus` | — | Status indicator object (`{ type, message }`) for validation feedback. |
| `labelTooltip` | `string` | — | Tooltip text for an info icon displayed next to the label. |
| `xstyle` | `StyleXStyles` | — | StyleX styles for layout customization (margins, positioning, sizing). Must be a stylex.create() value, not an inline style object like style={{}}. |

## Theming

| Component class | Preferred data attributes | Props | States |
|-----------------|---------------------------|-------|--------|
| `astryx-slider` | `data-orientation`, `data-disabled` | orientation | disabled |
| `astryx-slider-track` | `data-orientation` | orientation | — |
| `astryx-slider-thumb` | `data-orientation`, `data-disabled` | orientation | disabled |

-e 
---

# Switch

A toggle control for on/off states that take effect immediately. Supports labels, descriptions, loading states, and validation. Use it for settings or preferences that apply instantly. For changes requiring a form submission, use a checkbox instead.

## Example

```tsx
<Switch
  label="Enable notifications"
  value={enabled}
  isDisabled
  disabledMessage="Notifications are turned off org-wide"
/>

<Switch
  label="Enable notifications"
  value={enabled}
  onChange={setEnabled}
/>
<Switch
  label="Dark mode"
  description="Switch to a darker color scheme"
  value={darkMode}
  onChange={setDarkMode}
/>
```

## Best Practices

- **Do:** Use for settings that apply immediately; the toggle should take effect without a separate save action.
- **Do:** Pair with a clear, concise label that describes the setting being controlled.
- **Don't:** Use for options that require a form submission to take effect; use a checkbox instead.
- **Don't:** Use a switch for multi-state values; it's strictly on/off.
- **Don't:** Wrap a disabled switch in Tooltip to explain why it is disabled; disabled controls swallow the hover events the wrapper needs. Use the disabledMessage prop instead.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `ref` | `React.Ref<HTMLInputElement>` | — | Ref forwarded to the underlying <input> element. |
| `label` | `string` | — | Label text for the switch (always rendered for accessibility). **(required)** |
| `value` | `boolean` | — | Whether the switch is on or off. **(required)** |
| `onChange` | `(checked: boolean, e: ChangeEvent<HTMLInputElement>) => void` | — | Callback fired when the switch state changes. |
| `changeAction` | `(checked: boolean, e: ChangeEvent<HTMLInputElement>) => void | Promise<void>` | — | Async action fired after onChange. Triggers optimistic UI and shows a loading spinner until the promise resolves. |
| `isLoading` | `boolean` | `false` | Whether the switch is in a loading state, showing a spinner inside the thumb. |
| `isLabelHidden` | `boolean` | `false` | Visually hides the label while keeping it accessible to screen readers. |
| `description` | `string` | — | Description text displayed below the label. |
| `isDisabled` | `boolean` | `false` | Whether the switch is disabled. |
| `htmlName` | `string` | — | The HTML name attribute for the underlying checkbox input, useful for form submissions (submits "on" when the switch is on). |
| `disabledMessage` | `string` | — | Explains why the switch is disabled. With isDisabled, shows a tooltip on hover/keyboard focus and keeps the switch focusable via aria-disabled (toggling stays blocked). Use this instead of wrapping a disabled Switch in Tooltip. Disabled controls swallow the hover events an external Tooltip needs. |
| `isOptional` | `boolean` | `false` | Whether the field is optional. Mutually exclusive with isRequired. |
| `isRequired` | `boolean` | `false` | Whether the switch is required. Mutually exclusive with isOptional. |
| `status` | `InputStatus` | — | Status indicator with type and message. Displays a colored message box below the switch and sets aria-invalid when type is "error". |
| `onFocus` | `(e: FocusEvent<HTMLInputElement>) => void` | — | Callback fired when the switch receives focus. |
| `onBlur` | `(e: FocusEvent<HTMLInputElement>) => void` | — | Callback fired when the switch loses focus. |
| `labelIcon` | `IconType` | — | Icon displayed before the label text. See `npx astryx docs icons` for valid semantic names. |
| `labelTooltip` | `string` | — | Tooltip text shown in an info icon at the end of the label. |
| `labelPosition` | `'start' | 'end'` | `'end'` | Which side of the switch the label appears on. "start" places the label before the switch. |
| `labelSpacing` | `'default' | 'spread'` | `'default'` | Spacing behavior between label and switch. "spread" pushes them to opposite ends of the container (full width). |

## Theming

| Component class | Preferred data attributes | Props | States |
|-----------------|---------------------------|-------|--------|
| `astryx-switch` | `data-checked`, `data-disabled` | — | checked, disabled |
| `astryx-switch-thumb` | `data-checked` | — | checked |
| `astryx-switch-field` | `data-label-position`, `data-label-spacing` | labelPosition, labelSpacing | — |

-e 
---

# TextArea

TextArea is a multi-line text input for collecting longer-form content like comments, descriptions, or messages. Use it when the expected input spans multiple lines. For shorter, single-line values, use TextInput.

## Example

```tsx
<TextArea
  label="Notes"
  value={notes}
  isDisabled
  disabledMessage="Notes are locked after submission"
/>

<TextArea label="Description" value={description} onChange={setDescription} />
<TextArea label="Notes" rows={5} value={notes} onChange={setNotes} />
```

## Best Practices

- **Do:** Provide a visible label so users know what to enter. If the label must be hidden, set isLabelHidden with a descriptive label for screen readers.
- **Do:** Set maxLength with a character counter when there is a defined limit; it helps users stay within bounds before they submit.
- **Do:** Use the status prop to surface validation feedback inline: show success when input is valid, warning for soft limits, and error for hard failures.
- **Do:** Add a description or placeholder to clarify expected content, like "Describe the issue in detail," but never rely on placeholder alone as the only label.
- **Don't:** Avoid using TextArea for short, single-line values like names or emails; use TextInput instead.
- **Don't:** Don't rely solely on placeholder text to communicate the purpose of the field; placeholders disappear on focus and are not accessible labels.
- **Don't:** Don't show a status message without also setting the status type; the colored border and icon are what draw the user's attention to the message.
- **Don't:** Don't wrap a disabled TextArea in Tooltip to explain why it's disabled; disabled controls swallow the hover events the wrapper needs. Use the disabledMessage prop instead.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `ref` | `React.Ref<HTMLTextAreaElement>` | — | Ref forwarded to the underlying <textarea> element. |
| `label` | `string` | — | Label text for the textarea. Always rendered for accessibility. **(required)** |
| `value` | `string` | — | Current value of the textarea. **(required)** |
| `onChange` | `(value: string, e: ChangeEvent<HTMLTextAreaElement>) => void` | — | Callback fired when the textarea value changes. |
| `changeAction` | `(value: string, e: ChangeEvent<HTMLTextAreaElement>) => void | Promise<void>` | — | Async action fired after onChange inside a React transition. Enables optimistic updates via useOptimistic. |
| `isLabelHidden` | `boolean` | `false` | Visually hides the label while keeping it accessible to screen readers. |
| `description` | `string` | — | Helper text displayed between the label and textarea. |
| `isOptional` | `boolean` | `false` | Displays an "Optional" indicator next to the label. Mutually exclusive with isRequired. |
| `isRequired` | `boolean` | `false` | Displays a "Required" indicator next to the label and sets aria-required. Mutually exclusive with isOptional. |
| `isDisabled` | `boolean` | `false` | Disables the textarea, preventing interaction. |
| `disabledMessage` | `string` | — | Explains why the textarea is disabled. With isDisabled, shows a tooltip on hover/keyboard focus and keeps the textarea focusable via aria-disabled (the field becomes read-only). Use this instead of wrapping a disabled TextArea in Tooltip. Disabled controls swallow the hover events an external Tooltip needs. |
| `isLoading` | `boolean` | `false` | Puts the textarea in a loading state, showing a spinner inside the input. |
| `placeholder` | `string` | — | Placeholder text shown when the textarea is empty. |
| `rows` | `number` | `3` | Number of visible text rows. |
| `maxLength` | `number` | — | Maximum number of characters allowed. When set, a character counter (current/max) is displayed below the textarea. Does not enforce the limit natively; the counter shows error styling when exceeded. |
| `status` | `{ type: 'warning' | 'error' | 'success'; message?: string }` | — | Status indicator that applies a colored border and icon. An optional message is displayed in a floating box below the textarea. |
| `labelTooltip` | `string` | — | Tooltip text displayed in an info icon at the end of the label. |
| `startIcon` | `IconType` | — | Icon component rendered inside the leading edge of the textarea wrapper. See `npx astryx docs icons` for valid semantic names. |
| `hasSpellCheck` | `boolean` | `true` | Enables or disables browser spell checking. |
| `hasAutoFocus` | `boolean` | `false` | Automatically focuses the textarea on mount. |
| `size` | `'sm' | 'md' | 'lg'` | `'md'` | Size of the textarea, affecting internal padding. Height is controlled by rows, not size. |
| `onPaste` | `(e: ClipboardEvent<HTMLTextAreaElement>) => void` | — | Callback fired when content is pasted into the textarea. |
| `htmlName` | `string` | — | HTML name attribute for the textarea element, useful for form submissions. |
| `onFocus` | `(e: FocusEvent<HTMLTextAreaElement>) => void` | — | Callback fired when the textarea receives focus. |
| `onBlur` | `(e: FocusEvent<HTMLTextAreaElement>) => void` | — | Callback fired when the textarea loses focus. |
| `xstyle` | `StyleXStyles` | — | StyleX styles for layout customization (margins, positioning, sizing). Must be a stylex.create() value, not an inline style object like style={{}}. |

## Theming

| Component class | Preferred data attributes | Props | States |
|-----------------|---------------------------|-------|--------|
| `astryx-textarea` | `data-size`, `data-status` | size, status | — |

-e 
---

# TextInput

TextInput collects short-form text like names, emails, or search queries. Use it for single-line values where the expected input is brief. Pair it with validation status to guide users through required or formatted fields.

## Example

```tsx
<TextInput
  label="Owner"
  value={owner}
  isDisabled
  disabledMessage="You need the Editor role to change this"
/>

<TextInput label="Name" value={name} onChange={setName} />
<TextInput label="Search" isLabelHidden value={query} onChange={setQuery} />
```

## Anatomy

| Element | Required | Description |
|---------|----------|-------------|
| Label | Yes | Text that identifies the field. Always rendered for accessibility even when visually hidden. |
| Description | No | Helper text between the label and the input that provides additional context or formatting hints. |
| Start icon | No | A leading icon inside the input that hints at the expected content, like a magnifying glass for search. |
| Placeholder | No | Hint text shown when the input is empty. Disappears on focus. |
| Clear button | No | A trailing × button that resets the value and returns focus to the input. |
| Spinner | No | Loading indicator that appears during async actions like server-side validation. |
| Status icon | No | A trailing icon (error, warning, or success) that communicates validation state. |

## Best Practices

- **Do:** Always provide a visible label so users know what the field is for. Only hide the label when surrounding context makes it obvious, like a search bar with a magnifying-glass icon.
- **Do:** Use validation status with a message to explain what went wrong: "Email must include @" is better than just turning the border red.
- **Do:** Size the input to match the expected content length so users can gauge how much to type: small for zip codes, medium for names, large for URLs.
- **Do:** Add a clear button for search and filter inputs so users can quickly reset without selecting all text.
- **Don't:** Don't use placeholder text as a replacement for a label; placeholders disappear on focus and are not reliably read by screen readers.
- **Don't:** Don't use TextInput for multi-line content like comments or descriptions; use TextArea instead.
- **Don't:** Don't mark every field as required; only flag mandatory fields so users are not overwhelmed by validation errors.
- **Don't:** Don't wrap a disabled TextInput in Tooltip to explain why it's disabled; disabled controls swallow the hover events the wrapper needs. Use the disabledMessage prop instead.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `type` | `'text' | 'password' | 'email'` | `'text'` | The HTML input type. |
| `label` | `string` | — | Label text for the input: always rendered for accessibility. **(required)** |
| `value` | `string` | — | Current value of the input. **(required)** |
| `onChange` | `(value: string, e: ChangeEvent<HTMLInputElement>) => void` | — | Callback fired when the input value changes. |
| `changeAction` | `(value: string, e: ChangeEvent<HTMLInputElement>) => void | Promise<void>` | — | Async action fired after onChange (if not prevented). Triggers optimistic update and shows a loading spinner while pending. |
| `size` | `'sm' | 'md' | 'lg'` | `'md'` | Size variant of the input. |
| `isLabelHidden` | `boolean` | `false` | Visually hides the label while keeping it accessible to screen readers. |
| `description` | `string` | — | Description text displayed between the label and input. |
| `isOptional` | `boolean` | `false` | Displays an "Optional" indicator next to the label. Mutually exclusive with isRequired. |
| `isRequired` | `boolean` | `false` | Displays a "Required" indicator next to the label and sets aria-required. Mutually exclusive with isOptional. |
| `isDisabled` | `boolean` | `false` | Disables the input, preventing interaction and dimming the element. |
| `disabledMessage` | `string` | — | Explains why the input is disabled. With isDisabled, shows a tooltip on hover/keyboard focus and keeps the input focusable via aria-disabled (the field becomes read-only). Use this instead of wrapping a disabled TextInput in Tooltip. Disabled controls swallow the hover events an external Tooltip needs. |
| `isLoading` | `boolean` | `false` | Puts the input in a loading state, showing a spinner and setting aria-busy. |
| `placeholder` | `string` | — | Placeholder text shown when the input is empty. |
| `labelTooltip` | `string` | — | Tooltip text displayed in an info icon at the end of the label. |
| `startIcon` | `IconType` | — | SVG icon component displayed at the start of the input. See `npx astryx docs icons` for valid semantic names. |
| `status` | `{type: 'error' | 'warning' | 'success', message?: string}` | — | Validation status: applies a colored border and status icon. If message is provided, displays a floating message below the input. Error type also sets aria-invalid. |
| `hasClear` | `boolean` | `false` | Shows a clear (×) button when the input has a value. Clicking it clears the value and returns focus to the input. |
| `hasAutoFocus` | `boolean` | `false` | Automatically focuses the input on mount. |
| `htmlName` | `string` | — | The HTML name attribute for the input, useful for form submissions. |

## Theming

| Component class | Preferred data attributes | Props | States |
|-----------------|---------------------------|-------|--------|
| `astryx-text-input` | `data-size`, `data-status` | size, status | — |

-e 
---

# TimeInput

TimeInput lets users enter a time of day and converts it to a standard format. It also allows users to adjust times using the arrow keys. Use it in forms, scheduling flows, or any interface where users need to select a specific time.

## Example

```tsx
<TimeInput
  label="Start time"
  value={time}
  onChange={setTime}
  isDisabled
  disabledMessage="You need the Editor role to change this"
/>

<TimeInput
  label="Start time"
  value={time}
  onChange={setTime}
  hourFormat="12h"
  hasClear
/>
```

## Anatomy

| Element | Required | Description |
|---------|----------|-------------|
| Clock icon | No | A leading clock icon that identifies the field as a time input. |
| Text input | Yes | The editable text field where users type or see the formatted time. |
| Clear button | No | A trailing button to reset the value, shown when hasClear is true and a value is set. |
| Status icon | No | A trailing icon indicating error, warning, or success state. |
| Spinner | No | Replaces trailing content during loading to show an async action is in progress. |

## Best Practices

- **Do:** Choose the hour format (12h or 24h) that matches your audience's locale: 12-hour with AM/PM for US-centric UIs, 24-hour for international or technical contexts.
- **Do:** Set min and max constraints when the context has a valid range, like business hours or event windows, so users cannot submit an out-of-bounds time.
- **Do:** Provide a description or placeholder that hints at the expected format or purpose, like "Business hours: 9 AM – 5 PM".
- **Do:** Use the status prop to surface validation errors inline: show a message like "Time must be during business hours" so users know exactly what to fix.
- **Do:** Enable hasClear when the field is optional, so users can remove a previously selected time.
- **Do:** Place TimeInput inside InputGroup when the time needs a single-line prefix or suffix addon, like a start/end label or timezone marker.
- **Don't:** Don't use TimeInput for combined date-and-time selection; pair it with a separate DateInput instead.
- **Don't:** Don't hide the label; even when space is tight, keep the label visible or provide a description so the purpose is clear.
- **Don't:** Wrap a disabled TimeInput in Tooltip to explain why it is disabled; disabled triggers swallow the hover events the wrapper needs. Use the disabledMessage prop instead.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | `string` | — | Label text for the input (required for accessibility). **(required)** |
| `isLabelHidden` | `boolean` | `false` | Visually hides the label while keeping it accessible to screen readers. |
| `description` | `string` | — | Description text displayed between the label and input. |
| `isOptional` | `boolean` | `false` | Shows an "(optional)" indicator next to the label. Mutually exclusive with isRequired. |
| `isRequired` | `boolean` | `false` | Marks the field as required and sets aria-required. Mutually exclusive with isOptional. |
| `isDisabled` | `boolean` | `false` | Disables the input and suppresses interactions. |
| `disabledMessage` | `string` | — | Explains why the input is disabled. With isDisabled, shows a tooltip on hover/keyboard focus and keeps the field focusable via aria-disabled (activation stays blocked). Use this instead of wrapping a disabled TimeInput in Tooltip. Disabled controls swallow the hover events an external Tooltip needs. |
| `value` | `ISOTimeString` | — | Controlled time value in ISO format (HH:MM or HH:MM:SS). |
| `onChange` | `(value: ISOTimeString | undefined) => void` | — | Callback fired when the time changes. Receives undefined when the input is cleared. |
| `changeAction` | `(value: ISOTimeString | undefined) => void | Promise<void>` | — | Async action fired after onChange. Wrapped in a React transition to provide optimistic UI; triggers the loading spinner while pending. |
| `isLoading` | `boolean` | `false` | Puts the input into a loading state, displaying a spinner. |
| `min` | `ISOTimeString` | — | Minimum selectable time in ISO format. Values outside the range are rejected. |
| `max` | `ISOTimeString` | — | Maximum selectable time in ISO format. Values outside the range are rejected. |
| `hasSeconds` | `boolean` | `false` | Includes seconds in the time display and parsing. |
| `hasClear` | `boolean` | `false` | Shows a clear button when a value is set and the input is not disabled. |
| `hourFormat` | `'12h' | '24h'` | `'12h'` | Controls the display format. '12h' shows AM/PM (e.g. '2:30 PM'); '24h' uses 24-hour notation (e.g. '14:30'). |
| `increment` | `number` | `1` | Number of minutes to add or subtract when the user presses the up or down arrow key. |
| `placeholder` | `string` | `'Select a time'` | Placeholder text shown when no time is selected. When the input is focused and empty, a format hint overrides this text. |
| `size` | `'sm' | 'md' | 'lg'` | `'md'` | Controls the height of the input element. |
| `status` | `InputStatus` | — | Status indicator that colors the border and displays an icon. When a message is provided it is rendered below the input. |
| `labelTooltip` | `string` | — | Tooltip text rendered as an info icon at the end of the label row. |
| `xstyle` | `StyleXStyles` | — | StyleX styles for layout customization (margins, positioning, sizing). Must be a stylex.create() value, not an inline style object like style={{}}. |

## Theming

| Component class | Preferred data attributes | Props | States |
|-----------------|---------------------------|-------|--------|
| `astryx-time-input` | `data-size`, `data-status` | size, status | — |

-e 
---

# Button

Button triggers an action when clicked. Use it for form submissions, confirmations, navigation, or any interaction that needs a clear call to action.

## Example

```tsx
<Button label="Click me" />
<Button label="Primary action" variant="primary" />
<Button label="Delete" variant="destructive" />
<Button label="Settings" icon={<GearIcon />} variant="ghost" isIconOnly />
<Button label="Pick emoji" icon={<span>🚀</span>} variant="ghost" size="sm" isIconOnly />
<Button label="Edit" icon={<PencilIcon />} />
<Button label="Messages" endContent={<Badge label={3} />} />
<Button label="Edit" icon={<PencilIcon />} endContent={<Badge label="New" />} />
<Button label="Visit site" href="https://example.com" variant="primary" />
<Button label="Open in new tab" href="https://example.com" target="_blank" rel="noopener noreferrer" />
```

## Anatomy

| Element | Required | Description |
|---------|----------|-------------|
| Icon | No | A leading icon that reinforces the label, like a trash icon on a Delete button. |
| Label | Yes | The visible text describing the action. Also used as the accessible name. |
| End content | No | A trailing badge or icon after the label, like a notification count or dropdown arrow. |
| Spinner | No | Replaces the icon during loading to show the action is in progress. |

## Best Practices

- **Do:** Reserve primary for the single most important action in the view. Use secondary or ghost for everything else based on emphasis.
- **Do:** Write labels that describe the action ("Save changes", "Delete account", "Send invite"), not vague labels like "OK" or "Click here".
- **Do:** Show a loading state for actions that take time, like saving or submitting, so the user knows it is working.
- **Do:** Always provide a label for icon-only buttons so screen readers can announce what the button does. Add a tooltip for sighted users.
- **Do:** For a dedicated icon-only button, use IconButton from '@astryxdesign/core/IconButton'. It is a separate component, not exported from '@astryxdesign/core/Button'.
- **Don't:** Place more than one primary button in the same view; this dilutes the visual hierarchy.
- **Don't:** Use the destructive variant without a confirmation step for irreversible actions like deleting data.
- **Don't:** Use a button for navigation. If it only takes the user to another page, use a link instead. Buttons are for actions like saving, deleting, or submitting.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | `string` | — | Accessible label. Rendered as visible text by default; used as aria-label when isIconOnly is true. **(required)** |
| `variant` | `'primary' | 'secondary' | 'ghost' | 'destructive'` | `'secondary'` | Visual style variant. |
| `size` | `'sm' | 'md' | 'lg'` | `'md'` | Size variant. |
| `type` | `'button' | 'submit' | 'reset'` | `'button'` | HTML button type attribute. |
| `name` | `string` | — | HTML name attribute for form submission. |
| `value` | `string | number | readonly string[]` | — | HTML value attribute for form submission. |
| `form` | `string` | — | Associates the button with a form element by ID. |
| `isLoading` | `boolean` | `false` | Shows a loading spinner and disables interaction. Announces "Loading" via a live region. |
| `isInterruptible` | `boolean` | `false` | Keep the button clickable while a clickAction is pending: the spinner and aria-busy still show, but the button is not disabled and the action is not deduped, so a re-click lands and interrupts the in-flight action with a fresh one. |
| `isDisabled` | `boolean` | `false` | Disables the button. When a tooltip is present, uses aria-disabled instead of native disabled so the button stays focusable. |
| `icon` | `ReactNode` | — | Icon element rendered before the label text. |
| `isIconOnly` | `boolean` | `false` | When true, renders as a square icon-only button with label as aria-label. Requires icon. Tip: for a dedicated icon-only button component, use IconButton from '@astryxdesign/core/IconButton' instead. |
| `children` | `ReactNode` | — | Optional override for visible text. When provided, displayed instead of label, but label is still required (it provides the accessible name). For most cases, just use label alone: <Button label="Save" />. |
| `endContent` | `ReactElement<IconProps> | ReactElement<BadgeProps>` | — | Trailing icon or badge rendered after the label. Ignored when isIconOnly is true. Color is inherited from the button variant. |
| `tooltip` | `string` | — | Tooltip text shown on hover. |
| `onClick` | `(e: MouseEvent) => void` | — | Standard click handler (passed through from ButtonHTMLAttributes). |
| `clickAction` | `(e: MouseEvent) => void | Promise<void>` | — | Async click handler. Shows loading state while the returned promise is pending. |

## Theming

| Component class | Preferred data attributes | Props | States |
|-----------------|---------------------------|-------|--------|
| `astryx-button` | `data-size`, `data-variant` | size, variant | — |

| CSS Variable | Default | Description |
|-------------|---------|-------------|
| `--button-press-scale` | `scale(0.98)` | Active press transform |
| `--button-disabled-opacity` | `0.5` | Opacity when disabled |
| `--button-focus-offset` | `3px` | Focus ring outline offset |
| `--button-icon-only-aspect` | `1 / 1` | Aspect ratio for icon-only buttons |

-e 
---

# DropdownMenu

A dropdown menu that displays a list of actionable items in a popup triggered by a button. Use to present action options as a next step in a process, or to offer contextual actions without cluttering the interface.

## Example

```tsx
<DropdownMenu
  button={{ label: 'Actions' }}
  items={[
    { label: 'Edit', onClick: () => handleEdit() },
    { label: 'Delete', onClick: () => handleDelete() },
  ]}
/>

<DropdownMenu button={{ label: 'Actions' }}>
  <DropdownMenuItem icon={PencilIcon} label="Edit" onClick={handleEdit} />
  <DropdownMenuItem label="Delete" endContent={<Badge label="⌘D" />} onClick={handleDelete} />
</DropdownMenu>
```

## Best Practices

- **Do:** Keep menu items concise and action-oriented so users can scan options quickly.
- **Do:** Use sections and dividers to group related actions when the menu has many items.
- **Don't:** Use a DropdownMenu for navigation; use a navigation component instead.
- **Don't:** Place more than 10–12 items in a single menu without grouping them into sections.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `button` | `DropdownMenuButtonProps` | `{ label: 'Menu' }` | Props for the trigger button (Button props except onClick). |
| `items` | `DropdownMenuOption[]` | — | Array of menu entries. Each entry is one of: an action item `{label, onClick?, icon?, isDisabled?}`, a divider `{type: "divider"}`, or a section `{type: "section", title?, items: [...action items]}`. **(required)** |
| `isMenuOpen` | `boolean` | — | Controlled open state for the menu. |
| `onOpenChange` | `(isOpen: boolean) => void` | — | Callback fired when the open state changes. |
| `menuWidth` | `number | string` | — | Custom menu width; defaults to matching the trigger button width. |
| `onClick` | `() => void` | — | Callback fired when the trigger button is clicked. |
| `hasChevron` | `boolean` | `true` | Whether to show a chevron icon on the trigger button. Set to false for icon-only triggers. |
| `children` | `(item: DropdownMenuItemData) => ReactNode` | — | Custom render function for each item in the list. |

## Components

### DropdownMenuItem

undefined



## Theming

| Component class | Preferred data attributes | Props | States |
|-----------------|---------------------------|-------|--------|
| `astryx-dropdown-menu` | — | — | — |
| `astryx-dropdown-menu-item` | — | — | — |

-e 
---

# Link

A styled anchor for inline and standalone text navigation. Supports external links, underline variants, tooltips, and custom link components for router integration. Use it for navigating between pages or to external URLs.

## Example

```tsx
<Link href="/docs">Documentation</Link>
<Link href="https://github.com" isExternalLink>GitHub</Link>
<Link href="/settings" color="secondary">Settings</Link>
<Link href="/privacy" hasUnderline>Privacy Policy</Link>
<Link label="Close dialog" href="/home"><Icon icon="x" /></Link>

// Inline link inside text — inherits the surrounding type/size:
<Text type="large">
  Read our <Link href="/terms" type="inherit">terms</Link> first.
</Text>

import Link from 'next/link';
<LinkProvider component={Link}>
  <App />
</LinkProvider>

import Link from 'next/link';
<LinkProvider component={Link}>

const nodes = useLinkify('Visit https://example.com or email hi@example.com');
return <p>{nodes}</p>;
```

## Anatomy

| Element | Required | Description |
|---------|----------|-------------|
| Label | Yes | The visible text of the link. |
| Right icon | No | Icon placed after the label to indicate an action affordance. |
| Left icon | No | Icon placed before the label to represent meaning. |

## Best Practices

- **Do:** Write descriptive, concise link text that clearly communicates the destination.
- **Do:** Set `isStandalone` when the link appears outside of inline text, so it receives proper base font sizing.
- **Do:** Only set `label` when the link content is not descriptive text (e.g. an icon-only link). For text links, the visible text is already the accessible name; adding `label` overrides it for screen readers, which is harmful.
- **Don't:** Use Link for actions that do not navigate; use a Button instead.
- **Don't:** Use generic text like "click here" or "read more"; describe the destination.
- **Don't:** Set `label` on text links; `aria-label` prevents assistive technology from reading the actual link content.

## Components

### Link

Styled anchor link with variants, external link support, and polymorphic rendering.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `as` | `LinkComponentType` | — | Custom component to render instead of <a> |
| `label` | `string` | — | Accessible label (aria-label). Only use when children are not self-descriptive (e.g. icon-only links). Omit for text links; the link text is the accessible name. |
| `href` | `string` | — | Link destination URL |
| `hasUnderline` | `boolean` | `false` | Always show underline |
| `isDisabled` | `boolean` | `false` | Disables the link |
| `isExternalLink` | `boolean` | `false` | Opens in new tab with external icon and safe rel tokens |
| `newTabLabel` | `string` | `'(opens in new tab)'` | Screen-reader text announcing that an external link opens in a new tab. Override for localization. |
| `target` | `string` | — | Where to open linked document. target="_blank" automatically adds noopener noreferrer. |
| `rel` | `string` | — | Link relationship tokens. noopener noreferrer are merged automatically for target="_blank". |
| `onClick` | `MouseEventHandler` | — | Click event handler |
| `tooltip` | `string` | — | Tooltip text displayed on hover |
| `isStandalone` | `boolean` | `false` | Applies base font sizing |
| `children` | `ReactNode` | — | Link content **(required)** |

### LinkProvider

Provider that sets the default link component for all Astryx link-rendering components in the subtree. Wrap your app root to replace native <a> elements with your framework router (Next.js Link, React Router Link, etc.).

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `component` | `LinkComponentType` | — | Component to use for all link elements **(required)** |
| `children` | `ReactNode` | — | Subtree **(required)** |

## Theming

| Component class | Preferred data attributes | Props | States |
|-----------------|---------------------------|-------|--------|
| `astryx-link` | `data-color` | color | — |

-e 
---

# TabList

TabList provides tab-style navigation for organizing content into categorized sections. Use it to let users switch between related views without leaving the page, with overflow items handled by a built-in "more" menu.

## Example

```tsx
<TabList value={tab} onChange={setTab}>
  <Tab value="general" label="General" />
  <Tab value="advanced" label="Advanced" />
</TabList>

<TabList value={activeTab} onChange={setActiveTab}>
  <Tab value="home" label="Home" />
  <Tab value="settings" label="Settings" />
  <TabMenu label="More">
    <Tab value="analytics" label="Analytics" />
    <Tab value="reports" label="Reports" />
  </TabMenu>
</TabList>

<TabList value={tab} onChange={setTab}>
  <Tab value="overview" label="Overview" />
  <TabMenu label="More" options={[
    { value: "settings", label: "Settings" },
    { value: "history", label: "History" },
  ]} />
</TabList>
```

## Anatomy

| Element | Required | Description |
|---------|----------|-------------|
| Left Content | No | Most important area; hugs content width. |
| Center-Fill Content | No | Stretches to fill available space. |
| Right Content | No | Hugs content width. |

## Best Practices

- **Do:** Keep tab labels short and descriptive so users can quickly scan available sections.
- **Do:** Use TabMenu to group overflow items when horizontal space is limited rather than scrolling tabs off-screen.
- **Do:** When using hasDivider with action buttons alongside tabs, use a smaller button size (sm) so the actions don't overpower the tab row.
- **Don't:** Use tabs for sequential steps or workflows; use a stepper or wizard pattern instead.
- **Don't:** Place more than 6–8 visible tabs before the overflow menu; prioritize the most important categories.
- **Don't:** Confuse TabList with SegmentedControl or ToggleButton. TabList is for navigation between views. SegmentedControl and ToggleButton are input controls: SegmentedControl always has exactly one selected option, while ToggleButton can be toggled on or off.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `string` | — | The currently selected tab value. **(required)** |
| `onChange` | `(value: string) => void` | — | Callback fired when a tab is selected. **(required)** |
| `size` | `'sm' | 'md' | 'lg'` | `'md'` | Size variant applied to all child tabs. |
| `layout` | `'hug' | 'fill'` | `'hug'` | Layout mode for tab sizing. 'hug': each tab hugs its content width. 'fill': tabs stretch equally to fill the container width. |
| `hasDivider` | `boolean` | `false` | Whether to show a bottom border divider under the tab list. |
| `orientation` | `'horizontal' | 'vertical'` | `'horizontal'` | Orientation of the tab strip, controlling which arrow keys move focus between tabs and the reported aria-orientation. 'horizontal': ArrowLeft/ArrowRight. 'vertical': ArrowUp/ArrowDown. Both axes' arrows are accepted regardless. |
| `children` | `ReactNode` | — | Tab and TabMenu items to render inside the nav. **(required)** |
| `xstyle` | `StyleXStyles` | — | StyleX styles for layout customization (margins, positioning, sizing). Must be a stylex.create() value: not an inline style object like style={{}}. |

## Components

### Tab

undefined



### TabMenu

undefined



## Theming

| Component class | Preferred data attributes | Props | States |
|-----------------|---------------------------|-------|--------|
| `astryx-tab-list` | `data-size` | size | — |
| `astryx-tab` | `data-selected` | — | selected |
| `astryx-tab-indicator` | `data-selected` | — | selected |
| `astryx-tab-menu` | — | — | — |
| `astryx-tab-menu-dropdown` | — | — | — |
| `astryx-tab-menu-item` | — | — | — |

-e 
---

# TopNav

TopNav is a horizontal navigation bar for product-level navigation in application headers. Use TopNav for 5 or fewer always-visible navigation items, or minimal navigation paired with search and controls. For complex navigation hierarchies, use a sidebar; to filter content, use tabs or filter buttons instead.

## Example

```tsx
<TopNav
  label="Main navigation"
  heading={<TopNavHeading heading="My App" />}
  startContent={<TopNavItem label="Home" href="/" isSelected />}
  endContent={<Button label="Search" variant="ghost" />}
/>

<TopNavHeading logo={<NavIcon icon={<HomeIcon />} />} heading="My App" headingHref="/" />
<TopNavHeading
  logo={<NavIcon icon={<SuiteIcon />} />}
  superheading="Suite Name"
  superheadingHref="/suite"
  heading="Product Name"
  headingHref="/product"
  menu={<ProductSwitcher />}
/>

<TopNav
  startContent={
    <>
      <TopNavItem label="Home" href="/" isSelected />
      <TopNavItem label="Products" href="/products" />
      <TopNavItem label="Settings" href="/settings" icon={<GearIcon />} isIconOnly />
    </>
  }
/>

<TopNav
  startContent={
    <TopNavMegaMenu
      label="Products"
      items={
        <>
          <TopNavMegaMenuItem
            title="Analytics"
            description="Track behavior"
            icon={<ChartIcon />}
            href="/analytics"
          />
          <TopNavMegaMenuItem
            title="Messaging"
            description="Real-time comms"
            icon={<ChatIcon />}
            href="/messaging"
          />
        </>
      }
      featured={
        <>
          <strong>New: AI Features</strong>
          <p>Explore our latest AI-powered tools.</p>
        </>
      }
    />
  }
/>

<TopNavMegaMenu
  label="Products"
  items={...}
  featured={
    <TopNavMegaMenuFeaturedCard
      title="What's new in v4.0"
      description="AI-powered analytics and real-time collaboration."
      image="https://example.com/promo.jpg"
      imageAlt="Team collaboration"
      linkLabel="Read the announcement"
      linkHref="/blog/v4"
    />
  }
/>

<TopNavMegaMenu
  label="Products"
  items={
    <>
      <TopNavMegaMenuItem
        title="Analytics"
        description="Track and analyze user behavior"
        icon={<ChartIcon />}
        href="/analytics"
      />
      <TopNavMegaMenuItem title="Reports" href="/reports" />
    </>
  }
/>

<TopNav
  startContent={
    <>
      <TopNavItem label="Home" href="/" isSelected />
      <TopNavMenu
        label="Products"
        items={[
          {
            title: 'Analytics',
            description: 'Track and analyze user behavior',
            icon: <ChartBarIcon />,
            href: '/products/analytics',
          },
          {
            title: 'Messaging',
            description: 'Real-time communication tools',
            icon: <ChatBubbleIcon />,
            href: '/products/messaging',
          },
        ]}
      />
    </>
  }
/>
```

## Anatomy

| Element | Required | Description |
|---------|----------|-------------|
| Product icon and name | Yes | Identifies the product in the navigation bar. |
| Navigation items | Yes | Primary links for product-level destinations. |
| More menu | No | Overflow menu for additional navigation items. |
| Flex area | No | Flexible region for search, primary action buttons, or other controls. |

## Best Practices

- **Do:** Include a product logo and name in the heading slot to clearly identify the application.
- **Do:** Limit primary navigation items to 5 or fewer for quick scanning and minimal cognitive load.
- **Don't:** Avoid using TopNav to filter page content; use Tabs or filter controls instead.
- **Don't:** Avoid deeply nested navigation hierarchies; keep menus to one level of depth.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `heading` | `ReactNode` | — | Heading slot content (logo, brand): positioned at the left edge of the nav bar. |
| `startContent` | `ReactNode` | — | Start content slot for navigation items or breadcrumbs: positioned after the heading, left-aligned. |
| `children` | `ReactNode` | — | Alias for startContent. Prefer startContent when composing with heading, centerContent, or endContent; children keeps the common React nav-item pattern from silently dropping items. |
| `centerContent` | `ReactNode` | — | Center content slot (tabs, search bar, primary navigation): when provided, switches the layout to a three-column CSS grid for true horizontal centering. |
| `endContent` | `ReactNode` | — | End content slot for search, icons, or user profile: positioned at the right edge. |
| `label` | `string` | — | Accessible label for the navigation landmark, applied as aria-label on the <nav> element. |
| `xstyle` | `StyleXStyles` | — | StyleX styles for layout customization (margins, positioning, sizing). Must be a stylex.create() value: not an inline style object like style={{}}. |

## Components

### TopNavHeading

undefined



### TopNavItem

undefined



### TopNavMenu

undefined



### TopNavMegaMenu

undefined



### TopNavMegaMenuItem

undefined



### TopNavMegaMenuFeaturedCard

undefined



## Theming

| Component class | Preferred data attributes | Props | States |
|-----------------|---------------------------|-------|--------|
| `astryx-top-nav` | `data-mode` | — | mode |
| `astryx-top-nav-item` | `data-mode` | — | mode |
| `astryx-top-nav-heading` | — | — | — |
| `astryx-top-nav-mega-menu` | `data-mode` | — | mode |
| `astryx-top-nav-mega-menu-item` | `data-mode` | — | mode |
| `astryx-top-nav-mega-menu-featured-card` | — | — | — |
| `astryx-top-nav-menu` | — | — | — |

-e 
---

# Calendar

Calendar lets the user pick a date or date range from a month grid. Use it in booking flows, scheduling UIs, date filters, or anywhere the user needs to see surrounding dates for context.

## Example

```tsx
<Calendar value={selectedDate} onChange={setSelectedDate} />
```

## Anatomy

| Element | Required | Description |
|---------|----------|-------------|
| Month header | Yes | The month name and year with navigation arrows to move between months. |
| Day grid | Yes | A 7-column grid of days with column headers for the day names. |
| Selected day | No | The currently selected date, highlighted. In range mode, the start and end dates plus the days between them. |
| Today marker | No | A subtle indicator on the current date for orientation. |

## Best Practices

- **Do:** Set min and max dates to limit selection to a valid window, like only future dates for a booking or the current quarter for a report.
- **Do:** Use range mode when the user needs to pick a start and end date, like a trip or a time-off request.
- **Do:** Use dateConstraints to disable specific dates like weekends or holidays, and explain why they are unavailable.
- **Do:** Show two months side by side when the user frequently selects dates that span a month boundary.
- **Don't:** Use a calendar for dates far in the past or future like a birth date. A text input is faster for open-ended entry.
- **Don't:** Disable large blocks of dates without context. The user should understand why dates are unavailable.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `mode` | `'single' | 'range'` | `'single'` | Selection mode. |
| `value` | `ISODateString | DateRange` | — | Controlled selected value. |
| `defaultValue` | `ISODateString | DateRange` | — | Uncontrolled default value. |
| `onChange` | `Function` | — | Selection callback. |
| `numberOfMonths` | `1 | 2` | `1` | Number of months to display. |
| `min` | `ISODateString` | — | Minimum selectable date. |
| `max` | `ISODateString` | — | Maximum selectable date. |
| `dateConstraints` | `Array<(date: Date) => boolean>` | — | Custom constraint functions. |
| `focusDate` | `ISODateString` | — | Controlled visible month. |
| `onFocusDateChange` | `(focusDate: ISODateString) => void` | — | Navigation callback. |
| `handleRef` | `React.Ref<CalendarHandle>` | — | Imperative handle for calendar navigation, including navigateTo(). |
| `hasOutsideDays` | `boolean` | `true` | Show days from adjacent months. |
| `hasWeekNumbers` | `boolean` | `false` | Show ISO week numbers. |
| `hasVariableRowCount` | `boolean` | `false` | Variable vs fixed 6-row grid. |
| `weekStartsOn` | `0 | 1 | 2 | 3 | 4 | 5 | 6 | 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat'` | `0` | First day of week. Accepts a number (0=Sunday) or a three-letter day name (e.g. "mon"). |

## Theming

| Component class | Preferred data attributes | Props | States |
|-----------------|---------------------------|-------|--------|
| `astryx-calendar` | `data-mode` | mode | — |
| `astryx-calendar-day` | `data-selected`, `data-today`, `data-disabled`, `data-in-range` | — | selected, today, disabled, in-range |

-e 
---

# Dialog

Dialog displays a modal overlay that blocks interaction with the page until the user responds. Use it for delete confirmations, edit forms, terms acceptance, or any decision that should not be skipped.

For cases where you want to show a dialog without managing open state, use the `useImperativeDialog` hook: call `dialog.show(content)` and render `dialog.element` in your tree.

## Example

```tsx
const [isOpen, setIsOpen] = useState(false);
<Dialog isOpen={isOpen} onOpenChange={open => setIsOpen(open)}>
  <Layout
    header={<DialogHeader title="Title" onOpenChange={open => setIsOpen(open)} />}
    content={<LayoutContent>Content</LayoutContent>}
    footer={<LayoutFooter hasDivider>Actions</LayoutFooter>}
  />
</Dialog>

<Dialog isOpen={isOpen} onOpenChange={open => setIsOpen(open)}>
  <Layout
    header={<DialogHeader title="Modal Title" onOpenChange={open => setIsOpen(open)} />}
    content={<LayoutContent>Content</LayoutContent>}
    footer={<LayoutFooter hasDivider>Actions</LayoutFooter>}
  />
</Dialog>

const dialog = useImperativeDialog();
<button onClick={() => dialog.show(<MyContent />)}>Open</button>
{dialog.element}

const dialog = useImperativeDialog();
onClick={() => dialog.show(
  <CodeBlock code={output} language="bash" />
)}
return <>{dialog.element}</>;
```

## Anatomy

| Element | Required | Description |
|---------|----------|-------------|
| Header | Yes | Title, optional subtitle, and close button. The title receives focus on open for accessibility. |
| Body | Yes | The main content area: text, forms, lists, or any layout. |
| Footer | No | Action buttons like Save/Cancel or Accept/Decline, aligned to the end. |
| Backdrop | Yes | Semi-transparent overlay behind the dialog that blocks page interaction. |

## Best Practices

- **Do:** Choose the right purpose: info for dismissable content, form to prevent accidental backdrop dismissal, required when the user must respond.
- **Do:** Include a clear title in the header so users immediately understand what the dialog is asking.
- **Do:** Use purpose="form" for dialogs with inputs so the user can't accidentally lose data by clicking the backdrop.
- **Do:** Keep dialogs focused on a single task; if the content grows beyond what fits, consider a full page instead.
- **Don't:** Use a dialog for simple messages that could be shown inline or as a toast notification.
- **Don't:** Nest dialogs inside other dialogs; restructure the flow into steps within a single dialog instead.
- **Don't:** Use the fullscreen variant for simple confirmations; it is meant for complex content like editors or long forms.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `isOpen` | `boolean` | — | Whether the dialog is open. **(required)** |
| `onOpenChange` | `(isOpen: boolean) => unknown` | — | Callback when dialog visibility changes. **(required)** |
| `children` | `ReactNode` | — | Dialog content. **(required)** |
| `width` | `number | string` | `400` | Width of the dialog in pixels or any CSS value. |
| `maxHeight` | `number | string` | `'75vh'` | Maximum height of the dialog. |
| `position` | `DialogPosition` | — | Static position for the dialog; centered by default when omitted. |
| `variant` | `'standard' | 'fullscreen'` | `'standard'` | Dialog variant: fullscreen expands to fill the entire viewport. |
| `purpose` | `'required' | 'form' | 'info'` | `'info'` | Controls dismissal behavior: required disables Escape and backdrop click; form disables backdrop click after interaction; info allows both. |
| `isInline` | `boolean` | `false` | Renders dialog content inline without the <dialog> element, backdrop, or modal behavior. For documentation previews and showcases only. |

## Components

### DialogHeader

undefined



### useImperativeDialog

undefined



## Theming

| Component class | Preferred data attributes | Props | States |
|-----------------|---------------------------|-------|--------|
| `astryx-dialog` | `data-variant` | variant | — |

-e 
---

# Layer

Layer utilities provide the app-level provider used by overlay systems. Use LayerProvider at the app root for toast/layer configuration; use higher-level Popover, HoverCard, or Tooltip APIs for most overlay UI.

## Example

```tsx
<LayerProvider toast={{ position: 'topEnd', maxVisible: 3 }}>
  <App />
</LayerProvider>

const layer = useLayer({ mode: 'context' });
<button ref={layer.ref}>Trigger</button>
{layer.render(<Content />, { placement: 'above', alignment: 'center' })}
```

## Best Practices

- **Do:** Use LayerProvider once near the app root when you need shared toast/layer configuration.
- **Do:** Build on higher-level components like Popover, HoverCard, and Tooltip for common overlay patterns.
- **Don't:** Add nested LayerProvider instances: nested providers are ignored and add unnecessary tree depth.

## Components

### LayerProvider

App-level provider for layer systems such as toast viewports and imperative modals. Nested providers pass through.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `ReactNode` | — | Application subtree that can use the shared layer context. **(required)** |
| `toast` | `LayerToastConfig` | — | Toast viewport configuration. Controls position, maxVisible, and inset for toasts shown through useToast. |

-e 
---

# AlertDialog

AlertDialog asks the user to confirm a destructive or irreversible action before it happens. Use it for things like deleting content, revoking access, or discarding unsaved changes.

For cases where you want to show an alert without managing open state, use the `useImperativeAlertDialog` hook: call `alert.show(options)` and render `alert.element` in your tree.

## Example

```tsx
<AlertDialog
  isOpen={isOpen}
  onOpenChange={setIsOpen}
  title="Delete item?"
  description="This action cannot be undone."
  actionLabel="Delete"
  onAction={async () => { await deleteItem(); setIsOpen(false); }}
/>

const alert = useImperativeAlertDialog();

const handleDelete = () => {
  alert.show({
    title: 'Delete item?',
    description: 'This action cannot be undone.',
    actionLabel: 'Delete',
    onAction: async () => { await deleteItem(); alert.hide(); },
  });
};

return (
  <>
    <button onClick={handleDelete}>Delete</button>
    {alert.element}
  </>
);
```

## Best Practices

- **Do:** Make the action button label specific: "Delete project" is better than "OK" or "Confirm".
- **Do:** Describe what will happen in the description so the user knows the consequences before confirming.
- **Don't:** Use AlertDialog for non-destructive actions; use a standard Dialog instead.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `isOpen` | `boolean` | — | Whether the dialog is open. **(required)** |
| `onOpenChange` | `(isOpen: boolean) => unknown` | — | Visibility change callback. **(required)** |
| `title` | `string` | — | Dialog title. Linked via aria-labelledby. **(required)** |
| `description` | `string` | — | Consequence description. Linked via aria-describedby. **(required)** |
| `actionLabel` | `string` | — | Action button label. **(required)** |
| `onAction` | `() => unknown` | — | Called when action button is clicked. Does NOT auto-close. **(required)** |
| `cancelLabel` | `string` | `'Cancel'` | Cancel button label. |
| `actionVariant` | `ButtonVariant` | `'destructive'` | Action button variant. |
| `isActionLoading` | `boolean` | — | Shows loading spinner on the action button. |
| `width` | `number | string` | `400` | Dialog width. |
| `isInline` | `boolean` | `false` | Renders alert dialog content inline without modal behavior. For documentation previews and showcases only. |

## Components

### useImperativeAlertDialog

undefined



-e 
---

# AppShell

The outermost layout for an application. Provides slots for top navigation, side navigation, banners, and main content. Use it as the root wrapper for every page. It handles responsive mobile navigation and skip-to-content automatically. Configure side nav collapse on SideNav with its collapsible prop.

## Example

```tsx
<AppShell topNav={...} sideNav={...} />
<AppShell mobileNav={{ isOpen, onOpenChange }} />
<AppShell mobileNav={{ hasToggle: false }}>
  <MobileNavToggle />
</AppShell>
<AppShell mobileNav={<MobileNav title="Menu">...</MobileNav>} />
<AppShell mobileNav={false} />

const SIDEBAR_ROUTES = ['/dashboard', '/settings'];
function Layout({ children, sidebar }) {
  const hasSidebar = SIDEBAR_ROUTES.some(r => pathname.startsWith(r));
  return (
    <AppShell
      sideNav={hasSidebar ? sidebar : undefined}
      mobileNav={hasSidebar ? { breakpoint: 'md' } : false}>
      {children}
    </AppShell>
  );
}

<AppShell
  topNav={<TopNav label="Navigation" heading={<TopNavHeading heading="My App" />} />}
  sideNav={<SideNav>{navSections}</SideNav>}
  mobileNav={
    <MobileNav isOpen={mobileOpen} onOpenChange={(open) => setMobileOpen(open)} title="My App">
      {navSections}
    </MobileNav>
  }>
  <Content />
</AppShell>
```

## Best Practices

- **Do:** Choose the right height: use "fill" for dashboards with internal scrolling and "auto" for pages that grow with content.
- **Do:** Set `contentPadding` based on content type: 4 for forms and settings, 0 for tables and dashboards.
- **Don't:** Nest one AppShell inside another; it's the outermost layout frame.
- **Don't:** Use for sub-page layouts; use Layout for content areas within AppShell.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `ReactNode` | — | Main content area, rendered inside a <main> element. |
| `contentPadding` | `0 | 0.5 | 1 | 1.5 | 2 | 3 | 4 | 5 | 6 | 8 | 10` | `0` | Padding for the main content area. Set based on the dominant content pattern: 4 (16px) for forms/settings/text, 0 for dashboards/maps/tables. Override individual sections with Section. |
| `topNav` | `ReactNode` | — | Top navigation slot, typically TopNav. |
| `sideNav` | `ReactNode` | — | Side navigation slot, typically SideNav. |
| `mobileNav` | `ReactNode` | — | Mobile navigation configuration. Accepts false (disable), config object (tune auto behavior), or ReactNode (full custom drawer). |
| `banner` | `ReactNode` | — | Banner slot for system-wide announcements, placed above the topNav. |
| `height` | `'fill' | 'auto'` | `'fill'` | Height behavior: 'fill' makes the shell fill the viewport (100dvh) with independent scroll containers; 'auto' lets the shell grow with content and uses sticky positioning for nav. |
| `variant` | `'wash' | 'surface' | 'section' | 'elevated'` | `'elevated'` | Navigation background style controlling how nav areas contrast with content. 'wash' uses wash background, 'surface' uses surface background, 'section' adds dividers between nav and content, 'elevated' uses wash nav with elevated surface content and border radius. |
| `xstyle` | `StyleXStyles` | — | StyleX styles for layout customization (margins, positioning, sizing). Must be a stylex.create() value, not an inline style object like style={{}}. |

## Theming

| Component class | Preferred data attributes | Props | States |
|-----------------|---------------------------|-------|--------|
| `astryx-app-shell` | `data-variant` | variant | — |
| `astryx-app-shell-header` | `data-variant` | variant | — |
| `astryx-app-shell-sidenav` | `data-variant` | variant | — |

-e 
---

# AvatarGroup

AvatarGroup displays multiple avatars in an overlapping row with an optional overflow indicator. Uses a compositional API: pass Avatar children directly so each avatar can carry its own props (status dots, click handlers, etc.).

## Example

```tsx
<AvatarGroup size="medium">
  {users.slice(0, 3).map(u => (
    <Avatar key={u.id} src={u.src} name={u.name} />
  ))}
  <AvatarGroupOverflow count={users.length - 3} />
</AvatarGroup>

<AvatarGroup size="medium">
  {users.slice(0, 3).map(u => (
    <Avatar key={u.id} src={u.src} name={u.name} />
  ))}
  <AvatarGroupOverflow count={users.length - 3} onClick={showAll} />
</AvatarGroup>
```

## Anatomy

| Element | Required | Description |
|---------|----------|-------------|
| Avatar children | Yes | Avatar elements that form the overlapping row. Each can have its own props. |
| Overflow indicator | No | A "+N" circle at the end showing hidden count, or a custom AvatarGroupOverflow slot. |

## Best Practices

- **Do:** Set max to limit visible avatars when the list is long; 3-5 is typical.
- **Do:** Use AvatarGroupOverflow for custom overflow content like a popover trigger or "add member" button.
- **Do:** Pass status dots, click handlers, or tooltips directly on each Avatar child.
- **Don't:** Don't nest AvatarGroups; use a single group with all avatars.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `ReactNode` | — | Avatar children, optionally followed by one AvatarGroupOverflow. Consumers handle slicing to the desired visible count. **(required)** |
| `size` | `AvatarSize` | `'small'` | Size applied to all avatars via context. |
| `ref` | `React.Ref<HTMLDivElement>` | — | Ref forwarded to the root element. |
| `xstyle` | `StyleXStyles` | — | StyleX styles for layout customization. |
| `data-testid` | `string` | — | Test selector for automated testing frameworks. |

## Components

### AvatarGroupOverflow

undefined



## Theming

| Component class | Preferred data attributes | Props | States |
|-----------------|---------------------------|-------|--------|
| `astryx-avatar-group` | `data-size` | size | — |

-e 
---

# Banner

Banner shows a persistent message at the top of a page or section. Use it for form errors, system updates, maintenance notices, or success confirmations that the user needs to see until they act on it.

## Example

```tsx
endContent={<Button label="Retry" variant="ghost" onClick={handleRetry} />}

<Banner status="info" title="New update available" />
<Banner
  status="error"
  title="Something went wrong"
  description="Please try again later."
  isDismissable
  onDismiss={() => logDismiss()}
/>
<Banner
  status="error"
  title="Multiple errors found"
  description="The following issues need to be resolved:"
  isDismissable>
  <ul>
    <li>Email address is invalid</li>
    <li>Password must be at least 8 characters</li>
  </ul>
</Banner>
<Banner
  status="warning"
  title="Configuration changes"
  defaultIsExpanded>
  <p>Details here...</p>
</Banner>
```

## Anatomy

| Element | Required | Description |
|---------|----------|-------------|
| Icon | Yes | Automatically set based on the status (info, warning, error, success). |
| Title | No | The main message. Required if no description is provided. |
| Description | No | Additional detail below the title. Required if no title is provided. |
| Action button | No | A button for the user to act on the message, like "Review" or "Retry". |
| Dismiss button | No | Lets the user close the banner. Enabled by setting isDismissable. |
| Collapsible content | No | Extra detail that expands below the banner header, like a list of errors. |

## Best Practices

- **Do:** Pick a status that matches the message: info for updates, warning for caution, error for problems, success for confirmations.
- **Do:** Use the card container inside page content and the section container for full-width messages that span the entire page.
- **Do:** Make info and success banners dismissable. Keep error banners visible until the user fixes the issue.
- **Do:** Keep titles short and scannable: "Payment failed" not "There was a problem processing your most recent payment."
- **Don't:** Use Banner for short-lived messages that disappear on their own; use Toast instead.
- **Don't:** Stack multiple banners with the same status; combine related messages into one banner.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `status` | `'info' | 'warning' | 'error' | 'success'` | — | Status type controlling icon and color. **(required)** |
| `title` | `ReactNode` | — | Title text or ReactNode displayed in the header. **(required)** |
| `description` | `ReactNode` | — | Description text rendered below the title in the header. |
| `icon` | `ReactNode` | — | Override the default status icon. |
| `isDismissable` | `boolean` | `false` | Whether the banner can be dismissed by the user. |
| `onDismiss` | `() => void` | — | Called when the dismiss button is clicked; banner hides itself regardless of whether this is provided. |
| `endContent` | `ReactNode` | — | Action content rendered in the header area, end-aligned. Typically a button or link. |
| `container` | `'card' | 'section'` | `'card'` | Container type: card has border-radius; section is full-width with no border-radius for page-level use. |
| `children` | `ReactNode` | — | Content rendered in the card-background area below the colored header. |
| `defaultIsExpanded` | `boolean` | `false` | Whether the content area (children) starts expanded. Only relevant when children are provided. |
| `xstyle` | `StyleXStyles` | — | StyleX styles for layout customization (margins, positioning, sizing). Must be a stylex.create() value, not an inline style object like style={{}}. |

## Theming

| Component class | Preferred data attributes | Props | States |
|-----------------|---------------------------|-------|--------|
| `astryx-banner` | `data-container`, `data-status` | container, status | — |
| `astryx-banner-icon` | `data-status` | status | — |

-e 
---

# Blockquote

A styled quotation block with an accent-colored left border and secondary text color. Use to highlight quoted content, testimonials, or excerpts.

## Example

```tsx
<Blockquote>Design is not just what it looks like.</Blockquote>
```

## Best Practices

- **Do:** Use for quoted text, testimonials, or highlighted excerpts from external sources.
- **Do:** Provide a cite prop when the source of the quote is known.
- **Don't:** Use for callout boxes or informational notes; use Banner for those.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `ReactNode` | — | Content of the blockquote. **(required)** |
| `cite` | `ReactNode` | — | Optional attribution for the quote. Rendered in a <footer> with <cite>. |
| `xstyle` | `StyleXStyles` | — | StyleX styles for layout customization (margins, positioning, sizing). Must be a stylex.create() value, not an inline style object like style={{}}. |

## Theming

| Component class | Preferred data attributes | Props | States |
|-----------------|---------------------------|-------|--------|
| `astryx-blockquote` | — | — | — |

-e 
---

# Breadcrumbs

Breadcrumbs show a trail of links from the root to the current page. Use them at the top of detail pages, settings panels, or anywhere the user needs to see where they are and navigate back up.

## Example

```tsx
<BreadcrumbItem href="/projects">Projects</BreadcrumbItem>
<BreadcrumbItem isCurrent>My Project</BreadcrumbItem>

<Breadcrumbs>
  <BreadcrumbItem href="/">Home</BreadcrumbItem>
  <BreadcrumbItem href="/projects">Projects</BreadcrumbItem>
  <BreadcrumbItem isCurrent>My Project</BreadcrumbItem>
</Breadcrumbs>
```

## Anatomy

| Element | Required | Description |
|---------|----------|-------------|
| Trail | Yes | The ordered list of links from root to current page. |
| Item | Yes | A single step in the trail. Renders as a link or plain text for the current page. |
| Separator | Yes | The character between items. Defaults to "/" but can be customized. |
| Icon | No | An optional icon before an item label, like a home icon on the first item. |

## Best Practices

- **Do:** Place breadcrumbs above the page heading so the user sees their location before reading the content.
- **Do:** Keep labels short and match the page titles they link to: "Settings" not "Application Settings Page".
- **Do:** Use the supporting variant in dense UIs like admin panels or sidebars where the breadcrumb should be subtle.
- **Do:** Make the last item plain text, not a link; it represents the current page. The component does this automatically when you set isCurrent.
- **Don't:** Use breadcrumbs as the primary navigation. They supplement a sidebar or top nav, not replace it.
- **Don't:** Show breadcrumbs on top-level pages that have no parent; they add clutter without helping the user.
- **Don't:** Let the trail grow beyond 5 levels. If you need more, consider simplifying the page hierarchy instead.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `ReactNode` | — | BreadcrumbItem elements to render inside the breadcrumb trail. **(required)** |
| `separator` | `ReactNode` | `'/'` | Separator rendered between breadcrumb items. |
| `variant` | `'default' | 'supporting'` | `'default'` | Visual variant: supporting is smaller with secondary text styling. |
| `label` | `string` | `'Breadcrumb'` | Accessible label for the nav landmark (aria-label). |
| `xstyle` | `StyleXStyles` | — | StyleX styles for layout customization (margins, positioning, sizing). Must be a stylex.create() value: not an inline style object like style={{}}. |

## Components

### BreadcrumbItem

Individual breadcrumb item. Renders as a link when href is provided, or as plain text for the current page.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `ReactNode` | — | Label content for the breadcrumb item. **(required)** |
| `href` | `string` | — | URL the breadcrumb links to; omit for non-navigable items. |
| `onClick` | `(e: MouseEvent) => void` | — | Click handler for the breadcrumb item. |
| `isCurrent` | `boolean` | `false` | Marks this item as the current page, applying aria-current="page". |
| `startIcon` | `ReactNode` | — | Icon rendered before the item label. |
| `as` | `LinkComponentType` | — | Custom link component to render instead of <a>. Overrides the provider-level default from LinkProvider. Only applies to non-current items. |

## Theming

| Component class | Preferred data attributes | Props | States |
|-----------------|---------------------------|-------|--------|
| `astryx-breadcrumb-item` | — | — | — |
| `astryx-breadcrumbs` | `data-variant` | variant | — |

-e 
---

# ButtonGroup

ButtonGroup joins related actions into a single connected control. Use it when multiple buttons represent related choices or operations that belong together visually, like copy/cut/paste, or undo/redo.

## Example

```tsx
<ButtonGroup label="Actions">
  <Button label="Copy" />
  <Button label="Cut" />
  <Button label="Paste" />
</ButtonGroup>
```

## Anatomy

| Element | Required | Description |
|---------|----------|-------------|
| Button | Yes | One or more Button or IconButton children that form the connected group. |
| Divider | No | A thin border between buttons, rendered automatically by the group. |

## Best Practices

- **Do:** Group buttons that perform related actions on the same object, like copy, cut, paste on selected text.
- **Do:** Use the same variant for all buttons in a group so they look like a single connected unit.
- **Do:** Keep groups small (2–4 buttons). For more actions, use a Toolbar or DropdownMenu instead.
- **Don't:** Don't mix wildly different actions. A Save button next to a Delete button in the same group is confusing.
- **Don't:** Don't use ButtonGroup for navigation. Use SegmentedControl or TabList for switching between views.
- **Don't:** Don't nest ButtonGroups. If you need multiple groups, place them side by side with a gap.

## Components

### ButtonGroup

Groups multiple buttons together with connected styling: shared borders, proper border-radius handling (only on outer edges), and horizontal or vertical orientation.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `ReactNode` | — | Button or IconButton children. **(required)** |
| `label` | `string` | — | Accessible label for the group (aria-label). **(required)** |
| `orientation` | `'horizontal' | 'vertical'` | `'horizontal'` | Layout direction of the button group. |
| `size` | `'sm' | 'md' | 'lg'` | `'md'` | Default size for buttons in the group. Individual buttons can override. |
| `isDisabled` | `boolean` | `false` | Whether all buttons in the group are disabled. |
| `ref` | `React.Ref<HTMLDivElement>` | — | Ref forwarded to the root element. |
| `xstyle` | `StyleXStyles` | — | StyleX styles for layout customization. Must be a stylex.create() value. |
| `data-testid` | `string` | — | Test selector for automated testing frameworks. |

## Theming

| Component class | Preferred data attributes | Props | States |
|-----------------|---------------------------|-------|--------|
| `astryx-button-group` | `data-size`, `data-orientation` | size, orientation | — |

-e 
---

# Card

Card is a bordered, elevated container for discrete, self-contained items: things you could reorder, remove, or interact with independently. Cards are NOT the default layout tool. Most content groups don't need a container at all; spacing and alignment create visual grouping naturally. Only reach for a Card when items need clear interaction boundaries or visual comparison in a grid.

## Example

```tsx
<Card width={400} height={300}>
  <Layout
    header={<LayoutHeader hasDivider>Title</LayoutHeader>}
    content={<LayoutContent>Content</LayoutContent>}
    footer={<LayoutFooter hasDivider>Actions</LayoutFooter>}
  />
</Card>

<Card variant="blue" width={300}>
  <p>Blue tinted card</p>
</Card>

<Card variant="muted" width={300}>
  <p>Subtle de-emphasised card</p>
</Card>
```

## Anatomy

| Element | Required | Description |
|---------|----------|-------------|
| Container | Yes | The outer box with border, background, border-radius, and padding. |
| Content | Yes | Any children rendered inside the card. Often a stack of heading, text, and actions. |

## Best Practices

- **Do:** Ask "could I reorder or remove this independently?" If yes, it's a card. If no, it's just a section of the page: use a heading + Stack or Section.
- **Do:** Use cards for discrete items: a single user profile, a single notification, a single metric, a product in a grid. Each card represents one "thing" with clear interaction boundaries.
- **Do:** Spacing and alignment alone create visual grouping. Not everything needs a container; try removing the card and see if the grouping is still clear from whitespace and typography.
- **Do:** Keep padding consistent across sibling cards so they align visually in a grid or list.
- **Do:** Pair a card with Layout when you need a structured header, scrollable content, and footer with actions.
- **Don't:** Default to cards for visual grouping. A heading + Stack with proper spacing creates hierarchy without adding borders everywhere. Cards should be the exception, not the default.
- **Don't:** Wrap page sections in cards. "General Settings", "Notification Preferences", form groups: these are page regions, use Section or heading + stack.
- **Don't:** Create identical card grids (icon + heading + text, repeated). Vary the layout or question whether cards are needed at all.
- **Don't:** Nest cards inside other cards; flatten the hierarchy or use spacing and dividers instead.
- **Don't:** Use color variants for status; use Banner or Badge for that. Color cards are for categorization.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `width` | `SizeValue` | — | Width of the card (number = pixels, string = used as-is). |
| `height` | `SizeValue` | — | Height of the card (number = pixels, string = used as-is). |
| `maxWidth` | `SizeValue` | — | Maximum width of the card. |
| `minHeight` | `SizeValue` | — | Minimum height of the card. |
| `children` | `ReactNode` | — | Content to render inside the card. |
| `padding` | `0 | 0.5 | 1 | 1.5 | 2 | 3 | 4 | 5 | 6 | 8 | 10` | `4` | Internal padding using the spacing scale. |
| `variant` | `'default' | 'muted' | 'blue' | 'cyan' | 'gray' | 'green' | 'orange' | 'pink' | 'purple' | 'red' | 'teal' | 'yellow'` | `'default'` | Background color variant. `default` uses the standard card background. `muted` uses the muted background for de-emphasised cards. The non-semantic variants use the corresponding `--color-<name>-background` token. |

## Theming

| Component class | Preferred data attributes | Props | States |
|-----------------|---------------------------|-------|--------|
| `astryx-card` | `data-variant` | variant | — |

-e 
---

# Carousel

Carousel scrolls a row of items horizontally when they overflow the available width. Use it for card grids, image galleries, product lists, or any set of items that should be browsable without taking up the full page.

## Example

```tsx
<Carousel gap={1}>
  <Thumbnail src="/a.jpg" alt="A" />
  <Thumbnail src="/b.jpg" alt="B" />
  <Thumbnail src="/c.jpg" alt="C" />
</Carousel>
```

## Anatomy

| Element | Required | Description |
|---------|----------|-------------|
| Scroll container | Yes | The horizontal overflow area that holds all items. |
| Items | Yes | The children rendered in a row. Each item is animated with a scroll-driven scale effect. |
| Fade edges | No | Gradient fades on the left and right edges that indicate more content is available. Enabled by default, disable with hasEdgeFade={false}. |
| Navigation buttons | No | Prev/next buttons that appear on hover. Enabled by default, disable with hasButtons={false}. |

## Best Practices

- **Do:** Enable scroll-snap when each item should land precisely at the start edge, like a gallery or product list.
- **Do:** Always provide an aria-label that describes what the carousel contains, like "Featured products" or "Team members".
- **Do:** Use a consistent gap and item width so the carousel looks intentional, not like content overflowing by accident.
- **Don't:** Use a carousel for content every user must see. Not everyone scrolls horizontally, so put critical content above the fold.
- **Don't:** Auto-advance items. Let the user scroll at their own pace.
- **Don't:** Nest carousels. A carousel inside a carousel is confusing and breaks keyboard navigation.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `ReactNode` | — | Carousel items rendered in a horizontal scroll container. **(required)** |
| `gap` | `0 | 0.5 | 1 | 1.5 | 2 | 3 | 4` | `1` | Gap between items using the spacing token scale. |
| `hasButtons` | `boolean` | `true` | Show prev/next navigation buttons on hover (desktop only). |
| `hasEdgeFade` | `boolean` | `true` | Show a gradient edge-fade mask when content overflows, signalling that more items exist off-screen. |
| `hasSnap` | `boolean` | `false` | Enable scroll-snap so each child snaps to the start edge. |
| `padding` | `0 | 0.5 | 1 | 1.5 | 2 | 3 | 4 | 5 | 6 | 8 | 10` | — | Inline padding inside the scroll container, with matching scroll-padding so snap points align to the content edge. |
| `aria-label` | `string` | `'Carousel'` | Accessible label for the carousel region. |
| `ref` | `React.Ref<HTMLDivElement>` | — | Ref forwarded to the root element. |
| `xstyle` | `StyleXStyles` | — | StyleX styles for layout customization (margins, positioning, sizing). Must be a stylex.create() value. |
| `className` | `string` | — | CSS class name for the root element. Prefer xstyle for styling. |
| `style` | `CSSProperties` | — | Inline styles for the root element. Prefer xstyle. |
| `data-testid` | `string` | — | Test selector for automated testing frameworks. |

## Theming

| Component class | Preferred data attributes | Props | States |
|-----------------|---------------------------|-------|--------|
| `astryx-carousel` | — | — | — |

-e 
---

# Chat

Chat is a family of composable primitives for building AI and human chat experiences. Combine ChatLayout, ChatMessageList, ChatMessage, bubbles, system messages, tool calls, tokenized text, and ChatComposer to assemble complete conversations without reimplementing sender-aware layout, density, scrolling, or composer behavior.

## Example

```tsx
<ChatComposer
  onSubmit={(value) => console.log(value)}
  placeholder="Type a message..."
/>

<ChatComposerDrawer count={3}>
  <AttachmentThumbnail />
  <AttachmentThumbnail />
</ChatComposerDrawer>

import {createStaticSource} from '@astryxdesign/core/Typeahead';
const mentionTrigger = {
  character: '@',
  searchSource: createStaticSource(users),
  onSelect: (item) => ({ value: `@${item.id}`, render: () => ... }),
};

<ChatDictationButton dictation={dictation} />

const scrollRef = useRef(document.documentElement);
<ChatLayout scrollRef={scrollRef} composer={...}>...</ChatLayout>

<ChatLayoutScrollButton isVisible={!isAtBottom} onClick={scrollToBottom} />

<ChatMessage sender="assistant" name="Navi" avatar={<Avatar name="Navi" size="small" />}>
  <ChatMessageBubble>Hello!</ChatMessageBubble>
  <ChatMessageMetadata timestamp="2:30 PM" />
</ChatMessage>

<ChatMessage sender="user">
  <ChatMessageBubble
    name="Cindy"
    metadata={<ChatMessageMetadata timestamp="2:30 PM" status="read" />}>
    Hey, how's it going?
  </ChatMessageBubble>
</ChatMessage>

<ChatMessageList>
  <ChatMessage sender="assistant" name="Navi" avatar={<Avatar name="Navi" size="md" />}>
    <ChatMessageBubble>Hello!</ChatMessageBubble>
  </ChatMessage>
</ChatMessageList>

<ChatMessage sender="user">
  <ChatMessageBubble>Hello!</ChatMessageBubble>
  <ChatMessageMetadata timestamp={<Timestamp value="..." format="time" />} status="read" />
</ChatMessage>

<ChatComposer onSubmit={handleSubmit} sendButton={<ChatSendButton />} />

<ChatSystemMessage>Conversation started</ChatSystemMessage>
<ChatSystemMessage variant="divider">Today</ChatSystemMessage>
<ChatSystemMessage variant="divider">March 15, 2026</ChatSystemMessage>

const mentionTokens = contacts.map(c => ({
  value: `@${c.id}`,
  label: `@${c.label}`,
  variant: 'blue' as const,
}));
<ChatTokenizedText tokens={mentionTokens}>
  {message.text}
</ChatTokenizedText>

<ChatToolCalls
  calls={message.toolCalls.map(tc => ({
    name: tc.toolName,
    status: tc.state,
    duration: tc.duration,
  }))}
  renderDetail={(call) => (
    <CodeBlock code={call.args} language="json" />
  )}
/>
```

## Anatomy

| Element | Required | Description |
|---------|----------|-------------|
| Message area | Yes | Scrollable region for messages. Renders children (typically ChatMessageList) in a flex column that pushes content to the bottom when the list is short. |
| Frosted glass dock | Yes | Sticky or fixed container at the bottom with a backdrop-blur layer. Houses the scroll button and composer. |
| Scroll-to-bottom button | No | Appears when the user scrolls up or new messages arrive. Defaults to ChatLayoutScrollButton; pass null to hide or a custom element to override. |
| Composer | Yes | The input area for sending messages, typically ChatComposer. Docked at the bottom inside the frosted glass layer. |
| Empty state | No | Centered placeholder shown when no messages exist. Use EmptyState for a consistent look. |
| Avatar | No | A sender avatar rendered beside the message. Typically Avatar with size="small". Hidden for system messages. |
| Name | No | Sender name above the message body. Place on the bubble when using bubbles, or on the message wrapper for raw content. |
| Content | Yes | The message body: one or more ChatMessageBubble elements, or any free-form ReactNode like images or tool calls. |
| Metadata | No | Timestamp, delivery status, and footer actions below the message. Place on the last bubble or on the message wrapper. |

## Best Practices

- **Do:** Compose messages using MessageList > Message > Bubble for consistent sender-aware styling and density.
- **Do:** Set the density prop to control spacing globally: compact for sidebars, balanced for most views, spacious for long-form reading. Individual messages can override.
- **Do:** Use gap when top-level rows are independent (for example, LLM tool events or streamed blocks) and list spacing needs to be tuned separately from density.
- **Do:** Use the group prop on bubbles (first, middle, last) when a single sender sends multiple consecutive messages; it tightens corner radius to visually connect them.
- **Do:** Use ChatSystemMessage with variant="divider" for date separators and default for inline status notices like joins, leaves, or topic changes.
- **Do:** Put name on the first bubble and metadata on the last bubble in a message so they align with the bubble's inline padding.
- **Do:** Provide an emptyState prop so new users see a clear prompt to start a conversation instead of a blank screen.
- **Do:** Use the ghost bubble variant for AI-style responses that show rich content like code blocks or markdown without a visible boundary.
- **Don't:** Don't use ChatSystemMessage for sender content; it has no avatar, alignment, or bubble. Use ChatMessage with a sender role instead.
- **Don't:** Don't put long or multi-line content in a system message; keep it to a single short sentence. If you need more, use a bubble or a card.
- **Don't:** Don't nest ChatMessage inside another ChatMessage; each message is a standalone article element with its own sender context.
- **Don't:** Don't apply a fixed height directly on the message list; wrap it in a sized container and let the list fill with flex: 1.
- **Don't:** Don't mix filled and ghost bubble variants within the same sender's messages; pick one style per side and use it consistently.
- **Don't:** Don't place metadata or names on both the bubble and the message wrapper; pick one based on whether the content has a bubble boundary.

## Components

### ChatMessageList

undefined



### ChatMessage

undefined



### ChatMessageBubble

undefined



### ChatMessageMetadata

undefined



### ChatSystemMessage

undefined



### ChatComposer

undefined



### ChatComposerInput

undefined



### ChatComposerDrawer

undefined



### ChatSendButton

undefined



### ChatToolCalls

undefined



### ChatTokenizedText

undefined



### ChatComposerTokenElement

undefined



### ChatLayout

undefined



### ChatLayoutScrollButton

undefined



## Theming

| Component class | Preferred data attributes | Props | States |
|-----------------|---------------------------|-------|--------|
| `astryx-chat-layout` | `data-density` | density | — |
| `astryx-chat-composer` | `data-density` | density | — |
| `astryx-chat-composer-input` | — | — | — |
| `astryx-chat-composer-drawer` | `data-collapsed` | collapsed | — |
| `astryx-chat-message` | `data-sender` | sender | — |
| `astryx-chat-message-bubble` | `data-sender`, `data-variant`, `data-density` | sender, variant, density | — |
| `astryx-chat-message-list` | `data-density` | density | — |
| `astryx-chat-system-message` | `data-variant` | variant | — |
| `astryx-chat-message-metadata` | — | — | — |
| `astryx-chat-send-button` | — | — | — |
| `astryx-chat-tokenized-text` | — | — | — |
| `astryx-chat-tool-calls` | — | — | — |
| `astryx-trigger-menu` | — | — | — |

-e 
---

# CheckboxList

CheckboxList shows a small group of checkboxes so users can turn several options on or off at once. Place it in settings pages, filter panels, or forms where every choice should be visible without scrolling. For a single standalone checkbox (like "I agree to the terms"), use CheckboxInput instead. If only one option can be picked, use RadioList. If the list is long enough to need searching or scrolling, use MultiSelector instead.

## Example

```tsx
<CheckboxList
  label="Notifications"
  value={selected}
  onChange={setSelected}>
  <CheckboxListItem label="Email" value="email" />
  <CheckboxListItem label="SMS" value="sms" />
  <CheckboxListItem label="Push" value="push" />
</CheckboxList>

<CheckboxListItem label="Email" value="email" />
<CheckboxListItem
  label="Accept terms"
  isChecked={accepted}
  onCheck={setAccepted}
/>
```

## Best Practices

- **Do:** Keep the list short: three to seven options is the sweet spot. Beyond that, switch to MultiSelector which adds search and scrolling.
- **Do:** Turn on dividers (hasDividers) when items have helper text underneath; without them the labels and descriptions blur together.
- **Do:** Write a group label that says what the choices represent: "Export formats" tells users more than "Options".
- **Don't:** Show a CheckboxList when the user can only pick one thing; that is what RadioList is for.
- **Don't:** Put buttons or links inside the trailing slot (endContent); the whole row is already tappable, so a nested button creates two competing click targets.
- **Don't:** Wrap a disabled CheckboxList in Tooltip to explain why it is disabled; disabled controls swallow the hover events the wrapper needs. Use the disabledMessage prop instead.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | `string` | — | Label text for the checkbox group (always rendered for accessibility). **(required)** |
| `children` | `ReactNode` | — | CheckboxListItem elements. **(required)** |
| `value` | `string[]` | — | The currently selected values (collection mode). |
| `onChange` | `(values: string[]) => void` | — | Callback fired when the selected values change. |
| `changeAction` | `(values: string[]) => void | Promise<void>` | — | Async action on change with optimistic updates. While the promise is pending, the toggled item shows a spinner inside its checkbox and is marked aria-busy. |
| `isLabelHidden` | `boolean` | `false` | Whether to visually hide the label. |
| `description` | `string` | — | Description text displayed below the label. |
| `density` | `'compact' | 'balanced' | 'spacious'` | `'balanced'` | Spacing density for list items. |
| `hasDividers` | `boolean` | `false` | Whether to show dividers between items. |
| `isDisabled` | `boolean` | `false` | Whether all checkbox items are disabled. |
| `disabledMessage` | `string` | — | Explains why the group is disabled. Applies to the whole-group disabled state (isDisabled), not per item. With isDisabled, shows a tooltip on hover/keyboard focus and keeps the checkboxes focusable via aria-disabled (toggling stays blocked). Use this instead of wrapping a disabled CheckboxList in Tooltip. Disabled controls swallow the hover events an external Tooltip needs. |
| `status` | `InputStatus` | — | Status indicator ({ type, message }). |
| `xstyle` | `StyleXStyles` | — | StyleX styles for layout customization. Must be a stylex.create() value. |

## Components

### CheckboxListItem

undefined



-e 
---

# Citation

Citations display inline references to external sources. Use them to attribute information within AI-generated responses, articles, or anywhere provenance and source links are needed.

## Anatomy

| Element | Required | Description |
|---------|----------|-------------|
| Container | Yes | The interactive wrapper. Renders as an anchor when a URL is provided, or a span otherwise. |
| Icon | No | An optional favicon or source icon displayed before the label text. Only available in the label variant. |
| Label text | No | The source title, truncated with ellipsis when it exceeds the max width. Shown in the label variant. |
| Number | No | The citation index displayed as a superscript badge. Shown in the number variant. |

## Best Practices

- **Do:** Use the label variant when the source title adds meaningful context for the reader.
- **Do:** Use the number variant for compact inline references within body text, like footnotes.
- **Don't:** Mix label and number variants in the same paragraph. Pick one style per context for visual consistency.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `source` | `CitationSource` | — | The citation source object containing title, url, and optional icon. **(required)** |
| `number` | `number` | — | The display index for this citation. **(required)** |
| `variant` | `'label' | 'number'` | `'label'` | Display style: a label chip showing the source title or a compact numbered badge. |

-e 
---

# ClickableCard

An interactive card for navigation or action targets. Nested interactive elements work independently.

## Example

```tsx
<ClickableCard label="Settings" href="/settings">
  <Text type="body" weight="bold">Settings</Text>
  <Text type="supporting" color="secondary">Manage your preferences</Text>
</ClickableCard>

<ClickableCard label="Open modal" onClick={() => setShowModal(true)}>
  <Text type="body">Click anywhere to open</Text>
  <Button label="Other action" onClick={handleOther} />
</ClickableCard>
```

## Anatomy

| Element | Required | Description |
|---------|----------|-------------|
| Container | Yes | Interactive div with hover/focus/active states. |
| Content | Yes | Children, which may include nested interactive elements. |

## Best Practices

- **Do:** Use for cards that navigate to a detail page or trigger a single action.
- **Do:** Nest buttons or links freely inside; they handle their own events.
- **Don't:** Use for toggling selection; use SelectableCard for that.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | `string` | — | Accessibility label. **(required)** |
| `onClick` | `(event: MouseEvent) => void` | — | Click handler: fires on card surface only. |
| `href` | `string` | — | Navigation URL. |
| `target` | `string` | `'_self'` | Link target. |
| `isDisabled` | `boolean` | `false` | Disables the card. |
| `children` | `ReactNode` | — | Card content. |
| `padding` | `SpacingStep` | `4` | Inner padding. |
| `variant` | `'default' | 'transparent' | 'muted' | 'blue' | 'cyan' | 'gray' | 'green' | 'orange' | 'pink' | 'purple' | 'red' | 'teal' | 'yellow'` | `'default'` | Background color variant. |
| `width` | `SizeValue` | — | Card width. |
| `height` | `SizeValue` | — | Card height. |
| `maxWidth` | `SizeValue` | — | Maximum card width. |
| `xstyle` | `StyleXStyles` | — | StyleX styles for layout customization (margins, positioning, sizing). Must be a stylex.create() value, not an inline style object like style={{}}. |

## Theming

| Component class | Preferred data attributes | Props | States |
|-----------------|---------------------------|-------|--------|
| `astryx-clickable-card` | `data-variant` | variant | — |

-e 
---

# CodeBlock

CodeBlock renders syntax-highlighted code with line numbers, a copy button, and optional collapsible sections. Use CodeBlock for multi-line snippets like source files, terminal commands, and configuration examples. Use Code for inline references to function names, variables, or CLI flags within body text.

## Example

```tsx
<CodeBlock code="const x = 42;" language="javascript" />
```

## Anatomy

| Element | Required | Description |
|---------|----------|-------------|
| Header Bar | No | Shows the title, language label, and copy button. Appears when any of these props are set. |
| Line Numbers | No | Numbered gutter along the left edge. Enable with hasLineNumbers. |
| Code Body | Yes | The syntax-highlighted code content. |
| Highlighted Lines | No | Background accent on specific lines to draw attention. |
| Copy Button | No | Copies the code string to the clipboard. Shown by default. |

## Best Practices

- **Do:** Set the language prop to match the code content so syntax highlighting is accurate. Use "plaintext" when the language is unknown.
- **Do:** Add a title when the code represents a file. It gives readers context and appears in the header bar alongside the copy button.
- **Do:** Use Code for short inline references like function names or CLI flags, and CodeBlock for standalone multi-line snippets.
- **Don't:** Enable line numbers on short snippets (under 5 lines) where they add clutter without helping navigation.
- **Don't:** Nest a code block inside a scrollable container. Use the maxHeight prop instead, which handles overflow natively.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `code` | `string` | — | The code string to display. **(required)** |
| `language` | `string` | `'plaintext'` | Language for syntax highlighting. Use "plaintext" to disable. |
| `title` | `string` | — | Filename or label shown in the header bar. |
| `hasLanguageLabel` | `boolean` | `true` | Show the language name in the header bar. Hidden when language is "plaintext". |
| `hasLineNumbers` | `boolean` | `false` | Show a line number gutter. |
| `highlightLines` | `number[]` | — | 1-indexed line numbers to highlight. |
| `hasCopyButton` | `boolean` | `true` | Show a copy-to-clipboard button. |
| `onCopy` | `() => void` | — | Callback after the code is copied. |
| `isWrapped` | `boolean` | `false` | Wrap long lines instead of enabling horizontal scroll. |
| `maxHeight` | `number | string` | — | Max height before the block scrolls vertically. |
| `size` | `'sm' | 'md'` | `'md'` | Text size variant. |
| `width` | `string` | `'fit-content'` | Width of the code block. Any CSS width value. 'fit-content' (default) shrinks to longest line. '100%' fills parent width. |
| `container` | `'card' | 'section'` | `'card'` | Container presentation style. 'card' (default): border and radius with the muted syntax background for a standalone card look. 'section': no border or radius and a transparent background so the block blends into the card or panel it's embedded in. |
| `tokenizer` | `(code: string, language: string) => Array<{type: string; start: number; end: number}>` | — | Custom tokenizer override for unsupported languages. |
| `isCollapsible` | `boolean` | `false` | Allow collapsing the code body into just the header bar. Starts expanded; the header becomes clickable to toggle. Only shows the toggle when the code exceeds collapsibleThreshold lines. |
| `collapsibleThreshold` | `number` | `10` | Minimum number of lines before the collapse toggle appears. Below this threshold the code block renders normally even when isCollapsible is true. |
| `xstyle` | `StyleXStyles` | — | StyleX styles for layout customization. Must be a stylex.create() value. |
| `className` | `string` | — | CSS class name for the root element. Prefer xstyle for styling. |
| `style` | `CSSProperties` | — | Inline styles. Prefer xstyle for StyleX-optimized styling. |
| `data-testid` | `string` | — | Test selector for automated testing frameworks. |

## Components

### Code

undefined



## Theming

| Component class | Preferred data attributes | Props | States |
|-----------------|---------------------------|-------|--------|
| `astryx-code` | — | — | — |
| `astryx-codeblock` | `data-size`, `data-language` | size, language | — |

-e 
---

# Collapsible

Collapsible hides and reveals content behind a trigger button. Use it in settings panels, FAQ pages, or detail views to keep the page scannable while letting users drill into sections they care about. Wrap multiple collapsibles in CollapsibleGroup for accordion behavior. For custom collapsible components, use the `useCollapsible` hook directly (`astryx hook useCollapsible`).

## Example

```tsx
<Collapsible trigger="Details">
  <Text type="body">Collapsible content</Text>
</Collapsible>
<Card>
  <Collapsible trigger="Settings">
    <SettingsForm />
  </Collapsible>
</Card>
<CollapsibleGroup type="single" defaultValue="general">
  <VStack gap={2}>
    <Card>
      <Collapsible trigger="General" value="general">
        <GeneralSettings />
      </Collapsible>
    </Card>
    <Card>
      <Collapsible trigger="Advanced" value="advanced">
        <AdvancedSettings />
      </Collapsible>
    </Card>
  </VStack>
</CollapsibleGroup>

<CollapsibleGroup type="single" defaultValue="general">
  <VStack gap={2}>
    <Card>
      <Collapsible trigger="General" value="general">
        <p>General settings content</p>
      </Collapsible>
    </Card>
    <Card>
      <Collapsible trigger="Advanced" value="advanced">
        <p>Advanced settings content</p>
      </Collapsible>
    </Card>
  </VStack>
</CollapsibleGroup>

<CollapsibleGroup type="single" defaultValue="faq1">
  <VStack gap={2}>
    <Card>
      <Collapsible trigger="What is Astryx?" value="faq1">
        Astryx is a design system for building internal tools.
      </Collapsible>
    </Card>
    <Card>
      <Collapsible trigger="How do I start?" value="faq2">
        Install the package and import components.
      </Collapsible>
    </Card>
  </VStack>
</CollapsibleGroup>
```

## Anatomy

| Element | Required | Description |
|---------|----------|-------------|
| Trigger | Yes | The always-visible button that toggles the content. Shows a label and a chevron indicator. |
| Chevron | No | Animated arrow that rotates to show open or closed state. |
| Content | No | The area that hides or reveals when the trigger is clicked. |

## Best Practices

- **Do:** Wrap each Collapsible in an Card for visual separation in accordion layouts.
- **Do:** Use CollapsibleGroup with type="single" for settings or FAQ pages where only one section should be open at a time.
- **Do:** Use type="multiple" when users need to compare content across sections, like feature lists or pricing tiers.
- **Do:** Start sections open (defaultIsOpen) when the content is likely needed on first view; don't make users click to see essential info.
- **Don't:** Hide critical or required content behind a collapsible; users may not discover it.
- **Don't:** Nest collapsibles more than two levels deep; it makes content hard to find and navigate.
- **Don't:** Use a collapsible for a single short paragraph; just show the text directly instead.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `trigger` | `ReactNode` | — | Content shown in the trigger area (always visible). **(required)** |
| `children` | `ReactNode` | — | Content that collapses and expands. |
| `defaultIsOpen` | `boolean` | `true` | Default open state (uncontrolled). |
| `isOpen` | `boolean` | — | Controlled open state. |
| `onOpenChange` | `(isOpen: boolean) => void` | — | Callback invoked when the open state changes. |
| `value` | `string` | — | Identifier used for group coordination. Required when placed inside an CollapsibleGroup. |

## Components

### CollapsibleGroup

undefined



## Theming

| Component class | Preferred data attributes | Props | States |
|-----------------|---------------------------|-------|--------|
| `astryx-collapsible` | — | — | — |

-e 
---

# CommandPalette

CommandPalette is a searchable dialog for quick access to commands, navigation, and actions. Use it as a keyboard-driven launcher powered by SearchSource for filtering and selection.

## Example

```tsx
<CommandPalette
  isOpen={isOpen}
  onOpenChange={setIsOpen}
  searchSource={createStaticSource(commands)}
/>

<CommandPalette
  emptyBootstrapText={<CommandPaletteEmpty>Start typing to search</CommandPaletteEmpty>}
  emptySearchText={<CommandPaletteEmpty>No results found</CommandPaletteEmpty>}
  searchSource={source}
/>

<CommandPalette
  isOpen={isOpen}
  onOpenChange={setIsOpen}
  input={<CommandPaletteInput />}
  footer={<CommandPaletteFooter />}>
  <CommandPaletteList>...</CommandPaletteList>
</CommandPalette>

<CommandPaletteGroup heading="Navigation">
  <CommandPaletteItem value="home" onSelect={goHome}>
    Home
  </CommandPaletteItem>
</CommandPaletteGroup>

<CommandPalette isOpen={isOpen} onOpenChange={setIsOpen}>
  <CommandPaletteInput placeholder="Search commands..." />
</CommandPalette>

<CommandPaletteItem value="settings" onSelect={() => navigate('/settings')}>
  Settings
</CommandPaletteItem>

<CommandPaletteList>
  <CommandPaletteItem value="home" onSelect={goHome}>
    Go Home
  </CommandPaletteItem>
</CommandPaletteList>
```

## Best Practices

- **Do:** Provide a searchSource with bootstrap results so users see useful options before typing.
- **Do:** Use auxiliaryData.group on items to automatically organize results into labeled sections.
- **Don't:** Use CommandPalette for simple dropdowns or menus; use Menu or Selector for inline selections.
- **Don't:** Add too many groups or items; curate results to keep the palette fast and scannable.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `isOpen` | `boolean` | — | Whether the command palette dialog is visible. **(required)** |
| `onOpenChange` | `(isOpen: boolean) => void` | — | Called when the palette visibility changes. **(required)** |
| `searchSource` | `SearchSource<T>` | — | Search source providing items via search(query) and bootstrap(). Use createStaticSource for static lists. **(required)** |
| `input` | `ReactNode` | `<CommandPaletteInput />` | Input slot. Defaults to CommandPaletteInput with standard behavior. |
| `footer` | `ReactNode` | `<CommandPaletteFooter />` | Footer slot. Defaults to CommandPaletteFooter showing keyboard hints. |
| `renderItem` | `(item: T, isSelected: boolean) => ReactNode` | — | Per-item render function. Auto-grouping by auxiliaryData.group is preserved. When omitted, renders label text. |
| `emptySearchText` | `ReactNode` | `'No results'` | Content shown when a search query returns no results. |
| `emptyBootstrapText` | `ReactNode` | `'Type to search'` | Content shown when there is no search query and bootstrap() returns nothing. |
| `value` | `string` | — | Controlled selected value for picker mode. |
| `onValueChange` | `(value: string) => void` | — | Called when the selected value changes in picker mode. |
| `label` | `string` | `'Command palette'` | Accessible label for the command palette dialog. |
| `width` | `number | string` | `640` | Width of the dialog. |
| `maxHeight` | `number | string` | `480` | Maximum height of the dialog. |
| `isInline` | `boolean` | `false` | Renders command palette content inline without modal behavior. Automatically disables input auto-focus and initial highlighted-item auto-scroll. For documentation previews and showcases only. |

## Components

### CommandPaletteInput

undefined



### CommandPaletteList

undefined



### CommandPaletteItem

undefined



### CommandPaletteGroup

undefined



### CommandPaletteFooter

undefined



### CommandPaletteEmpty

undefined



## Theming

| Component class | Preferred data attributes | Props | States |
|-----------------|---------------------------|-------|--------|
| `astryx-command-palette-footer` | — | — | — |
| `astryx-command-palette-group` | — | — | — |
| `astryx-command-palette-input` | — | — | — |
| `astryx-command-palette-item` | — | — | — |
| `astryx-command-palette-list` | — | — | — |

-e 
---

# ContextMenu

A right-click context menu that appears at the cursor position. Use to provide contextual actions for specific elements or regions without cluttering the UI with visible buttons.

## Example

```tsx
<ContextMenu
  items={[
    { label: 'Cut', onClick: () => handleCut() },
    { label: 'Copy', onClick: () => handleCopy() },
    { type: 'divider' },
    { label: 'Paste', onClick: () => handlePaste() },
  ]}
>
  <div>Right-click this area</div>
</ContextMenu>
```

## Best Practices

- **Do:** Keep menu items concise and action-oriented; users expect quick access to contextual actions.
- **Do:** Use sections and dividers to group related actions when the menu has many items.
- **Do:** Ensure all context menu actions are also accessible via other UI elements for keyboard-only users.
- **Don't:** Use a ContextMenu as the only way to access important actions; not all users know to right-click.
- **Don't:** Place more than 10–12 items in a single menu without grouping them into sections.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `ReactNode` | — | The trigger area: right-click on this content to open the menu. **(required)** |
| `items` | `ContextMenuOption[]` | — | Array of menu entries. Each entry is one of: an action item `{label, onClick?, icon?, isDisabled?}`, a divider `{type: "divider"}`, or a section `{type: "section", title?, items: [...action items]}`. **(required)** |
| `menuContent` | `ReactNode` | — | Custom JSX menu content for compound mode. Use instead of items for dynamic or stateful menus. |
| `menuWidth` | `number | string` | `'160px'` | Custom menu width. |
| `size` | `'sm' | 'md' | 'lg'` | `'md'` | Size of menu items: controls padding density. |
| `label` | `string` | `'Context menu'` | Accessible name for the menu surface, announced when it opens. |
| `isDisabled` | `boolean` | `false` | When true, right-click shows the native browser context menu instead. |

## Components

### ContextMenuItem

undefined



## Theming

| Component class | Preferred data attributes | Props | States |
|-----------------|---------------------------|-------|--------|
| `astryx-context-menu` | — | — | — |

-e 
---

# DateRangeInput

DateRangeInput lets users select a start and end date from a dual-month calendar popover. Use it for filtering data by time period, report generation, analytics dashboards, and booking flows.

## Example

```tsx
<DateRangeInput
  label="Reporting period"
  value={range}
  onChange={setRange}
  isDisabled
  disabledMessage="You need the Editor role to change this"
/>

<DateRangeInput
  label="Date range"
  value={range}
  onChange={setRange}
  presets={[
    { label: "Last 7 days", getRange: () => ({start: "...", end: "..."}) },
  ]}
/>
```

## Anatomy

| Element | Required | Description |
|---------|----------|-------------|
| Label | Yes | Text above the trigger describing what date range is expected. |
| Trigger button | Yes | A button showing the formatted range or placeholder. Clicking opens the popover. |
| Calendar icon | Yes | A trailing icon that also opens the popover. |
| Calendar popover | Yes | A dual-month calendar grid with range selection and hover preview. |
| Preset sidebar | No | A list of preset range options beside the calendar. |
| Clear button | No | A × button that resets the range to null. |
| Status message | No | An error, warning, or success message below the trigger. |

## Best Practices

- **Do:** Use presets for common ranges like "Last 7 days" to speed up selection.
- **Do:** Use min/max to constrain selectable dates to valid ranges.
- **Do:** Keep hasClear enabled (default) so users can reset the filter.
- **Do:** Provide clear labels and descriptions so users understand what the range controls.
- **Don't:** Use DateRangeInput when only a single date is needed; use DateInput instead.
- **Don't:** Hide the label without surrounding context that makes the purpose obvious.
- **Don't:** Wrap a disabled DateRangeInput in Tooltip to explain why it is disabled; disabled triggers swallow the hover events the wrapper needs. Use the disabledMessage prop instead.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | `string` | — | Label text. **(required)** |
| `isLabelHidden` | `boolean` | `false` | Visually hide the label. |
| `description` | `string` | — | Helper text displayed below the label. |
| `isOptional` | `boolean` | `false` | Show an "(optional)" indicator. |
| `isRequired` | `boolean` | `false` | Mark the field as required. |
| `isDisabled` | `boolean` | `false` | Disable the trigger and picker. |
| `disabledMessage` | `string` | — | Explains why the input is disabled. With isDisabled, shows a tooltip on hover/keyboard focus and keeps the field focusable via aria-disabled (activation stays blocked). Use this instead of wrapping a disabled DateRangeInput in Tooltip. Disabled controls swallow the hover events an external Tooltip needs. |
| `value` | `DateRange | null` | — | Selected date range ({start, end} in ISO format), or null. **(required)** |
| `onChange` | `(value: DateRange | null) => void` | — | Callback when the range changes. Called with null on clear. **(required)** |
| `changeAction` | `(value: DateRange | null) => void | Promise<void>` | — | Async action fired after onChange. Drives optimistic UI updates via useTransition. |
| `isLoading` | `boolean` | `false` | Whether the input is in a loading state. Disables interaction and shows a spinner. |
| `min` | `ISODateString` | — | Minimum selectable date. |
| `max` | `ISODateString` | — | Maximum selectable date. |
| `dateConstraints` | `Array<(date: Date) => boolean>` | — | Custom constraint functions to disable specific dates. |
| `presets` | `Array<DateRangePreset>` | — | Preset ranges shown as quick-select options beside the calendar. |
| `hasClear` | `boolean` | `true` | Shows a clear button when a range is selected. |
| `placeholder` | `string` | `'Select date range'` | Placeholder text when no range is selected. |
| `size` | `'sm' | 'md' | 'lg'` | `'md'` | Size of the trigger. |
| `status` | `InputStatus` | — | Status indicator for error, warning, or success states. |
| `labelTooltip` | `string` | — | Tooltip text via info icon at label end. |
| `numberOfMonths` | `1 | 2` | `2` | Number of months in the calendar. |
| `xstyle` | `StyleXStyles` | — | StyleX styles for layout customization. |

## Theming

| Component class | Preferred data attributes | Props | States |
|-----------------|---------------------------|-------|--------|
| `astryx-date-range-input` | `data-size`, `data-status` | size, status | — |

-e 
---

# DateTimeInput

DateTimeInput combines a calendar popover with a time input for selecting both a date and time in a single interaction flow. Use it for scheduling, event creation, deadline setting, or any form field that needs a specific datetime.

## Example

```tsx
<DateTimeInput
  label="Meeting time"
  value={dateTime}
  onChange={setDateTime}
  isDisabled
  disabledMessage="You need the Editor role to change this"
/>

<DateTimeInput
  label="Meeting time"
  value={dateTime}
  onChange={setDateTime}
/>
```

## Anatomy

| Element | Required | Description |
|---------|----------|-------------|
| Label | Yes | Text above the input describing what datetime is expected. |
| Date input | Yes | A text input where the user can type a date. Clicking opens a calendar popover. |
| Calendar icon | Yes | A button that opens the calendar popover. |
| Calendar popover | No | A month grid that appears when the icon is clicked or the date input is focused. |
| Time input | Yes | A text input for entering the time, displayed beside the date input. |
| Clear button | No | A × button that resets the datetime value. |
| Status message | No | An error, warning, or success message below the inputs. |

## Best Practices

- **Do:** Provide clear labels and descriptions so users understand what datetime is expected.
- **Do:** Use min and max to restrict selectable datetimes to valid ranges.
- **Do:** Use hasClear when the datetime is optional so the user can reset it.
- **Do:** Choose the hour format (12h or 24h) that matches your audience's locale.
- **Don't:** Use DateTimeInput when only a date is needed; use DateInput instead.
- **Don't:** Use DateTimeInput when only a time is needed; use TimeInput instead.
- **Don't:** Hide the label without surrounding context that makes the field purpose obvious.
- **Don't:** Wrap a disabled DateTimeInput in Tooltip to explain why it is disabled; disabled triggers swallow the hover events the wrapper needs. Use the disabledMessage prop instead.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | `string` | — | Label text. **(required)** |
| `isLabelHidden` | `boolean` | `false` | Visually hide the label. |
| `description` | `string` | — | Helper text displayed below the label. |
| `isOptional` | `boolean` | `false` | Show an "(optional)" indicator next to the label. |
| `isRequired` | `boolean` | `false` | Mark the field as required. |
| `isDisabled` | `boolean` | `false` | Disable the input and picker. |
| `disabledMessage` | `string` | — | Explains why the input is disabled. With isDisabled, shows a tooltip on hover/keyboard focus and keeps the field focusable via aria-disabled (activation stays blocked). Use this instead of wrapping a disabled DateTimeInput in Tooltip. Disabled controls swallow the hover events an external Tooltip needs. |
| `value` | `ISODateTimeString` | — | Selected datetime in ISO 8601 format (YYYY-MM-DDTHH:MM or YYYY-MM-DDTHH:MM:SS). |
| `onChange` | `(value: ISODateTimeString | undefined) => void` | — | Callback invoked when the selected datetime changes. **(required)** |
| `changeAction` | `(value: ISODateTimeString | undefined) => void | Promise<void>` | — | Async action fired after onChange. Drives optimistic UI updates via useTransition. |
| `isLoading` | `boolean` | `false` | Whether the input is in a loading state. Disables interaction and shows a spinner. |
| `min` | `ISODateTimeString` | — | Minimum selectable datetime. Constrains both date and time selection. |
| `max` | `ISODateTimeString` | — | Maximum selectable datetime. Constrains both date and time selection. |
| `dateConstraints` | `Array<(date: Date) => boolean>` | — | Array of custom constraint functions that disable specific dates. |
| `hasSeconds` | `boolean` | `false` | Include seconds in the time portion. |
| `hourFormat` | `'12h' | '24h'` | `'12h'` | Hour display format. '12h' shows AM/PM; '24h' uses 24-hour notation. |
| `timeIncrement` | `number` | `1` | Minutes to add or subtract when using arrow keys in the time input. |
| `hasClear` | `boolean` | `false` | Shows a clear button when a datetime value is set. |
| `placeholder` | `string` | `'Select a date'` | Placeholder text shown in the date portion when no date is selected. |
| `timePlaceholder` | `string` | `'Select a time'` | Placeholder text shown in the time portion when no time is selected. |
| `timeLabel` | `string` | — | Accessible label for the time portion. Defaults to "{label} time" so it is tied to the field label and localizable. |
| `size` | `'sm' | 'md' | 'lg'` | `'md'` | Size of the input control. |
| `status` | `InputStatus` | — | Status indicator object for error, warning, or success states with a message. |
| `labelTooltip` | `string` | — | Tooltip text displayed via an info icon at the end of the label. |
| `numberOfMonths` | `1 | 2` | `1` | Number of months displayed simultaneously in the calendar. |
| `xstyle` | `StyleXStyles` | — | StyleX styles for layout customization (margins, positioning, sizing). Must be a stylex.create() value, not an inline style object like style={{}}. |

## Theming

| Component class | Preferred data attributes | Props | States |
|-----------------|---------------------------|-------|--------|
| `astryx-date-time-input` | `data-size`, `data-status` | size, status | — |

-e 
---

# EmptyState

EmptyState shows a placeholder when a content area has no data. Use it for empty lists, zero search results, first-time setups, or cleared inboxes. Always include a title and a next step so the user is not stuck.

## Example

```tsx
<EmptyState
  title="No results found"
  description="Try adjusting your search or filters."
/>
<EmptyState
  icon={<Icon icon={InboxIcon} size="lg" />}
  title="No messages"
  description="You're all caught up!"
  actions={<Button label="Compose" variant="primary" />}
/>
```

## Anatomy

| Element | Required | Description |
|---------|----------|-------------|
| Icon | No | A visual cue above the title that reinforces the context, like a search icon for no results. |
| Title | Yes | Primary message explaining what is empty: "No projects yet" not "No data". |
| Description | No | Additional context explaining why it is empty or what the user can do. |
| Actions | No | One or two buttons guiding the user to a next step, like "Create project" or "Clear filters". |

## Best Practices

- **Do:** Include a clear title and a call-to-action button so users know how to proceed.
- **Do:** Use an illustration or icon that reinforces the context of the empty state.
- **Do:** Use the compact variant inside cards or sidebars where space is limited.
- **Don't:** Leave an empty state without guidance; always explain what happened and what the user can do next.
- **Don't:** Use a generic message like "No data"; be specific about what is empty and why.
- **Don't:** Use an EmptyState for error messages that require immediate action; use a Banner instead.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `title` | `string` | — | Primary message rendered as an <h3> heading inside the empty state. **(required)** |
| `description` | `string` | — | Optional secondary text providing additional context below the title. |
| `icon` | `ReactNode` | — | Optional icon or illustration displayed above the title; rendered as decorative (aria-hidden="true"). |
| `actions` | `ReactNode` | — | Optional action buttons displayed below the description, laid out horizontally by default and stacked vertically when isCompact is true. |
| `headingLevel` | `1 | 2 | 3 | 4 | 5 | 6` | `3` | Controls the rendered HTML heading tag (h1-h6) to fit the document outline. |
| `isCompact` | `boolean` | `false` | Enables the compact variant with reduced spacing for constrained content areas. |
| `xstyle` | `StyleXStyles` | — | StyleX styles for layout customization (margins, positioning, sizing). Must be a stylex.create() value, not an inline style object like style={{}}. |

## Theming

| Component class | Preferred data attributes | Props | States |
|-----------------|---------------------------|-------|--------|
| `astryx-empty-state` | `data-variant` | variant | — |

-e 
---

# FieldStatus

FieldStatus renders validation feedback for fields and field-like controls. Use it directly for custom controls that need the same error, warning, or success presentation as Field.

## Example

```tsx
<FieldStatus
  type="error"
  message="This field is required"
/>
<FieldStatus
  type="warning"
  message="This will be visible to others"
  variant="detached"
/>
```

## Best Practices

- **Do:** Use attached status below bordered inputs when the message belongs to that input.
- **Do:** Use detached status for controls like checkboxes, switches, and custom controls where overlap would be visually awkward.
- **Don't:** Use FieldStatus for general alerts or page-level notices; use Banner or Toast instead.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `type` | `'error' | 'warning' | 'success'` | — | Status type. **(required)** |
| `message` | `string` | — | Status message text. **(required)** |
| `id` | `string` | — | ID for aria-describedby association. |
| `variant` | `'attached' | 'detached'` | `'attached'` | Visual variant: attached overlaps the input, detached floats below. |

## Theming

| Component class | Preferred data attributes | Props | States |
|-----------------|---------------------------|-------|--------|
| `astryx-field-status` | `data-type`, `data-variant` | type, variant | — |

-e 
---

# FileInput

FileInput provides file upload with optional drag-and-drop support. Use it for single or multiple file selection with built-in validation for file type, size, and count. Pair with validation status for upload feedback.

## Example

```tsx
<FileInput
  label="Resume"
  value={file}
  isDisabled
  disabledMessage="Uploads are locked until your profile is verified"
/>

<FileInput label="Resume" value={file} onChange={setFile} accept=".pdf" />
```

## Anatomy

| Element | Required | Description |
|---------|----------|-------------|
| Label | Yes | Text that identifies the field. Always rendered for accessibility even when visually hidden. |
| Description | No | Helper text between the label and the drop zone explaining accepted formats or size limits. |
| Drop zone | Yes | The clickable area for file selection. In dropzone mode, also accepts dragged files. |
| Upload icon | No | An arrow icon in the drop zone hinting at the upload action. |
| Placeholder | No | Hint text shown when no files are selected. |
| File name display | No | Shows the name(s) of selected files. |
| Clear button | No | A close button that removes selected files and returns focus to the input. |
| Spinner | No | Loading indicator that appears during async upload actions. |
| Status message | No | Validation feedback showing error, warning, or success with a message. |

## Best Practices

- **Do:** Always specify an accept prop to guide users toward valid file types.
- **Do:** Use maxSize and maxFiles to prevent oversized uploads; the component handles validation and error display automatically.
- **Do:** Add a description to communicate constraints like file size limits or accepted formats.
- **Do:** Use changeAction for immediate upload workflows that benefit from optimistic UI.
- **Don't:** Don't use FileInput for directory or folder uploads; that is not supported in v1.
- **Don't:** Don't avoid dropzone mode unless space is constrained; drag-and-drop is the expected interaction for file uploads.
- **Don't:** Don't wrap a disabled FileInput in Tooltip to explain why it's disabled; disabled controls swallow the hover events the wrapper needs. Use the disabledMessage prop instead.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | `string` | — | Accessible label for the file input. **(required)** |
| `value` | `File | File[] | null` | — | Currently selected file(s). Controlled component. **(required)** |
| `onChange` | `(files: File | File[] | null) => void` | — | Callback fired when files are selected or removed. **(required)** |
| `changeAction` | `(files: File | File[] | null) => Promise<void>` | — | Async change action (React 19 transitions pattern). Use for immediate upload on file selection. |
| `accept` | `string` | — | Accepted file types. Uses the HTML accept attribute format (e.g. "image/*", ".pdf,.doc"). |
| `isMultiple` | `boolean` | `false` | Whether multiple files can be selected. When true, value and onChange use File[] instead of File. |
| `maxSize` | `number` | — | Maximum file size in bytes. Files exceeding this are rejected with an error status. |
| `maxFiles` | `number` | — | Maximum number of files (only applies when isMultiple is true). |
| `isLabelHidden` | `boolean` | `false` | Visually hides the label while keeping it accessible to screen readers. |
| `description` | `string` | — | Description text displayed between the label and input. |
| `isOptional` | `boolean` | `false` | Displays an "Optional" indicator next to the label. Mutually exclusive with isRequired. |
| `isRequired` | `boolean` | `false` | Displays a "Required" indicator next to the label and sets aria-required. Mutually exclusive with isOptional. |
| `isDisabled` | `boolean` | `false` | Disables the input, preventing interaction and dimming the element. |
| `disabledMessage` | `string` | — | Explains why the input is disabled. With isDisabled, shows a tooltip on hover/keyboard focus and keeps the trigger focusable via aria-disabled (opening the file picker stays blocked). Use this instead of wrapping a disabled FileInput in Tooltip; disabled controls swallow the hover events an external Tooltip needs. |
| `isLoading` | `boolean` | `false` | Puts the input in a loading state, showing a spinner and setting aria-busy. |
| `placeholder` | `string` | `"Choose file" or "Choose files"` | Placeholder text shown when no file is selected. |
| `mode` | `'input' | 'dropzone'` | `'input'` | Visual mode. 'input' is a compact inline style; 'dropzone' is a larger area with drag-and-drop support. |
| `status` | `{type: 'error' | 'warning' | 'success', message?: string}` | — | Validation status: applies a colored border. If message is provided, displays a floating message below the input. Error type also sets aria-invalid. |
| `labelTooltip` | `string` | — | Tooltip text displayed in an info icon at the end of the label. |

## Theming

| Component class | Preferred data attributes | Props | States |
|-----------------|---------------------------|-------|--------|
| `astryx-file-input` | `data-mode`, `data-status` | mode, status | — |

-e 
---

# FormLayout

A layout container that arranges form fields with consistent spacing and direction. FormLayout handles where fields go, not state or submission. Wrap it in a <form> for that. Supports vertical (default), horizontal, and horizontal-labels directions, and can be nested to mix them.

## Example

```tsx
<FormLayout>
  <TextInput label="Name" value={name} onChange={setName} />
  <TextInput label="Email" value={email} onChange={setEmail} />
</FormLayout>
```

## Anatomy

| Element | Required | Description |
|---------|----------|-------------|
| Form title | No | Heading that describes the purpose of the form. |
| Fields | Yes | Input components with labels for collecting user data. |
| Footer | No | Contains confirmation buttons such as Submit or Cancel. |

## Best Practices

- **Do:** Stack fields vertically for most forms. It's the easiest to scan top to bottom.
- **Do:** Nest a horizontal FormLayout inside a vertical one when fields naturally pair up, like First Name + Last Name or City + State + ZIP.
- **Do:** Use horizontal-labels for settings pages where labels sit beside their inputs.
- **Don't:** Use FormLayout for form state or submission. It's just layout. Wrap it in a <form> for that.
- **Don't:** Put unrelated fields side by side in a horizontal layout. Save it for fields that belong together.
- **Don't:** Nest horizontal-labels inside another FormLayout. It uses CSS Grid and needs to be the outermost container.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `direction` | `'vertical' | 'horizontal' | 'horizontal-labels'` | `'vertical'` | Controls field arrangement. Vertical stacks top-to-bottom, horizontal arranges left-to-right with equal flex-grow, and horizontal-labels uses CSS Grid with labels to the left of inputs (collapses to vertical on narrow viewports <=480px). |
| `children` | `ReactNode` | — | Form fields to arrange. Accepts Astryx inputs (TextInput, Selector, etc.) and Field-wrapped custom controls. |
| `xstyle` | `StyleXStyles` | — | StyleX styles for layout customization (margins, positioning, sizing). Must be a stylex.create() value, not an inline style object like style={{}}. |

## Theming

| Component class | Preferred data attributes | Props | States |
|-----------------|---------------------------|-------|--------|
| `astryx-form-layout` | `data-direction` | direction | — |

-e 
---

# HoverCard

HoverCard shows additional information when the user hovers or focuses a trigger element. Use it for profile cards, link summaries, or inline definitions where the user needs more context without navigating away.

## Example

```tsx
<HoverCard
  content={<ProfileCard user={user} />}
  placement="above">
  <Button>Hover me</Button>
</HoverCard>

const hoverCard = useHoverCard({ placement: 'above' });
<Button ref={hoverCard.ref} aria-describedby={hoverCard.describedBy}>
  Hover me
</Button>
{hoverCard.renderHoverCard(<ProfileCard user={user} />)}
```

## Anatomy

| Element | Required | Description |
|---------|----------|-------------|
| Trigger | Yes | The element that opens the hover card on hover or focus: a button, link, or inline text. |
| Card | Yes | The floating overlay with the preview content, anchored to the trigger. |
| Body | Yes | The main content area: profile info, link summary, or any rich content. |
| Actions | No | Optional buttons inside the card for follow-up actions like Follow or Message. |

## Best Practices

- **Do:** Keep content supplementary; hover cards should enhance understanding without blocking the primary workflow.
- **Do:** Provide a dashed underline on text triggers so users know the element is hoverable.
- **Do:** Use the hook API (useHoverCard) when you need more control over timing or placement.
- **Don't:** Place critical actions or required information inside a hover card; users may miss content that only appears on hover.
- **Don't:** Use a hover card when a simple Tooltip or Popover would suffice.
- **Don't:** Use a HoverCard for content the user must interact with; it disappears when the cursor leaves.
- **Don't:** Nest a HoverCard whose content has block elements directly inside phrasing-only contexts such as a <p>, <label>, or heading. The card renders inline, so block content there is invalid HTML the browser reparents. Wrap the surrounding text in a block element (e.g. a <div>) instead.

## Components

### HoverCard

Component wrapper for hover card display: a richer, larger overlay triggered on hover or focus.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `ReactNode` | — | Trigger element that must accept a ref. |
| `content` | `ReactNode` | — | Hover card content. **(required)** |
| `placement` | `'above' | 'below' | 'start' | 'end'` | `'above'` | Position relative to the anchor element. |
| `alignment` | `'start' | 'center' | 'end'` | `'center'` | Alignment along the placement axis. |
| `delay` | `number` | `300` | Show delay in milliseconds. |
| `hideDelay` | `number` | `200` | Hide delay in milliseconds. |
| `focusTrigger` | `'auto' | 'always' | 'never'` | `'auto'` | Controls when focus events trigger the hover card. |
| `isEnabled` | `boolean` | `true` | Enables or disables the hover and focus triggers. |
| `onOpenChange` | `(isOpen: boolean) => void` | — | Callback fired when hover card visibility changes. Called with true when shown and false when hidden. |
| `hasHoverIndication` | `'auto' | boolean` | `'auto'` | Shows a dashed underline on the trigger element. |
| `isDefaultOpen` | `boolean` | — | Whether the hover card should be shown on mount. Still dismissible. |

## Theming

| Component class | Preferred data attributes | Props | States |
|-----------------|---------------------------|-------|--------|
| `astryx-hovercard` | — | — | — |

-e 
---

# IconButton

A button that shows only an icon with no visible text. Use IconButton in toolbars, table rows, and compact UI where space is tight and the icon is universally understood.

## Example

```tsx
<IconButton label="Settings" icon={<GearIcon />} variant="ghost" />
<IconButton label="Delete" icon={<TrashIcon />} variant="destructive" />
<IconButton label="Emoji" icon={<span>🚀</span>} variant="ghost" size="sm" />
```

## Best Practices

- **Do:** Make the aria-label specific: a trash icon labeled "Delete conversation" is clearer than just "Delete" for screen readers.
- **Do:** Add a tooltip: even a gear icon can mean Settings, Preferences, or Configure.
- **Do:** Use ghost in toolbars and dense areas to reduce visual clutter.
- **Don't:** Use IconButton if the action isn't obvious from the icon alone; use Button with text.
- **Don't:** Skip the tooltip; label only reaches screen readers, sighted users need the hover hint.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | `string` | — | Accessible label. Used as aria-label (not rendered as visible text). **(required)** |
| `icon` | `ReactNode` | — | Icon element rendered inside the button. **(required)** |
| `variant` | `'primary' | 'secondary' | 'ghost' | 'destructive'` | `'secondary'` | Visual style variant. |
| `size` | `'sm' | 'md' | 'lg'` | `'md'` | Size variant. |
| `isLoading` | `boolean` | `false` | Shows a loading spinner and disables interaction. |
| `isDisabled` | `boolean` | `false` | Disables the button. |
| `tooltip` | `string` | — | Tooltip text shown on hover. |
| `onClick` | `(e: MouseEvent) => void` | — | Standard click handler. |
| `clickAction` | `(e: MouseEvent) => void | Promise<void>` | — | Async click handler with automatic loading state. |

-e 
---

# InputGroup

InputGroup connects an input with prefix/suffix addons in a single visual unit. Use it for URL fields, currency inputs, search fields with action buttons, or any input that needs contextual decorations.

## Example

```tsx
<InputGroup label="Price">
  <InputGroupText>$</InputGroupText>
  <TextInput label="Price" isLabelHidden value={price} onChange={setPrice} />
</InputGroup>

<InputGroup label="URL">
  <InputGroupText>https://</InputGroupText>
  <TextInput label="URL" isLabelHidden value={url} onChange={setUrl} />
</InputGroup>
```

## Anatomy

| Element | Required | Description |
|---------|----------|-------------|
| Label | Yes | Text above the group. |
| Prefix addon | No | Content before the input (text, icon, or button). |
| Input | Yes | The main input element (TextInput, NumberInput, TimeInput, DateInput, Typeahead, Selector, or MultiSelector). |
| Suffix addon | No | Content after the input (text, icon, or button). |
| Status message | No | An error, warning, or success message below the group. |

## Best Practices

- **Do:** Use text addons to show units, prefixes, or suffixes that clarify the input format (e.g., "$", "kg", "https://").
- **Do:** Use InputGroupText for static prefixes/suffixes like "$", "kg", or "https://".
- **Do:** Use InputGroup with compatible single-line inputs: TextInput, NumberInput, TimeInput, DateInput, Typeahead, Selector, and MultiSelector.
- **Do:** Keep each inner input's label specific; grouped inputs automatically combine the group label with their own label and inherit the group description/status context.
- **Don't:** Don't put multiple text inputs in one group; use separate fields instead.
- **Don't:** Don't use InputGroup for unrelated inputs; it's for a single input with decorations.
- **Don't:** Don't use InputGroup with TextArea, Slider, Switch, CheckboxInput, or RadioList.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `ReactNode` | — | InputGroupText and compatible input children: TextInput, NumberInput, TimeInput, DateInput, Typeahead, Selector, or MultiSelector. **(required)** |
| `label` | `string` | — | Accessible label for the group. **(required)** |
| `isLabelHidden` | `boolean` | `false` | Visually hide the label. |
| `description` | `string` | — | Helper text between label and input group. |
| `isDisabled` | `boolean` | `false` | Disable the entire group. |
| `isOptional` | `boolean` | `false` | Show "(optional)" indicator. |
| `isRequired` | `boolean` | `false` | Mark the field as required. |
| `size` | `'sm' | 'md' | 'lg'` | `'md'` | Default size for inputs in the group. |
| `status` | `InputStatus` | — | Status indicator applied to the group border. |
| `labelTooltip` | `string` | — | Tooltip text at the end of the label. |
| `xstyle` | `StyleXStyles` | — | StyleX styles for layout customization. |
| `data-testid` | `string` | — | Test selector. |

## Components

### InputGroupText

undefined



## Theming

| Component class | Preferred data attributes | Props | States |
|-----------------|---------------------------|-------|--------|
| `astryx-input-group` | `data-size`, `data-status` | size, status | — |

-e 
---

# Item

A single, flexible item primitive that unifies the "start content + label + description + end content" pattern across Astryx. Use it wherever you need a structured row: dropdown menus, selectors, contact lists, notifications, file browsers, and activity feeds.

## Example

```tsx
<Item
  startContent={<Avatar src={user.avatar} size="sm" />}
  label={user.name}
  description={user.role}
  endContent={<Badge>Admin</Badge>}
  onClick={() => navigate(`/users/${user.id}`)}
/>
```

## Anatomy

| Element | Required | Description |
|---------|----------|-------------|
| Marker | No | Optional list bullet/counter rendered before start content. |
| Start content | No | Leading visual: avatar, icon, image, or checkbox. |
| Label | Yes | Primary text identifying the item. |
| Description | No | Secondary supporting text below the label. |
| End content | No | End-aligned content: badges, timestamps, or action buttons. |

## Best Practices

- **Do:** Use named slots (startContent, label, description, endContent) for the common layout. These cover the 80% case.
- **Do:** Use density="compact" for menus and dense lists, "balanced" for standard rows, and "spacious" for roomier layouts.
- **Do:** Set labelLines and descriptionLines to control truncation when content length varies.
- **Do:** Use align="start" when start or end content is taller than a single line of text.
- **Don't:** Don't nest interactive elements (buttons, links) inside an interactive Item; it creates confusing focus and click targets.
- **Don't:** Don't use Item for navigation between views; use proper navigation components instead.
- **Don't:** Don't add read/unread or inbox-specific behavior directly; compose a thin wrapper like PreviewItem instead.

## Components

### Item

A universal item primitive that unifies the "start content + label + description + end content" layout pattern. Use as a building block for list items, menu items, contact rows, notifications, and more.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | `ReactNode` | — | Primary text identifying this item. Accepts string (auto-truncated) or ReactNode (for rich content). **(required)** |
| `marker` | `ReactNode` | — | Marker rendered before startContent as a direct flex child. Use for list bullets/counters that need custom baseline alignment. |
| `startContent` | `ReactNode` | — | Content rendered before the label/description area, such as an icon, avatar, or checkbox. |
| `description` | `ReactNode` | — | Secondary text: subtitle, description, or supporting info. |
| `endContent` | `ReactNode` | — | Content rendered after the label/description area, such as badges, metadata, timestamps, or action buttons. |
| `as` | `'div' | 'li' | 'span'` | `'div'` | HTML element to render as the root. |
| `align` | `'center' | 'start'` | `'center'` | Vertical alignment of start/end content slots. |
| `density` | `'compact' | 'balanced' | 'spacious'` | `'balanced'` | Spacing density. "compact" uses 4px block padding, "balanced" uses 8px, and "spacious" uses 12px block and inline padding. |
| `labelLines` | `number` | — | Max lines before label truncates with ellipsis. |
| `descriptionLines` | `number` | — | Max lines before description truncates with ellipsis. |
| `onClick` | `(event: MouseEvent) => void` | — | Click handler. Makes the item clickable with button semantics. |
| `href` | `string` | — | Link URL. Makes the item a link via an invisible anchor element. |
| `target` | `'_blank' | '_self'` | — | Link target. Only used with href. target="_blank" automatically adds noopener noreferrer. |
| `rel` | `string` | — | Link relationship tokens. noopener noreferrer are merged automatically for target="_blank". |
| `isHighlighted` | `boolean` | `false` | Highlighted state (hover/keyboard focus appearance). |
| `isSelected` | `boolean` | `false` | Selected state. |
| `isDisabled` | `boolean` | `false` | Disabled state. |
| `ref` | `React.Ref<HTMLDivElement>` | — | Ref forwarded to the root element. |
| `xstyle` | `StyleXStyles` | — | StyleX styles for layout customization. Must be a stylex.create() value. |
| `data-testid` | `string` | — | Test selector for automated testing frameworks. |

## Theming

| Component class | Preferred data attributes | Props | States |
|-----------------|---------------------------|-------|--------|
| `astryx-item` | `data-density`, `data-align` | density, align | — |

-e 
---

# Kbd

Renders a keyboard shortcut as styled key badges. Use Kbd in tooltips, menus, and help text to show key combinations.

## Example

```tsx
"mod+k"
"mod+shift+p"
"shift+plus"
"enter"

<Kbd keys="mod+k" />
```

## Best Practices

- **Do:** Place shortcuts near the action they trigger: in a tooltip, menu item, or inline instruction.
- **Do:** Use mod instead of ctrl or cmd; it automatically adapts to the user's platform.
- **Don't:** Use Kbd as the only way to discover an action; shortcuts should supplement visible controls, not replace them.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `keys` | `string` | — | Keyboard shortcut string. Use "+" to separate keys. Special keys: mod (Cmd on Mac), ctrl, alt, shift, enter, backspace, escape, tab, up, down, left, right. **(required)** |
| `xstyle` | `StyleXStyles` | — | StyleX styles for layout customization (margins, positioning, sizing). Must be a stylex.create() value, not an inline style object like style={{}}. |
| `className` | `string` | — | CSS class name for the root element. Prefer xstyle for styling; className is provided for integration with non-StyleX systems. |
| `style` | `CSSProperties` | — | Inline styles for the root element. Prefer xstyle for styling; inline styles bypass StyleX optimization. |

## Theming

| Component class | Preferred data attributes | Props | States |
|-----------------|---------------------------|-------|--------|
| `astryx-kbd` | — | — | — |

-e 
---

# Lightbox

A fullscreen overlay for viewing images and videos at full resolution. Supports single-item and gallery modes with prev/next navigation, optional zoom and pan for images, and native video controls.

## Example

```tsx
<Lightbox
  isOpen={isOpen}
  onOpenChange={setIsOpen}
  media={{src: "/photo.jpg", alt: "A photo"}}
/>
<Lightbox
  isOpen={isOpen}
  onOpenChange={setIsOpen}
  media={photos}
/>
<Lightbox
  isOpen={isOpen}
  onOpenChange={setIsOpen}
  media={photos}
  index={currentIndex}
  onIndexChange={setCurrentIndex}
/>

const lightbox = useLightbox({ media: photos });
<img onClick={() => lightbox.open(2)} />
{lightbox.element}

const lightbox = useLightbox({ media: photos });

{photos.map((photo, i) => (
  <img
    key={photo.src}
    src={photo.src}
    alt={photo.alt}
    {...lightbox.getTriggerProps(i)}
  />
))}
{lightbox.element}
```

## Best Practices

- **Do:** Always provide alt text for every image for screen reader accessibility.
- **Do:** Use gallery mode with onIndexChange for multi-image sets.
- **Do:** Enable hasZoom only when viewing high-resolution images that benefit from close inspection.
- **Don't:** Use the lightbox for non-image content; it is specialized for images.
- **Don't:** Nest interactive content inside captions; keep them plain text.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `isOpen` | `boolean` | — | Whether the lightbox is open. **(required)** |
| `onOpenChange` | `(isOpen: boolean) => void` | — | Callback when the lightbox open state changes. **(required)** |
| `media` | `LightboxMedia | LightboxMedia[]` | — | Media to display. Pass a single object for one item, or an array for gallery mode with prev/next navigation. Each item has src, alt, optional caption and type. **(required)** |
| `index` | `number` | — | Current index in gallery mode (when media is an array). |
| `onIndexChange` | `(index: number) => void` | — | Callback when the gallery index changes via prev/next navigation. |
| `hasZoom` | `boolean` | `false` | Enable zoom on double-click (images only). When zoomed, drag to pan. |
| `xstyle` | `StyleXStyles` | — | StyleX styles for layout customization. Must be stylex.create() value. |

## Theming

| Component class | Preferred data attributes | Props | States |
|-----------------|---------------------------|-------|--------|
| `astryx-lightbox` | — | — | — |

-e 
---

# List

A vertical collection of items with consistent spacing, dividers, and optional markers. Supports headers, icons, avatars, badges, and interactive items with click or link behavior. Use it to display ordered or unordered groups of related content.

## Example

```tsx
<List>
  <ListItem label="Notifications" description="Manage your alerts" />
  <ListItem label="Privacy" description="Control your data" />
</List>
<List listStyle="decimal" density="compact">
  <ListItem label="First step" />
  <ListItem label="Second step" />
</List>

<ListItem label="Settings" description="Manage your preferences" />
<ListItem label="Profile" onClick={() => navigate('/profile')} />
<ListItem label="Docs" href="/docs" target="_blank" rel="noreferrer" />
```

## Anatomy

| Element | Required | Description |
|---------|----------|-------------|
| List title | Yes | Heading that labels the list. |
| Description | No | Supplementary text below the title. |
| List items | Yes | Individual entries, which may include icons or images. |
| Item description | No | Additional detail for an individual list item. |

## Best Practices

- **Do:** Provide a header to label the list and give context to screen readers.
- **Do:** Use start and end content slots to add icons, avatars, or badges to each item.
- **Don't:** Place interactive elements inside an interactive list item; it creates nested click targets and confusing focus behavior.
- **Don't:** Use a list for a single item or for laying out unrelated content; lists imply a meaningful collection.
- **Don't:** Mix clickable and non-clickable items in the same list without clear visual distinction.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `ReactNode` | — | List items (ListItem components). |
| `density` | `'compact' | 'balanced' | 'spacious'` | `'balanced'` | Spacing density for items. |
| `hasDividers` | `boolean` | `false` | Show dividers between items. |
| `header` | `ReactNode` | — | Header content, associated with the list via aria-labelledby. |
| `listStyle` | `'none' | 'disc' | 'decimal' | 'circle'` | `'none'` | List marker style. 'decimal' renders an <ol> element instead of <ul>. |
| `start` | `number` | `1` | Starting number for ordered lists (listStyle='decimal'). Sets the CSS counter to begin at this value. |
| `xstyle` | `StyleXStyles` | — | StyleX styles for layout customization (margins, positioning, sizing). Must be a stylex.create() value: not an inline style object like style={{}}. |

## Components

### ListItem

undefined



## Theming

| Component class | Preferred data attributes | Props | States |
|-----------------|---------------------------|-------|--------|
| `astryx-list` | `data-density`, `data-list-style` | density, listStyle | — |
| `astryx-list-item` | — | — | — |

-e 
---

# Markdown

Renders a markdown string as Astryx-styled components. Use Markdown for user-generated content, AI responses, and documentation; it handles headings, lists, tables, code blocks, and citations with consistent styling.

## Example

```tsx
<Markdown contentWidth={640}>{text}</Markdown>

<Markdown>
  {'# Hello\n\nThis is **bold** and _italic_ text.\n\n- Item one\n- Item two'}
</Markdown>
```

## Best Practices

- **Do:** Set headingLevelStart to match the page hierarchy, e.g. start at 3 if the markdown sits inside an h2 section.
- **Do:** Use contentWidth to keep prose at a readable line length in wide layouts.
- **Do:** Use inlinePlugins for custom shorthand patterns like issue refs, diff refs, and mentions instead of preprocessing the markdown string.
- **Don't:** Use Markdown for hand-authored layouts; use Text and Heading directly when you control the content.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `string` | — | The markdown string to render. **(required)** |
| `display` | `'block' | 'inline'` | `'block'` | Display type. Markdown defaults to block. Use 'inline' for markdown spans embedded inside text. |
| `density` | `'default' | 'compact'` | `'default'` | Controls spacing between block-level elements. |
| `headingLevelStart` | `1 | 2 | 3 | 4 | 5 | 6` | `1` | The HTML heading level that markdown # maps to. Shifts all heading levels down to fit the surrounding page hierarchy. Levels exceeding h6 are clamped to h6. |
| `isStreaming` | `boolean` | `false` | Enables streaming mode; it uses incremental parsing and a smooth fade-in animation for chunk-by-chunk text delivery. |
| `onLinkClick` | `(href: string, event: MouseEvent) => void | false` | — | Handler for link clicks. Return false to prevent the default navigation behavior. |
| `sources` | `Record<string, MarkdownSource>` | — | Citation sources keyed by ID. When provided, [id] and 【id】 markers in the markdown that match a key are rendered as citation chips. |
| `citationStyle` | `'label' | 'number'` | `'label'` | How citations are displayed inline. 'label' shows a chip with source title, icon, and border. 'number' shows a compact numbered badge. |
| `contentWidth` | `number | string` | `680` | Max width for prose content (paragraphs, headings, lists, blockquotes). Tables and code blocks are unconstrained and can expand to the full container width. Use for readable line lengths in wide layouts. |
| `contentAlign` | `'start' | 'center'` | `'start'` | Alignment of prose content within the container when contentWidth is narrower than the available space. |
| `inlinePlugins` | `MarkdownInlinePlugin[]` | — | Transforms regex matches in parsed text nodes into custom inline React elements. Use for issue refs, diff refs, mentions, and other shorthand patterns. Inline code and fenced code blocks are unaffected. |
| `autolink` | `'gfm'` | — | Opt-in autolinking of bare URLs and emails. 'gfm' applies GitHub-Flavored Markdown autolink-literal rules: bare https?://..., www...., <scheme:url>, <email>, and user@host all become links. Trailing sentence punctuation and unbalanced trailing close-parens are excluded; matches inside code spans, code blocks, existing links, and image alt text are skipped. Default behavior (option unset) is unchanged. |
| `xstyle` | `StyleXStyles` | — | StyleX styles for layout customization (margins, positioning, sizing). Must be a stylex.create() value, not an inline style object like style={{}}. |
| `className` | `string` | — | CSS class name for the root element. Prefer xstyle for styling; className is provided for integration with non-StyleX systems. |
| `style` | `CSSProperties` | — | Inline styles for the root element. Prefer xstyle for styling; inline styles bypass StyleX optimization. |
| `data-testid` | `string` | — | Test selector for automated testing frameworks. |

## Theming

| Component class | Preferred data attributes | Props | States |
|-----------------|---------------------------|-------|--------|
| `astryx-markdown` | `data-density` | density | — |

-e 
---

# MetadataList

MetadataList displays key-value pairs for object attributes like quality, condition, and status, in a structured layout. Use it for detail panels, settings summaries, and record information.

## Example

```tsx
<MetadataList columns="multi">
  <MetadataListItem label="Name">MetadataList</MetadataListItem>
  <MetadataListItem label="Status">Active</MetadataListItem>
</MetadataList>

<MetadataListItem label="Status">Active</MetadataListItem>
<MetadataListItem label="Created" icon={<CalendarIcon />}>
  January 1, 2023
</MetadataListItem>
```

## Anatomy

| Element | Required | Description |
|---------|----------|-------------|
| Title | No | Optional title for the metadata list. |
| Label | Yes | The key label for each metadata entry. |
| Metadata | Yes | The value displayed in various formats. |
| Disclosure | No | Collapse/expand control for the list. |

## Best Practices

- **Do:** Choose label position based on content: "start" for short values, "top" for long or complex values.
- **Do:** Collapse long lists with `maxNumOfItems` to keep the page scannable.
- **Don't:** Use for extensive form input; use a form layout instead.
- **Don't:** Use for data that doesn't have a clear key-value structure.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `ReactNode` | — | Metadata items (MetadataListItem components). **(required)** |
| `columns` | `'multi' | 'single' | number` | `'single'` | Column layout mode. |
| `label` | `{ position?: 'start' | 'top', width?: number | string }` | `{ position: 'start' } (single-column) / { position: 'top' } (multi-column)` | Label display configuration. position controls label placement, width sets a custom label column width. Defaults to { position: 'top' } for multi-column layouts. |
| `maxNumOfItems` | `number` | — | Maximum items to show before collapsing with a show more/less toggle. |
| `orientation` | `'vertical' | 'horizontal'` | `'vertical'` | Layout orientation. Horizontal mode flows items in a row with flex-wrap. |
| `title` | `ReactNode` | — | Optional title or heading above the list. |
| `xstyle` | `StyleXStyles` | — | StyleX styles for layout customization. Must be a stylex.create() value. |

## Components

### MetadataListItem

undefined



## Theming

| Component class | Preferred data attributes | Props | States |
|-----------------|---------------------------|-------|--------|
| `astryx-metadata-list` | `data-columns`, `data-orientation` | columns, orientation | — |
| `astryx-metadata-list-item` | — | — | — |

-e 
---

# MobileNav

A slide-out drawer for mobile navigation. MobileNav is the mobile counterpart to SideNav and accepts the same children. Use it on narrow viewports where a persistent sidebar is not practical. Inside AppShell, use MobileNavToggle as the trigger; it reads state from context automatically.

## Example

```tsx
<AppShell mobileNav={
  <MobileNav header="Navigation">
    <SideNavItem label="Home" href="/" />
  </MobileNav>
}>
<MobileNav isOpen={isOpen} onOpenChange={setIsOpen} header="Navigation">
  <SideNavItem label="Home" href="/" />
</MobileNav>

<div className="my-toolbar">
  <MobileNavToggle />
  <h1>Page Title</h1>
</div>
<MobileNavToggle label="Menu">
  <MyCustomMenuIcon />
</MobileNavToggle>
```

## Best Practices

- **Do:** Share the same nav items between MobileNav and SideNav by extracting them into a variable.
- **Do:** Provide a header when the drawer's purpose is not obvious from its content.
- **Do:** Inside AppShell, use MobileNavToggle to open the drawer; it reads state from context. Do not pass isOpen/onOpenChange to the toggle.
- **Don't:** Use MobileNav on desktop: use a persistent SideNav instead.

## Components

### MobileNav

A slide-out drawer for mobile navigation. Accepts SideNav children.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `isOpen` | `boolean` | — | Whether the drawer is open. Inside AppShell, this is managed automatically via context. Outside AppShell, provide this prop to control the drawer yourself. |
| `onOpenChange` | `(isOpen: boolean) => void` | — | Called when the drawer visibility changes (backdrop click, Escape key, or close button). Inside AppShell, this is managed automatically via context. |
| `children` | `ReactNode` | — | Drawer content: typically SideNavSection/SideNavItem, or any ReactNode. **(required)** |
| `header` | `ReactNode` | — | Header content for the drawer. Rendered next to the close button. Pass a string for a simple text heading, or a ReactNode for custom content (logo, search bar, etc.). |
| `width` | `number` | `320` | Drawer width in pixels. Capped at 85vw to prevent overflow on small screens. |
| `side` | `'start' | 'end' | 'auto'` | `'auto'` | Which side the drawer slides from. Start is left in LTR, right in RTL. Auto picks a side based on the trigger position. |

### MobileNavToggle

Hamburger button that opens/closes the mobile nav drawer. Reads open state from AppShell context automatically: does NOT accept isOpen or onOpenChange props. Renders nothing above the mobile breakpoint.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `ReactNode` | — | Custom content to render instead of the default hamburger icon. |
| `label` | `string` | `'Open navigation'` | Accessible label for the toggle button. |

## Theming

| Component class | Preferred data attributes | Props | States |
|-----------------|---------------------------|-------|--------|
| `astryx-mobile-nav` | `data-side` | side | — |

-e 
---

# MoreMenu

MoreMenu is a three-dot button that opens a list of actions. Use it for secondary actions that don't need to be always visible, like in table rows, card headers, or toolbars.

## Example

```tsx
<MoreMenu
  items={[
    { label: 'Edit', onClick: handleEdit },
    { label: 'Delete', onClick: handleDelete },
  ]}
/>
```

## Best Practices

- **Do:** Use for overflow or secondary actions; keep primary actions visible outside the menu.
- **Do:** Use dividers or sections to group related actions when the menu has many items.
- **Don't:** Hide primary actions inside a MoreMenu; they should be directly visible.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `items` | `DropdownMenuOption[]` | — | Menu items: data array of actions, dividers, and sections. Same type as DropdownMenu items prop. **(required)** |
| `label` | `string` | `'More options'` | Accessible label for the trigger button (aria-label) and tooltip text. |
| `variant` | `ButtonVariant` | `'ghost'` | Visual style variant of the trigger button. |
| `size` | `ButtonSize` | `'md'` | Size of the trigger button. |
| `icon` | `ReactNode` | — | Override the default three-dot icon. Accepts any ReactNode. |
| `isDisabled` | `boolean` | `false` | Whether the menu trigger is disabled. |
| `xstyle` | `StyleXStyles` | — | StyleX styles for layout customization (margins, positioning, sizing). Must be a stylex.create() value, not an inline style object like style={{}}. |

## Theming

| Component class | Preferred data attributes | Props | States |
|-----------------|---------------------------|-------|--------|
| `astryx-more-menu` | — | — | — |

-e 
---

# MultiSelector

A checkbox dropdown for selecting multiple values from a list. Selected items can display as a count, labels, or badges. Use it for filtering or when presenting a finite set of options where multiple choices are needed.

## Example

```tsx
<MultiSelector
  label="Columns"
  options={columns}
  value={selected}
  onChange={setSelected}
  isDisabled
  disabledMessage="Select a table first"
/>

<MultiSelector
  label="Columns"
  options={['Name', 'Email', 'Role', 'Status']}
  value={selectedColumns}
  onChange={setSelectedColumns}
  hasSelectAll
/>
```

## Best Practices

- **Do:** Use for a moderate, finite set of options where multiple choices are needed.
- **Do:** Enable search filtering when the list exceeds ~15 options.
- **Do:** Use renderOption for custom option rows; the checkbox affordance remains owned by MultiSelector.
- **Do:** Enable select-all when most users will want all or nearly all options selected.
- **Do:** Use inside InputGroup only when the control needs a short prefix or suffix addon as part of one decorated input surface; prefer count or labels trigger display so the group stays single-line.
- **Don't:** Use for single-value selection; use Selector instead.
- **Don't:** Show more than ~20 options without enabling search.
- **Don't:** Wrap a disabled MultiSelector in Tooltip to explain why it is disabled; disabled triggers swallow the hover events the wrapper needs. Use the disabledMessage prop instead.

## Components

### MultiSelector

Multi-select dropdown with checkboxes for choosing multiple items.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | `string` | — | Label text for accessibility. **(required)** |
| `options` | `MultiSelectorOptionType[]` | — | Array of items: strings, objects with value/label/icon/disabled, dividers, or sections. **(required)** |
| `value` | `string[]` | — | Currently selected values. **(required)** |
| `onChange` | `(value: string[]) => void` | — | Callback fired when the selection changes. **(required)** |
| `changeAction` | `(value: string[]) => void | Promise<void>` | — | Async action on change. Fires after onChange. |
| `placeholder` | `string` | `'Select...'` | Placeholder text shown when no value is selected. |
| `size` | `'sm' | 'md' | 'lg'` | `'md'` | Size variant for the selector. |
| `triggerDisplay` | `'count' | 'labels' | 'badges'` | `'count'` | How to display selected items in the trigger. |
| `maxBadges` | `number` | `3` | Maximum badges to show before "+N". Only for triggerDisplay="badges". |
| `hasSelectAll` | `boolean` | — | Whether to show a select-all checkbox. |
| `selectAllLabel` | `string` | `'Select all'` | Label for the select-all checkbox. |
| `hasSearch` | `boolean` | — | Whether to show a search input for filtering options. |
| `searchPlaceholder` | `string` | `'Search...'` | Placeholder text for the search input. |
| `isDisabled` | `boolean` | — | Disables the selector. |
| `htmlName` | `string` | — | The HTML name attribute for form submissions. Renders one hidden input per selected value, like a native multi-select. |
| `disabledMessage` | `string` | — | Explains why the selector is disabled. With isDisabled, shows a tooltip on hover/keyboard focus and keeps the trigger focusable via aria-disabled (activation stays blocked). Use this instead of wrapping a disabled MultiSelector in Tooltip. Disabled controls swallow the hover events an external Tooltip needs. |
| `isLabelHidden` | `boolean` | — | Visually hides the label while keeping it accessible. |
| `description` | `string` | — | Helper text displayed below the label. |
| `isOptional` | `boolean` | — | Marks the field as optional. |
| `isRequired` | `boolean` | — | Marks the field as required. |
| `isLoading` | `boolean` | — | Shows a loading spinner in the trigger. |
| `status` | `{type: 'error' | 'warning' | 'success', message?: string}` | — | Validation status with an optional message. |
| `renderOption` | `(option: MultiSelectorOptionData) => ReactNode` | — | Custom render function for each selectable option in the dropdown. Not called for dividers, sections, or the select-all row. |
| `xstyle` | `StyleXStyles` | — | StyleX styles for layout customization. Must be a stylex.create() value. |

## Theming

| Component class | Preferred data attributes | Props | States |
|-----------------|---------------------------|-------|--------|
| `astryx-multi-selector` | `data-size`, `data-status` | size, status | — |

-e 
---

# NavIcon

NavIcon is a circular icon container with an accent-colored background. Use it in navigation headers such as TopNavHeading and PageNavHeader to visually identify a section or application.

## Example

```tsx
import {HomeIcon} from '@heroicons/react/24/solid';
<TopNavHeading
  heading="Dashboard"
  logo={<NavIcon icon={<HomeIcon style={{width: 16, height: 16}} />} />}
/>
<PageNavHeader
  icon={<NavIcon icon={<HomeIcon style={{width: 16, height: 16}} />} />}
  heading="My App"
/>
```

## Best Practices

- **Do:** Use in navigation headers to provide a recognizable visual anchor for the section.
- **Do:** Pass an Icon or similarly sized icon component to ensure proper proportions.
- **Don't:** Use NavIcon for interactive purposes; it is a display-only container, not a button.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `icon` | `ReactNode` | — | The icon element to render inside the circular background. Should be an Icon or similar icon component. **(required)** |

## Theming

| Component class | Preferred data attributes | Props | States |
|-----------------|---------------------------|-------|--------|
| `astryx-navicon` | — | — | — |

-e 
---

# NavHeadingMenu

Accessible menu container and items for nav heading popovers. NavHeadingMenu provides role="menu" with keyboard navigation; NavHeadingMenuItem renders individual selectable items. Pass as the menu prop of SideNavHeading or TopNavHeading.

## Example

```tsx
<SideNavHeading
  heading="Products"
  menu={
    <NavHeadingMenu size="lg">
      <NavHeadingMenuItem label="Dashboard" href="/dashboard" />
      <NavHeadingMenuItem label="Analytics" href="/analytics" />
    </NavHeadingMenu>
  }
/>

<NavHeadingMenu>
  <NavHeadingMenuItem label="Dashboard" href="/dashboard" />
  <NavHeadingMenuItem label="Settings" icon={GearIcon} onClick={open} />
</NavHeadingMenu>
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `ReactNode` | — | Menu items. **(required)** |
| `size` | `'sm' | 'md' | 'lg'` | `'md'` | Controls min-width and item padding. |
| `minWidth` | `number | string` | — | Minimum width override. |
| `xstyle` | `StyleXStyles` | — | StyleX styles for layout customization (margins, positioning, sizing). Must be a stylex.create() value, not an inline style object like style={{}}. |

-e 
---

# Outline

A table-of-contents sidebar for documentation pages, help centers, wikis, and long settings pages. Use it for navigation within a single page, not for app routes. Features a sliding indicator track that animates to the active heading.

## Example

```tsx
<Outline
  items={[
    {id: 'intro', label: 'Introduction', level: 1},
    {id: 'features', label: 'Features', level: 2},
    {id: 'api', label: 'API Reference', level: 1},
  ]}
/>
```

## Best Practices

- **Do:** Pass a flat ordered list of headings and let level control indentation.
- **Do:** Use activeId when custom scroll logic owns the active section.
- **Do:** Use density="compact" in dense sidebars where vertical space is tight.
- **Do:** Use useOutlineFromMarkdown or useOutlineFromDOM when headings are generated from content.
- **Don't:** Use Outline for application navigation - use SideNav or TopNav for routes.
- **Don't:** Use Outline for expandable hierarchy - use TreeList when nodes need expand and collapse.

## Components

### Outline

Document outline navigation with sliding indicator track. Renders a flat heading list as anchor links with a density variant and scroll-spy active state when uncontrolled.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `items` | `OutlineItem[]` | — | Ordered heading items. Each item has id, label, and level (1-6). The id should match the target heading element id. **(required)** |
| `activeId` | `string` | — | Currently active heading id. Providing this prop makes active state controlled and disables built-in scroll-spy. |
| `onActiveIdChange` | `(id: string) => void` | — | Called when the active item changes from built-in scroll-spy or from an outline link click. |
| `label` | `string` | `'Table of contents'` | Accessible label for the nav landmark. |
| `density` | `'default' | 'compact'` | `'default'` | Density variant controlling item padding. 'compact' for dense UIs, 'default' for standard spacing. |
| `xstyle` | `StyleXStyles` | — | StyleX styles for layout customization. Must be a stylex.create() value. |

## Theming

| Component class | Preferred data attributes | Props | States |
|-----------------|---------------------------|-------|--------|
| `astryx-outline` | `data-density` | density | — |
| `astryx-outline-item` | `data-level`, `data-active` | level | active |

-e 
---

# OverflowList

A horizontal list that automatically hides items when they exceed the available width. Use OverflowList for breadcrumbs, toolbars, tag lists, or any row that needs to collapse gracefully at smaller sizes.

## Example

```tsx
const labels = ['Save', 'Edit', 'Share'];
<OverflowList
  overflowRenderer={(overflowItems) => (
    <DropdownMenu
      button={{label: `+${overflowItems.length}`, variant: 'ghost'}}
      items={overflowItems.map(({index}) => ({ label: labels[index] }))}
    />
  )}>
  {labels.map(l => <Button key={l} label={l} />)}
</OverflowList>

<OverflowList
  gap={2}
  overflowRenderer={(items) => (
    <Button label={`+${items.length} more`} variant="ghost" />
  )}>
  <Button label="Action 1" />
  <Button label="Action 2" />
  <Button label="Action 3" />
  <Button label="Action 4" />
</OverflowList>
```

## Best Practices

- **Do:** Provide a meaningful overflowRenderer: a "+N more" badge, a dropdown, or a count indicator.
- **Do:** Set minVisibleItems to keep key items visible regardless of container size.
- **Don't:** Use OverflowList for vertical layouts; it only works with horizontal rows.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `ReactNode` | — | Items to render. Each child should be a single element. **(required)** |
| `overflowRenderer` | `(overflowItems: OverflowItem[]) => ReactNode` | — | Render function for the overflow indicator. Receives the list of hidden items (each with child and index). Only called when items are overflowing. |
| `gap` | `SpacingStep` | `2` | Gap between items as a spacing token step (0, 0.5, 1, 1.5, 2, 3, 4, 5, 6, 8, 10). |
| `minVisibleItems` | `number` | `0` | Minimum number of items to always show, even when overflowing. |
| `collapseFrom` | `'start' | 'end'` | `'end'` | Which end to collapse items from when overflow occurs. |
| `behavior` | `'observeSelf' | 'observeParent'` | `'observeSelf'` | Controls which element is measured for available width. 'observeSelf' uses the container's own width. 'observeParent' observes the parent element, useful when the list should stay content-sized while still detecting available space. |
| `xstyle` | `StyleXStyles` | — | StyleX styles for layout customization (margins, positioning, sizing). Must be a stylex.create() value, not an inline style object. |

## Theming

| Component class | Preferred data attributes | Props | States |
|-----------------|---------------------------|-------|--------|
| `astryx-overflow-list` | — | — | — |

-e 
---

# Overlay

Overlay layers action or supporting content over media, cards, video, or other bounded surfaces with an optional scrim and reveal behavior.

## Example

```tsx
<Overlay
  showOn="hover"
  content={<Button label="Quick view" variant="ghost" />}>
  <AspectRatio ratio={16/9}>
    <img src="hero.jpg" style={{objectFit: 'cover', width: '100%', height: '100%'}} />
  </AspectRatio>
</Overlay>

const overlay = useOverlay({
  showOn: 'hover',
  content: <Button label="Quick view" variant="ghost" />,
});

<Card ref={overlay.containerRef} {...overlay.containerProps}>
  <Layout content={...} />
  {overlay.element}
</Card>

// Callback mode — render on demand
const overlay = useOverlay({ showOn: 'hover' });

<div ref={overlay.containerRef} {...overlay.containerProps}>
  <img src={src} />
  {overlay.renderOverlay(<Button label="Quick view" />)}
</div>
```

## Anatomy

| Element | Required | Description |
|---------|----------|-------------|
| Base content | No | The media, card, or bounded surface that the overlay sits on top of. |
| Scrim | No | Optional dark or light overlay background that improves content contrast. |
| Overlay content | Yes | Actions, labels, or supporting content rendered above the base surface. |

## Best Practices

- **Do:** Use overlays for short, contextual actions or labels that belong directly to the underlying media or surface.
- **Do:** Keep overlay content compact so it remains legible over the scrim and does not obscure important visual information.
- **Don't:** Do not use Overlay for floating content anchored outside the surface. Use Popover, Tooltip, or Dialog for those patterns.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `content` | `ReactNode` | — | Content rendered inside the overlay scrim. **(required)** |
| `children` | `ReactNode` | — | Base content such as an image, video, card, or media surface that the overlay sits on top of. |
| `showOn` | `'hover' | 'always' | 'focus' | 'hover-or-focus'` | `'always'` | Visibility trigger. Hover mode also reveals on focus for keyboard accessibility; hover-or-focus is an alias for hover. |
| `isOpen` | `boolean` | — | Controlled visibility override. When set, this takes precedence over showOn and touch toggle behavior. |
| `scrim` | `'dark' | 'light' | false` | `'dark'` | Scrim background mode. Set to false to render overlay content without a scrim background. |
| `position` | `'fill' | 'bottom' | 'top'` | `'fill'` | Where the scrim appears within the base surface. |
| `align` | `'start' | 'center' | 'end'` | `'end'` | Alignment of the overlay content within the scrim. |
| `xstyle` | `StyleXStyles` | — | StyleX styles for layout customization (margins, positioning, sizing). Must be a stylex.create() value, not an inline style object like style={{}}. |
| `className` | `string` | — | CSS class name(s) appended to the root element. Prefer xstyle for styling when possible. |
| `style` | `React.CSSProperties` | — | Inline styles applied to the root element. Prefer xstyle for design-system styling. |
| `ref` | `Ref<HTMLDivElement>` | — | Ref forwarded to the overlay root element. |

-e 
---

# Pagination

Pagination lets users step through pages of content. Place it below a table, list, or card grid so users can move forward and backward through results. Pick a variant to match the context: numbered pages for data tables, a count for large lists, compact for tight spaces, or dots for carousels.

## Example

```tsx
generatePageRange(5, 10, 1) → [1, '...', 4, 5, 6, '...', 10]
generatePageRange(1, 10, 1) → [1, 2, 3, '...', 10]
generatePageRange(1, 5, 1)  → [1, 2, 3, 4, 5]

<Pagination
  page={page}
  onChange={setPage}
  totalItems={200}
  pageSize={20}
/>
```

## Best Practices

- **Do:** Place pagination below the content it controls so users see results before navigating.
- **Do:** Use the pages variant for data tables where users need to jump to a specific page.
- **Do:** Use the count variant with a page size selector when users need to control how many items they see at once.
- **Do:** Use the dots variant for carousels and walkthroughs where the total is small and position matters more than a number.
- **Do:** Pass totalItems when the total is known so users can see how much content remains.
- **Don't:** Show pagination when all items fit on a single page; there is nothing to paginate.
- **Don't:** Use the dots variant for more than about 10 pages; the dots become too small to be useful.
- **Don't:** Place pagination above the content; users expect it at the bottom.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `page` | `number` | — | Current page number (1-based). Page 1 is the first page. **(required)** |
| `onChange` | `(page: number) => void` | — | Called when the page changes. **(required)** |
| `changeAction` | `(page: number) => void | Promise<void>` | — | Async action on page change. Fires after onChange and uses React transitions for built-in loading state. |
| `totalItems` | `number` | — | Total number of items. Used to calculate page count. Takes precedence over totalPages if both provided. |
| `totalPages` | `number` | — | Total number of pages. Use when you know page count but not item count. |
| `hasMore` | `boolean` | — | Whether more pages exist after the current one. Use for cursor-based pagination where total is unknown. |
| `pageSize` | `number` | `10` | Number of items per page. Coerced to a positive integer; non-finite values fall back to the default. |
| `pageSizeOptions` | `number[]` | — | Available page size options. Shows a page size selector dropdown when provided. |
| `onPageSizeChange` | `(pageSize: number) => void` | — | Called when the page size changes. Automatically resets to page 1. |
| `variant` | `'pages' | 'count' | 'compact' | 'dots' | 'none'` | `'pages'` | Visual variant controlling what appears between prev/next buttons. 'pages' shows page number buttons with ellipsis, 'count' shows 'X-Y of Z' text, 'compact' shows 'Page X of Y', 'dots' shows dot indicators, 'none' shows just prev/next buttons. |
| `siblingCount` | `number` | `1` | Number of page buttons to show on each side of the current page. Only applies when variant='pages'. |
| `size` | `'sm' | 'md'` | `'md'` | Size of the pagination controls. |
| `isDisabled` | `boolean` | `false` | Whether the component is disabled. |
| `label` | `string` | `'Pagination'` | Accessible label for the navigation landmark. |
| `xstyle` | `StyleXStyles` | — | StyleX styles for layout customization (margins, positioning, sizing). Must be a stylex.create() value, not an inline style object like style={{}}. |

## Theming

| Component class | Preferred data attributes | Props | States |
|-----------------|---------------------------|-------|--------|
| `astryx-pagination` | `data-size`, `data-variant` | size, variant | — |
| `astryx-pagination-dot` | `data-size`, `data-active` | size | active |

-e 
---

# Popover

A click-triggered overlay anchored to a button or trigger element. Use it for secondary actions, inline confirmations, or supplementary information that does not warrant a full dialog. For hover previews use HoverCard, for brief helper text use Tooltip.

## Example

```tsx
<Popover content={...}><Button label="Open" /></Popover>
<Popover content={...}><Token label="Filter" /></Popover>
<Popover content={...}>
  {(triggerProps) => <MyCustomTrigger {...triggerProps} />}
</Popover>

<Popover label="Settings" content={<SettingsPanel />} placement="below">
  <Button label="Settings" />
</Popover>
<Popover
  isOpen={isOpen}
  onOpenChange={setIsOpen}
  label="Filter"
  content={<FilterForm />}>
  <Button label="Filter" />
</Popover>
<Popover
  anchorRef={myButtonRef}
  label="Actions"
  content={<ActionMenu />}
  placement="below"
/>

{popover.render(
  <Calendar />,
  { placement: 'below', alignment: 'start' }
)}

function DatePickerExample() {
  const inputRef = useRef<HTMLInputElement>(null);
  const popover = usePopover({
    onHide: () => inputRef.current?.focus(),
    closeButtonLabel: 'Close calendar',
  });
  return (
    <>
      <input ref={inputRef} />
      <button
        ref={popover.triggerRef}
        onClick={popover.toggle}
        {...popover.triggerProps}>
        Open Calendar
      </button>
      {popover.render(
        <Calendar />,
        { placement: 'below', alignment: 'start' }
      )}
    </>
  );
}
```

## Anatomy

| Element | Required | Description |
|---------|----------|-------------|
| Header | Yes | Contains the title, optional subheader, and close button. |
| Body | Yes | Main content area of the popover. |
| Trigger Element | Yes | The button or link that toggles the popover open. |

## Best Practices

- **Do:** Keep popover content focused on a single task or piece of information.
- **Do:** Provide a clear way to close: either by clicking outside or with an explicit close button.
- **Don't:** Nest popovers inside other popovers; it creates confusing focus and navigation.
- **Don't:** Use a popover for content that requires heavy user input; use a Dialog instead.
- **Don't:** Put too much content in a popover; if it needs scrolling, use a Dialog instead.

## Components

### Popover

A click-triggered popover for displaying interactive content anchored to a trigger element.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `ReactNode` | — | Trigger element. Must contain a <button> or [role="button"] element. |
| `anchorRef` | `React.RefObject<HTMLElement>` | — | External ref to use as the popover anchor in sibling mode. |
| `content` | `ReactNode` | — | Content to display inside the popover. **(required)** |
| `placement` | `'above' | 'below' | 'start' | 'end'` | `'below'` | Position placement relative to the trigger. |
| `alignment` | `'start' | 'center' | 'end'` | `'start'` | Alignment along the placement axis. |
| `isOpen` | `boolean` | — | Whether the popover is shown in controlled mode. |
| `onOpenChange` | `(isOpen: boolean) => void` | — | Callback fired when the popover visibility changes. |
| `isEnabled` | `boolean` | `true` | When false, trigger interactions are ignored. |
| `width` | `number | string` | `'auto'` | Width of the popover container. |
| `label` | `string` | — | Accessible label for the popover dialog. |
| `hasCloseButton` | `boolean` | `true` | Whether to include a hidden close button for accessibility. |
| `closeButtonLabel` | `string` | `'Close popover'` | Label for the hidden close button. |
| `hasAutoFocus` | `boolean` | `true` | Whether to auto-focus the first focusable element when the popover opens. Set to false for inline showcases or documentation previews. |
| `hasLightDismiss` | `boolean` | `true` | Whether clicking outside dismisses the popover. Set to false for surfaces that stay open until explicitly dismissed, like onboarding coachmarks. |
| `hasEscapeDismiss` | `boolean` | `true` | Whether pressing Escape dismisses the popover. Only takes full effect together with hasLightDismiss={false}, since native light dismiss also closes on Escape. |
| `xstyle` | `StyleXStyles` | — | StyleX styles for layout customization (margins, positioning, sizing). Must be a stylex.create() value, not an inline style object like style={{}}. |

## Theming

| Component class | Preferred data attributes | Props | States |
|-----------------|---------------------------|-------|--------|
| `astryx-popover` | — | — | — |

-e 
---

# PowerSearch

PowerSearch is a structured filter bar where each token represents a field, operator, and value. Use it for complex multi-dimensional filtering when users need to combine multiple search criteria. For simple single-field search, use a text input instead.

## Example

```tsx
const config = {
  name: 'MySearch',
  fields: [
    {
      key: 'status',
      label: 'Status',
      operators: [
        {
          key: 'is',
          label: 'is',
          value: {
            type: 'enum',
            values: [
              { value: 'open', label: 'Open' },
              { value: 'closed', label: 'Closed' },
            ],
          },
        },
      ],
    },
  ],
};
const [filters, setFilters] = useState([]);
<PowerSearch
  config={config}
  filters={filters}
  onChange={(newFilters) => setFilters(newFilters)}
/>

const config = {
  name: 'IssueSearch',
  contentSearchFieldKey: 'title',
  fields: [
    {
      key: 'title',
      label: 'Title',
      operators: [
        { key: 'contains', label: 'contains', value: { type: 'string' } },
      ],
    },
    {
      key: 'status',
      label: 'Status',
      operators: [
        { key: 'is', label: 'is', value: { type: 'enum', values: [...] } },
      ],
    },
  ],
};
```

## Best Practices

- **Do:** Define clear, descriptive field names and aliases so users can quickly find the filter they need.
- **Do:** Provide a result count to give users feedback on how their filters affect the data set.
- **Don't:** Use PowerSearch for simple keyword searches; a standard text input is more appropriate for single-field lookups.
- **Don't:** Wrap a disabled PowerSearch in Tooltip to explain why it is disabled; disabled controls swallow the hover events the wrapper needs. Use the disabledMessage prop instead.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `config` | `PowerSearchConfig` | — | Configuration defining available fields, operators, and their value types. **(required)** |
| `filters` | `ReadonlyArray<PowerSearchFilter>` | — | Currently active filters. **(required)** |
| `onChange` | `(filters: ReadonlyArray<PowerSearchFilter>, changeType: PowerSearchChangeType, index: number) => void` | — | Called when filters change. changeType is 'add', 'edit', or 'remove'. index is the affected filter's position. **(required)** |
| `label` | `string` | `'Search'` | Accessible label for the search input. |
| `isLabelHidden` | `boolean` | `true` | Visually hides the label while keeping it accessible. |
| `placeholder` | `string` | `'Search...'` | Placeholder text shown when no filters are selected. |
| `hasAutoFocus` | `boolean` | `false` | Auto-focus the input on mount. |
| `hasClear` | `boolean` | `true` | Show a clear-all button for removing all filters. |
| `isReadOnly` | `boolean` | `false` | Prevent adding, editing, or removing filters. |
| `isDisabled` | `boolean` | `false` | Disables the entire component. |
| `disabledMessage` | `string` | — | Explains why the search is disabled. With isDisabled, shows a tooltip on hover/keyboard focus and keeps the input focusable via aria-disabled (input stays blocked). Use this instead of wrapping a disabled PowerSearch in Tooltip. Disabled controls swallow the hover events an external Tooltip needs. |
| `status` | `InputStatus` | — | Validation status object with type and optional message. |
| `maxTokenLength` | `number` | `40` | Max character length for filter value display in tokens. |
| `popoverSaveButtonLabel` | `string` | `'Apply'` | Label for the save button in the edit popover. |
| `timezoneID` | `string` | — | Timezone ID for date formatting (e.g. "America/New_York"). |
| `handleRef` | `Ref<PowerSearchHandle>` | — | Imperative handle with focusTypeahead() and blurTypeahead() methods. |
| `endContent` | `ReactNode` | — | Content to display at the end of the input row. Useful for action buttons or other controls. |
| `resultCount` | `number | string` | — | Number of results matching the current filters. When a number, formatted as "N results". When a string, displayed as-is. |
| `size` | `'sm' | 'md' | 'lg'` | `'md'` | Size of the search input and tokens. |
| `xstyle` | `StyleXStyles` | — | StyleX styles for layout customization. Must be a stylex.create() value. |

-e 
---

# ProgressBar

A horizontal bar showing the completion progress of a task. Use it for operations where the duration is known, or as an animated indicator when progress can't be calculated. Supports semantic color variants, value labels, and custom formatting.

## Example

```tsx
<ProgressBar value={75} label="Upload progress" />
<ProgressBar isIndeterminate label="Loading..." />
<ProgressBar value={3.2} max={5} label="Disk usage" hasValueLabel
  formatValueLabel={(v, m) => `${v} GB / ${m} GB`} />
<ProgressBar value={30} label="Canceled" isDisabled hasValueLabel />
```

## Best Practices

- **Do:** Use a determinate bar when the total amount of work is known, and indeterminate when it's not.
- **Do:** Choose a color variant that matches the context: accent for general progress, success for completion, warning or error for alerts.
- **Do:** Always provide a label, even if hidden; screen readers need it to announce what's loading.
- **Don't:** Place icons or labels inside the bar; compose them alongside it using layout components.
- **Don't:** Use a progress bar for instant actions; it's meant for operations that take noticeable time.
- **Don't:** Use multiple progress bars stacked together for the same operation; use one bar with a value label instead.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | `string` | — | accessible label **(required)** |
| `value` | `number` | `0` | Current value (ignored when indeterminate). |
| `max` | `number` | `100` | Maximum value. |
| `isLabelHidden` | `boolean` | `false` | Visually hide the label (remains accessible). |
| `hasValueLabel` | `boolean` | `false` | Show formatted value text (ignored when indeterminate). |
| `formatValueLabel` | `(value: number, max: number) => string` | — | Custom value label formatter; defaults to a percentage string. |
| `variant` | `'accent' | 'success' | 'warning' | 'error' | 'neutral'` | `'accent'` | Semantic color variant. |
| `isIndeterminate` | `boolean` | `false` | Animated loading indicator for unknown progress. |
| `isDisabled` | `boolean` | `false` | Visually disabled state: grays out the fill and text. Use for canceled or inactive operations. |
| `xstyle` | `StyleXStyles` | — | StyleX styles for layout customization (margins, positioning, sizing). Must be a stylex.create() value, not an inline style object like style={{}}. |

## Theming

| Component class | Preferred data attributes | Props | States |
|-----------------|---------------------------|-------|--------|
| `astryx-progressbar` | `data-variant` | variant | — |
| `astryx-progressbar-fill` | `data-variant` | variant | — |

-e 
---

# Resizable

Hook-based resizable panel system. useResizable() manages size state and ResizeHandle provides the interactive pill-grip separator. Pass resize props to existing layout components via their resizable prop.

## Example

```tsx
<ResizeHandle
  resizable={sidebar.props}
  direction="horizontal"
  hasDivider />
```

## Best Practices

- **Do:** Use useResizable() with existing Astryx layout components. Pass the returned props to the resizable prop on LayoutPanel or SideNav.
- **Do:** Provide an accessible label on each ResizeHandle when multiple handles exist (e.g. "Resize sidebar", "Resize terminal").
- **Don't:** Wrap panels in extra container components for resize. The hook-first architecture avoids extra DOM; use it directly on existing components.

## Components

### useResizable

Hook that manages resize state for one or more panel regions. Returns size, isCollapsed, collapse/expand/resize methods, and props to pass to handles.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `defaultSize` | `number | string` | `250` | Initial size in pixels or percentage string (e.g. "20%"). |
| `minSizePx` | `number` | `50` | Minimum size in pixels. |
| `maxSizePx` | `number` | `Infinity` | Maximum size in pixels. |
| `collapsible` | `boolean` | `false` | Whether the region can collapse to size 0. |
| `collapsedSize` | `number` | `40` | Pixel threshold that triggers collapse during drag. |
| `snaps` | `number[]` | — | Pixel values to snap to during resize. |
| `shrinkOrder` | `number` | — | Cascade priority: lower number shrinks first. |
| `autoSaveId` | `string` | — | Key for persisting sizes to localStorage. |

### ResizeHandle

Draggable separator between panels. Pill-grip design: invisible at rest, visible on hover (0.6 opacity), fully opaque during drag (1.0). Keyboard-accessible.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `direction` | `'horizontal' | 'vertical'` | `'horizontal'` | Layout direction: determines cursor and indicator orientation. |
| `isReversed` | `boolean` | `false` | Reverse drag direction. Use when the handle controls a panel on the end/right/bottom side. |
| `isDisabled` | `boolean` | `false` | Whether the handle is interactive. |
| `hasDivider` | `boolean` | `false` | Show a full-length 1px divider line through the handle. Use when adjacent panels share the same background. |
| `isAlwaysVisible` | `boolean` | `true` | Show the pill grip at rest instead of only on hover. Use when discoverability is important. |
| `pillPlacement` | `'start' | 'end' | 'center' | 'auto'` | `'auto'` | Which side of the divider the pill sits on. auto = content side (derived from isReversed), flips when collapsed. start = left/top, end = right/bottom, center = centered on divider. |
| `label` | `string` | `'Resize handle'` | Accessible label for the separator. |
| `resizable` | `ResizableProps` | — | Resize props from useResizable: connects handle to panel. **(required)** |
| `children` | `ReactNode` | — | Custom handle content. Overrides the default pill + divider. |
| `xstyle` | `StyleXStyles` | — | StyleX styles for layout customization (margins, positioning, sizing). Must be a stylex.create() value, not an inline style object like style={{}}. |

## Theming

| Component class | Preferred data attributes | Props | States |
|-----------------|---------------------------|-------|--------|
| `astryx-resize-handle` | `data-direction` | direction | — |
| `astryx-resize-handle-pill` | — | — | — |

-e 
---

# Section

Section is the correct way to create page regions and group related content on a page. Use it for settings groups, form sections, sidebar areas, or any time you need visual separation between parts of a page. If you are tempted to use a Card for a page section, use Section instead.

## Example

```tsx
dividers={['top', 'bottom']}

<Section variant="muted" width={300} height={250}>
  <Layout
    content={<LayoutContent>Content in muted section</LayoutContent>}
  />
</Section>
```

## Best Practices

- **Do:** Use Section for page-level grouping: settings panels, form groups, sidebar regions. These are sections of a page, not discrete items.
- **Do:** Start with the default variant. Use muted only to call attention to a specific region.
- **Do:** Add dividers between same-background sections that need separation.
- **Do:** Combine with a heading + Stack for a typical page section pattern.
- **Don't:** Use Card when you mean Section. Cards are for discrete items (one notification, one profile). Sections are for page regions.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `'section' | 'transparent' | 'muted'` | `'section'` | Background variant applied to the section container. |
| `width` | `SizeValue` | — | Width of the section; a number is interpreted as pixels, a string is used as-is. |
| `height` | `SizeValue` | — | Height of the section; a number is interpreted as pixels, a string is used as-is. |
| `maxWidth` | `SizeValue` | — | Maximum width of the section. |
| `minHeight` | `SizeValue` | — | Minimum height of the section. |
| `children` | `ReactNode` | — | Content rendered inside the section. |
| `dividers` | `Array<'top' | 'bottom' | 'start' | 'end'>` | — | Which sides of the section have divider borders. |
| `padding` | `SpacingStep` | `4` | Internal padding using the spacing scale (0, 0.5, 1, 1.5, 2, 3, 4, 5, 6, 8, 10). Use padding={0} for edge-to-edge content. |
| `paddingBlock` | `SpacingStep` | — | Block (vertical) padding override. Overrides only the block-axis padding while preserving inline padding from `padding` or the container theme default. Accepts the spacing scale (0, 0.5, 1, 1.5, 2, 3, 4, 5, 6, 8, 10). |
| `xstyle` | `StyleXStyles` | — | StyleX styles for layout customization (margins, positioning, sizing). Must be a stylex.create() value, not an inline style object. |

## Theming

| Component class | Preferred data attributes | Props | States |
|-----------------|---------------------------|-------|--------|
| `astryx-section` | `data-variant` | variant | — |

-e 
---

# SegmentedControl

A segmented button group that allows users to make a single selection from a small set of mutually exclusive options. Use SegmentedControl when all options should be visible at once and the selection controls a value or mode, not page navigation.

## Example

```tsx
<SegmentedControl value={view} onChange={setView} label="View mode">
  <SegmentedControlItem value="grid" label="Grid" />
  <SegmentedControlItem value="list" label="List" />
  <SegmentedControlItem value="table" label="Table" />
</SegmentedControl>

<SegmentedControlItem value="grid" label="Grid" icon={<GridIcon />} />
```

## Best Practices

- **Do:** Use for switching between 2–5 mutually exclusive views or modes where all options should be visible.
- **Do:** Provide a descriptive label for the control to ensure the group is accessible to screen readers.
- **Don't:** Use for page-level navigation; use TabList instead. TabList is a navigation component, while SegmentedControl is an input that always has exactly one selected option.
- **Don't:** Use for simple on/off states; use ToggleButton instead. ToggleButton can be toggled on or off independently, while SegmentedControl enforces a single selection from a group.
- **Don't:** Wrap a disabled SegmentedControl in Tooltip to explain why it is disabled; disabled controls swallow the hover events the wrapper needs. Use the disabledMessage prop instead.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `string` | — | The currently selected value (controlled). **(required)** |
| `onChange` | `(value: string) => void` | — | Callback fired when a segment is selected. **(required)** |
| `label` | `string` | — | Accessible label for the radio group (used as aria-label, never rendered visually). **(required)** |
| `size` | `'sm' | 'md' | 'lg'` | `'md'` | Size variant for the control. |
| `layout` | `'hug' | 'fill'` | `'hug'` | Layout mode. hug (default) sizes segments to content; fill stretches them equally to fill the container. |
| `isDisabled` | `boolean` | `false` | Whether the entire control is disabled. |
| `disabledMessage` | `string` | — | Explains why the control is disabled. Applies to the whole-group disabled state (isDisabled), not per segment. With isDisabled, shows a tooltip on hover/keyboard focus and keeps the control focusable via aria-disabled (selection stays blocked). Use this instead of wrapping a disabled SegmentedControl in Tooltip. Disabled controls swallow the hover events an external Tooltip needs. |
| `children` | `ReactNode` | — | SegmentedControlItem children. **(required)** |
| `xstyle` | `StyleXStyles` | — | StyleX styles for layout customization (margins, positioning, sizing). Must be a stylex.create() value: not an inline style object like style={{}}. |

## Components

### SegmentedControlItem

undefined



## Theming

| Component class | Preferred data attributes | Props | States |
|-----------------|---------------------------|-------|--------|
| `astryx-segmented-control` | `data-size` | size | — |
| `astryx-segmented-control-item` | — | — | — |

-e 
---

# SelectableCard

A card that toggles between selected and unselected states with an accent border. For navigation use ClickableCard.

## Example

```tsx
<SelectableCard
  label="Option A"
  isSelected={selected === 'a'}
  onChange={() => setSelected('a')}>
  <Text type="body" weight="bold">Option A</Text>
</SelectableCard>
```

## Anatomy

| Element | Required | Description |
|---------|----------|-------------|
| Container | Yes | Interactive div with accent border on selection. |
| Content | Yes | Children rendered inside the card. |

## Best Practices

- **Do:** Use for plan pickers, filter chips, or option grids.
- **Do:** For single-select track one ID; for multi-select use a Set.
- **Don't:** Use for navigation; use ClickableCard for that.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | `string` | — | Accessibility label. **(required)** |
| `isSelected` | `boolean` | — | Controlled selection state. **(required)** |
| `onChange` | `(isSelected: boolean) => void` | — | Called when toggled. **(required)** |
| `isDisabled` | `boolean` | `false` | Disables the card. |
| `children` | `ReactNode` | — | Card content. |
| `padding` | `SpacingStep` | `4` | Inner padding. |
| `variant` | `'default' | 'transparent' | 'muted' | 'blue' | 'cyan' | 'gray' | 'green' | 'orange' | 'pink' | 'purple' | 'red' | 'teal' | 'yellow'` | `'default'` | Background color variant. |
| `width` | `SizeValue` | — | Card width. |
| `height` | `SizeValue` | — | Card height. |
| `maxWidth` | `SizeValue` | — | Maximum card width. |
| `xstyle` | `StyleXStyles` | — | StyleX styles for layout customization (margins, positioning, sizing). Must be a stylex.create() value, not an inline style object like style={{}}. |

## Theming

| Component class | Preferred data attributes | Props | States |
|-----------------|---------------------------|-------|--------|
| `astryx-selectable-card` | `data-selected` | selected | — |

-e 
---

# SideNav

A sidebar navigation component for organizing application pages with sections, nested items, and icons. Use SideNav as the primary navigation when an app has 5 or more destinations or requires hierarchical grouping.

## Example

```tsx
<SideNav
  header={<SideNavHeading heading="My App" headingHref="/" />}
  topContent={<Button label="Create new" variant="primary" />}>
  <SideNavSection heading="Main">
    <SideNavItem label="Dashboard" isSelected href="/dashboard" />
    <SideNavItem label="Projects" href="/projects" />
  </SideNavSection>
</SideNav>

<SideNav isCollapsible footerIcons={<SideNavCollapseButton />}>
  ...
</SideNav>

const ref = useRef(null);
<TopNav endContent={<SideNavCollapseButton handleRef={ref} />} />
<SideNav handleRef={ref} collapsible>...</SideNav>

<SideNavHeading icon={<AppIcon />} heading="My App" headingHref="/" />
<SideNavHeading
  icon={<SuiteIcon />}
  superheading="Suite Name"
  superheadingHref="/suite"
  heading="Product Name"
  headingHref="/product"
  menu={<ProductSwitcher />}
/>
<SideNavHeading
  icon={<AppIcon />}
  heading="Product Name"
  subheading="Business Account"
  menu={<AccountSwitcher />}
/>

<SideNavItem
  label="Dashboard"
  icon={HomeIcon}
  selectedIcon={HomeIconSolid}
  isSelected
  href="/dashboard"
/>
<SideNavItem label="Settings" icon={CogIcon}>
  <SideNavItem label="General" href="/settings/general" />
  <SideNavItem label="Security" href="/settings/security" />
</SideNavItem>

<SideNavSection title="Main">
  <SideNavItem label="Dashboard" icon={HomeIcon} isSelected />
  <SideNavItem label="Projects" icon={FolderIcon} />
</SideNavSection>
```

## Anatomy

| Element | Required | Description |
|---------|----------|-------------|
| Product icon and name | No | Branding area at the top of the nav. |
| Navigation items | Yes | Sections and groups of navigable links. |
| Collapse/expand toggle | No | Toggle to collapse or expand the side nav. |

## Best Practices

- **Do:** Use sections to group related navigation items and help users scan for their destination.
- **Do:** Pair outline and filled icon variants so the selected state is visually distinct.
- **Don't:** Include a SideNavHeading when a TopNav is already providing app identity; this duplicates branding.
- **Don't:** Use for filtering content; use tabs or filter buttons instead.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `header` | `ReactNode` | — | Header area (typically SideNavHeading). Sticky. |
| `topContent` | `ReactNode` | — | Content below the header, e.g., a create button. |
| `children` | `ReactNode` | — | Navigation sections and items. Scrollable. |
| `footer` | `ReactNode` | — | Footer area above the icon bar. |
| `footerIcons` | `ReactNode` | — | Footer icon bar. |
| `collapsible` | `boolean | { defaultIsCollapsed?: boolean; isCollapsed?: boolean; onCollapsedChange?: (isCollapsed: boolean) => void; hasButton?: boolean; buttonLabel?: string }` | `false` | Enables collapse behavior. true for uncontrolled with default toggle button, or an object for controlled mode and advanced config (defaultIsCollapsed, isCollapsed + onCollapsedChange, hasButton, buttonLabel). |
| `handleRef` | `Ref<SideNavImperativeCollapseHandle>` | — | Imperative collapse handle for SideNavCollapseButton instances rendered outside this SideNav. Separate from `ref`, which continues to expose the root HTMLElement. |
| `xstyle` | `StyleXStyles` | — | StyleX styles for layout customization (margins, positioning, sizing). Must be a stylex.create() value: not an inline style object like style={{}}. |

## Components

### SideNavHeading

undefined



### SideNavItem

undefined



### SideNavSection

undefined



### SideNavCollapseButton

undefined



## Theming

| Component class | Preferred data attributes | Props | States |
|-----------------|---------------------------|-------|--------|
| `astryx-side-nav` | `data-mode` | mode | — |
| `astryx-side-nav-heading` | — | — | — |
| `astryx-side-nav-item` | — | — | — |
| `astryx-side-nav-section` | — | — | — |

-e 
---

# Spinner

An animated loading indicator for processes with unknown duration, such as data fetching or form submission. Supports visible labels, multiple sizes, and a dark background variant. For content with known dimensions, use Skeleton instead.

## Example

```tsx
<Spinner label="Loading..." />
<Spinner label={<><strong>Fetching data</strong><br/>This may take a moment</>} aria-label="Fetching data" />

<Spinner />
<Spinner size="sm" />
<Spinner size="lg" shade="onMedia" />
<Spinner label="Loading..." />
<Spinner aria-label="Loading data" />
```

## Best Practices

- **Do:** Provide a meaningful label to describe what is loading for screen reader users.
- **Do:** Use the "onMedia" shade when placed on dark or accent-colored backgrounds.
- **Don't:** Use for content areas with known dimensions; use Skeleton to preserve layout instead.
- **Don't:** Stack multiple spinners in the same view; use one to represent the overall loading state.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `size` | `'sm' | 'md' | 'lg'` | `'md'` | Spinner size (10px, 14px, 18px). |
| `shade` | `'default' | 'onMedia' | 'subtle' | 'inherit'` | `'default'` | Color shade for light or dark backgrounds. |
| `label` | `ReactNode` | — | Visible content below the spinner. String labels auto-set aria-label. |
| `aria-label` | `string` | `'Loading'` | Accessible name for screen readers. Defaults to label (if string) or "Loading". |
| `xstyle` | `StyleXStyles` | — | StyleX styles for layout customization (margins, positioning, sizing). Must be a stylex.create() value, not an inline style object like style={{}}. |

## Theming

| Component class | Preferred data attributes | Props | States |
|-----------------|---------------------------|-------|--------|
| `astryx-spinner` | `data-size`, `data-shade` | size, shade | — |

-e 
---

# StatusDot

A small colored dot that communicates status like online/offline presence or severity levels. Supports five semantic variants and an optional pulse animation. Always pair with a visible text label, as color alone should not carry meaning.

## Example

```tsx
<StatusDot variant="success" label="Online" />
<StatusDot variant="error" label="Offline" />
<StatusDot variant="success" label="Live" isPulsing />
<StatusDot variant="success" label="Online" tooltip="Online" />
```

## Best Practices

- **Do:** Always pair with a visible text label so status is not conveyed by color alone.
- **Do:** Provide a descriptive `label` prop for screen reader accessibility.
- **Don't:** Use the pulse animation for purely decorative purposes; reserve it for states that require immediate attention.
- **Don't:** Rely on color alone to communicate status; always include text.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `'success' | 'warning' | 'error' | 'accent' | 'neutral'` | — | Semantic color variant. **(required)** |
| `label` | `string` | — | Accessible label surfaced via aria-label. **(required)** |
| `isPulsing` | `boolean` | `false` | Enables a pulse animation; respects prefers-reduced-motion: reduce. |
| `tooltip` | `string` | — | Tooltip text shown on hover to explain the status meaning. |
| `xstyle` | `StyleXStyles` | — | StyleX styles for layout customization (margins, positioning, sizing). Must be a stylex.create() value, not an inline style object like style={{}}. |

## Theming

| Component class | Preferred data attributes | Props | States |
|-----------------|---------------------------|-------|--------|
| `astryx-statusdot` | `data-variant` | variant | — |

-e 
---

# Thumbnail

Thumbnail displays a compact, square preview of an image attachment. It shows a shimmer effect while uploading, the image on success, and a placeholder icon when no source is set. Use it in chat composers, file upload lists, or anywhere you need a small image preview with optional remove and click actions.

## Example

```tsx
<Thumbnail src="/photo.jpg" alt="Vacation photo" onRemove={() => {}} />
<Thumbnail src="/preview.png" alt="Preview" onClick={() => {}} label="preview.png" />
```

## Anatomy

| Element | Required | Description |
|---------|----------|-------------|
| Image | No | The preview image, displayed as a square with cover fit. |
| Placeholder | No | An image silhouette icon shown when no src is provided. |
| Remove button | No | An overlaid close button in the top-right corner. Appears when onRemove is set. Uses APCA luminance detection to stay visible on any image. |
| Upload overlay | No | A semi-transparent overlay with a spinner, shown when isLoading is true and a src preview is available. |
| Skeleton | No | A shimmer animation shown when isLoading is true and no src is set. |

## Best Practices

- **Do:** Always provide a label prop with the file name so the thumbnail and its remove button are accessible to screen readers and show a tooltip on hover.
- **Do:** Use isLoading without a src to show a skeleton during initial upload, and isLoading with a src to show a spinner overlay once a preview URL is available.
- **Do:** Pair onClick with a lightbox or detail view so users can inspect the full image; the thumbnail adds button semantics and a hover shadow automatically.
- **Don't:** Don't use Thumbnail for non-image file types like PDFs or spreadsheets; use a file attachment component with an appropriate icon instead.
- **Don't:** Don't omit alt text when a src is provided; screen readers need a description of the image content, not just the file name from label.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `src` | `string` | — | Image source URL. |
| `alt` | `string` | — | Alt text for the image. |
| `label` | `string` | — | Accessible label (e.g. file name). Shown as tooltip on hover. |
| `onRemove` | `(e: React.MouseEvent) => void` | — | Callback for the overlaid remove button. |
| `onClick` | `(e: React.MouseEvent) => void` | — | Click handler. Adds button semantics and hover shadow. |
| `isLoading` | `boolean` | `false` | Shows skeleton (no src) or upload overlay (with src). |
| `isDisabled` | `boolean` | `false` | Whether the thumbnail is disabled. |
| `xstyle` | `StyleXStyles` | — | StyleX styles for layout customization (margins, positioning, sizing). Must be a stylex.create() value, not an inline style object like style={{}}. |
| `className` | `string` | — | CSS class name for the root element. Prefer xstyle for styling; className is provided for integration with non-StyleX systems. |
| `style` | `CSSProperties` | — | Inline styles for the root element. Prefer xstyle for styling; inline styles bypass StyleX optimization. |
| `data-testid` | `string` | — | Test selector for automated testing frameworks. |

## Theming

| Component class | Preferred data attributes | Props | States |
|-----------------|---------------------------|-------|--------|
| `astryx-thumbnail` | — | — | — |

-e 
---

# Timestamp

Timestamp formats a date or time value into human-readable text. Use it to show when something was created, updated, or is scheduled; picking relative for recency, absolute for precision, or auto to let the component decide.

## Example

```tsx
<Timestamp value="2026-02-19T17:00:00Z" />
<Timestamp value={1740000000} format="date" />
<Timestamp value={date} format="auto" isLive />
<Timestamp value={event.timestamp} format="system_date_time" />
```

## Anatomy

| Element | Required | Description |
|---------|----------|-------------|
| Formatted text | Yes | The rendered date, time, or relative label like "2 hours ago" or "Mar 21, 2025". |
| Tooltip | No | A hover card showing the full absolute date and time when the display is relative. |

## Best Practices

- **Do:** Use the auto format in feeds and lists so recent items show "2 hours ago" and older items show the full date automatically.
- **Do:** Keep formatting consistent within the same list or table; mixing relative and absolute timestamps in the same column confuses scanning.
- **Do:** Enable isTimezoneShown when the audience spans multiple time zones, like a global team calendar or audit log.
- **Do:** Use isLive for active dashboards or real-time feeds so the relative time stays accurate without a page refresh.
- **Don't:** Don't display raw Unix timestamps or ISO strings to users; always pass them through Timestamp to get a human-readable format.
- **Don't:** Avoid system_date or system_time formats in user-facing UI; they are meant for developer tools, logs, and machine-readable contexts.
- **Don't:** Don't disable the tooltip on relative timestamps; users expect to hover for the full date when they see "3 hours ago".

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `string | number` | — | The date/time to display. Accepts Unix timestamps (seconds) or ISO 8601 strings. **(required)** |
| `format` | `'relative' | 'auto' | 'date' | 'date_time' | 'time' | 'system_date' | 'system_date_time' | 'system_time'` | `'auto'` | Display format. 'relative' shows '2 hours ago', 'date' shows 'Mar 21, 2025', 'date_time' shows 'Mar 21, 2025, 2:51 PM', 'time' shows '2:51 PM', 'system_*' variants use ISO-style formatting, 'auto' switches from relative to date_time based on recency. |
| `autoThreshold` | `number` | `604800` | Threshold in seconds for 'auto' format to switch from relative to date_time. |
| `hasTooltip` | `boolean` | `true` | Whether to show a tooltip with the full date/time on hover when displaying relative time. |
| `isTimezoneShown` | `boolean` | `false` | Whether to append the timezone abbreviation. Applies to date_time, time, system_date_time, and system_time formats. |
| `isLive` | `boolean` | `false` | Whether the relative time should update live (e.g. "2 min ago" → "3 min ago"). |
| `type` | `TextType` | `'supporting'` | Semantic text type from Text. Determines size, weight, and line-height. |
| `size` | `TextSize` | — | Explicit font size override. Overrides the size from type. |
| `color` | `TextColor` | `'secondary'` | Text color. |
| `weight` | `TextWeight` | — | Font weight override. |

## Theming

| Component class | Preferred data attributes | Props | States |
|-----------------|---------------------------|-------|--------|
| `astryx-timestamp` | `data-type`, `data-color` | type, color | — |

-e 
---

# Toast

Toast shows a brief, non-blocking notification to confirm an action or present temporary information. Use it for scenarios where the user needs feedback but not a decision, such as saving, deleting, or changing a status.

For production use, prefer the `useToast()` hook; it handles positioning, stacking, auto-dismiss, and deduplication via `ToastViewport`. The `Toast` component renders the visual toast element inline and is useful for previews, documentation, and static showcases where the viewport lifecycle is not needed.

## Example

```tsx
<Toast
  type="info"
  body="Saved successfully"
  isAutoHide={true}
  autoHideDuration={5000}
  onDismiss={(reason) => removeToast(id, reason)}
/>

<ToastViewport position="bottomEnd" maxVisible={3}>
  <App />
</ToastViewport>

function SaveButton() {
  const toast = useToast();
  const handleSave = async () => {
    try {
      await saveData();
      toast({ body: 'Saved successfully' });
    } catch {
      toast({ body: 'Failed to save', type: 'error' });
    }
  };
  return <Button label="Save" onClick={handleSave} />;
}
```

## Anatomy

| Element | Required | Description |
|---------|----------|-------------|
| Body | Yes | The primary message text describing what happened or what the user should know. |
| End content | No | A trailing action like an Undo button or a link, placed after the body text. |
| Dismiss button | Yes | A close button that lets the user manually dismiss the toast before auto-hide. |

## Best Practices

- **Do:** Keep messages short: only a few words that tell the user what happened, like "Changes saved" or "Message sent".
- **Do:** Add an undo action in the endContent slot for reversible operations like deleting an item, so the user can recover without navigating away.
- **Do:** Use uniqueID to deduplicate toasts that fire from repeated actions, like clicking a save button multiple times.
- **Do:** Use error type for failures that need attention but not immediate action; it persists until dismissed so the user won't miss it.
- **Don't:** Don't use a toast for critical errors that block the user. Use Banner for persistent, in-context messaging that requires acknowledgment.
- **Don't:** Don't put long or multi-line content in a toast; it disappears after 5 seconds and the user may not finish reading.
- **Don't:** Don't show form validation errors as toasts. Use inline field validation so the user can see exactly which field needs fixing.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `body` | `ReactNode` | — | Primary message content. **(required)** |
| `type` | `'info' | 'error'` | `'info'` | Toast type controlling background color. Error toasts persist until dismissed. |
| `isAutoHide` | `boolean` | — | Whether the toast auto-dismisses. Defaults to true for info, false for error. |
| `autoHideDuration` | `number` | `5000` | Duration in ms before auto-dismiss. |
| `endContent` | `ReactNode` | — | Content rendered at the trailing end (e.g. Undo button, link). |
| `uniqueID` | `string` | — | Unique identifier for deduplication. |
| `collisionBehavior` | `'overwrite' | 'ignore'` | `'overwrite'` | Behavior when a toast with matching uniqueID already exists. |
| `onHide` | `(reason: "auto" | "manual") => void` | — | Callback fired when the toast is removed. |

## Theming

| Component class | Preferred data attributes | Props | States |
|-----------------|---------------------------|-------|--------|
| `astryx-toast` | `data-type` | type | — |

-e 
---

# ToggleButton

ToggleButton switches between selected and unselected states to represent a persistent on/off choice. Use it standalone for binary actions like bold, mute, or favorite, or inside a ToggleButtonGroup for single-select or multi-select toolbar controls.

## Example

```tsx
<ToggleButton
  label="Favorite"
  isPressed={isFavorited}
  onPressedChange={setIsFavorited}
  pressedChangeAction={async (newState) => {
    await api.setFavorite(itemId, newState);
  }}
/>

pressedIcon={<StarIconSolid style={{color: 'var(--color-icon-yellow)'}} />}

const [isBold, setIsBold] = useState(false);
<ToggleButton
  label="Bold"
  icon={<BoldIcon />}
  isPressed={isBold}
  onPressedChange={setIsBold}
/>

const [view, setView] = useState<string | null>('grid');
<ToggleButtonGroup value={view} onChange={setView} label="View mode">
  <ToggleButton value="list" label="List" icon={<ListIcon />} />
  <ToggleButton value="grid" label="Grid" icon={<GridIcon />} />
</ToggleButtonGroup>
```

## Anatomy

| Element | Required | Description |
|---------|----------|-------------|
| Icon | No | A leading icon that represents the toggle action, like a star for favorite or bold "B" for formatting. |
| Pressed icon | No | An alternate icon shown when pressed: typically a filled version of the default icon to reinforce the active state. |
| Label | Yes | The visible text or accessible name. For icon-only toggles, used as the aria-label and auto-tooltip. |
| Spinner | No | Replaces the icon during async operations triggered by pressedChangeAction. |

## Best Practices

- **Do:** Use a filled or colored icon for the pressed state so users can see the current state at a glance: an outline star vs a solid star, for example.
- **Do:** Keep the label identical between pressed and unpressed states. Let the visual treatment (icon, weight, background) communicate the change.
- **Do:** Wrap related toggles in a ToggleButtonGroup with an accessible label so screen readers announce them as a connected set.
- **Don't:** Don't use a ToggleButton for one-time actions like "Submit" or "Delete"; those are regular Buttons, not toggles.
- **Don't:** Don't mix ToggleButtons with regular Buttons inside the same group; use only ToggleButtons in a ToggleButtonGroup.
- **Don't:** Don't use a ToggleButton for on/off settings that persist across sessions; use a Switch instead, which better communicates "setting" semantics.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | `string` | — | Accessible label for the button. Used as visible text, or as aria-label for icon-only buttons. **(required)** |
| `isPressed` | `boolean` | — | Whether the button is currently pressed. Ignored when inside a group. |
| `onPressedChange` | `(isPressed: boolean, event: MouseEvent) => void` | — | Called when pressed state should change. Receives the next state and the click event; call event.preventDefault() to skip pressedChangeAction. Ignored when inside a group. |
| `pressedChangeAction` | `(isPressed: boolean) => void | Promise<void>` | — | Action handler for API- or navigation-backed toggles, run in a transition. Shows an optimistic pressed state immediately and a spinner while pending; the button stays interruptible by re-clicks. |
| `size` | `'sm' | 'md' | 'lg'` | `'md'` | Button size. Defaults to group size when inside a group. |
| `isDisabled` | `boolean` | `false` | Whether the button is disabled. |
| `isLoading` | `boolean` | `false` | Whether the button shows a loading spinner. |
| `icon` | `ReactNode` | — | Icon element. When provided without children, button becomes icon-only with tooltip from label. |
| `isIconOnly` | `boolean` | `false` | When true, renders as a square icon-only button with `label` as the aria-label and an automatic tooltip from the label. |
| `pressedIcon` | `ReactNode` | — | Icon shown when pressed. Falls back to icon if not provided. |
| `children` | `ReactNode` | — | Visible content. If omitted with icon, button becomes icon-only. |
| `tooltip` | `string` | — | Tooltip text shown on hover. |
| `value` | `string` | — | Value identifier when used inside ToggleButtonGroup. Required in groups. |
| `data-testid` | `string` | — | Test selector for automated testing frameworks. |

## Components

### ToggleButtonGroup

undefined



## Theming

| Component class | Preferred data attributes | Props | States |
|-----------------|---------------------------|-------|--------|
| `astryx-toggle-button-group` | — | — | — |

-e 
---

# Token

Token is a small, inline element for representing discrete pieces of associated data, like tags, categories, or selections. Use it to label content, show active filters, or represent removable items like selected recipients in a compose field.

## Example

```tsx
<Token label="Tag" />
<Token label="Status" color="green" />
<Token label="Removable" onRemove={() => {}} />
<Token label="Clickable" onClick={() => {}} />
<Token label="Link" href="/path" />
```

## Anatomy

| Element | Required | Description |
|---------|----------|-------------|
| Icon | No | A leading icon that identifies the token type, like a user avatar or category symbol. |
| Label | Yes | The visible text. Also used as the accessible name when isLabelHidden is true. |
| End content | No | Trailing content after the label, like a count badge or status dot. |
| Remove button | No | An X button that appears when onRemove is provided, letting users dismiss the token. |

## Best Practices

- **Do:** Use color to distinguish categories (for example, green for "Active", red for "Blocked", blue for "In Review") so users can scan status at a glance.
- **Do:** Provide an onRemove callback when tokens represent user selections that can be undone, like filters or multi-select values.
- **Do:** Add a leading icon when it helps identify the token type faster, like a person icon for user tokens or a tag icon for labels.
- **Do:** Keep labels short: one to three words. Tokens truncate with ellipsis when the text overflows.
- **Don't:** Don't use tokens for primary actions or navigation; use Button or Link instead. Tokens are for displaying metadata, not triggering workflows.
- **Don't:** Don't hide the label unless the icon alone is universally understood. A color dot without text is ambiguous.
- **Don't:** Don't mix too many colors in one token group. Stick to two or three meaningful colors so the palette stays scannable.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | `string` | — | Text label displayed inside the token. **(required)** |
| `size` | `'sm' | 'md' | 'lg'` | `'md'` | The size of the token. |
| `color` | `'default' | 'red' | 'orange' | 'yellow' | 'green' | 'teal' | 'cyan' | 'blue' | 'purple' | 'pink' | 'gray'` | `'default'` | Color variant of the token. |
| `icon` | `ReactNode` | — | Optional icon rendered before the label. |
| `isDisabled` | `boolean` | `false` | Whether the token is disabled; reduces opacity and blocks interactions. |
| `onRemove` | `(e: React.MouseEvent) => void` | — | Callback fired when the remove button is clicked. When provided, an X button is rendered inside the token. |
| `onClick` | `(e: React.MouseEvent) => void` | — | Click handler. When provided, the token renders as a <span> container with an invisible <button> inside for accessibility. |
| `href` | `string` | — | Link URL. When provided, the token renders as an <a> element. |
| `description` | `string` | — | Accessible description applied via aria-description on the root element. |
| `endContent` | `ReactNode` | — | Content rendered after the label and before the remove button. |
| `isLabelHidden` | `boolean` | `false` | Visually hides the label using a screen-reader-only clip technique; the label remains accessible. |
| `xstyle` | `StyleXStyles` | — | StyleX styles for layout customization (margins, positioning, sizing). Must be a stylex.create() value, not an inline style object like style={{}}. |

## Theming

| Component class | Preferred data attributes | Props | States |
|-----------------|---------------------------|-------|--------|
| `astryx-token` | `data-color`, `data-size` | color, size | — |

-e 
---

# Tokenizer

Tokenizer is a multi-select input that lets users search, select, and manage multiple items displayed as removable chips. Use it when users need to build a set of selections from a searchable data source, like adding team members, applying tags, or choosing filters.

## Example

```tsx
const [members, setMembers] = useState<UserItem[]>([]);
<Tokenizer
  label="Team members"
  searchSource={userSource}
  value={members}
  onChange={(items, change) => {
    setMembers(items);
    if (change.type === 'add') {
      console.log('Added:', change.item.label);
    }
  }}
  placeholder="Search people..."
/>
<Tokenizer
  label="Tags"
  searchSource={tagSource}
  value={tags}
  onChange={(items) => setTags(items)}
  renderToken={(item, onRemove) => (
    <Token
      label={item.label}
      color={item.auxiliaryData.color}
      onRemove={onRemove}
    />
  )}
  maxEntries={5}
/>
```

## Anatomy

| Element | Required | Description |
|---------|----------|-------------|
| Label | Yes | The visible text above the input describing what the user is selecting. Also used as the accessible name. |
| Token chips | No | Removable chips representing each selected item. Each chip shows a label and a remove button. |
| Search input | Yes | The text input where users type to search the data source. Hides when maxEntries is reached. |
| Dropdown menu | No | The search results list that appears below the input as the user types. |
| End content | No | A trailing slot after the input for action buttons, counts, or other controls. |
| Clear button | No | A button that removes all selected tokens at once. Shown when hasClear is true and tokens are present. |

## Best Practices

- **Do:** Write a placeholder that tells users what they can search for, such as "Search people..." or "Add tags...", so the input is not a blank mystery.
- **Do:** Set maxEntries when the number of selections should be bounded, like limiting a review to 5 approvers.
- **Do:** Use hasCreate for free-form tagging where users need to enter values that do not exist in the search source.
- **Do:** Show validation status with the status prop so users know immediately when a selection is missing or invalid.
- **Don't:** Don't use Tokenizer for single-item selection; use Typeahead instead. Tokenizer is for building sets of two or more items.
- **Don't:** Avoid applying custom colors to individual tokens inside a Tokenizer; use the default token style for visual consistency across the set.
- **Don't:** Don't hide the label; every Tokenizer needs a visible label so users understand what they are selecting. Use isLabelHidden only when surrounding context makes the purpose obvious.
- **Don't:** Wrap a disabled Tokenizer in Tooltip to explain why it is disabled; disabled controls swallow the hover events the wrapper needs. Use the disabledMessage prop instead.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | `string` | — | Accessible label for the input. **(required)** |
| `searchSource` | `SearchSource<T>` | — | Data source providing search and bootstrap methods for populating the dropdown. **(required)** |
| `value` | `T[]` | — | Array of currently selected items. **(required)** |
| `onChange` | `(items: T[], change: TokenizerChange<T>) => void` | — | Called when selection changes. The change argument includes the affected item and type ('add' | 'create' | 'remove' | 'reorder'). **(required)** |
| `placeholder` | `string` | — | Input placeholder text. Only shown when no tokens are selected. |
| `maxEntries` | `number` | — | Maximum number of selections allowed. Input is hidden when the limit is reached. |
| `hasClear` | `boolean` | `false` | Show a clear-all button for bulk removal of all tokens. |
| `renderToken` | `(item: T, onRemove: () => void) => ReactNode` | — | Custom render function for selected tokens. Default renders Token with label and onRemove. |
| `renderItem` | `(item: T) => ReactNode` | — | Custom render function for dropdown items. Default renders TypeaheadItem. |
| `isDisabled` | `boolean` | `false` | Disables the input and all token interactions. |
| `htmlName` | `string` | — | The HTML name attribute for form submissions. Renders one hidden input per selected item id. |
| `disabledMessage` | `string` | — | Explains why the tokenizer is disabled. With isDisabled, shows a tooltip on hover/keyboard focus and keeps the input focusable via aria-disabled (input stays blocked). Use this instead of wrapping a disabled Tokenizer in Tooltip. Disabled controls swallow the hover events an external Tooltip needs. |
| `status` | `InputStatus` | — | Validation status object with type and message for error/warning/success states. |
| `isLabelHidden` | `boolean` | `false` | Visually hides the label while keeping it accessible. |
| `description` | `string` | — | Helper text displayed below the label. |
| `isRequired` | `boolean` | `false` | Marks the field as required. |
| `isOptional` | `boolean` | `false` | Shows an optional indicator on the label. |
| `labelTooltip` | `string` | — | Tooltip text shown on the label. |
| `hasEntriesOnFocus` | `boolean` | `false` | Show bootstrap results on focus before typing. |
| `maxMenuItems` | `number` | `10` | Maximum number of dropdown items to display. |
| `emptySearchResultsText` | `string` | `'No results found'` | Text shown when search returns no results. |
| `hasAutoFocus` | `boolean` | `false` | Auto-focus the input on mount. |
| `size` | `'sm' | 'md' | 'lg'` | `'md'` | Input and token size. |
| `debounceMs` | `number` | `150` | Debounce delay in ms before triggering search. Set to 0 for synchronous sources. |
| `hasCreate` | `boolean` | `false` | Allow users to create new tokens from free-text input. When true, a "Create" option appears in the dropdown for typed text that doesn't match existing results. The onChange change type is 'create' for these items. |
| `onChangeQuery` | `(query: string) => void` | — | Callback fired when the search query text changes. |
| `endContent` | `ReactNode` | — | Content to display at the end of the input row. Useful for buttons, result counts, or other controls. |
| `handleRef` | `React.Ref<TokenizerHandle>` | — | Imperative handle for focus() and blur() control. |
| `xstyle` | `StyleXStyles` | — | StyleX styles for layout customization (margins, positioning, sizing). Must be a stylex.create() value; not an inline style object like style={{}}. |

## Theming

| Component class | Preferred data attributes | Props | States |
|-----------------|---------------------------|-------|--------|
| `astryx-tokenizer` | `data-size` | size | — |

-e 
---

# Toolbar

Toolbar is a horizontal bar with left, center, and right areas. Use it for contextual actions within a content area (above a table, inside a card, or in a panel), not as a page-level header. Set the size once on the toolbar and all buttons, inputs, and tabs inside it match automatically.

## Example

```tsx
dividers={['bottom']}

<Toolbar label="Actions" size="sm"
  startContent={<Button label="Cut" variant="ghost" />}
  endContent={<Button label="Settings" variant="ghost" />}
/>
```

## Best Practices

- **Do:** Put secondary actions like "Back" on the left, and primary actions like "Save" on the right.
- **Do:** Make temporary toolbars like bulk selection visually distinct so users can tell they're contextual, for example with a background color or border.
- **Do:** Visually separate the toolbar from the content below it, with a divider, a background variant, or both.
- **Do:** Use Toolbar as a card header when the header has interactive actions like filter or add; it gives you slot layout, keyboard navigation, and size cascading. If the header is just a title with no actions, a LayoutHeader or Section is enough.
- **Don't:** Put too many actions in one toolbar; move less common items into a MoreMenu.
- **Don't:** Set size on individual child buttons; set it once on the toolbar and it cascades automatically.
- **Don't:** Use Toolbar for app-wide navigation like main menu links or sign out; use TopNav or LayoutHeader for that.

## Components

### Toolbar

General-purpose toolbar container with three content slots and roving tabindex.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | `string` | — | Accessible label for the toolbar, applied as aria-label. **(required)** |
| `startContent` | `ReactNode` | — | Content aligned to the start (left in LTR). |
| `centerContent` | `ReactNode` | — | Centered content. Switches layout to CSS grid (1fr auto 1fr). |
| `endContent` | `ReactNode` | — | Content aligned to the end (right in LTR). |
| `size` | `'sm' | 'md' | 'lg'` | `'md'` | Size of the toolbar. Controls minimum height and coordinates with Button, TextInput, TabList, and Selector; children inherit this size as their default via SizeContext. |
| `gap` | `SpacingStep` | `1` | Gap between items within each slot. |
| `orientation` | `'horizontal' | 'vertical'` | `'horizontal'` | Orientation for keyboard navigation. Controls arrow key direction. |
| `variant` | `SectionVariant` | `'transparent'` | Visual variant passed to Section. |
| `xstyle` | `StyleXStyles` | — | StyleX styles for layout customization. Must be a stylex.create() value. |

## Theming

| Component class | Preferred data attributes | Props | States |
|-----------------|---------------------------|-------|--------|
| `astryx-toolbar` | `data-size` | — | size |

-e 
---

# Tooltip

A short text hint that appears on hover or focus, anchored to a trigger element. Use it to describe icon-only buttons, show the full text of truncated labels, or provide supplementary context without cluttering the UI.

## Example

```tsx
<Tooltip content="Helpful tooltip text" placement="above">
  <Button>Hover me</Button>
</Tooltip>

const tooltip = useTooltip({ placement: 'above' });
<Button ref={tooltip.ref} aria-describedby={tooltip.describedBy}>
  Hover me
</Button>
{tooltip.renderTooltip('Helpful tooltip text')}
```

## Best Practices

- **Do:** Keep tooltip content concise: aim for under 140 characters of plain text.
- **Do:** Add a tooltip to icon-only buttons and controls that lack a visible label.
- **Don't:** Place interactive elements like links or buttons inside a tooltip; use HoverCard or Popover instead.
- **Don't:** Use tooltips for essential information that users must see to complete a task.

## Components

### Tooltip

Component wrapper for tooltip display triggered on hover or focus.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `ReactNode` | — | Trigger element(s) that activate the tooltip. |
| `anchorRef` | `RefObject<HTMLElement>` | — | External anchor ref for sibling mode. |
| `content` | `ReactNode` | — | Tooltip content, typically short text. |
| `placement` | `'above' | 'below' | 'start' | 'end'` | `'above'` | Position relative to the anchor element. |
| `alignment` | `'start' | 'center' | 'end'` | `'center'` | Alignment along the placement axis. |
| `delay` | `number` | `200` | Show delay in milliseconds. |
| `hideDelay` | `number` | `0` | Hide delay in milliseconds. |
| `focusTrigger` | `'auto' | 'always' | 'never'` | `'auto'` | Controls when focus events trigger the tooltip. |
| `isEnabled` | `boolean` | `true` | Enables or disables the tooltip triggers. |
| `onOpenChange` | `(isOpen: boolean) => void` | — | Callback fired when tooltip visibility changes. Called with true when shown and false when hidden. |
| `hasHoverIndication` | `'auto' | boolean` | `'auto'` | Shows a dashed underline on the trigger element. |
| `isDefaultOpen` | `boolean` | — | Whether the tooltip should be shown on mount. Still dismissible. |

## Theming

| Component class | Preferred data attributes | Props | States |
|-----------------|---------------------------|-------|--------|
| `astryx-tooltip` | — | — | — |

-e 
---

# TreeList

An expandable tree structure for displaying hierarchical data with branch connector lines. Use it for file explorers, nested category browsers, or any interface that visualizes parent-child relationships.

## Example

```tsx
<TreeList
  items={[
    { id: 'src', label: 'src', isExpanded: true, children: [
      { id: 'app', label: 'App.tsx' },
      { id: 'index', label: 'index.tsx' },
    ]},
    { id: 'pkg', label: 'package.json' },
  ]}
/>
```

## Best Practices

- **Do:** Provide meaningful labels and icons for each node to make the hierarchy easy to scan.
- **Do:** Pre-expand important branches so users see key content immediately.
- **Don't:** Nest more than 4–5 levels deep; flatten the structure or use a different pattern.
- **Don't:** Use a tree for flat, non-hierarchical data; use a List instead.

## Components

### TreeList

Tree list container. Accepts items data and rendering configuration. Expansion state is managed internally.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `items` | `TreeListItemData[]` | — | Recursive tree item data. Each item has id, label, optional children array, and optional isExpanded boolean for initial state. **(required)** |
| `density` | `'compact' | 'balanced' | 'spacious'` | `'balanced'` | Spacing density for items. |
| `header` | `ReactNode` | — | Header content, associated with the tree via aria-labelledby. |
| `xstyle` | `StyleXStyles` | — | StyleX styles for layout customization. Must be a stylex.create() value. |

## Theming

| Component class | Preferred data attributes | Props | States |
|-----------------|---------------------------|-------|--------|
| `astryx-tree-list` | `data-density` | density | — |
| `astryx-tree-list-item` | `data-selected`, `data-disabled` | — | selected, disabled |

-e 
---

# Typeahead

A searchable input for selecting a single item from a large or dynamic dataset. Results appear as the user types, with support for async data sources, debounced search, and custom item rendering. Use it when the option list is too large for a Selector dropdown.

## Example

```tsx
<BaseTypeahead
  searchSource={source}
  value={selected}
  onChange={setSelected}
  anchorRef={wrapperRef}
  placeholder="Search..."
/>

<Typeahead
  label="Assignee"
  searchSource={userSource}
  value={assignee}
  onChange={setAssignee}
  isDisabled
  disabledMessage="You need the Editor role to change this"
/>

<Typeahead
  label="Assignee"
  searchSource={userSource}
  value={assignee}
  onChange={setAssignee}
  placeholder="Search users..."
/>

<Typeahead searchSource={source} value={v} onChange={setV} label="Search" />
<Typeahead
  searchSource={source}
  value={v}
  onChange={setV}
  label="Search"
  renderItem={(item) => (
    <TypeaheadItem
      item={item}
      icon={<Avatar src={item.auxiliaryData.avatar} size="sm" />}
      description={item.auxiliaryData.role}
    />
  )}
/>
```

## Best Practices

- **Do:** Provide descriptive placeholder text that hints at what users can search for.
- **Do:** Show suggestions on focus when users benefit from seeing popular or recent options before typing.
- **Do:** Add a search delay for remote data sources to avoid excessive network requests.
- **Do:** Use inside InputGroup when the typeahead needs a single-line prefix or suffix addon.
- **Don't:** Use for short, static option lists; use Selector for better discoverability.
- **Don't:** Use for multi-selection; use Tokenizer instead.
- **Don't:** Place multiple Typeaheads adjacent to each other without clear labels differentiating them.
- **Don't:** Wrap a disabled Typeahead in Tooltip to explain why it is disabled; disabled triggers swallow the hover events the wrapper needs. Use the disabledMessage prop instead.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | `string` | — | Accessible label for the input. **(required)** |
| `searchSource` | `SearchSource<T>` | — | Data source providing search and bootstrap methods for populating the dropdown. **(required)** |
| `value` | `T | null` | — | Currently selected item, or null if nothing is selected. **(required)** |
| `onChange` | `(item: T | null) => void` | — | Called when the selection changes. **(required)** |
| `placeholder` | `string` | — | Input placeholder text. |
| `hasEntriesOnFocus` | `boolean` | `false` | Show bootstrap results on focus before typing. |
| `hasClear` | `boolean` | `true` | Show clear button to deselect the current value. |
| `isDisabled` | `boolean` | `false` | Disables the input. |
| `disabledMessage` | `string` | — | Explains why the input is disabled. With isDisabled, shows a tooltip on hover/keyboard focus and keeps the field focusable via aria-disabled (activation stays blocked). Use this instead of wrapping a disabled Typeahead in Tooltip. Disabled controls swallow the hover events an external Tooltip needs. |
| `maxMenuItems` | `number` | `10` | Maximum number of dropdown items to display. |
| `status` | `InputStatus` | — | Validation status object with type and message for error/warning/success states. |
| `renderItem` | `(item: T) => ReactNode` | — | Custom render function for dropdown items. Default renders TypeaheadItem. |
| `isLabelHidden` | `boolean` | `false` | Visually hides the label while keeping it accessible. |
| `description` | `string` | — | Helper text displayed below the label. |
| `isRequired` | `boolean` | `false` | Marks the field as required. |
| `isOptional` | `boolean` | `false` | Shows an optional indicator on the label. |
| `labelTooltip` | `string` | — | Tooltip text shown on the label. |
| `emptySearchResultsText` | `string` | `'No results found'` | Text shown when search returns no results. |
| `hasAutoFocus` | `boolean` | `false` | Auto-focus the input on mount. |
| `size` | `'sm' | 'md' | 'lg'` | `'md'` | Input and token size. |
| `debounceMs` | `number` | `150` | Debounce delay in ms before triggering search. Set to 0 for synchronous sources. |
| `onChangeQuery` | `(query: string) => void` | — | Callback fired when the search query text changes. |
| `onOpenChange` | `(isOpen: boolean) => void` | — | Callback when the dropdown opens or closes. |
| `xstyle` | `StyleXStyles` | — | StyleX styles for layout customization (margins, positioning, sizing). Must be a stylex.create() value: not an inline style object like style={{}}. |

## Components

### BaseTypeahead

undefined



### TypeaheadItem

undefined



## Theming

| Component class | Preferred data attributes | Props | States |
|-----------------|---------------------------|-------|--------|
| `astryx-typeahead` | `data-status` | status | — |
| `astryx-typeahead-dropdown` | — | — | — |
| `astryx-typeahead-item` | — | — | — |

-e 
---

# VisuallyHidden

Renders content in the accessibility tree while hiding it visually. Use for accessible names on icon-only controls, aria-live announcement regions, and supplementary screen-reader context. Deliberately has no styling props; the whole point is to stay invisible.

## Example

```tsx
// Accessible name for an icon-only button
<IconButton icon="trash" label="">
  <VisuallyHidden>Delete incident</VisuallyHidden>
</IconButton>

// Live region for announcements
<VisuallyHidden as="div" aria-live="polite">
  {`Moved ${task} to ${column}`}
</VisuallyHidden>
```

## Best Practices

- **Do:** Use to give icon-only buttons and controls an accessible name that screen readers announce.
- **Do:** Render as a block element (as="div") with aria-live to announce dynamic updates like drag-and-drop or result counts.
- **Don't:** Use it to hide content from everyone; it stays in the accessibility tree; use conditional rendering or `hidden` to remove content entirely.
- **Don't:** Put interactive controls inside it; the content is not visible and cannot receive pointer input.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `ReactNode` | — | Content exposed to assistive technology while hidden from sight. |
| `as` | `ElementType` | `'span'` | HTML tag to render as. Use a block element for live regions. |

