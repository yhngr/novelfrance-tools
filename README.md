# NovelFrance Tools

Extension Chromium pour [novelfrance.fr](https://novelfrance.fr) — contrôle du volume TTS, défilement automatique du chapitre et raccourcis clavier.

> **Version actuelle : 2.3.3**

## Fonctionnalités

### Défilement automatique
- Scroll fluide avec accumulation sub-pixel (10–160 px/s, stable même à basse vitesse)
- Défilement continu par défaut, avec option pour le lier au TTS
- Tolérance aux micro-pauses audio quand le TTS est activé
- Pause automatique en cas de scroll manuel (bouton **Reprendre**)
- Panneau flottant déplaçable (statut, toggle, curseur vitesse, retour lecteur)
- Position par défaut : **bas droite** (volume : bas gauche)
- Raccourci `S` (personnalisable)

### Volume TTS
- Curseur intégré dans la barre « Lecture audio du chapitre »
- Volume max **100 %** par défaut (boost optionnel dans Options)
- Presets 25 / 50 / 75 / 100 % — masquables via bouton **▾** (au clic, pas au survol)
- Profils **Nuit / Voix faible / Casque** (volume + égaliseur)
- Normalisation automatique entre narrateurs
- Égaliseur (graves, médiums, aigus), limiteur anti-distorsion
- Molette souris, fade in/out, badge sur l'icône extension
- Contrôle flottant déplaçable (visible uniquement quand le TTS est lancé) + popup

### Interface
- **Popup** : cartes volume et auto-scroll, presets, profils, raccourcis
- **Options** : page complète avec toggles, curseurs visuels et barre d'enregistrement fixe
- Thème sombre unifié (accent rose)

## Installation

```bash
git clone https://github.com/yhngr/novelfrance-tools.git
cd novelfrance-tools
```

1. Ouvrir `chrome://extensions/` (ou `edge://extensions/`)
2. Activer le **Mode développeur**
3. **Charger l'extension non empaquetée** → sélectionner le dossier du projet
4. Recharger la page novelfrance.fr

## Utilisation rapide

| Action | Résultat |
| --- | --- |
| `S` | Activer / pause auto-scroll |
| `M` | Mute / unmute TTS |
| `↑` / `↓` | Volume ±5 % |
| Molette sur barre volume | Ajuster le volume |
| Bouton **▾** (barre volume) | Afficher / masquer presets et profils |
| Icône extension | Popup volume + scroll |
| Options | Tous les réglages |

Les touches média du clavier (volume / mute) sont aussi prises en charge.

## Structure du projet

```
├── manifest.json
├── background/service-worker.js
├── shared/storage.js
├── features/
│   ├── volume/       # audio-engine, content, volume.css
│   └── autoscroll/   # content, autoscroll.css
├── ui/
│   ├── popup/        # popup extension
│   └── options/      # page de réglages
└── icons/
```

## Compatibilité

- Chrome, Edge, Brave et autres navigateurs Chromium (Manifest V3)
- Testé sur novelfrance.fr — d'autres sites peuvent être ajoutés via Options (motifs Chrome)

## Confidentialité

- Aucune collecte de données personnelles
- Aucune communication avec un serveur externe
- Stockage local via `chrome.storage.sync` (préférences et volume uniquement)
- Accès limité aux sites configurés (novelfrance.fr par défaut)

## Licence

MIT — libre d'utilisation, modification et distribution.
