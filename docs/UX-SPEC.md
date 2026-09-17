# FlowTranslate · spec UX « Une porte, des lettres »

17 sept. 2026 · base 0.4.0 · relue par un contradicteur (§ 14) · **questions tranchées par Lucas le 17/09 (§ 13)** · lecture : un quart d’heure

**[code]** vérifié dans le dépôt · **[proto]** à confirmer par le prototype (§ 12) · **[Q n]** question du § 13 · captures `visuel/…` : maquettes de l’étude visuelle du 17/09, gardées hors du dépôt (contenu d’exemple).

---

## 1. Le choix

**Un geste, Ctrl+Alt+Espace, ouvre près de la sélection une bulle qui liste les actions.**
- La ligne active écrit ce qu’elle va faire : « Remplace » ou « Affiche ».
- Chaque action a une lettre ; le pied dit quel moteur part.
- L’occasionnel apprend ce seul geste et clique. L’intensif tape le geste puis une lettre, ou garde ses raccourcis directs, toujours immédiats.
- Derrière, les deux profils figés deviennent des **moteurs** (un modèle sur un serveur) : un par action, un « pour cette fois », ou un seul pour tout, choisi dans un menu [Q 10].
- La 1.0 suppose un serveur, le sien ou celui d’une équipe [Q 11].

Verre, bande, pilule, placement, temps de lecture et chemin Remplacer ne changent pas.

**Colonne vertébrale : concept B**, forme V5 de l’étude visuelle (`visuel/v5-mail.png`, `visuel/v5-chat.png`).
- **Greffé de A** : sortie habituelle qui suit l’intention de l’action ; page Démarrer ; serveurs séparés des moteurs.
- **Greffé de C** : aucune fenêtre native agrandie ; pas de bulle quand rien n’est lu ; « Relancer avec… » dans ⋯ ; adresse vérifiée à la sortie du champ ; migration sans réaffectation d’office.

**Pourquoi pas les autres.**
- **C** ne répond pas à la demande : cinq actions au plus, aucun choix de moteur avant l’envoi, sortie devinée d’après la cible (un texte collé dans un brouillon pour être traduit serait remplacé), libellés tronqués à 196 px (`visuel/v1-mail.png`).
- **A** : son segment Remplacer | Afficher attire l’œil sur le contrôle que l’occasionnel ne touche jamais, et la bulle monte à 265 px (`visuel/v3-mail.png`).
- **B** porte les deux vitesses dans une seule surface ; ses défauts (icônes muettes, présélection mouvante) se corrigent sans toucher sa structure.

| Écarté | De | Raison |
|---|---|---|
| Menu 196 px, chiffres, ligne de sortie | C | Tronqué ; chiffres presque invisibles ; la sortie se lit comme une commande |
| Cinq actions au plus | C | « Quatorze tâches » ; six lignes tiennent, la liste défile au-delà |
| Moteur sans entité serveur | C | Clé répétée par modèle (OpenRouter, Ollama) |
| En-tête « Sélection · n mots », segment, puce moteur | A | +50 px pour une confirmation que le surlignage donne déjà |
| Bulle sous la souris sans ancre | A | Contredit UI-025 ; casse le passage bulle → pilule au même endroit |
| « Utiliser le texte copié · 312 caractères » | A | Lit le presse-papiers sans qu’on le demande |
| Bulle vide qui guette un Ctrl+C 8 s | B | Surprise ; hook qui surveille une copie |
| Icône de sortie seule par ligne | B | L’icône presse-papiers ne dit pas « remplace » (`visuel/v2-mail.png`) |
| Maj qui retourne toutes les icônes | B | La liste clignote (`visuel/t1-bulle.png`) |
| Présélection de la dernière action | A, B, C | Entrée change de sens au fil des jours (`visuel/v5-chat.png`) |
| Compteur « Choisie 23 fois », étiquette de pilule cliquable | B | Statistique inutile ; commande cachée |
| Barre horizontale d’icônes | V4 | 620 px avec libellés, illisible sans (`visuel/v4-libelles-trop-large-mail.png`) |
| Ctrl+Alt seul par défaut | demande | Hook permanent, faux positifs, AltGr [Q 1] |
| Ctrl+Espace par défaut | Lucas | Pris par l’autocomplétion de VS Code, JetBrains et Visual Studio, Word et Outlook, Excel, PowerShell, IME chinois et japonais ; proposé au choix avec avertissement [Q 1] |

---

## 2. Parcours

### 2.1 Claire corrige un mail de temps en temps

1. **Installation.** Les Réglages s’ouvrent une fois sur **Démarrer** (§ 7).
   - Son équipe lui a installé un serveur (ici Ollama, sur son PC) [Q 11] : « Trouvé sur ce PC : Ollama · 1 modèle ».
   - Elle sélectionne la phrase d’exemple, fait le geste : la bulle s’ouvre dans la page, Entrée corrige.
   - « Lancer avec Windows » est présenté activé ; rien n’est écrit avant qu’elle ferme.
   - Elle ferme. Un avis reste 4 s : « FlowTranslate est prêt… ».
2. **Corriger.** Dans Outlook Web, elle sélectionne son paragraphe et fait le geste.
   - La bulle naît sous la sélection ; Outlook garde le focus.
   - UI Automation prouve un champ modifiable : Corriger, en tête, est actif avec « Remplace ».
   - Entrée : pilule d’attente, puis coche. Ctrl+Z rend l’original.
3. **Lire un message anglais.** Dans Teams, elle sélectionne un message reçu et fait le geste.
   - Teams passe par la copie synthétique, qui ne prouve pas que la cible est modifiable : toutes les lignes montrent un œil.
   - Traduire en français est active, « Affiche ». Entrée : le verre s’ouvre.
4. **Traduire sans remplacer ce qu’elle écrit.** Un clic sur le mot « Remplace » le change en « Affiche » pour cette fois.
5. **Oubli ou panne.** L’infobulle de l’icône rappelle le geste. Avant d’agir, le pied signale « hors ligne ». Après l’envoi, le verre d’erreur nomme le moteur et propose Réessayer.

Elle n’a jamais eu besoin des lettres, de Maj, de Tab, des raccourcis directs ni des serveurs.

### 2.2 Lucas, quatorze tâches

- **Rédiger.**
  - Ctrl+A puis Ctrl+Alt+C : raccourci direct, remplacement sans bulle, comme en 0.4.0.
  - Geste puis P, d’une traite : Professionnaliser remplace. P attend la fin de la capture au lieu d’écraser la sélection (§ 3.3).
  - Geste puis A : Traduire en anglais affiche le résultat (sortie habituelle) ; Maj+A remplace directement [Q 5].
  - Une action rare : geste, puis sa lettre.
