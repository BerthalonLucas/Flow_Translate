import type * as React from 'react';

/** Lucide 1.43 icon names shipped in the bundle (node data copied verbatim, ISC). */
export type IconName = 'copy' | 'check' | 'ellipsis' | 'x' | 'pin' | 'pin-off' | 'loader-circle' | 'eye' | 'eye-off' | 'clipboard-paste' | 'rotate-ccw' | 'refresh-cw' | 'settings-2' | 'info' | 'triangle-alert' | 'circle-alert' | 'circle-check' | 'languages' | 'spell-check' | 'briefcase-business' | 'wand' | 'plus' | 'trash-2' | 'chevron-down' | 'keyboard' | 'server' | 'shield-check' | 'type' | 'power' | 'history';
export type TextSize = 'normal' | 'large' | 'xlarge';
export type Tone = 'info' | 'success' | 'warning' | 'danger';

// ——— Brand ———
export interface IconProps { name: IconName; /** px, default 16 */ size?: number; /** default 1.75 (2.25 for loader-circle) */ strokeWidth?: number; /** turns once a second, linear */ spin?: boolean; className?: string }
/** Stroke icon drawn with currentColor. Decorative: always aria-hidden; the control carries the label. */
export declare function Icon(props: IconProps): React.ReactElement;
export interface MarkProps { /** px, default 32 */ size?: number; /** tile: graphite square (app icon); glyph: lines in currentColor, band always signal */ variant?: 'tile' | 'glyph'; /** accessible name; omit when a text name sits beside the mark */ title?: string; className?: string }
export declare function Mark(props: MarkProps): React.ReactElement;

// ——— Overlay (always graphite) ———
export interface MenuItem { label: string; icon?: IconName; /** right-aligned key hint, e.g. « Échap » */ hint?: string; disabled?: boolean; /** draws the separator above this entry (only before Fermer) */ separatorBefore?: boolean; /** preview only: paints the keyboard highlight */ highlighted?: boolean; onSelect?: () => void }
export interface OverlayProps {
  form?: 'pending' | 'short' | 'reader';
  /** anchored: near the selection; bottom: centred at the bottom of the cursor's screen (the reader band, and any short glass without an anchor: synthetic copy, « Revoir le dernier résultat », a long source with a short result). Default: bottom for reader, anchored otherwise. */
  placement?: 'anchored' | 'bottom';
  /** result text (or GlassError / PartialNote); leave empty with busy for a relaunch */
  children?: React.ReactNode;
  /** action name shown in the pill: ExecutionInfo.actionName as is (60 characters at most, ellipsis past 132 px); tagTitle « Nom de l'action · moteur » */
  tag?: string; tagTitle?: string;
  size?: TextSize; original?: React.ReactNode;
  copied?: boolean; pinned?: boolean; disabled?: boolean;
  /** relaunch from an open glass (Réessayer, Relancer en …): the glass keeps its form and placement, the spinner takes the first line, Copier is disabled */
  busy?: boolean;
  /** open menu entries; the menu hangs under the pill when anchored, above it (6 px gap) at the bottom */
  menuItems?: MenuItem[] | null;
  /** a small Notice under the glass, right-aligned (above the glass at the bottom); hidden while the menu is open */
  feedback?: React.ReactNode;
  edge?: 'top' | 'middle' | 'bottom'; indicator?: { top: number; height: number }; maxHeight?: number;
  reveal?: boolean; dimmed?: boolean; slow?: boolean; done?: boolean;
  onCopy?: () => void; onPin?: () => void; onMenu?: () => void; onClose?: () => void;
  style?: React.CSSProperties;
}
/** One overlay session as the product lays it out: glass, pill biting its upper-right edge, menu, feedback. */
export declare function Overlay(props: OverlayProps): React.ReactElement;
export interface GlassProps { /** reader: the bottom band (Display 22/24/26, no max height) */ form?: 'short' | 'reader'; size?: TextSize; original?: React.ReactNode; children?: React.ReactNode; /** scroll position drives the edge fade */ edge?: 'top' | 'middle' | 'bottom'; indicator?: { top: number; height: number }; maxHeight?: number; reveal?: boolean; dimmed?: boolean; /** with no children: spinner on the first line */ busy?: boolean; label?: string; style?: React.CSSProperties }
/** The reading surface: text only, 28 px corners, no header, no footer, no visible scrollbar. */
export declare function Glass(props: GlassProps): React.ReactElement;
export interface GlassErrorProps { title: string; detail?: string; tone?: 'danger' | 'warning'; onRetry?: () => void; onSettings?: () => void }
export declare function GlassError(props: GlassErrorProps): React.ReactElement;
export declare function PartialNote(props: { children: React.ReactNode }): React.ReactElement;
export interface ActionPillProps { tag?: string; tagTitle?: string; copied?: boolean; /** reader form only */ pinnable?: boolean; pinned?: boolean; menuOpen?: boolean; disabled?: boolean; /** lay out in flow instead of absolutely (docs, pending form) */ static?: boolean; onCopy?: () => void; onPin?: () => void; onMenu?: () => void; onClose?: () => void }
export declare function ActionPill(props: ActionPillProps): React.ReactElement;
export interface WaitPillProps { /** after 1.5 s of work: the signal sweep */ slow?: boolean; /** Replace mode: pasted, shows the check 900 ms */ done?: boolean; doneLabel?: string }
export declare function WaitPill(props: WaitPillProps): React.ReactElement;
export declare function OverlayMenu(props: { items: MenuItem[]; style?: React.CSSProperties }): React.ReactElement;
export interface NoticeProps { tone?: Tone; size?: 'md' | 'sm'; icon?: IconName; children: React.ReactNode; style?: React.CSSProperties }
/** A message in a pill: alone at the bottom of the cursor's screen (md, 388 px and two lines at most), or as action feedback under the glass, above it at the bottom (sm). Never clickable. */
export declare function Notice(props: NoticeProps): React.ReactElement;

