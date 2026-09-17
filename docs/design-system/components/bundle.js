/* @ds-bundle: {"format":4,"namespace":"FlowTranslate","components":[{"name":"Mark"},{"name":"Icon"},{"name":"Overlay"},{"name":"Glass"},{"name":"ActionPill"},{"name":"WaitPill"},{"name":"OverlayMenu"},{"name":"Notice"},{"name":"SettingsWindow"},{"name":"SettingRow"},{"name":"Button"},{"name":"Segmented"},{"name":"Switch"},{"name":"TextField"},{"name":"TextArea"},{"name":"Keycaps"},{"name":"StatusBadge"},{"name":"Callout"},{"name":"SaveStatus"},{"name":"ActionRow"},{"name":"EngineCard"},{"name":"HistoryList"}]} */
/* FlowTranslate 1.0 design system — hand-written components over window.React. Icons: lucide 1.43.0 (ISC), node data copied verbatim. */
(function () {
  'use strict';
  var ICONS = {"copy":[["rect",{"width":"14","height":"14","x":"8","y":"8","rx":"2","ry":"2"}],["path",{"d":"M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"}]],"check":[["path",{"d":"M20 6 9 17l-5-5"}]],"ellipsis":[["circle",{"cx":"12","cy":"12","r":"1"}],["circle",{"cx":"19","cy":"12","r":"1"}],["circle",{"cx":"5","cy":"12","r":"1"}]],"x":[["path",{"d":"M18 6 6 18"}],["path",{"d":"m6 6 12 12"}]],"pin":[["path",{"d":"M12 17v5"}],["path",{"d":"M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"}]],"pin-off":[["path",{"d":"M12 17v5"}],["path",{"d":"M15 9.34V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H7.89"}],["path",{"d":"m2 2 20 20"}],["path",{"d":"M9 9v1.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h11"}]],"loader-circle":[["path",{"d":"M21 12a9 9 0 1 1-6.219-8.56"}]],"eye":[["path",{"d":"M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"}],["circle",{"cx":"12","cy":"12","r":"3"}]],"eye-off":[["path",{"d":"M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"}],["path",{"d":"M14.084 14.158a3 3 0 0 1-4.242-4.242"}],["path",{"d":"M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"}],["path",{"d":"m2 2 20 20"}]],"clipboard-paste":[["path",{"d":"M11 14h10"}],["path",{"d":"M16 4h2a2 2 0 0 1 2 2v1.344"}],["path",{"d":"m17 18 4-4-4-4"}],["path",{"d":"M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 1.793-1.113"}],["rect",{"x":"8","y":"2","width":"8","height":"4","rx":"1"}]],"rotate-ccw":[["path",{"d":"M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"}],["path",{"d":"M3 3v5h5"}]],"refresh-cw":[["path",{"d":"M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"}],["path",{"d":"M21 3v5h-5"}],["path",{"d":"M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"}],["path",{"d":"M8 16H3v5"}]],"settings-2":[["path",{"d":"M14 17H5"}],["path",{"d":"M19 7h-9"}],["circle",{"cx":"17","cy":"17","r":"3"}],["circle",{"cx":"7","cy":"7","r":"3"}]],"info":[["circle",{"cx":"12","cy":"12","r":"10"}],["path",{"d":"M12 16v-4"}],["path",{"d":"M12 8h.01"}]],"triangle-alert":[["path",{"d":"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"}],["path",{"d":"M12 9v4"}],["path",{"d":"M12 17h.01"}]],"circle-alert":[["circle",{"cx":"12","cy":"12","r":"10"}],["line",{"x1":"12","x2":"12","y1":"8","y2":"12"}],["line",{"x1":"12","x2":"12.01","y1":"16","y2":"16"}]],"circle-check":[["circle",{"cx":"12","cy":"12","r":"10"}],["path",{"d":"m16 9-5.5 5.5L8 12"}]],"languages":[["path",{"d":"m5 8 6 6"}],["path",{"d":"m4 14 6-6 2-3"}],["path",{"d":"M2 5h12"}],["path",{"d":"M7 2h1"}],["path",{"d":"m22 22-5-10-5 10"}],["path",{"d":"M14 18h6"}]],"spell-check":[["path",{"d":"m20 15-5.5 5.5L12 18"}],["path",{"d":"m4 16 6-12 5.115 10.23"}],["path",{"d":"M6 12h8"}]],"briefcase-business":[["path",{"d":"M12 12h.01"}],["path",{"d":"M16 6V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"}],["path",{"d":"M22 13a18.15 18.15 0 0 1-20 0"}],["rect",{"width":"20","height":"14","x":"2","y":"6","rx":"2"}]],"wand":[["path",{"d":"M15 4V2"}],["path",{"d":"M15 16v-2"}],["path",{"d":"M8 9h2"}],["path",{"d":"M20 9h2"}],["path",{"d":"M17.8 11.8 19 13"}],["path",{"d":"M15 9h.01"}],["path",{"d":"M17.8 6.2 19 5"}],["path",{"d":"m3 21 9-9"}],["path",{"d":"M12.2 6.2 11 5"}]],"plus":[["path",{"d":"M5 12h14"}],["path",{"d":"M12 5v14"}]],"trash-2":[["path",{"d":"M10 11v6"}],["path",{"d":"M14 11v6"}],["path",{"d":"M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"}],["path",{"d":"M3 6h18"}],["path",{"d":"M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"}]],"chevron-down":[["path",{"d":"m6 9 6 6 6-6"}]],"keyboard":[["path",{"d":"M10 8h.01"}],["path",{"d":"M12 12h.01"}],["path",{"d":"M14 8h.01"}],["path",{"d":"M16 12h.01"}],["path",{"d":"M18 8h.01"}],["path",{"d":"M6 8h.01"}],["path",{"d":"M7 16h10"}],["path",{"d":"M8 12h.01"}],["rect",{"width":"20","height":"16","x":"2","y":"4","rx":"2"}]],"server":[["rect",{"width":"20","height":"8","x":"2","y":"2","rx":"2","ry":"2"}],["rect",{"width":"20","height":"8","x":"2","y":"14","rx":"2","ry":"2"}],["line",{"x1":"6","x2":"6.01","y1":"6","y2":"6"}],["line",{"x1":"6","x2":"6.01","y1":"18","y2":"18"}]],"shield-check":[["path",{"d":"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"}],["path",{"d":"m9 12 2 2 4-4"}]],"type":[["path",{"d":"M12 4v16"}],["path",{"d":"M4 7V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2"}],["path",{"d":"M9 20h6"}]],"power":[["path",{"d":"M12 2v10"}],["path",{"d":"M18.4 6.6a9 9 0 1 1-12.77.04"}]],"history":[["path",{"d":"M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"}],["path",{"d":"M3 3v5h5"}],["path",{"d":"M12 7v5l4 2"}]]};
  var React = window.React;
  var h = React.createElement;
  var useState = React.useState;
  var cx = function () { return Array.prototype.filter.call(arguments, Boolean).join(' '); };
  var omit = function (props, keys) { var out = {}; for (var k in props) if (keys.indexOf(k) < 0) out[k] = props[k]; return out; };

  // ——— Brand ———
  function Icon(props) {
    var node = ICONS[props.name] || [];
    var size = props.size || 16;
    return h('svg', { className: cx('ft-svg', props.spin && 'ft-spin', props.className), width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: props.strokeWidth || (props.name === 'loader-circle' ? 2.25 : 1.75), strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true', focusable: 'false' },
      node.map(function (part, i) {
        var attrs = {}; for (var k in part[1]) attrs[k.replace(/-([a-z])/g, function (_, c) { return c.toUpperCase(); })] = part[1][k];
        attrs.key = i; return h(part[0], attrs);
      }));
  }

  // The mark: three lines of text, the middle one a highlighter stroke with a chisel tip.
  function Mark(props) {
    var size = props.size || 32;
    var glyph = props.variant === 'glyph';
    return h('svg', { className: cx('ft-svg', props.className), width: size, height: size, viewBox: '0 0 512 512', role: props.title ? 'img' : undefined, 'aria-label': props.title, 'aria-hidden': props.title ? undefined : 'true' },
      glyph ? null : h('rect', { width: 512, height: 512, rx: 128, fill: '#16171b' }),
      h('path', { d: 'M144 170H368', stroke: glyph ? 'currentColor' : '#eceef1', strokeWidth: 40, strokeLinecap: 'round', fill: 'none' }),
      h('path', { d: 'M140 228H392L376 284H124Z', fill: '#ffd24a', stroke: '#ffd24a', strokeWidth: 12, strokeLinejoin: 'round' }),
      h('path', { d: 'M144 342H272', stroke: glyph ? 'currentColor' : '#eceef1', strokeWidth: 40, strokeLinecap: 'round', fill: 'none' }));
  }

  // ——— Overlay ———
  // A relaunch from an open glass keeps its form: busy with no text puts the spinner on the first line.
  function Glass(props) {
    var form = props.form || 'short';
    var copyProps = { className: 'ft-glass-copy', 'data-size': props.size || 'normal', 'data-edge': props.edge, tabIndex: 0, role: 'document', 'aria-label': props.label || 'Résultat', 'aria-busy': props.busy || undefined };
    var waiting = props.busy && !props.children;
    return h('div', { className: 'ft-glass', 'data-form': form, 'data-reveal': props.reveal ? 'true' : undefined, 'data-dimmed': props.dimmed ? 'true' : undefined, style: props.maxHeight ? Object.assign({}, props.style, { maxHeight: props.maxHeight }) : props.style },
      h('div', { className: 'ft-glass-scroll' },
        h('div', copyProps,
          props.original ? h('div', { className: 'ft-original' }, h('span', { className: 'ft-original-label' }, 'Original'), props.original) : null,
          waiting ? h('span', { className: 'ft-glass-wait', role: 'img', 'aria-label': 'Traitement en cours' }, h(Icon, { name: 'loader-circle', size: 18, spin: true }))
            : h('span', { className: props.reveal ? 'ft-reveal' : undefined }, props.children)),
        props.indicator ? h('div', { className: 'ft-scroll-indicator', 'data-visible': 'true', 'aria-hidden': 'true' }, h('div', { className: 'ft-scroll-thumb', style: { top: props.indicator.top + '%', height: props.indicator.height + '%' } })) : null));
  }

  function GlassError(props) {
    return h('span', { className: 'ft-glass-status', 'data-tone': props.tone || 'danger', role: 'alert' },
      h(Icon, { name: props.tone === 'warning' ? 'triangle-alert' : 'circle-alert', size: 16 }),
      h('span', null, h('span', { className: 'ft-glass-status-title' }, props.title), props.detail ? h('span', { className: 'ft-glass-status-detail' }, props.detail) : null),
      props.onRetry || props.onSettings ? h('span', { className: 'ft-glass-actions' },
        props.onRetry ? h('button', { type: 'button', className: 'ft-chip', 'data-variant': 'primary', onClick: props.onRetry }, h(Icon, { name: 'rotate-ccw', size: 13 }), 'Réessayer') : null,
        props.onSettings ? h('button', { type: 'button', className: 'ft-chip', onClick: props.onSettings }, 'Réglages') : null) : null);
  }

  function PartialNote(props) {
    return h('span', { className: 'ft-partial', role: 'status' }, h(Icon, { name: 'triangle-alert', size: 13 }), props.children);
  }

  function GlassButton(props) {
    var rest = omit(props, ['icon', 'label', 'iconSize', 'done']);
    return h('button', Object.assign({ type: 'button', 'aria-label': props.label, title: props.label, 'data-done': props.done ? 'true' : undefined }, rest, { className: cx('ft-gbtn', props.className) }), h(Icon, { name: props.icon, size: props.iconSize || 15 }));
  }

  function ActionPill(props) {
    return h('div', { className: 'ft-pill', role: 'toolbar', 'aria-label': 'Actions du résultat', 'data-static': props.static ? 'true' : undefined },
      props.tag ? h('span', { className: 'ft-pill-tag', title: props.tagTitle || props.tag }, h('span', null, props.tag)) : null,
      props.tag ? h('span', { className: 'ft-pill-rule', 'aria-hidden': 'true' }) : null,
      h(GlassButton, { key: props.copied ? 'done' : 'copy', icon: props.copied ? 'check' : 'copy', label: props.copied ? 'Copié' : 'Copier le résultat', done: props.copied, disabled: props.disabled, onClick: props.onCopy }),
      props.pinnable ? h(GlassButton, { icon: 'pin', iconSize: 14, label: props.pinned ? 'Détacher' : 'Épingler', 'aria-pressed': Boolean(props.pinned), onClick: props.onPin }) : null,
      h(GlassButton, { icon: 'ellipsis', label: 'Plus d’options', 'aria-haspopup': 'menu', 'aria-expanded': Boolean(props.menuOpen), onClick: props.onMenu }),
      h(GlassButton, { icon: 'x', iconSize: 13, label: 'Fermer', onClick: props.onClose }));
  }

  function WaitPill(props) {
    return h('span', { className: 'ft-wait', role: 'img', 'aria-label': props.done ? (props.doneLabel || 'Sélection remplacée') : 'Traitement en cours', 'data-slow': props.slow && !props.done ? 'true' : undefined, 'data-done': props.done ? 'true' : undefined },
      props.done ? h(Icon, { key: 'done', name: 'check', size: 16, strokeWidth: 2 }) : h(Icon, { key: 'spin', name: 'loader-circle', size: 18, spin: true }));
  }

  function OverlayMenu(props) {
    return h('div', { className: 'ft-menu', role: 'menu', 'aria-label': 'Options du résultat', style: props.style },
      (props.items || []).map(function (item, i) {
        return h(React.Fragment, { key: item.label },
          item.separatorBefore ? h('div', { className: 'ft-menu-sep', role: 'separator' }) : null,
          h('button', { type: 'button', role: 'menuitem', className: 'ft-menu-item', disabled: item.disabled, 'data-highlighted': item.highlighted ? '' : undefined, onClick: item.onSelect },
            item.icon ? h(Icon, { name: item.icon, size: 15 }) : null, h('span', null, item.label), item.hint ? h('span', { className: 'ft-menu-hint' }, item.hint) : null));
      }));
  }

  function Notice(props) {
    var icons = { info: 'info', success: 'check', warning: 'triangle-alert', danger: 'circle-alert' };
    var tone = props.tone || 'info';
    return h('p', { className: 'ft-notice', 'data-tone': tone, 'data-size': props.size, role: tone === 'danger' ? 'alert' : 'status', style: props.style },
      h(Icon, { name: props.icon || icons[tone], size: props.size === 'sm' ? 13 : 15 }), h('span', null, props.children));
  }

  // One session as the product lays it out: glass, the pill biting its edge. Placement is not form:
  // anchored near the selection, the menu opens under the pill and feedback stands under the glass;
  // at the bottom of the screen (the reader band, or any capture without an anchor) both go above.
  function Overlay(props) {
    var form = props.form || 'short';
    var placement = props.placement || (form === 'reader' ? 'bottom' : 'anchored');
    var bottom = placement === 'bottom';
    if (form === 'pending') return h('div', { className: 'ft-overlay', 'data-form': 'pending', 'data-placement': placement, style: props.style }, h(WaitPill, { slow: props.slow, done: props.done }));
    var menu = props.menuItems ? h(OverlayMenu, { items: props.menuItems, style: bottom ? { position: 'absolute', right: 16, bottom: 'calc(100% + 6px)', zIndex: 3 } : { position: 'absolute', right: 16, top: 34, zIndex: 3 } }) : null;
    return h('div', { className: 'ft-overlay', 'data-form': form, 'data-placement': placement, style: props.style },
      h('div', { className: 'ft-overlay-body' },
        h(Glass, { form: form, size: props.size, original: props.original, edge: props.edge, reveal: props.reveal, dimmed: props.dimmed, indicator: props.indicator, maxHeight: props.maxHeight, busy: props.busy }, props.children),
        h(ActionPill, { tag: props.tag, tagTitle: props.tagTitle, copied: props.copied, pinnable: form === 'reader', pinned: props.pinned, menuOpen: Boolean(props.menuItems), disabled: props.disabled || props.busy, onCopy: props.onCopy, onPin: props.onPin, onMenu: props.onMenu, onClose: props.onClose }),
        menu),
      props.feedback && !props.menuItems ? h('div', { className: 'ft-overlay-feedback' }, props.feedback) : null);
  }

  // ——— Settings controls ———
  function Button(props) {
    var rest = omit(props, ['variant', 'size', 'icon', 'children']);
    return h('button', Object.assign({ type: 'button', 'data-variant': props.variant || 'secondary', 'data-size': props.size }, rest, { className: cx('ft-btn', props.className) }),
      props.icon ? h(Icon, { name: props.icon, size: props.size === 'sm' ? 14 : 16 }) : null, props.children);
  }

  function IconButton(props) {
    var rest = omit(props, ['icon', 'label', 'variant', 'iconSize']);
    return h('button', Object.assign({ type: 'button', 'data-variant': props.variant, 'aria-label': props.label, title: props.label }, rest, { className: cx('ft-ibtn', props.className) }), h(Icon, { name: props.icon, size: props.iconSize || 16 }));
  }

  function Segmented(props) {
    var options = props.options || [];
    var index = options.findIndex(function (o) { return o.value === props.value; });
    var onKey = function (event) {
      var step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
      if (!step || !props.onChange) return;
      event.preventDefault();
      var next = options[(index + step + options.length) % options.length];
      props.onChange(next.value);
      var buttons = event.currentTarget.querySelectorAll('button');
      if (buttons[(index + step + options.length) % options.length]) buttons[(index + step + options.length) % options.length].focus();
    };
    return h('div', { className: 'ft-seg', role: 'radiogroup', 'aria-label': props.label, 'data-size': props.size, onKeyDown: onKey },
      options.map(function (o) {
        var on = o.value === props.value;
        return h('button', { key: o.value, type: 'button', role: 'radio', 'aria-checked': on, tabIndex: on ? 0 : -1, onClick: function () { if (props.onChange) props.onChange(o.value); } }, o.label);
      }));
  }

  function Switch(props) {
    return h('button', { type: 'button', role: 'switch', className: 'ft-switch', 'aria-checked': Boolean(props.checked), 'aria-label': props.label, disabled: props.disabled, onClick: function () { if (props.onChange) props.onChange(!props.checked); } },
      h('span', { className: 'ft-switch-thumb' }));
  }

  var fieldId = 0;
  function useId(prefix) { var ref = React.useRef(null); if (ref.current === null) ref.current = prefix + (++fieldId); return ref.current; }

  // The label names the field; hint, error and counter describe it (aria-describedby), never name it.
  function describedBy(ids) { var list = ids.filter(Boolean); return list.length ? list.join(' ') : undefined; }
  function noteId(id, props) { return props.error ? id + '-error' : props.hint ? id + '-hint' : null; }
  function fieldNote(id, props) {
    return props.error ? h('span', { id: id + '-error', className: 'ft-field-error', role: 'alert' }, h(Icon, { name: 'triangle-alert', size: 13 }), props.error)
      : props.hint ? h('span', { id: id + '-hint', className: 'ft-field-hint' }, props.hint) : null;
  }

  function TextField(props) {
    var generated = useId('ft-field-');
    var id = props.id || generated;
    var rest = omit(props, ['label', 'hint', 'error', 'onChange', 'invalid', 'id']);
    return h('div', { className: 'ft-field' },
      h('label', { className: 'ft-field-label', htmlFor: id }, props.label),
      h('input', Object.assign({ 'aria-invalid': props.invalid || Boolean(props.error) || undefined, 'aria-describedby': describedBy([noteId(id, props)]), onChange: function (e) { if (props.onChange) props.onChange(e.target.value); } }, rest, { id: id, className: cx('ft-input', props.className) })),
      fieldNote(id, props));
  }

  function SelectField(props) {
    var id = useId('ft-select-');
    return h('div', { className: 'ft-field' },
      props.label ? h('label', { className: 'ft-field-label', htmlFor: id }, props.label) : null,
      h('span', { className: 'ft-select' },
        h('select', { id: id, value: props.value, 'aria-label': props.label ? undefined : props.ariaLabel, 'aria-describedby': describedBy([noteId(id, props)]), onChange: function (e) { if (props.onChange) props.onChange(e.target.value); } },
          (props.options || []).map(function (o) { return h('option', { key: o.value, value: o.value }, o.label); })),
        h(Icon, { name: 'chevron-down', size: 16 })),
      fieldNote(id, props));
  }

  function TextArea(props) {
    var id = useId('ft-area-');
    var value = props.value || '';
    var max = props.max || 8000;
    var count = Array.from(value).length;
    return h('div', { className: 'ft-field' },
      h('label', { className: 'ft-field-label', htmlFor: id }, props.label),
      h('textarea', { id: id, className: 'ft-textarea', value: value, rows: props.rows || 6, spellCheck: false, 'aria-invalid': Boolean(props.error) || undefined, 'aria-describedby': describedBy([noteId(id, props), id + '-count']), onChange: function (e) { if (props.onChange) props.onChange(e.target.value); } }),
      h('span', { className: 'ft-field-foot' },
        fieldNote(id, props),
        h('span', { id: id + '-count', className: 'ft-field-count' }, count.toLocaleString('fr-FR') + ' / ' + max.toLocaleString('fr-FR'))));
  }

  function Keycaps(props) {
    var state = props.state || (props.shortcut ? 'idle' : 'empty');
    var body = state === 'recording' ? 'Pressez la combinaison…' : state === 'empty' ? 'Sans raccourci' : props.shortcut.split('+').map(function (key, i) { return h('kbd', { key: i, className: 'ft-key' }, key); });
    return h('span', { className: 'ft-keys', 'data-state': state, role: state === 'recording' ? 'textbox' : undefined, 'aria-label': state === 'recording' ? 'Nouveau raccourci' : 'Raccourci ' + (props.shortcut || 'non défini'), tabIndex: state === 'recording' ? 0 : undefined },
      body, props.more ? h('span', { className: 'ft-keys-plus' }, '+' + props.more) : null);
  }

  function StatusBadge(props) {
    var tone = props.tone || 'neutral';
    return h('span', { className: 'ft-status', 'data-tone': tone, role: 'status' },
      tone === 'checking' ? h(Icon, { name: 'loader-circle', size: 12, spin: true }) : h('i', { className: 'ft-status-dot', 'aria-hidden': 'true' }), props.children);
  }

  function Badge(props) { return h('span', { className: 'ft-badge', 'data-tone': props.tone }, props.children); }

  function Callout(props) {
    return h('div', { className: 'ft-callout', 'data-tone': props.tone, role: props.tone === 'danger' ? 'alert' : 'note' },
      h(Icon, { name: props.icon || (props.tone === 'danger' ? 'circle-alert' : 'info'), size: 16 }), h('div', null, props.children));
  }

  function SaveStatus(props) {
    var status = props.status || 'saved';
    // With a message, the reason also shows as a danger Callout on the page (role alert): announce once.
    if (status === 'error') return h('span', { className: 'ft-save', 'data-status': 'error', role: props.announced ? undefined : 'alert', 'aria-live': props.announced ? 'polite' : undefined, title: props.message }, h(Icon, { name: 'triangle-alert', size: 13 }), 'Non enregistré', h('button', { type: 'button', className: 'ft-link', onClick: props.onRetry }, 'Réessayer'));
    return h('span', { className: 'ft-save', 'data-status': status, 'aria-live': 'polite' },
      status === 'saving' ? h(Icon, { name: 'loader-circle', size: 13, spin: true }) : h(Icon, { name: 'check', size: 13, strokeWidth: 2 }),
      status === 'saving' ? 'Enregistrement…' : status === 'just-saved' ? 'Enregistré à l’instant' : 'Enregistré');
  }

  // ——— Settings structure ———
  var PAGES = [
    { id: 'actions', label: 'Actions', icon: 'keyboard' },
    { id: 'reading', label: 'Lecture', icon: 'type' },
    { id: 'engines', label: 'Moteurs', icon: 'server' },
    { id: 'privacy', label: 'Confidentialité', icon: 'shield-check' },
  ];

  function TitleBar(props) {
    var page = PAGES.find(function (p) { return p.id === props.page; });
    return h('header', { className: 'ft-titlebar' },
      h(Mark, { size: 16 }), h('span', { className: 'ft-titlebar-name' }, 'FlowTranslate'), page ? h('span', { className: 'ft-titlebar-page' }, 'Réglages') : null,
      h(SaveStatus, { status: props.saveStatus, message: props.saveError, announced: props.announced, onRetry: props.onRetry }),
      h('button', { type: 'button', className: 'ft-close', 'aria-label': 'Fermer les réglages', title: 'Fermer (Échap)', onClick: props.onClose }, h(Icon, { name: 'x', size: 16 })));
  }

  function SettingsNav(props) {
    return h('nav', { className: 'ft-nav', 'aria-label': 'Sections des réglages' },
      PAGES.map(function (p) {
        return h('button', { key: p.id, type: 'button', className: 'ft-nav-item', 'aria-current': props.current === p.id ? 'page' : undefined, onClick: function () { if (props.onNavigate) props.onNavigate(p.id); } }, h(Icon, { name: p.icon, size: 16 }), p.label);
      }),
      h('div', { className: 'ft-nav-foot' },
        h('button', { type: 'button', className: 'ft-nav-item', onClick: props.onQuit }, h(Icon, { name: 'power', size: 16 }), 'Quitter'),
        h('span', { className: 'ft-nav-version' }, 'FlowTranslate ' + (props.version || '1.0.0'))));
  }

  function SettingsWindow(props) {
    return h('main', { className: 'ft-window', 'data-narrow': props.narrow ? 'true' : undefined, style: props.style },
      h(TitleBar, { page: props.page, saveStatus: props.saveStatus, saveError: props.saveStatus === 'error' ? props.saveError : undefined, announced: props.saveStatus === 'error' && Boolean(props.saveError), onRetry: props.onRetry, onClose: props.onClose }),
      h('div', { className: 'ft-shell' },
        h(SettingsNav, { current: props.page, onNavigate: props.onNavigate, version: props.version, onQuit: props.onQuit }),
        h('div', { className: 'ft-page' }, h('div', { className: 'ft-page-inner' },
          props.saveStatus === 'error' && props.saveError ? h(Callout, { tone: 'danger' }, props.saveError) : null,
          props.children))));
  }

  function PageHeader(props) {
    return h('div', { className: 'ft-page-head' },
      h('div', null, h('h1', { className: 'ft-page-title' }, props.title), props.description ? h('p', { className: 'ft-page-desc' }, props.description) : null),
      props.action || null);
  }

  function SettingGroup(props) {
    return h('section', { className: 'ft-group', 'aria-label': props.title },
      props.title ? h('h2', { className: 'ft-group-title' }, props.title) : null,
      props.plain ? h('div', { className: 'ft-stack' }, props.children) : h('div', { className: 'ft-card' }, props.children));
  }

  function SettingRow(props) {
    return h('div', { className: 'ft-row' },
      h('div', { className: 'ft-row-lead' }, props.icon ? h(Icon, { name: props.icon, size: 16 }) : null,
        h('div', { className: 'ft-row-copy' }, h('span', { className: 'ft-row-label' }, props.label), props.description ? h('span', { className: 'ft-row-desc' }, props.description) : null)),
      h('div', { className: 'ft-row-control' }, props.children));
  }

  var OUTPUT = [{ value: 'display', label: 'Afficher' }, { value: 'replace', label: 'Remplacer' }];

  function ShortcutBinding(props) {
    var b = props.binding;
    return h('div', { className: 'ft-binding' },
      h(Switch, { label: 'Activer ' + (b.shortcut || 'ce raccourci'), checked: b.enabled, onChange: props.onToggle }),
      h('div', { className: 'ft-binding-keys' },
        h(Keycaps, { shortcut: b.shortcut, state: props.recording ? 'recording' : undefined }),
        h(Button, { variant: 'ghost', size: 'sm', onClick: props.onRecord }, props.recording ? 'Annuler' : 'Modifier')),
      h(Segmented, { label: 'Résultat du raccourci ' + (b.shortcut || ''), size: 'sm', value: b.output, options: OUTPUT, onChange: props.onOutput }),
      h(IconButton, { icon: 'trash-2', iconSize: 15, variant: 'danger', label: 'Supprimer ce raccourci', onClick: props.onRemove }));
  }

  function ActionRow(props) {
    var a = props.action;
    var bindings = props.bindings || [];
    var active = bindings.filter(function (b) { return b.enabled && b.shortcut; });
    var outputs = active.map(function (b) { return b.output === 'replace' ? 'Remplace la sélection' : 'Affiche le résultat'; });
    var meta = [a.builtIn ? 'Prédéfinie' : 'Personnalisée'].concat(outputs.length ? [outputs[0]] : ['Aucun raccourci actif']).join(' · ');
    var headId = useId('ft-action-');
    return h('article', { className: 'ft-action', 'data-open': props.open ? 'true' : undefined },
      h('button', { type: 'button', id: headId, className: 'ft-action-head', 'aria-expanded': Boolean(props.open), onClick: props.onToggle },
        h('span', { className: 'ft-action-glyph' }, h(Icon, { name: a.glyph || 'wand', size: 16 })),
        h('span', { style: { minWidth: 0 } }, h('span', { className: 'ft-action-name' }, h('span', null, a.name || 'Action sans nom'), a.isDefault ? h(Badge, { tone: 'signal' }, 'Par défaut') : null), h('span', { className: 'ft-action-meta' }, meta)),
        h(Keycaps, { shortcut: active[0] && active[0].shortcut, more: active.length > 1 ? active.length - 1 : 0 }),
        h(Icon, { name: 'chevron-down', size: 16 })),
      props.open ? h('div', { className: 'ft-action-body', role: 'region', 'aria-labelledby': headId }, props.children) : null);
  }

  function EngineCard(props) {
    var tones = { ok: 'success', error: 'danger', checking: 'checking', unknown: 'neutral' };
    var label = props.status === 'ok' ? 'Connecté · ' + props.latency + ' ms' : props.status === 'error' ? 'Échec de connexion' : props.status === 'checking' ? 'Vérification…' : 'Non vérifié';
    return h('section', { className: 'ft-card', 'aria-label': 'Moteur ' + props.name },
      h('div', { className: 'ft-engine-head' },
        h('span', { className: 'ft-row-label' }, props.name), props.isDefault ? h(Badge, { tone: 'signal' }, 'Par défaut') : null,
        h(StatusBadge, { tone: tones[props.status || 'unknown'] }, label),
        h(Button, { size: 'sm', icon: 'refresh-cw', disabled: props.status === 'checking', onClick: props.onCheck }, 'Vérifier')),
      h('div', { className: 'ft-engine-body' },
        h('div', { className: 'ft-grid-2' },
          h(TextField, { label: 'Adresse', type: 'url', value: props.endpoint, placeholder: 'http://127.0.0.1:8002/v1', onChange: props.onEndpoint }),
          h(TextField, { label: 'Modèle', value: props.model, onChange: props.onModel })),
        h(TextField, { label: 'Clé API', type: 'password', autoComplete: 'new-password', value: props.apiKey, placeholder: 'Facultative pour un serveur local', onChange: props.onApiKey }),
        h('span', { className: 'ft-secret-note' }, h(Icon, { name: 'shield-check', size: 13 }), 'Chiffrée par Windows (DPAPI), jamais écrite en clair.'),
        props.status === 'error' && props.message ? h(Callout, { tone: 'danger' }, props.message) : null));
  }

  function HistoryList(props) {
    var entries = props.entries || [];
    if (!entries.length) return h('div', { className: 'ft-card' }, h('div', { className: 'ft-empty' }, h(Icon, { name: 'history', size: 20 }), h('span', null, 'Aucun résultat enregistré.')));
    return h('div', { className: 'ft-card' },
      entries.map(function (e) {
        return h('div', { key: e.id, className: 'ft-history-item' },
          h('div', { style: { minWidth: 0 } }, h('div', { className: 'ft-history-text' }, e.text), h('div', { className: 'ft-history-meta' }, e.meta)),
          h(IconButton, { icon: 'trash-2', iconSize: 15, variant: 'danger', label: 'Supprimer cette entrée', onClick: function () { if (props.onRemove) props.onRemove(e.id); } }));
      }),
      h('div', { className: 'ft-history-foot' }, h('span', null, entries.length + ' entrée' + (entries.length > 1 ? 's' : '') + ' · 7 jours au plus'), h(Button, { variant: 'danger', size: 'sm', onClick: props.onClear }, 'Tout supprimer')));
  }

  var api = {
    Icon: Icon, Mark: Mark,
    Overlay: Overlay, Glass: Glass, GlassError: GlassError, PartialNote: PartialNote, ActionPill: ActionPill, WaitPill: WaitPill, OverlayMenu: OverlayMenu, Notice: Notice,
    Button: Button, IconButton: IconButton, Segmented: Segmented, Switch: Switch, TextField: TextField, SelectField: SelectField, TextArea: TextArea, Keycaps: Keycaps,
    StatusBadge: StatusBadge, Badge: Badge, Callout: Callout, SaveStatus: SaveStatus,
    SettingsWindow: SettingsWindow, TitleBar: TitleBar, SettingsNav: SettingsNav, PageHeader: PageHeader, SettingGroup: SettingGroup, SettingRow: SettingRow,
    ActionRow: ActionRow, ShortcutBinding: ShortcutBinding, EngineCard: EngineCard, HistoryList: HistoryList,
    icons: Object.keys(ICONS),
  };
  window.FlowTranslate = Object.assign(window.FlowTranslate || {}, api);
})();