- **Moteurs, réglés une fois.** Traduire va vers Rapide (Hy-MT, 8001) ; Corriger et Professionnaliser vers Général (8003). Rapide et Qualité portent « Traduction seulement ».
- **Général éteint**, parce que Qualité tient le GPU 0. Le pied affiche « Général · hors ligne ». Tab saute Rapide et Qualité et passe à Rédaction (son Ollama) pour cette fois ; Entrée.
- **GPU à libérer pour jouer.** Menu de l’icône → Moteur ▸ Petit (Ollama, 4B). Toutes les actions y passent jusqu’au retour à « Selon les actions » ; le pied affiche « forcé » [Q 10].
- **Résultat décevant.** ⋯ → Relancer avec… → Rédaction. Ensuite, Remplacer est dans la pilule.
- **Nouvelle action.** Il duplique Professionnaliser en « Résumer en trois points » (lettre R, sortie Afficher), retouche la consigne et clique Essayer dans la carte. Ajouter un raccourci propose Ctrl+Alt+R, vérifié ; en AZERTY, un nouveau Ctrl+Alt+E serait refusé : « AltGr+E écrit €. »

---

## 3. Le geste et la bulle

### 3.1 Déclencheur

- **Ctrl+Alt+Espace** est enregistré comme les autres raccourcis (RegisterHotKey, `MOD_NOREPEAT` [code : `global-hotkey` 0.8.0]). Aucun hook au repos, aucun faux positif ; le droit au premier plan reste disponible si le repli l’exige.
- **Vérification AltGr des nouvelles combinaisons, geste compris.** ToUnicodeEx sur chaque disposition installée : si AltGr plus la touche produit un caractère, la combinaison est refusée, raison sous la ligne. Une combinaison déjà enregistrée n’est jamais désactivée, seulement signalée. [proto : AZERTY, AFNOR, belge, suisse, allemand]
- **La capture a lieu au geste**, par le pipeline actuel ; l’action n’est fixée qu’au choix. La cible (§ 4) est connue dès la capture, donc la bulle affiche la bonne sortie dès son apparition [code : `capture.rs`].
- **Voie copie** (sans sélection UI Automation) : la copie attend le relâchement des modificateurs du geste, puis la bulle apparaît. Au bout de 3 s de touches tenues : avis « Relâchez les touches, puis recommencez. », jamais « Rien à traiter ».
- **Rien de lisible : pas de bulle.** Avis « Rien à traiter dans la fenêtre active. Sélectionnez du texte, puis recommencez. »
- **Fenêtre lancée en administrateur** : avis « Cette fenêtre est lancée en administrateur. FlowTranslate ne peut pas y agir. » [proto : détection]
- **Combinaison au choix** [Q 1] : Ctrl+Alt+Espace par défaut. Dans Actions → Bulle d’actions, **Ctrl+Espace** est proposé tel quel, avec l’avertissement « Remplace partout l’autocomplétion (VS Code, JetBrains, Visual Studio), la suppression de mise en forme (Word, Outlook), la sélection de colonne (Excel) et la complétion de PowerShell tant que FlowTranslate tourne. » Un raccourci global capture la combinaison dans toutes les applications : on ne peut pas la laisser passer « quand rien n’est sélectionné ». Aucune option « Ctrl+Alt relâchés » n’est prévue.

### 3.2 Placement et forme

La bulle vit là où naîtra la pilule, dans la fenêtre native décidée à la capture (UI-025).

```
 …je vous envoie le devis corigé pour le premier lot, comme convenu.▌

            +--------------------------------------+  <- ligne de la pilule (elle naîtra dans ce coin)
            | | Corriger              Remplace [C] |
            |   Professionnaliser         =>   [P] |
            |   Traduire en français      o    [F] |
            |   Traduire en anglais       o    [A] |
            |   Résumer en trois points   o    [R] |
            |  ----------------------------------  |
            |   Général                 Ctrl Alt C |
            +--------------------------------------+
                                                   ^ bord droit du futur verre

 |  ligne active (tiret signal)   =>  remplace   o  affiche   [C]  lettre
```

- **Sous la sélection** : bord haut sur la ligne de la pilule, bord droit sur celui du futur verre ; la liste descend. Au niveau du menu ⋯ (+34 px), l’écart avec la sélection passerait de 28 à 62 px.
- **Au-dessus** (place manquante dessous, `PlacementSide::Above` [code : `placement.rs`]) : le bas de la bulle se pose sur le bas de l’empreinte du verre, 8 px au-dessus de la sélection ; la liste monte, pied en bas ; la pilule naît dans son coin bas droit. La hauteur de la bulle compte dans `extent`, qui décide du côté.
- **En bas** (source longue ou sans ancre) : bord bas sur la ligne de la pilule ; la liste monte, même ordre, pied en bas.
- **Hauteur.** 215 px pour 5 lignes et le pied, environ 247 px pour 6. Les deux fenêtres offrent déjà 270 px à cet endroit [code : `layout.ts`] (ancrée : 334 − 20 − 44 ; en bas : 236 + 6 + 28). **Six lignes tiennent sans agrandir de fenêtre** ; au-delà, la liste défile. Le contrat natif gagne une forme `choosing` : région de hit-test de 280 px, style non activable [proto].
- **Matière.** 280 px, lignes de 32, rayon 16, matériau et ombre du menu. Rien n’est plus lumineux que la ligne active.
- **Ligne** : pictogramme, nom, sortie, lettre en touche graphite. Sortie **en mot sur la ligne active** (« Remplace », « Affiche », style `tag`), en icône ailleurs (`clipboard-paste`, `eye`). Cible non prouvée remplaçable : colonne d’yeux, rien de grisé à expliquer.
- **Pied.** À gauche, le moteur de la ligne active ; son lieu seulement s’il n’est pas un serveur sur ce PC (« Rédaction · openrouter.ai », « Grand · en ligne via Ollama »). « hors ligne », « traduction seulement », « forcé » en `glass-warning`. À droite, le raccourci direct de l’action : c’est là que l’intensif l’apprend.
- **Ordre** : celui de la page Actions, jamais modifié par l’usage. Livré : Corriger, Professionnaliser, Traduire en français, Traduire en anglais. Une action décochée « Dans la bulle » n’y figure pas.
- **Présélection** [Q 3], stable dans le temps :
  - cible prouvée remplaçable : la première action dont la sortie habituelle est Remplacer (on écrit → Corriger) ;
  - sinon, la première dont la sortie habituelle est Afficher (on lit → Traduire en français).

### 3.3 Clavier

- **Fenêtre.** Pendant `choosing`, elle ne s’active pas (`WS_EX_NOACTIVATE`, `MA_NOACTIVATE`).
- **Hook de la bulle**, sur un thread dédié, posé **dès le WM_HOTKEY du geste**, avant la capture ; retiré à la fermeture.
  - Jusqu’à l’apparition (capture UI Automation, ou copie jusqu’à environ 950 ms, puis rendu), il met en attente lettres attribuées, Entrée, flèches et Tab. Une lettre ou Entrée en attente s’applique dès la fin de la capture, sans montrer la bulle.
  - Une touche non attribuée tapée avant passe à l’application et abandonne la capture. Si rien n’est lisible, les touches en attente sont jetées.
