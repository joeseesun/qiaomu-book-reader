# Qiaomu Book Reader · Reader HUD and AI Reading

## 1. Visual theme and atmosphere

The reader is a quiet, content-first Obsidian surface. Reading chrome uses warm-neutral, low-contrast materials that feel attached to the host application while remaining visibly above the page. The memorable action is a matched pair of top and bottom HUD bars that retract without changing page geometry.

## 2. Color roles

- Page colors continue to come from the selected reading theme.
- HUD surfaces use Obsidian `--background-primary`; text and icons use Obsidian text tokens.
- Borders use a single whisper line from `--background-modifier-border`.
- Accent color is reserved for active progress and focus, never decorative chrome.

## 3. Typography

- Chinese UI uses the platform system stack and weights 400 / 500 / 600.
- The visible book title is limited to 18 Unicode characters plus `…`; the full title remains available to assistive technology and pointer users.
- Page and percentage values use tabular numerals.

## 4. Component styling

- Desktop HUD bars: 48px high, 14px outer radius, 6px inset padding.
- Desktop icon and timer controls: 36px high, 10px inner radius, one whisper border and a subtle tinted fill.
- Touch controls: at least 44px hit area.
- Depth uses layered low-opacity shadows instead of one dark shadow.
- Top and bottom bars share the same surface, border, radius, control height and shadow tokens.

## 5. Layout principles

- The HUD is an overlay and never reserves document height.
- Top: back / shortened title / frequent reader actions.
- Desktop frequent actions: timer, reading note, book search, contents, reading settings.
- Overflow contains reader-only secondary actions: highlights and timer reset. It must not contain generic file or external-link commands.
- Bottom: previous page / clickable page-and-percentage status / next page. Scrolling mode collapses to status only.

## 6. Depth hierarchy

- Level 0: book page.
- Level 1: inner icon controls with tinted fill.
- Level 2: matched HUD bars with whisper border and layered shadow.
- Level 3: menus and reader panels supplied by Obsidian.

## 7. Do and do not

- Do keep frequent reading actions one click away on desktop.
- Do preserve complete accessible labels for truncated titles and icon buttons.
- Do use one geometric system for all HUD controls.
- Do not mix generic file actions into the reader overflow menu.
- Do not add persistent explanatory copy to the reading surface.
- Do not let chrome visibility change pagination geometry.

## 8. Responsive behavior

- Desktop shows the full frequent-action set.
- Mobile keeps back, shortened title, timer and one reader-only overflow menu; note, search, contents, highlights, timer reset and settings remain in that menu to protect the title and 44px targets.
- Bottom bar spans the available phone width while respecting safe-area insets.
- No horizontal overflow at 390px.

## 9. Motion philosophy

- HUD reveal/retract animates only opacity and transform for 220ms with a strong ease-out curve.
- Hover and press feedback lasts 100–150ms and never delays the action.
- Reduced motion keeps a short opacity change and removes large translation.
- Focused controls, open menus, panels and selection tools prevent automatic retraction.

## 10. AI reading composer

- Provider and model are stable settings, not per-message controls. The reading chat header shows only the current book; the settings button owns provider, model and reasoning changes.
- A new chat opened from a text PDF attaches the full extractable document; EPUB and FB2 attach the current page. A text selection replaces that default for the next turn. There is no manual “update to current page” control in the composer.
- When the AI sidebar is already open, selecting text in the reader immediately replaces the pending page source with that selection. Ordinary text selection does not force the sidebar open; the selection wand remains the explicit opener when the sidebar is closed.
- Attached selection/page context shows the actual source text in a fully outlined quote card. It is clamped to three lines; source longer than 120 characters or containing a line break expands on demand and scrolls internally. Full-document context stays compact and non-expandable so a large PDF does not inflate the sidebar DOM.
- Context metadata identifies `PDF 全文`, `PDF 全文（已精简）`, `当前页` or `选文`, page position and character count. A separate remove button changes the next message only.
- Sent messages retain their source quote, clamped to two lines in the user bubble and expandable when long. Never replace the source with a generic `选文` badge.
- Custom quick prompts sit directly above the input, remain available after a selection is attached, and execute with one click. More than three prompts move into a compact overflow menu.
- Typing `/` opens the same custom prompt library. Typing filters by prompt name; arrow keys move, Enter executes and Escape closes the menu.
- The composer uses the primary background, a visible neutral border and an accent focus ring. Disabled, ready and stop states must be visually distinct.
- Keep only the placeholder inside the field. Do not reserve a permanent row for keyboard instructions such as `Enter 发送`.
- Assistant answers keep streaming while the same message is re-rendered as Markdown in throttled increments. Final output must not jump from plain text to formatted text.
- Use Obsidian's renderer and lifecycle for headings, links, nested lists, blockquotes, fenced code, task lists, strikethrough, footnotes, math and diagrams. GFM tables get a message-local horizontal scroll container so the sidebar itself never overflows.
- User messages use only a quiet accent tint; saturated brand colour is reserved for actions and focus. Assistant answers stay in the page flow without a full card border, while tables, code and quotes keep their own local boundaries.
- Task lists reserve a fixed checkbox lane instead of pulling controls into the sidebar edge. Saving an answer makes the Markdown answer the note body and keeps the attached source below it as a reference.