// ——— Settings controls (theme-aware) ———
export interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; size?: 'md' | 'sm'; icon?: IconName; children?: React.ReactNode }
/** One primary per page at most. Labels are infinitive verbs. */
export declare function Button(props: ButtonProps): React.ReactElement;
export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> { icon: IconName; label: string; variant?: 'danger'; iconSize?: number }
export declare function IconButton(props: IconButtonProps): React.ReactElement;
export interface SegmentedOption<T extends string> { value: T; label: string }
export interface SegmentedProps<T extends string> { label: string; value: T; options: SegmentedOption<T>[]; onChange?: (value: T) => void; size?: 'md' | 'sm' }
/** A radiogroup of 2 to 4 short options; arrows move the choice, the change saves at once. */
export declare function Segmented<T extends string>(props: SegmentedProps<T>): React.ReactElement;
export interface SwitchProps { label: string; checked: boolean; onChange?: (checked: boolean) => void; disabled?: boolean }
export declare function Switch(props: SwitchProps): React.ReactElement;
export interface TextFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> { label: string; hint?: string; error?: string; invalid?: boolean; onChange?: (value: string) => void }
export declare function TextField(props: TextFieldProps): React.ReactElement;
export interface SelectFieldProps { label?: string; ariaLabel?: string; hint?: string; error?: string; value: string; options: { value: string; label: string }[]; onChange?: (value: string) => void }
export declare function SelectField(props: SelectFieldProps): React.ReactElement;
export interface TextAreaProps { label: string; value: string; onChange?: (value: string) => void; hint?: string; error?: string | null; /** characters, default 8000 */ max?: number; rows?: number }
export declare function TextArea(props: TextAreaProps): React.ReactElement;
export interface KeycapsProps { /** « Ctrl+Alt+T » */ shortcut?: string; state?: 'idle' | 'recording' | 'empty'; /** other active shortcuts of the same action */ more?: number }
export declare function Keycaps(props: KeycapsProps): React.ReactElement;
export interface StatusBadgeProps { tone?: 'neutral' | 'success' | 'danger' | 'checking'; children: React.ReactNode }
export declare function StatusBadge(props: StatusBadgeProps): React.ReactElement;
export declare function Badge(props: { tone?: 'neutral' | 'signal'; children: React.ReactNode }): React.ReactElement;
export declare function Callout(props: { tone?: 'info' | 'danger'; icon?: IconName; children: React.ReactNode }): React.ReactElement;
export interface SaveStatusProps { status?: 'saved' | 'saving' | 'just-saved' | 'error'; /** the reason from Rust, as a tooltip */ message?: string; /** set by SettingsWindow when a danger Callout already announces the reason: the block drops role="alert" for aria-live="polite" */ announced?: boolean; onRetry?: () => void }
export declare function SaveStatus(props: SaveStatusProps): React.ReactElement;