- **Hook Échap.** Aujourd’hui permanent, sur le thread principal [code]. Il rejoint ce thread, n’est posé que quand l’overlay est visible, et sert de garde de frappe (§ 4) : il note qu’une touche physique hors modificateurs a été pressée dans la source, jamais laquelle.

| Touche | Effet |
|---|---|
| ↑ ↓ | Ligne active ; défilement au-delà de 6 |
| Entrée · Maj+Entrée | Appliquer avec la sortie affichée · avec l’autre, si la cible l’admet |
| Lettre · Maj+lettre (Ctrl+Alt tenus ou non) | Appliquer cette action · avec l’autre sortie, si la cible l’admet |
| Maj tenue | La ligne active montre l’autre sortie ; rien sur une cible non remplaçable |
| Tab · Maj+Tab | Moteur suivant · précédent **pour l’action active, cette fois**, parmi ceux qui savent la faire, en ligne d’abord. Les autres lignes gardent le leur ; pied « Rédaction · pour cette fois » |
| Échap, ou nouvel appui du geste | Fermer |
| Toute autre touche | Fermer et laisser passer la touche |

**Règles du hook.**
- **Appuis seuls.** Relâchés et répétition automatique sont ignorés : le relâché d’Espace, ou un geste tenu, ne ferme rien.
- **Premier plan.** Il n’agit que si le premier plan est la source ou l’overlay, comme le hook Échap [code : `host.rs`] ; sinon la bulle se ferme (§ 3.5).
- **Ce qu’il avale** : les touches du tableau et les lettres attribuées, puis leurs relâchés avant de se retirer. Il laisse passer les évènements injectés (nos Ctrl+Insert et Ctrl+V) et tous les modificateurs. Avaler une lettre ne perd rien : sur une sélection, elle l’aurait écrasée.
- **Touche masque.** Touche avalée pendant qu’Alt est tenu sans Ctrl : il injecte VK 0xE8, sinon le relâché d’Alt ouvre la barre de menus ou les KeyTips d’Office, qui prennent le focus. Inutile avec Ctrl+Alt tenus [doc : AutoHotkey, A_MenuMaskKey]. [proto : Maj avec Alt ou Ctrl, qui change la disposition]
- [proto] Il doit passer avant RegisterHotKey, pour qu’une lettre tapée Ctrl+Alt tenus ne lance pas aussi un raccourci direct.

### 3.4 Souris

- **Survol** : la ligne devient active, mais seulement après un vrai déplacement du pointeur depuis l’ouverture, comme les menus natifs. Le pointeur qui vient de sélectionner est tout près : un tremblement ne doit pas changer Entrée.
- **Clic sur la ligne** : l’action s’applique.
- **Clic sur le mot « Remplace » / « Affiche »** : bascule pour cette fois, sans lancer ; infobulle « Maj+Entrée ». Inerte sur une cible non remplaçable.
- **Clic sur le pied** : les moteurs qui savent faire l’action active remplacent les actions dans la même surface [Q 4].

```
+--------------------------------------+
|   < Corriger                         |
| | Général        hors ligne    coché |
|   Rédaction      Ollama              |
|   Petit          Ollama              |
|  ----------------------------------  |
|   Pour toutes les actions            |
+--------------------------------------+
```

- **Si un clic active quand même la fenêtre** : chemin « Remplacer » existant ; la source revient au premier plan, la cible est revalidée, puis on colle [proto].

### 3.5 Fermeture et enchaînement

- **Fermer sans agir** :
  - Échap, nouvel appui du geste, touche hors liste ;
  - changement de fenêtre au premier plan, **pour toute capture**, y compris sans ancre, que `watch_context` saute aujourd’hui [code : `lib.rs`] ;
  - clic hors de la bulle (le hit-tester lit déjà le bouton gauche) : la cible est invalidée ;
  - changement de sélection, quand l’ancre permet de le voir ;
  - 12 s sans interaction : estompe existante, que le survol retient ;
  - **plafond dur de 30 s**, survol ou non : bulle et hook partent.
- **Au choix** : la bulle s’efface en 100 ms ; la pilule d’attente naît dans son coin et se décale de 4 px ; le parcours 1.0 reprend (`visuel/t2-fondu.png`, `t3-attente.png`, `t4-verre.png`). Le verre de 380 px dépasse la bulle sur la gauche : accepté.
- **Remplacer.** `visuel/t5-remplace.png` : une correction plus longue remonte sous la coche. Si le rectangle relu après le collage touche la pilule, la coche éclot puis sort aussitôt, sans tenir 900 ms [proto].

### 3.6 Si le prototype invalide

| Constat | Repli |
|---|---|
| Un clic active la bulle | Clavier par le hook ; clic par le chemin Remplacer |
| Hook lent, touches perdues, ou alerte de Defender ou d’un EDR | **Bulle activée** : au geste, elle prend le premier plan, puis rend la main à la source avant d’agir. La source perd le focus (autocomplétion fermée, `blur`) [Q 8] |
| Les deux | Bulle à la souris seule ; le clavier passe par les raccourcis directs |
| Ctrl+Alt+Espace pris ou refusé | La personne choisit sa combinaison dans Démarrer ou Actions, vérifiée de même |

---

## 4. Afficher ou remplacer

**Trois cas de cible, fixés à la capture.**

| Cible | Quand | Dans la bulle |
|---|---|---|
| **Remplaçable** | UI Automation prouve un champ modifiable (ValuePattern ou plage sans `IsReadOnly`), y compris sur la voie copie | Sortie habituelle de l’action |
| **Inconnue** | Voie copie sans cette preuve : Word, Teams, VS Code, Discord d’après UI-019 | « Affiche » ; Remplacer reste possible par Maj, le mot, puis la pilule |
| **Non remplaçable** | Copie faite soi-même, console, mot de passe, champ prouvé en lecture seule | « Affiche » ; Maj et le mot sont inertes |

Aujourd’hui, toute copie synthétique compte comme remplaçable [code : `capture::replaceable`] : sur un message reçu dans Teams, la coche s’afficherait sans rien coller. [proto : preuve UI Automation dans Word, Teams (message reçu, zone de saisie), VS Code, Discord]

**Règle unique.**
- Cible remplaçable : la sortie habituelle de l’action. Sinon : Afficher.
- Pour cette fois : Maj, clic sur le mot, ou « Plus d’options » sur un raccourci.
- Un raccourci direct réglé sur Remplacer garde le comportement 0.4.0 sur une cible inconnue : c’est un choix explicite.

**Sorties livrées** [Q 5] : Corriger et Professionnaliser, Remplacer ; Traduire en français et Traduire en anglais, Afficher (on relit la traduction avant de l’utiliser ; Remplacer est dans la pilule ou par Maj) ; nouvelle action, Afficher.

**Après un affichage.**
- Tant que la cible est valide, **Remplacer entre dans la pilule** du verre court : étiquette, Copier, Remplacer, ⋯, Fermer. Quatre boutons, le plafond.
- Dans la bande de lecture, la pilule est pleine : Remplacer reste dans ⋯.
- Une relance s’affiche toujours dans le verre.