### AI conversation recovery and input

- Saved answer titles come from the answer's topic heading, emphasized phrase or content sentence, never a generic quick question. Suggest locally without a model request, keep the title editable and preserve the full Markdown body. Saved-note actions remember their target and never switch source books midway.
- Drafts are scoped to books during the sidebar lifetime. Deleting the active history resets it without re-saving the deleted conversation. Explicitly detached sources stay detached when history is normalized.
- Use the existing host colors, 12px rounded controls and quiet 1px boundaries; draw on Claude's 1.6 body line-height and restrained secondary controls without importing its branding or fonts.
- Desktop and mobile share input behavior: composition-confirming Enter never sends, Shift+Enter stays a newline on desktop, and input typed during generation is never replaced by a prior failure.
- Stopping or losing a connection retains generated Markdown with an explicit interrupted label, copy/save actions, and its source. Persisted history retains that label.
- Copy and save remain visible for every stored answer without hovering; only the latest answer can be regenerated. A stale action must never target a different turn. Action targets are at least 32px tall on desktop and 44px on coarse-pointer devices.
- Reading earlier messages pauses automatic following, including on the final frame. A keyboard-accessible “Back to latest reply” button appears only away from the bottom; scrolling is confined to the chat log.

## 11. PDF fixed-layout architecture

PDF is a page description format, not a flowing-book format. The reader must
therefore preserve each page as the source of visual truth instead of rebuilding
it from extracted text.

### Rendering stack

Each PDF page uses one stable shell with three layers:

1. **Page image layer** - PDF.js renders the complete page to a lazy JPEG-backed
   canvas snapshot. This preserves charts, tables, vector graphics, typography,
   headers, footers and mixed writing directions.
2. **Text layer** - when PDF.js returns reliable text, its official `TextLayer`
   is positioned over the page image. The text remains visually transparent but
   selectable, searchable and available to highlights and AI context.
3. **Reader action layer** - selection actions and later PDF-specific actions sit
   above both content layers and never alter page geometry. Notes remain a
   single book-level destination in the global reader toolbar.

The page shell is identical for text, mixed and scan documents. Capabilities are
decided per page, because a single PDF can contain both native text pages and
scanned inserts.

### Capability matrix

| Capability | Reliable text layer | Scan / unreadable text |
| --- | --- | --- |
| Original visual page | Yes | Yes |
| Select and copy | Yes | No |
| Persistent highlight and comment | Yes | No |
| Book search | Yes | No |
| Full-document or selected-text AI context | Yes | No |
| Book note, backlink, bookmark and progress | Yes | Yes |

Vision-model questions and OCR are future capability-gated additions. They must
not be presented as available when the active provider accepts text only.

### Pagination and progress

- In page mode, every PDF page forces a column break. One-column mode shows one
  PDF page; two-column mode shows a two-page spread.
- In scrolling mode, pages form a vertical stack and image rendering stays
  viewport-lazy.
- The PDF text layer is one reader anchor per source page. This keeps progress,
  search results, highlights and note backlinks page-stable across screen sizes.
- Scan pages still have page-number progress even though they have no text
  anchor.

### Page zoom

- PDF zoom is separate from flowing-book typography. `100%` means the original
  page is fitted to the current page slot; zoom does not reconstruct or reflow
  the PDF.
- The page image, official text layer and persistent highlight geometry share
  one transform, so selection and annotations stay aligned at every scale.
- Desktop exposes a compact decrease / percentage / increase group. The centre
  value resets to fit-page. Mobile keeps the same commands in the reader menu
  and treats two-finger pinch as the primary path.
- `Cmd/Ctrl +`, `Cmd/Ctrl -` and `Cmd/Ctrl 0` provide keyboard parity. A
  modifier-wheel gesture follows the trackpad continuously.
- Zoom is bounded to 50%–300%. Button steps are 25%; gesture input is continuous.
  A zoomed paged view becomes a contained pan surface, while continuous reading
  keeps one shared horizontal scroller. Resetting to 100% restores ordinary
  side-tap and swipe page turning.

### Performance and failure handling

- Page pixels render only for the current viewport and a small prefetch window.
- Far-away page pixels are released; lightweight page shells and text layers
  remain so search and highlight anchors stay stable.
- Full-page rendering keeps the existing time budget and reduced-resolution
  retry.
- Every non-recoverable rendering error becomes a visible page-local error with
  a console diagnostic. A failure must never degrade into an unexplained blank
  reader.

### Migration and rollout

- The legacy “show pictures on text pages” preference is retired because every
  PDF page now preserves its original appearance.
- Existing EPUB and FB2 extraction, typography and pagination remain unchanged.
- Existing text highlights keep their quote-based fallback. PDF highlights now
  anchor to the stable per-page text layer rather than reflowed paragraphs.
- Acceptance uses one text-heavy PDF, one chart/table report, one image-only
  scan, one Traditional Chinese CMap PDF, desktop page mode, desktop scroll mode
  and a narrow mobile viewport.