// ——— Settings structure ———
export type SettingsPage = 'actions' | 'reading' | 'engines' | 'privacy';
export interface SettingsWindowProps { page: SettingsPage; onNavigate?: (page: SettingsPage) => void; saveStatus?: SaveStatusProps['status']; /** with saveStatus « error »: the reason, shown as a danger Callout at the top of the page */ saveError?: string; onRetry?: () => void; onClose?: () => void; onQuit?: () => void; version?: string; /** forces the tab layout; otherwise a container query switches under 640 px */ narrow?: boolean; children: React.ReactNode; style?: React.CSSProperties }
export declare function SettingsWindow(props: SettingsWindowProps): React.ReactElement;
export declare function TitleBar(props: { page?: SettingsPage; saveStatus?: SaveStatusProps['status']; saveError?: string; /** see SaveStatusProps.announced */ announced?: boolean; onRetry?: () => void; onClose?: () => void }): React.ReactElement;
export declare function SettingsNav(props: { current: SettingsPage; onNavigate?: (page: SettingsPage) => void; onQuit?: () => void; version?: string }): React.ReactElement;
export declare function PageHeader(props: { title: string; description?: string; action?: React.ReactNode }): React.ReactElement;
export declare function SettingGroup(props: { title?: string; /** children stack without the card */ plain?: boolean; children: React.ReactNode }): React.ReactElement;
export interface SettingRowProps { label: string; description?: string; icon?: IconName; children?: React.ReactNode }
export declare function SettingRow(props: SettingRowProps): React.ReactElement;

// ——— Settings blocks ———
export interface ActionSummary { name: string; glyph?: IconName; builtIn?: boolean; isDefault?: boolean }
export interface BindingSummary { id?: string; shortcut: string; output: 'display' | 'replace'; enabled: boolean }
export interface ActionRowProps { action: ActionSummary; bindings: BindingSummary[]; open?: boolean; onToggle?: () => void; /** the editor: name, bindings, instruction, footer */ children?: React.ReactNode }
export declare function ActionRow(props: ActionRowProps): React.ReactElement;
export interface ShortcutBindingProps { binding: BindingSummary; recording?: boolean; onRecord?: () => void; onToggle?: (enabled: boolean) => void; onOutput?: (output: 'display' | 'replace') => void; onRemove?: () => void }
export declare function ShortcutBinding(props: ShortcutBindingProps): React.ReactElement;
export interface EngineCardProps { name: string; isDefault?: boolean; status?: 'unknown' | 'checking' | 'ok' | 'error'; latency?: number; message?: string; endpoint: string; model: string; apiKey: string; onCheck?: () => void; onEndpoint?: (v: string) => void; onModel?: (v: string) => void; onApiKey?: (v: string) => void }
export declare function EngineCard(props: EngineCardProps): React.ReactElement;
export interface HistoryEntryView { id: string; /** the result text, one line */ text: string; /** « Corriger · Rapide · 17 sept. 09:12 » */ meta: string }
export declare function HistoryList(props: { entries: HistoryEntryView[]; onRemove?: (id: string) => void; onClear?: () => void }): React.ReactElement;

declare global {
  interface Window {
    FlowTranslate: {
      Icon: typeof Icon; Mark: typeof Mark;
      Overlay: typeof Overlay; Glass: typeof Glass; GlassError: typeof GlassError; PartialNote: typeof PartialNote; ActionPill: typeof ActionPill; WaitPill: typeof WaitPill; OverlayMenu: typeof OverlayMenu; Notice: typeof Notice;
      Button: typeof Button; IconButton: typeof IconButton; Segmented: typeof Segmented; Switch: typeof Switch; TextField: typeof TextField; SelectField: typeof SelectField; TextArea: typeof TextArea; Keycaps: typeof Keycaps;
      StatusBadge: typeof StatusBadge; Badge: typeof Badge; Callout: typeof Callout; SaveStatus: typeof SaveStatus;
      SettingsWindow: typeof SettingsWindow; TitleBar: typeof TitleBar; SettingsNav: typeof SettingsNav; PageHeader: typeof PageHeader; SettingGroup: typeof SettingGroup; SettingRow: typeof SettingRow;
      ActionRow: typeof ActionRow; ShortcutBinding: typeof ShortcutBinding; EngineCard: typeof EngineCard; HistoryList: typeof HistoryList;
      icons: IconName[];
    };
  }
}