**Remplacer** garde UI-027 : pilule seule, coche, verre seulement si le collage échoue. [proto] Si la matrice ne montre aucun faux négatif, un collage relu lisible mais sans le résultat ouvre le verre au lieu de la coche.

**Garde de la cible**, du geste jusqu’au collage.
- **Capture ancrée** : `watch_context` compare la sélection, comme aujourd’hui.
- **Capture sans ancre** (Word, Teams, VS Code, Discord) : la sélection ne se relit pas [code : `validate_target`], et un clic dans Word puis une lettre colleraient le résultat au curseur. Toute frappe physique dans la source et tout clic hors de nos surfaces invalident donc la cible.

**Limite connue.** Taper ou cliquer dans la source pendant le calcul annule le collage, avec ou sans ancre ; le verre s’ouvre avec « La sélection a pu changer pendant le calcul. Copiez le résultat. » Reste non détectée : une modification faite par l’application elle-même (co-édition) sur une capture sans ancre.

---

## 5. Raccourcis directs

- **Toujours immédiats** : une combinaison, une action (UI-011, 15/09).
- **Ce qu’ils héritent** : la sortie et le moteur de leur action. « Plus d’options » les force : on peut encore avoir un Corriger qui affiche et un qui remplace.
- **Où les éditer** : dans la carte de l’action. À l’ajout, Ctrl+Alt+la lettre de l’action est proposé, puis vérifié.
- **Plafonds** : 24 actions ; 0 à 24 raccourcis à partir de 0.8.0, avec au moins un déclencheur actif (geste ou raccourci), vérifié côté Rust. Aujourd’hui : 1 à 12 raccourcis [code : `actions.rs`].
- **Livrés** : installation neuve, le geste seul ; Démarrer propose d’un clic Ctrl+Alt+C pour Corriger, en remplacement [Q 2] ; mise à jour, tous gardés, Ctrl+Alt+T compris.
- **« Action par défaut » disparaît.** Elle pré-remplissait un raccourci (la présélection de la bulle la remplace) et choisissait l’action d’une capture sans raccourci : `Execution::snapshot`, donc `--demo`, la sonde native et les visual-tests (la première action la remplace) [code].

---

## 6. Serveurs et moteurs

### 6.1 Vocabulaire et données

- **Moteur** : ce qu’on choisit, un modèle sur un serveur, avec un nom lisible. Qualité et Rapide deviennent des noms par défaut, modifiables.
- **Serveur** : une adresse et une clé. Il n’apparaît que sur la page Moteurs.
- **Lieu**, sous chaque nom : « Serveur sur ce PC » (adresse de bouclage) ; « En ligne via Ollama » (tag Ollama finissant par `cloud`, servi par localhost mais exécuté chez Ollama) ; sinon « Sur » et l’hôte (« Sur openrouter.ai », « Sur msigt.lan »). Le lieu dit où est le serveur, pas où finit le texte : un serveur local peut relayer (proxy, tunnel).
- **Traduction seulement** : attribut de moteur, posé d’office pour les Hy-MT connus (`flowtranslate-fast`, `flowtranslate-quality`, identifiant contenant `Hy-MT`), modifiable. Pour une action qui n’est pas une traduction, la bulle, Tab et « Relancer avec… » ne le proposent pas ; assigné à la main dans une carte, il porte un avertissement avec le bouton « C’est une traduction ».
- **Jamais** « endpoint », « provider » ni « profil ».

| Entité | Contenu |
|---|---|
| Serveur | Nom, adresse, clé (DPAPI, jamais transmise à l’overlay) |
| Moteur | Serveur, identifiant du modèle, nom, traduction seulement. Leur ordre est celui des listes |
| Action | Nom, consigne, règles de sortie ajoutées (oui/non), traduction (oui/non), pictogramme, lettre, sortie habituelle, moteur (vide = défaut), « dans la bulle ». Leur ordre est celui de la bulle |
| Raccourci | Combinaison, action, activé, sortie et moteur forcés (vide = hérité) ; `outputMode` reste écrit, avec la sortie effective |
| Réglages | `schemaVersion`, serveurs, moteurs, moteur par défaut, moteur forcé [Q 10], actions, raccourcis, geste, accueil vu, historique, démarrage, lecture ; `mode` et `profiles` toujours écrits (§ 6.2). Retirés : `defaultActionId`, `connectionExpanded` |
| Exécution vue par l’overlay | Action, sortie, cible (§ 4), moteur (nom, lieu), origine (bulle, raccourci, relance). Remplace `mode` |
| Historique | Nouvelle colonne moteur (copie du nom) ; la colonne `mode` garde `fast` ou `quality` |

**Quel moteur part** : le choix fait dans la bulle ; sinon le moteur forcé, s’il sait faire l’action [Q 10] ; sinon celui du raccourci ; sinon celui de l’action ; sinon le défaut. Jamais de bascule automatique (SPEC). La capture fige serveurs et moteurs, comme les profils aujourd’hui [code].

### 6.2 Migration et retour arrière

Le format change trois fois : 0.6.0 (serveurs), 0.7.0 (sorties, consignes, fin de `defaultActionId`), 0.8.0 (geste, lettres, 0 raccourci).

1. **Sauvegarde par montée.** `schemaVersion` apparaît en 0.5.0. Avant chaque montée, le fichier est copié en `settings.v{n}.json`, puis migré : `v0` pour la 0.4.0, `v1` pour la 0.5.0, `v2` pour la 0.6.0, `v3` pour la 0.7.0.
2. **Chargement tolérant, dès 0.5.0.** Aujourd’hui, un fichier refusé arrête le démarrage sans message [code : `lib.rs`, `setup`]. Désormais, il est mis de côté, la dernière sauvegarde lisible ou des réglages neufs sont chargés, et un avis le dit.
3. **Lisible par la 0.4.0 jusqu’à 1.0.** Elle ignore les champs inconnus, mais exige `mode`, `profiles` (`fast`, `quality`), un `outputMode` par raccourci et 1 à 12 raccourcis [code : `settings.rs`, `actions.rs`] : les trois premiers restent écrits. Son historique refuse en bloc un `mode` autre que `fast` ou `quality` [code : `history.rs`] : le moteur va dans sa propre colonne.
4. **Profils** (0.6.0). Chaque profil devient un serveur (même adresse normalisée et même clé : un seul serveur) et un moteur, `fast` « Rapide », `quality` « Qualité », « Traduction seulement » si Hy-MT connu. Le défaut reprend l’ancien mode. Réglages neufs : les trois moteurs connus, Corriger et Professionnaliser sur Général.
5. **Actions** (0.7.0).
   - Aucune n’a de moteur propre ; les deux Traduire sont marquées traduction.
   - Sortie habituelle : celle de leurs raccourcis s’ils sont d’accord, sinon celle livrée. Un raccourci qui diffère la garde en sortie forcée : **aucun raccourci ne change de comportement**.
   - Ordre : une liste identique à celle livrée en 0.4.0 prend l’ordre 1.0 ; toute autre est gardée, et l’encadré « Nouveau » dit que la bulle présélectionne la première action qui remplace.
