/* Contextes, variantes de bulle et placement. Chargé après icons.js (window.ICONS). */
(function () {
  'use strict';
  var ICONS = window.ICONS;
  function icon(name, size, stroke) {
    var node = ICONS[name] || [];
    var parts = node.map(function (p) {
      var attrs = Object.keys(p[1]).map(function (k) { return k + '="' + p[1][k] + '"'; }).join(' ');
      return '<' + p[0] + ' ' + attrs + '/>';
    }).join('');
    return '<svg class="ft-svg" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (stroke || 1.75) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + parts + '</svg>';
  }
  window.icon = icon;

  // ——— Contextes ———
  function mail(opts) {
    opts = opts || {};
    var selText = 'Suite a notre échange de ce matin, je vous envoi le devis corigé pour la commande du mois prochain. J’ai intégrer les remarques de votre équipe sur les délais de livraison et ajusté les quantité pour le premier lot, comme convenu.';
    var fixed = 'Suite à notre échange de ce matin, je vous envoie le devis corrigé pour la commande du mois prochain. J’ai intégré les remarques de votre équipe sur les délais de livraison et ajusté les quantités pour le premier lot, comme convenu.';
    var para = opts.replaced ? '<p><span class="anchor">' + fixed + '</span></p>' : '<p><span class="sel">' + selText + '</span></p>';
    return '<div class="scene mail">' +
      '<div class="top"><span class="grid"></span><span>Outlook</span><span class="search">Rechercher</span></div>' +
      '<div class="ribbon"><span class="send">Envoyer</span><span class="tb">B</span><span class="tb"><i>I</i></span><span class="tb"><u>S</u></span><span class="sep"></span><span class="tb">≡</span><span class="tb">☰</span><span class="sep"></span><span class="tb">Aa</span><span class="tb">@</span><span class="tb">…</span></div>' +
      '<div class="field"><span class="lbl">À</span><span class="chip"><span class="av">MD</span>Marie Dupont</span></div>' +
      '<div class="field"><span class="lbl">Objet</span>Devis révisé pour la commande du mois prochain</div>' +
      '<div class="body"><p>Bonjour Marie,</p>' + para +
      '<p>N’hésitez pas si vous avez des question, je reste disponible cette semaine.</p>' +
      '<p class="tight">Cordialement,<br>Lucas</p></div>' +
      '</div>';
  }
  function chat() {
    return '<div class="scene chat">' +
      '<div class="rail"><i></i><i class="on"></i><i></i><i></i><i></i></div>' +
      '<div class="list"><h3>Discussions</h3>' +
      '<div class="row on"><span class="av"></span><div><div class="n">Sarah Whitfield</div><div class="s">Could you send us the updated report…</div></div></div>' +
      '<div class="row"><span class="av" style="background:#c4314b"></span><div><div class="n">Projet Sirius</div><div class="s">Thomas : réunion décalée à 14 h</div></div></div>' +
      '<div class="row"><span class="av" style="background:#498205"></span><div><div class="n">Marie Dupont</div><div class="s">Merci, je regarde ça cet après-midi</div></div></div>' +
      '<div class="row"><span class="av" style="background:#8764b8"></span><div><div class="n">Qualité · Audits</div><div class="s">Vous : le rapport est dans le dossier partagé</div></div></div>' +
      '</div>' +
      '<div class="main"><div class="head"><span class="av"></span>Sarah Whitfield</div>' +
      '<div class="msgs">' +
      '<div class="msg"><span class="av"></span><div><div class="meta">Sarah Whitfield<span>09:41</span></div><div class="txt">Hi Lucas, quick heads-up: <span class="sel">the review of the quotation has been moved to next Tuesday. Could you send us the updated report before then, so the team can go through it during the Monday sync?</span></div></div></div>' +
      '<div class="msg me"><span class="av"></span><div><div class="meta">Vous<span>09:44</span></div><div class="txt">Ok, je regarde ça.</div></div></div>' +
      '<div class="msg"><span class="av"></span><div><div class="meta">Sarah Whitfield<span>09:45</span></div><div class="txt">Thanks. The template is in the shared folder if you need it.</div></div></div>' +
      '</div>' +
      '<div class="compose">Saisissez un message</div>' +
      '</div></div>';
  }
  window.contexts = { mail: mail, chat: chat };

  // ——— Actions ———
  var ACTIONS = [
    { name: 'Corriger', icon: 'spell-check', key: 'C', out: 'replace', digit: 1, shortcut: ['Ctrl', 'Alt', 'C'] },
    { name: 'Professionnaliser', icon: 'briefcase-business', key: 'P', out: 'replace', digit: 2 },
    { name: 'Traduire en français', icon: 'languages', key: 'F', out: 'display', digit: 3, shortcut: ['Ctrl', 'Alt', 'T'] },
    { name: 'Traduire en anglais', icon: 'languages', key: 'A', out: 'replace', digit: 4 },
    { name: 'Résumer en trois points', icon: 'wand', key: 'R', out: 'display', digit: 5 }
  ];
  var OUT_ICON = { replace: 'clipboard-paste', display: 'eye' };

  // ——— Variantes. Chaque fonction reçoit { canReplace, hl } et rend un fragment posé dans .ovl ———
  // V1 · Menu (concept C) : l’OverlayMenu 196 px, chiffres, ligne de sortie.
  function v1(o) {
    var rows = ACTIONS.map(function (a, i) {
      return '<div class="ft-menu-item"' + (i === o.hl ? ' data-highlighted' : '') + '>' + icon(a.icon, 15) + '<span class="ell">' + a.name + '</span><span class="ft-menu-hint">' + a.digit + '</span></div>';
    }).join('');
    var out = o.canReplace
      ? '<div class="ft-menu-item">' + icon('clipboard-paste', 15) + '<span class="ell">Remplacer la sélection</span><span class="ft-menu-hint">Tab</span></div>'
      : '<div class="ft-menu-item" style="opacity:var(--opacity-disabled)">' + icon('eye', 15) + '<span class="ell">Afficher le résultat</span></div>';
    return '<div class="ft-menu" style="position:absolute;top:0;right:16px">' + rows + '<div class="ft-menu-sep"></div>' + out + '</div>';
  }
  // V2 · Liste large, lettres, icône de sortie par ligne, pied moteur + raccourci (concept B).
  function v2(o) {
    var rows = ACTIONS.map(function (a, i) {
      var out = o.canReplace ? a.out : 'display';
      return '<div class="row' + (i === o.hl ? ' hl' : '') + '">' + icon(a.icon, 15) + '<span class="name">' + a.name + '</span><span class="out">' + icon(OUT_ICON[out], 15) + '</span><span class="gkey">' + a.key + '</span></div>';
    }).join('');
    var a = ACTIONS[o.hl];
    var right = o.canReplace
      ? (a.shortcut ? '<span class="r gkeys">' + a.shortcut.map(function (k) { return '<span class="gkey">' + k + '</span>'; }).join('') + '</span>' : '')
      : '<span class="r">Remplacement impossible</span>';
    return '<div class="picker" style="top:0;right:0;width:280px">' + rows + '<div class="sep"></div><div class="foot"><span>Général · Sur ce PC</span>' + right + '</div></div>';
  }
  // V3 · En-tête, lettres, pied segmenté + puce moteur (concept A).
  function v3(o) {
    var rows = ACTIONS.map(function (a, i) {
      return '<div class="row' + (i === o.hl ? ' hl' : '') + '">' + icon(a.icon, 15) + '<span class="name">' + a.name + '</span><span class="gkey">' + a.key + '</span></div>';
    }).join('');
    var a = ACTIONS[o.hl];
    var mode = o.canReplace ? a.out : 'display';
    var seg = '<div class="ft-seg" data-size="sm" role="radiogroup">' +
      '<button aria-checked="' + (mode === 'replace') + '"' + (o.canReplace ? '' : ' disabled style="opacity:var(--opacity-disabled)"') + '>Remplacer</button>' +
      '<button aria-checked="' + (mode === 'display') + '">Afficher</button></div>';
    var chip = '<button class="ft-chip">Général ' + icon('chevron-down', 13) + '</button>';
    var also = a.shortcut ? '<div class="cap" style="padding-top:2px;padding-bottom:6px">Aussi : ' + a.shortcut.join(' ') + '</div>' : '';
    return '<div class="picker" style="top:0;right:0;width:260px">' +
      '<div class="cap">' + (o.canReplace ? 'Sélection · 41 mots' : 'Sélection · 38 mots') + '</div>' + rows + '<div class="sep"></div>' +
      '<div class="foot" style="height:36px;gap:6px">' + seg + '<span class="r" style="margin-left:auto">' + chip + '</span></div>' + also + '</div>';
  }
  // V4 · Barre horizontale sur la ligne de la pilule (famille PopClip / Grammarly).
  // Avec les quatre noms écrits, la barre fait 620 px et sort du verre (v4-libelles-trop-large-mail.png) :
  // ici, icônes seules et le nom de la ligne active seulement.
  function v4(o) {
    var its = ACTIONS.slice(0, 4).map(function (a, i) {
      var hl = i === o.hl;
      return '<span class="it' + (hl ? ' hl' : '') + '"' + (hl ? '' : ' style="padding:0 6px"') + '>' + icon(a.icon, 15) + (hl ? a.name : '') + '</span>';
    }).join('');
    var tog = o.canReplace
      ? '<span class="tog">' + icon('clipboard-paste', 15) + 'Remplacer</span>'
      : '<span class="tog off">' + icon('eye', 15) + 'Afficher</span>';
    return '<div class="strip" style="right:16px">' + its + '<span class="rule"></span>' + tog + '<span class="rule"></span><span class="tog" style="padding:0 6px">' + icon('ellipsis', 15) + '</span></div>';
  }
  // V5 · Hybride retenu après les captures : géométrie de V2 ; la ligne active dit sa sortie en un mot
  // (« Remplace » / « Affiche »), les autres gardent l’icône ; pied moteur + raccourci direct.
  function v5(o) {
    var rows = ACTIONS.map(function (a, i) {
      var out = o.canReplace ? a.out : 'display';
      var hl = i === o.hl;
      // Maj ne retourne que la ligne active : retourner toutes les icônes (concept B) fait clignoter la liste (vu sur t1).
      if (o.shift && o.canReplace && hl) out = out === 'replace' ? 'display' : 'replace';
      var trail = hl
        ? '<span class="tag-out">' + (out === 'replace' ? 'Remplace' : 'Affiche') + '</span>'
        : '<span class="out">' + icon(OUT_ICON[out], 15) + '</span>';
      return '<div class="row' + (hl ? ' hl' : '') + '">' + icon(a.icon, 15) + '<span class="name">' + a.name + '</span>' + trail + '<span class="gkey">' + a.key + '</span></div>';
    }).join('');
    var a = ACTIONS[o.hl];
    var right = a.shortcut ? '<span class="r gkeys">' + a.shortcut.map(function (k) { return '<span class="gkey">' + k + '</span>'; }).join('') + '</span>' : '';
    return '<div class="picker" style="top:0;right:0;width:280px">' + rows + '<div class="sep"></div><div class="foot"><span>Général · Sur ce PC</span>' + right + '</div></div>';
  }
  window.variants = { v1: v1, v2: v2, v3: v3, v4: v4, v5: v5 };

  // ——— Pièces du parcours 1.0 ———
  function waitPill(o) {
    o = o || {};
    return '<div class="ft-wait"' + (o.slow ? ' data-slow="true"' : '') + (o.done ? ' data-done="true"' : '') + '>' + (o.done ? icon('check', 15, 2.25) : icon('loader-circle', 18, 2.25)) + '</div>';
  }
  function glass(o) {
    var pill = '<div class="ft-pill" data-static="false" style="animation:none"><span class="ft-pill-tag"><span>' + o.tag + '</span></span><span class="ft-pill-rule"></span>' +
      '<button class="ft-gbtn">' + icon('copy', 15) + '</button>' +
      (o.replace ? '<button class="ft-gbtn">' + icon('clipboard-paste', 15) + '</button>' : '') +
      '<button class="ft-gbtn">' + icon('ellipsis', 15) + '</button><button class="ft-gbtn">' + icon('x', 13) + '</button></div>';
    return pill + '<div class="ft-glass"><div class="ft-glass-scroll"><div class="ft-glass-copy">' + o.text + '</div></div></div>';
  }
  window.pieces = { waitPill: waitPill, glass: glass };

  // ——— Placement : origine de .ovl = coin haut gauche du verre sur la ligne de la pilule ———
  // Fenêtre native : x = ancre.droite − 444, y = ancre.bas + 8 ; halo 32/20 ; pilule sur la ligne du haut du corps.
  window.place = function (scene) {
    var sel = scene.querySelector('.sel') || scene.querySelector('.anchor');
    var sr = scene.getBoundingClientRect();
    var rects = Array.prototype.slice.call(sel ? sel.getClientRects() : []);
    if (!rects.length) return;
    var a = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
    rects.forEach(function (r) { a.left = Math.min(a.left, r.left); a.top = Math.min(a.top, r.top); a.right = Math.max(a.right, r.right); a.bottom = Math.max(a.bottom, r.bottom); });
    var last = rects[rects.length - 1];
    var ovl = scene.querySelector('.ovl');
    if (ovl) {
      var right = a.right - sr.left;
      var top = a.bottom - sr.top + 8 + 20;
      ovl.style.left = (right - 32 - 380) + 'px';
      ovl.style.top = top + 'px';
    }
    var cur = scene.querySelector('.cursor');
    if (cur) { cur.style.left = (last.right - sr.left + 1) + 'px'; cur.style.top = (last.bottom - sr.top - 6) + 'px'; }
  };
  window.cursorSvg = '<svg class="cursor" viewBox="0 0 13 20" aria-hidden="true"><path d="M1 1v15l3.6-3.4 2.6 5.9 2.4-1.1-2.6-5.7H12z" fill="#fff" stroke="#000" stroke-width="1.1" stroke-linejoin="round"/></svg>';
})();
