# NovelFrance Tools

Extension Chromium pour [novelfrance.fr](https://novelfrance.fr) — contrôle du volume TTS, défilement automatique du chapitre et raccourcis clavier.

> **Version actuelle : 2.4.5**

## Fonctionnalités

### Défilement automatique
- Scroll fluide avec accumulation sub-pixel (10–160 px/s, stable même à basse vitesse)
- Défilement continu par défaut, avec option pour le lier au TTS
- Tolérance aux micro-pauses audio quand le TTS est activé
- Pause en cas de scroll manuel, conservée lors des changements de page jusqu’au clic sur **Reprendre**
- Panneau flottant déplaçable (statut, toggle, curseur vitesse, retour lecteur)
- Position par défaut : **bas droite** (volume : bas gauche)
- Raccourci `S` (personnalisable)

### Volume TTS
- Curseur intégré dans la barre « Lecture audio du chapitre »
- Retour et avance de 10 secondes depuis le popup ou les raccourcis clavier
- Volume max **100 %** par défaut (boost optionnel dans Options)
- Presets 25 / 50 / 75 / 100 % — masquables via bouton **▾** (au clic, pas au survol)
- Profils **Nuit / Voix faible / Casque** (volume + égaliseur)
- Normalisation automatique entre narrateurs
- Égaliseur (graves, médiums, aigus), limiteur anti-distorsion
- Molette souris, fade in/out, badge sur l'icône extension
- Contrôle flottant déplaçable (visible uniquement quand le TTS est lancé) + popup

### Progression et navigation
- Panneau **Lecture** flottant au-dessus de l’auto-scroll (bas droite), déplaçable
- Vitesse TTS de 0,75× à 2×, mémorisée séparément pour chaque roman
- Barre discrète en haut de page (optionnelle)
- Estimation du temps de lecture et du temps audio restants
- Position de lecture enregistrée localement avec bouton de reprise
- Passage automatique optionnel au chapitre suivant à la fin du TTS

### Interface
- **Popup** : lecture (progression, vitesse TTS, reprise), auto-scroll, volume, profils
- **Options** : page complète avec toggles, curseurs visuels et barre d'enregistrement fixe
- Thème sombre unifié (accent rose)

## Installation

1. Télécharger l’archive ZIP du projet puis l’extraire, ou cloner le dépôt
2. Ouvrir `chrome://extensions/` (ou `edge://extensions/`)
3. Activer le **Mode développeur**
4. **Charger l'extension non empaquetée** → sélectionner le dossier du projet
5. Recharger la page novelfrance.fr

Aucune dépendance ni étape de compilation n’est nécessaire.

## Utilisation rapide

| Action | Résultat |
| --- | --- |
| `S` | Activer / pause auto-scroll |
| `M` | Mute / unmute TTS |
| `↑` / `↓` | Volume ±5 % |
| `J` / `L` | Reculer / avancer le TTS de 10 secondes |
| `[` / `]` | Diminuer / augmenter la vitesse TTS |
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
│   ├── autoscroll/   # content, autoscroll.css
│   └── reader/       # progression, reprise et navigation
├── ui/
│   ├── popup/        # popup extension
│   └── options/      # page de réglages
└── icons/
```

## Compatibilité

- Chrome, Edge, Brave et autres navigateurs Chromium (Manifest V3)
- Accès limité à `https://novelfrance.fr` et ses sous-domaines HTTPS

## Confidentialité

- Aucune collecte de données personnelles
- Aucune requête réseau vers un serveur applicatif externe
- Préférences générales synchronisées via `chrome.storage.sync`
- Volumes, romans et narrateurs conservés uniquement sur l'appareil via `chrome.storage.local`
- Progression et vitesse TTS par roman conservées uniquement sur l'appareil
- Aucun accès aux métadonnées des autres onglets et aucune permission globale sur tous les sites

## Licence

MIT — libre d'utilisation, modification et distribution.