6. **Consignes** (0.7.0). Les règles de sortie sont retirées seulement si elles terminent exactement la consigne : « règles ajoutées : oui », comme pour les actions livrées et nouvelles. Toute autre consigne reçoit « non » et part telle quelle, qu’elle ait été écrite sans règles ou avec des règles retouchées [code : `OUTPUT_RULES` ; `migrate_template` ne les ajoute pas].
7. **Geste** (0.8.0). Activé s’il s’enregistre et passe la vérification AltGr ; sinon désactivé, raison dans Actions. Lettres attribuées, toutes les actions dans la bulle.
8. **Clés.** Réécrites chiffrées (étendre `migrated_credentials_remain_dpapi_encrypted`).
9. **Aucune réaffectation à la mise à jour.** La page Moteurs propose « Trouvé sur ce PC : flowtranslate-general · Ajouter » [Q 7].

**Revenir en arrière** (recopié dans les notes de chaque version) : quitter FlowTranslate par l’icône ; dans `%APPDATA%\com.flowtranslate.desktop\`, remplacer `settings.json` par `settings.v{n}.json` de la version visée, en perdant ce qui a été réglé depuis ; installer cette version. Sans restaurer, la 0.4.0 démarre encore tant que le fichier garde 1 à 12 raccourcis.

### 6.3 Écrans

```
 Moteurs                          Moteur par défaut [ Qualité   v ]
                                                [Ajouter un moteur]
+------------------------------------------------------------------+
| Rapide    flowtranslate-fast · Serveur sur ce PC · 127.0.0.1:8001 |
|           Connecté · 38 ms · Traduction seulement                 |
|           Utilisé par Traduire en français, Traduire en anglais   |
+------------------------------------------------------------------+
| Général   flowtranslate-general · Serveur sur ce PC · :8003       |
|           Hors ligne · Utilisé par Corriger, Professionnaliser    |
+------------------------------------------------------------------+
| Ollama · Serveur sur ce PC · 127.0.0.1:11434  Connecté [Vérifier] |
|   Rédaction   mon-modele-27b                                      |
|   Grand       un-modele:cloud              En ligne via Ollama    |
+------------------------------------------------------------------+
```

**Page Moteurs.**
- Un serveur à un seul modèle tient en une ligne (le serveur FlowTranslate : un port, un modèle).
- États : « Connecté · 38 ms », « Hors ligne », « Modèle introuvable », « Clé refusée », « Non vérifié ». Serveurs locaux vérifiés à l’ouverture ; Vérifier reste disponible ; adresse vérifiée à la sortie du champ.
- Supprimer un moteur utilisé renvoie ses actions au défaut, avec « Annuler » dans la page.

**Ajouter un moteur** : une carte qui se déplie.
1. **« Où tourne le modèle ? »** Interrogation en bouclage, 1 s, des ports 8001 à 8003, 8000, 8080, 1234 et 11434 : « Trouvé sur ce PC · 127.0.0.1:8003 · 1 modèle », sinon « Autre adresse ». La clé n’est demandée que sur un 401 ou 403, ou pour une adresse distante.
2. **Modèles à garder**, cochés dans `/models`, que `inference::check` lit déjà [code]. Un seul : étape sautée. LM Studio : « Chargé à la première demande ».
3. **Pas de liste** : identifiant saisi à la main, « Non vérifié ».

**Choisir le moteur.**
- **Par défaut** : liste en tête de la page Moteurs, pour les actions sans moteur propre.
- **Forcé, pour tout** [Q 10] : sous-menu natif « Moteur ▸ » de l’icône, « Selon les actions » (coché d’origine) puis les moteurs. Un moteur choisi s’impose à toutes les actions qu’il sait faire, jusqu’au retour à « Selon les actions ». C’est le menu déroulant configuré une fois. L’icône étant souvent cachée sous Windows 11, le même choix figure en tête de la page Moteurs et en bas de la sous-liste de la bulle.
- **Par action** : liste « Moteur » de la carte, qui commence par « Par défaut (Qualité) ».
- **Pour cette fois** : pied de la bulle ou Tab. À l’ouverture, un `GET /models` part vers les serveurs locaux affichés (300 ms au plus, sans retarder la bulle, gardé 30 s). Un serveur distant n’est jamais interrogé d’office [proto : coût].

**Relancer.**
- Un seul autre moteur capable : « Relancer avec Rapide » dans ⋯.
- Deux ou plus : « Relancer avec… » remplace le menu par un retour et les moteurs qui savent faire l’action, en ligne d’abord ; la réserve de 236 px en montre six [code : `layout.ts`], la liste défile au-delà.
- Infobulle de l’étiquette de la pilule : « Corriger · Général ».

---

## 7. Premier lancement

**Installation neuve.** Les Réglages s’ouvrent une fois, sur **Démarrer** : une page, pas un assistant.

```
+------------------------------------------------------------------+
| 1  Moteurs                                                       |
|    Serveur FlowTranslate : Rapide et Général en ligne,           |
|    Qualité arrêté. Traduire utilise Rapide ; Corriger et         |
|    Professionnaliser utilisent Général.               [Modifier] |
|                                                                  |
| 2  Essayer                                                       |
|    Sélectionnez la phrase, puis  [Ctrl] [Alt] [Espace]           |
|    [ Je vous envoi le devis corigé.          ]        [Corriger] |
|    Je vous envoie le devis corrigé.                              |
|                                                                  |
| 3  Au quotidien                                                  |
|    Partout : sélectionnez du texte, puis  [Ctrl] [Alt] [Espace]  |
|    Lancer avec Windows                                  (activé) |
+------------------------------------------------------------------+
```

- **Moteurs.**
  - **Serveur FlowTranslate** : dès qu’un modèle `flowtranslate-*` répond, les trois moteurs connus (8001 à 8003) et leur assignation sont créés, ceux qui ne répondent pas marqués « Hors ligne ». Les trois ne tournent jamais ensemble : Qualité et Général partagent le GPU 0 (0,80 et 0,85 de sa mémoire) [code : `server/compose.yaml`].
  - **LM Studio ou Ollama déjà installés** : trouvés par la même recherche en bouclage ; leurs modèles sont proposés, le premier devient le défaut, rien n’est supposé de leurs capacités.
  - **Aucun serveur trouvé** [Q 11] : la page demande l’adresse du serveur (clé si demandée), rien de plus. Pas de lien d’installation ni de service en ligne proposé ; une adresse distante reste acceptée (HTTPS).
- **Essayer** prend un moteur en ligne qui sait faire l’action, sinon le dit : « Corriger a besoin de Général, hors ligne. » C’est l’inférence sans capture des cartes d’action.
- **Le geste dans la page.** Les Réglages au premier plan refusent aujourd’hui toute capture [code : `capture_with_binding`]. Sur Démarrer, le geste est transmis à la page : si la phrase d’exemple est sélectionnée, la page ouvre la bulle sur le champ, sans capture native ni hook, puisqu’elle a le focus. Ailleurs dans les Réglages : « Fermez cette fenêtre, puis essayez dans votre messagerie. »
- **Au quotidien** : le geste en grand. « Lancer avec Windows » est présenté activé, mais la clé Run n’est écrite qu’à la fermeture de Démarrer, et jamais si la personne l’a coupé [proto : Defender, binaire non signé qui pose un hook et injecte des touches].
- **À la fermeture**, avis 4 s : « FlowTranslate est prêt. Sélectionnez du texte, puis Ctrl+Alt+Espace. » Ensuite, rien ne surgit ; restent l’infobulle de l’icône et Démarrer en pied de navigation.

**Mise à jour depuis la 0.4.0.** Aucune fenêtre ne s’ouvre. À la prochaine ouverture des Réglages, un encadré en tête d’Actions : « Nouveau : Ctrl+Alt+Espace ouvre la bulle d’actions. »

**Aucun moteur configuré.** La bulle s’ouvre, pied « Aucun moteur » ; choisir une action ouvre le verre d’erreur avec Réglages.

---

## 8. Réglages

**Navigation 1.0 gardée** : Actions, Lecture, Moteurs, Confidentialité, plus **Démarrer** en pied, avant Quitter. Ouverture sur Démarrer la première fois, sur Actions ensuite, sur la carte concernée depuis une erreur.

**Actions.**
- **En tête, le groupe « Bulle d’actions »** : la combinaison, Modifier, la raison d’un refus.
- **Les cartes**, dans l’ordre de la bulle, réordonnées par glisser-déposer ou Monter et Descendre au clavier.
- **« Nouvelle action ▾ »** : Vide, ou Traduire vers… (la langue remplit la consigne ; l’action est marquée traduction).

```
+------------------------------------------------------------------+
| [ic] Corriger       Remplace · Général   [C]  Ctrl Alt C       ^ |
|  --------------------------------------------------------------  |
| Nom   [ Corriger                  ]                 Lettre [ C ] |
| Dans la bulle                                           (activé) |
| Sortie habituelle   [ Remplacer | Afficher ]                     |
| Moteur              [ Général                      v ]           |
| Consigne                                                         |
| [ Corrige l’orthographe et la grammaire du texte…         ]      |
| Ajouter les règles de sortie  (activé)  > Voir   Rétablir        |
| Essayer  [ texte d’exemple                  ]          [Essayer] |
|          résultat, avec le moteur utilisé                        |
| Raccourcis directs                                               |
|   (activé)  Ctrl Alt C   [Modifier]   Plus d’options   [x]       |
|   + Ajouter un raccourci                                         |
| [Dupliquer]                                 [Supprimer l’action] |
+------------------------------------------------------------------+
```

- **Essayer** évite de fermer les Réglages. Rien de ce qu’on y tape ne va dans les journaux ni dans l’historique.
- **Supprimer** n’est plus bloqué : l’action part avec ses raccourcis ; « Action supprimée · Annuler » s’affiche.
- **Retirés** : badge et bouton Par défaut ; règles de sortie dans le texte de la consigne.

**Lecture.** Inchangée.

**Confidentialité.**
- **Où vont vos textes** : « Serveur sur ce PC : Rapide, Qualité, Général. Ailleurs : aucun. » Dessous : « Un serveur sur ce PC peut lui-même relayer vers Internet (proxy, tunnel, modèle en ligne d’Ollama). »
- **Historique** : comme aujourd’hui, le texte sélectionné et le résultat, chiffrés, 7 jours et 100 entrées au plus, désactivé par défaut [code : `history.rs`]. Il gagne Copier et se relit à chaque ouverture (aujourd’hui au montage seulement).
- **Lancer avec Windows.**

---

## 9. Erreurs

**Une erreur ne s’efface plus au temps de lecture.** Elle reste jusqu’à Échap, Fermer ou l’action suivante. L’icône reste en alerte jusqu’à la prochaine réussite ; son infobulle nomme le dernier problème, sans contenu [Q 6].

| Situation | Message ou signe | Commandes |
|---|---|---|
| Moteur hors ligne à l’ouverture de la bulle | Pied « Général · hors ligne » | Tab ; Entrée reste possible |
| Moteur injoignable | « Le moteur Général ne répond pas. Vérifiez qu’il est démarré sur 127.0.0.1:8003. » | Réessayer ; « Relancer avec {moteur} » si un moteur qui sait faire l’action a répondu dans les 5 dernières minutes, sinon Réglages (sur ce moteur) |
| Modèle absent | « Le serveur 127.0.0.1:8003 répond, mais le modèle flowtranslate-general n’y est pas. Choisissez un modèle dans les Réglages. » | Réglages |
| Clé refusée | « openrouter.ai refuse la clé du moteur Rédaction. Vérifiez la clé dans les Réglages. » | Réglages |
| Aucun moteur | « Aucun moteur n’est configuré. Ajoutez-en un dans les Réglages. » | Réglages |
| « Traduction seulement » assigné à la main à une autre action | Pied « Rapide · traduction seulement » ; avertissement dans la carte | Tab ; Relancer avec… |
| Modèle inadapté non marqué | Indétectable ; l’infobulle « Corriger · Petit » et Essayer le rendent visible | Relancer avec… |
| Collage refusé, sélection changée ou touchée | Parcours 1.0 : verre avec le résultat et la raison | Copier |
| Rien de lisible · administrateur · touches tenues | Avis (§ 3.1) | aucune |
| Réglages illisibles au démarrage | Avis « Vos réglages étaient illisibles : la dernière sauvegarde est chargée. » | Réglages |
| Geste non enregistré | Réglages ouverts sur « Bulle d’actions », avec la raison | Modifier |
| Hook impossible à poser | Bulle utilisable à la souris ; pied « Clavier indisponible » | clic |

---

## 10. Design system 1.0 : surfaces à ajouter ou modifier

| Surface | Changement |
|---|---|
| **ActionPicker** (nouvelle) | 280 px, lignes de 32, rayon 16, `glass` + `shadow-menu`, 6 lignes visibles, pied `caption` de 32 px ; trois orientations (sous, au-dessus, en bas). Ligne active : `glass-hover` + tiret `signal` de 3 px. Mot de sortie : `tag` en `glass-ink-muted`. Avertissements du pied : `glass-warning`. Sous-liste Moteurs dans la même surface |
| Keycaps | Variante `glass` (touche graphite) ; contraste à vérifier à 125 % |
| `geometry`, `layout.ts`, hit-test | `picker-width` 280, `picker-rows` 6, forme `choosing` et sa région, hauteur de la bulle dans `extent`. Aucune hauteur de fenêtre ne change |
| Mouvement | Bulle : entrée 180 ms, sortie 100 ms. Pilule qui naît au coin, 4 px. Mot de sortie : 120 ms |
| ActionPill | Bouton Remplacer (verre court, cible valide) ; infobulle « action · moteur » |
| OverlayMenu | « Relancer avec {moteur} » ou sous-liste qui défile ; Remplacer quitte le menu du verre court |
| GlassError | Nomme le moteur ; Réessayer et « Relancer avec » ou Réglages ; pas d’estompe |
| Notice | Rien à traiter, administrateur, touches tenues, réglages illisibles, « prêt » |
| SettingsNav · **StartPage** (nouvelle) | Démarrer en pied · moteurs trouvés ou deux voies sans moteur, essai, bulle dans la page, geste, démarrage |
| ActionRow | Ajouts : lettre, sortie (Segmented), moteur (SelectField) avec avertissement, Dans la bulle, règles de sortie, Essayer, Dupliquer, poignée. Retraits : badge et bouton Par défaut |
| ShortcutBinding | Sortie sous « Plus d’options » ; refus AltGr expliqué ; avertissement sur une combinaison existante |
| EngineCard → **ServerCard**, **EngineRow**, **AddEngine** | Serveur, lieu, état, Vérifier ; moteur renommable, modèle, « Traduction seulement », « Utilisé par » ; ajout guidé |
| Callout · zone de notification | « Nouveau : … », « Action supprimée · Annuler », « Trouvé sur ce PC … » · sous-menu « Moteur ▸ », infobulle avec le geste |
| README et `10-parcours.md` | Noms par défaut ; « Relancer avec » ; « Choisir dans la bulle » ; « rien ne vole le focus » précisé ; « Serveur sur ce PC » |

---

## 11. Décisions validées

| Rouverte | Source | Devient | Pourquoi |
|---|---|---|---|
| Deux endpoints indépendants | SPEC | N serveurs et N moteurs ; « aucun repli implicite » gardé | Demande de Lucas ; le serveur livré en expose déjà trois |
| Ctrl+Alt+T livré par défaut | 09/09 | Installation neuve : le geste, plus [Q 2] | Une seule chose à apprendre |
| Effacement au temps de lecture | UI-022 (14/09) | Sauf pour les erreurs | Une erreur manquée devient un échec muet [Q 6] |
| Action par défaut | 0.4.0, ActionRow 1.0 | Retirée ; la première action sert aux captures sans raccourci | La présélection prend son autre rôle |
| Ordre livré, Traduire en tête | `actions::defaults` | Corriger en tête | « On écrit → Corriger » en dépend |
| Copie synthétique toujours remplaçable | `capture::replaceable` | Cible « inconnue » : la bulle propose Afficher ; raccourcis inchangés | Un message reçu dans Teams annoncerait « Remplace » |
| Noms fixes Qualité et Rapide, « Relancer en » | Brand book 1.0 | Noms par défaut, « Relancer avec » | Les moteurs se renomment |
| Remplacer dans ⋯ | OverlayMenu 1.0 | Dans la pilule du verre court | Lire puis remplacer en un clic |
| Démarrage automatique coupé par défaut | SPEC | Présenté activé sur Démarrer, écrit à sa fermeture | Sinon, après un redémarrage, le geste ne fait plus rien |
| 1 à 12 raccourcis | `actions.rs` | 0 à 24 dès 0.8.0, un déclencheur actif au moins | Geste seul et quatorze tâches |
| L’overlay ne prend pas le focus | 09/09, SPEC | Gardé ; rouvert pour la bulle seulement si le repli « bulle activée » est retenu | [Q 8] |

**Gardées** : UI-011 (aucune confirmation sur un raccourci direct), « un raccourci = une action » et la priorité Ctrl+A → Corriger du 15/09 ; UI-015 (réserve du menu), UI-021, UI-024, UI-025 (placement décidé à la capture), UI-023, UI-027 (pilule seule en Remplacer) ; UI-019 et UI-020 (copie synthétique, copie de moins de 3 s) ; UI-028 (langue dans la consigne). Invariants : rien de modal ; aucun texte dans les journaux, y compris Essayer et la garde de frappe ; clés et historique chiffrés ; HTTPS hors bouclage.

---

## 12. Versions

Chaque version est fusionnée seule dans `main`, CI verte et inférence vérifiée ; ses notes recopient la procédure de retour (§ 6.2).

| Version | Contenu | Vérification |
|---|---|---|
| **Étape 0 · prototype jetable** (branche, en parallèle de 0.5.0) | Fenêtre non activable ; hook au WM_HOTKEY avec touches en attente, appuis seuls, touche masque ; ToUnicodeEx ; preuve d’éditabilité sur la voie copie ; garde de frappe et de clic ; clic dans la bulle ; Ctrl+V injecté ; hook avant RegisterHotKey ; clé Run. Délais : voie UIA < 150 ms du geste à la bulle ; voie copie < 500 ms après le relâchement (la matrice 0.1.8 mesurait environ 450 ms de bout en bout). Tranche le § 3.6 | Bloc-notes, Chrome (`textarea`, `contenteditable`), Outlook Web autocomplétion ouverte. **Word et VS Code** : changer de fenêtre bulle ouverte, cliquer ailleurs puis taper une lettre attribuée, taper pendant le calcul. **Teams** : message reçu, zone de saisie. « Geste puis P » d’une traite ; geste tenu 2 s ; Ctrl relâché avant Alt puis une lettre ; Maj avec Alt. Defender ; Narrator |
| **0.5.0 · Verre et Réglages 1.0** | Portage du design system (Moteurs garde deux EngineCard) ; libellés « résultat » ; Réglages ouverts sur la bonne page ; adresse vérifiée à la sortie du champ ; historique relu, avec Copier ; erreurs sans estompe ; `schemaVersion` et chargement tolérant ; `DEPLOYMENT.md`, `ENDPOINTS.md` | `visual-tests` régénérés, matrice réelle, inférence ; fichier corrompu → démarrage avec avis ; retour à 0.4.0 |
| **0.6.0 · Moteurs** | Serveurs et moteurs ; migration avec sauvegarde, `mode` et `profiles` toujours écrits ; page Moteurs, ajout guidé, lieu, « Traduction seulement » ; moteur par action ; moteur forcé et « Moteur ▸ » ; « Relancer avec… » ; erreurs nommées ; « Où vont vos textes ». Réglages neufs : trois moteurs connus, Corriger et Professionnaliser sur Général | Vrai `settings.json` migré à l’identique ; installation neuve : Corriger → Général ; Général arrêté → erreur nommée, aucun Hy-MT proposé ; 0.4.0 relancée sans restaurer (démarre, historique lisible), puis avec `settings.v0.json` |
| **0.7.0 · Actions** | Sortie habituelle et trois cas de cible ; règles de sortie par action ; ordre livré ; Essayer ; Dupliquer ; Nouvelle action ; suppression avec Annuler ; fin de l’action par défaut ; AltGr pour les nouvelles combinaisons ; Remplacer dans la pilule ; garde de frappe et de clic ; coche raccourcie. Toujours 1 à 12 raccourcis | Raccourcis 0.4.0 inchangés ; action perso sans règles envoyée telle quelle ; `--demo`, sonde et visual-tests passent ; Ctrl+Alt+E existant actif, nouveau refusé en AZERTY ; Word : taper pendant le calcul → collage refusé ; aucun texte d’Essayer dans les journaux |
| **0.8.0 · Bulle d’actions** | Geste, bulle, lettres, « Dans la bulle », présélection ; hooks sur thread dédié ; moteur pour cette fois ; pré-vérification locale ; avis administrateur et touches tenues ; 0 à 24 raccourcis, un déclencheur actif au moins ; installation neuve selon Q 2, avec avis « prêt » et infobulle du geste ; encadré « Nouveau » ; repli retenu à l’étape 0 | Matrice de l’étape 0 sur le vrai produit ; Ctrl+Z ; aucune touche orpheline après 200 ouvertures ; installation neuve : le geste se découvre sans Démarrer |
| **0.9.0 · Premier lancement** | Démarrer ; trois moteurs connus dès qu’un `flowtranslate-*` répond ; LM Studio et Ollama déjà installés ; sans serveur trouvé, adresse demandée [Q 11] ; essai et bulle dans la page ; démarrage écrit à la fermeture | Réglages effacés (copie gardée) : serveur avec Général arrêté, Ollama seul, rien ; installation NSIS neuve ; Defender |
| **1.0.0 · Stabilisation** | Test papier avec cinq personnes non techniques (Q 3, Q 5) ; Narrator ; EDR et anti-cheat ; contrastes à 125 % | Recette complète |

---

## 13. Décisions de Lucas (17/09)

| Q | Question | Décision | Conséquence dans la spec |
|---|---|---|---|
| 1 | Geste par défaut | **Ctrl+Alt+Espace**, Ctrl+Espace proposé au choix avec avertissement | § 3.1 ; pas d’option « Ctrl+Alt relâchés » ni de double Ctrl |
| 2 | Raccourcis à l’installation neuve | **Le geste seul** ; Démarrer propose Ctrl+Alt+C pour Corriger en un clic | § 5, § 7 |
| 3 | Présélection à l’ouverture | **Selon le contexte** : cible remplaçable → première action qui remplace ; sinon première qui affiche | § 3.2 |
| 4 | Moteur choisi dans la bulle | **Pour cette fois**, et « Pour toutes les actions » en bas de la sous-liste | § 3.4, § 6.3 |
| 5 | Sortie de Traduire en anglais | **Afficher** (écart avec la recommandation « Remplacer ») | § 2.2, § 3.2, § 4 : les deux traductions affichent ; présélection inchangée (Corriger quand on écrit) |
| 6 | Durée des erreurs | **Jusqu’à Échap, Fermer ou l’action suivante**, icône en alerte | § 9 |
| 7 | Général branché d’office | **À l’installation neuve seulement** ; proposé à la mise à jour | § 6.2, § 7 |
| 8 | Repli si le hook ne tient pas | **Selon la matrice du prototype** : bulle activée si Outlook Web et Teams gardent leur sélection après le `blur`, sinon souris seule | § 3.6, § 12 étape 0 |
| 9 | Ordre des versions | **Moteurs (0.6.0) avant bulle (0.8.0)** | § 12 |
| 10 | Menu « Moteur ▸ » de l’icône | **Force un moteur** pour toutes les actions qu’il sait faire, jusqu’à « Selon les actions » | § 6.3 |
| 11 | Personne sans serveur | **Hors cible 1.0** (écart avec la recommandation) : Démarrer demande une adresse, sans lien d’installation ni service en ligne | § 7, § 12 (0.9.0) |

---

## 14. Relecture

Objections du contradicteur vérifiées dans le code le 17/09 : 20 retenues, dont 2 en partie, aucune écartée.

| # | Objection | Verdict et raison |
|---|---|---|
| 1 | Captures sans ancre non surveillées | Retenue : `watch_context` saute `anchor.is_none()`, `validate_target` ne relit pas la sélection → garde de frappe et de clic, fermeture au changement de premier plan |
| 2 | « Remplace » sur du texte en lecture seule | Retenue : `replaceable(Copy)` vaut `true`, `confirmed:false` donne `applied` → cible « inconnue », parcours Teams corrigé |
| 3 | Hook posé trop tard | Retenue : capture et rendu précèdent la bulle → hook au WM_HOTKEY, touches en attente |
| 4 | Lettre Ctrl+Alt tenus sur la voie copie | Retenue : `synthetic_copy` abandonne à 600 ms → attente de 3 s, avis dédié, deux objectifs de délai |
| 5 | Migration et retour arrière | Retenue : `load()?` puis `.expect`, champs obligatoires, `parse_mode` strict → sauvegardes par version, écriture compatible, procédure, AltGr sur les nouvelles combinaisons |
| 6 | Règles de sortie ajoutées à l’envoi | Retenue : `migrate_template` ne les ajoute pas, règles retouchées doublées → booléen par action |
| 7 | Règles du hook incomplètes | En partie : relâchés, répétition, plafond intégrés ; masque limité à Alt sans Ctrl (Ctrl+Alt n’ouvre pas les menus, doc AutoHotkey) ; Maj à mesurer |
| 8 | « 3 moteurs trouvés » irréaliste | Retenue : Qualité et Général partagent le GPU 0 → trois moteurs créés même hors ligne, parcours sans moteur, Q 11 |
| 9 | Capacités des moteurs ignorées | Retenue : Hy-MT ne fait que traduire (`server/README.md`) → « Traduction seulement », scénario 2.2 réécrit |
| 10 | Versions qui ne tiennent pas seules | Retenue : aucun appelant de `capture_text` dans l’interface, `Settings::default` en Hy-MT → 0 raccourci et avis « prêt » en 0.8.0, trois moteurs en 0.6.0 |
| 11 | Ordre des actions, argument de Q 2 | Retenue : `actions::defaults` commence par Traduire → ordre livré, présélection par sortie, Q 2 d |
| 12 | Historique sous-déclaré | Retenue : `HistoryStore::add` chiffre aussi `source_text` |
| 13 | « Sur ce PC » trompeur | Retenue : modèles `:cloud` d’Ollama servis par localhost → « Serveur sur ce PC », « En ligne via Ollama » ; lieu local retiré du pied, faute de place |
| 14 | Bascule globale absente | Retenue : un défaut ne touche pas les actions qui ont leur moteur → moteur forcé, Q 4 c, Q 10, portée de Tab |
| 15 | Côté « au-dessus » oublié | Retenue : `placement::overlay` choisit `Above` → liste qui monte, hauteur dans `extent` |
| 16 | Geste refusé depuis Démarrer | Retenue : `capture_with_binding` refuse les Réglages au premier plan → bulle dans la page |
| 17 | Survol qui change Entrée | Retenue : même défaut que « dernière action » → survol après un vrai déplacement |
| 18 | Démarrage automatique écrit trop tôt | En partie : risque Defender non vérifié ici, mais écrire la clé Run avant tout choix ne se justifie pas → écriture à la fermeture de Démarrer |
| 19 | « Relancer avec… » au-delà de quatre | Retenue : la réserve de 236 px montre six lignes → moteurs capables d’abord, défilement |
| 20 | Chemin démo sans action par défaut | Retenue : `Execution::snapshot` l’utilise sans raccourci → première action |
