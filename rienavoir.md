const path = require('node:path');
const PptxGenJS = require('pptxgenjs');

const pres = new PptxGenJS();
pres.layout = 'LAYOUT_16x9';
pres.title = 'Actions RSE 2024-2026 - Céréalog & Bénéteau';

// ─── PALETTE ───────────────────────────────────────────────────────────────
const C = {
  darkGreen:   '0B3D2C',
  midGreen:    '1A6E4A',
  accent:      '2DC87A',
  accentLight: 'B6F0D3',
  bgLight:     'F3FAF6',
  white:       'FFFFFF',
  textDark:    '1C2B22',
  textMid:     '4A5E54',
  blueTech:    '1E5FA8',   // Céréalog (ESN / tech)
  blueOcean:   '0B4F8A',  // Bénéteau (nautisme)
  blueLight:   'D6E8FA',
  oceanLight:  'D0E9F7',
  cardBg:      'FFFFFF',
  separator:   'D4EAE0',
};

const makeShadow = () => ({ type: 'outer', blur: 8, offset: 3, angle: 135, color: '000000', opacity: 0.10 });

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 1 — TITRE
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.darkGreen };

  // Bande accent gauche
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 0.18, h: 5.625, fill: { color: C.accent }, line: { color: C.accent } });

  // Cercle décoratif haut-droite
  s.addShape(pres.shapes.OVAL, { x: 8.2, y: -0.9, w: 2.6, h: 2.6, fill: { color: C.midGreen, transparency: 60 }, line: { color: C.midGreen, transparency: 60 } });
  s.addShape(pres.shapes.OVAL, { x: 8.8, y: -0.3, w: 1.8, h: 1.8, fill: { color: C.accent, transparency: 75 }, line: { color: C.accent, transparency: 75 } });

  // Bandeau bas
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 4.7, w: 10, h: 0.925, fill: { color: C.midGreen }, line: { color: C.midGreen } });

  // Picto RSE (feuille stylisée avec rectangles)
  s.addShape(pres.shapes.OVAL, { x: 0.55, y: 0.55, w: 0.8, h: 0.8, fill: { color: C.accent }, line: { color: C.accent } });
  s.addText('♻', { x: 0.55, y: 0.5, w: 0.8, h: 0.9, fontSize: 22, color: C.darkGreen, align: 'center', valign: 'middle', margin: 0 });

  // Surtitre
  s.addText('PRÉSENTATION', {
    x: 0.45, y: 1.55, w: 8.5, h: 0.35,
    fontSize: 10, color: C.accentLight, bold: true, charSpacing: 5, align: 'left', margin: 0
  });

  // Titre principal
  s.addText('Actions RSE', {
    x: 0.45, y: 1.85, w: 8.5, h: 0.85,
    fontSize: 48, fontFace: 'Georgia', color: C.white, bold: true, align: 'left', margin: 0
  });
  s.addText('2024 – 2026', {
    x: 0.45, y: 2.6, w: 8.5, h: 0.85,
    fontSize: 48, fontFace: 'Georgia', color: C.accent, bold: true, align: 'left', margin: 0
  });

  // Ligne de séparation
  s.addShape(pres.shapes.RECTANGLE, { x: 0.45, y: 3.52, w: 2.5, h: 0.04, fill: { color: C.accentLight }, line: { color: C.accentLight } });

  // Sous-titre
  s.addText('Céréalog  ·  Groupe Bénéteau', {
    x: 0.45, y: 3.65, w: 8.5, h: 0.4,
    fontSize: 16, color: C.accentLight, align: 'left', margin: 0
  });
  s.addText('Réalisations & comparaison avec la politique d\'entreprise', {
    x: 0.45, y: 4.0, w: 8.5, h: 0.35,
    fontSize: 11, color: C.accentLight, align: 'left', italic: true, margin: 0
  });

  // Footer
  s.addText('Année scolaire 2025–2026  ·  BTS / Licence Management', {
    x: 0.45, y: 4.77, w: 9, h: 0.38,
    fontSize: 9, color: C.white, align: 'left', margin: 0
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 2 — SOMMAIRE
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.bgLight };

  // Barre titre
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 1.1, fill: { color: C.darkGreen }, line: { color: C.darkGreen } });
  s.addText('Sommaire', { x: 0.5, y: 0, w: 9, h: 1.1, fontSize: 28, fontFace: 'Georgia', color: C.white, bold: true, valign: 'middle', margin: 0 });
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 1.1, w: 10, h: 0.06, fill: { color: C.accent }, line: { color: C.accent } });

  const sections = [
    { num: '01', title: 'Céréalog', desc: 'Présentation · Actions RSE 2024-2026 · Politique vs Réalisations', color: C.blueTech },
    { num: '02', title: 'Groupe Bénéteau', desc: 'Présentation · Actions RSE 2024-2025 · Stratégie B-SUSTAINABLE', color: C.blueOcean },
    { num: '03', title: 'Comparaison', desc: 'Analyse croisée des démarches RSE des deux entreprises', color: C.midGreen },
    { num: '04', title: 'Conclusion', desc: 'Bilan & perspectives RSE', color: C.darkGreen },
  ];

  sections.forEach((sec, i) => {
    const x = i < 2 ? 0.4 + i * 4.7 : 0.4 + (i - 2) * 4.7;
    const y = i < 2 ? 1.45 : 3.4;
    const w = 4.2;
    const h = 1.7;

    s.addShape(pres.shapes.RECTANGLE, { x, y, w, h, fill: { color: C.white }, line: { color: C.separator, pt: 1 }, shadow: makeShadow() });
    s.addShape(pres.shapes.RECTANGLE, { x, y, w: 0.12, h, fill: { color: sec.color }, line: { color: sec.color } });

    s.addText(sec.num, { x: x + 0.22, y: y + 0.15, w: 0.7, h: 0.5, fontSize: 28, fontFace: 'Georgia', color: sec.color, bold: true, margin: 0 });
    s.addText(sec.title, { x: x + 0.22, y: y + 0.62, w: w - 0.35, h: 0.42, fontSize: 14, fontFace: 'Georgia', color: C.textDark, bold: true, margin: 0 });
    s.addText(sec.desc, { x: x + 0.22, y: y + 1.02, w: w - 0.35, h: 0.55, fontSize: 9.5, color: C.textMid, margin: 0 });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 3 — CÉRÉALOG : PRÉSENTATION
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.bgLight };

  // Header
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 1.05, fill: { color: C.blueTech }, line: { color: C.blueTech } });
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 1.05, w: 10, h: 0.06, fill: { color: C.accent }, line: { color: C.accent } });
  s.addText('01 — Céréalog', { x: 0.5, y: 0, w: 6, h: 1.05, fontSize: 26, fontFace: 'Georgia', color: C.white, bold: true, valign: 'middle', margin: 0 });
  s.addText('PRÉSENTATION DE L\'ENTREPRISE', { x: 6, y: 0, w: 3.5, h: 1.05, fontSize: 9, color: 'B8CFEC', bold: true, charSpacing: 3, align: 'right', valign: 'middle', margin: 0 });

  // Colonne gauche — infos
  s.addShape(pres.shapes.RECTANGLE, { x: 0.35, y: 1.35, w: 5.8, h: 3.8, fill: { color: C.white }, line: { color: C.separator, pt: 1 }, shadow: makeShadow() });
  s.addShape(pres.shapes.RECTANGLE, { x: 0.35, y: 1.35, w: 0.12, h: 3.8, fill: { color: C.blueTech }, line: { color: C.blueTech } });

  s.addText('Qui sommes-nous ?', { x: 0.6, y: 1.55, w: 5.4, h: 0.42, fontSize: 14, bold: true, color: C.blueTech, margin: 0 });

  const descLines = [
    { text: 'Fondée en 1993, Céréalog est le 1ᵉʳ intégrateur français ERP Cloud SAP dédié aux PME.', options: { breakLine: true } },
    { text: '\u00a0', options: { breakLine: true, fontSize: 5 } },
    { text: 'Spécialisée dans la transformation digitale, l\'entreprise accompagne ses clients sur 4 domaines :', options: { breakLine: true } },
    { text: 'Systèmes & Réseaux, Intégration ERP (SAP), Data & Pilotage, Services & Support.', options: { breakLine: true } },
    { text: '\u00a0', options: { breakLine: true, fontSize: 5 } },
    { text: 'Présence : La Rochelle · Bordeaux · Nantes · Paris', options: { breakLine: false } },
  ];
  s.addText(descLines, { x: 0.6, y: 2.05, w: 5.3, h: 2.8, fontSize: 11, color: C.textDark, valign: 'top', margin: 0 });

  // Colonne droite — chiffres clés
  const stats = [
    { val: '1993', label: 'Fondation', color: C.blueTech },
    { val: '50+', label: 'Collaborateurs', color: C.midGreen },
    { val: '4', label: 'Agences', color: C.blueOcean },
    { val: 'N°1', label: 'Intégrateur SAP PME', color: C.accent.replace('2D','1A') },
  ];

  stats.forEach((st, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 6.45 + col * 1.75;
    const y = 1.35 + row * 1.95;
    const w = 1.55;
    const h = 1.75;
    s.addShape(pres.shapes.RECTANGLE, { x, y, w, h, fill: { color: C.white }, line: { color: C.separator, pt: 1 }, shadow: makeShadow() });
    s.addShape(pres.shapes.RECTANGLE, { x, y, w, h: 0.09, fill: { color: st.color }, line: { color: st.color } });
    s.addText(st.val, { x, y: y + 0.25, w, h: 0.85, fontSize: 28, fontFace: 'Georgia', bold: true, color: st.color, align: 'center', margin: 0 });
    s.addText(st.label, { x, y: y + 1.05, w, h: 0.55, fontSize: 9.5, color: C.textMid, align: 'center', margin: 0 });
  });

  // Valeurs
  s.addText('Valeurs : Innovation · Compréhension · Ténacité · Solidarité', {
    x: 0.35, y: 5.18, w: 9.3, h: 0.35,
    fontSize: 9.5, color: C.white, align: 'center', bold: true,
    fill: { color: C.blueTech }, margin: [0, 8, 0, 8]
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 4 — CÉRÉALOG : ACTIONS RSE 2024-2026
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.bgLight };

  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 1.05, fill: { color: C.blueTech }, line: { color: C.blueTech } });
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 1.05, w: 10, h: 0.06, fill: { color: C.accent }, line: { color: C.accent } });
  s.addText('01 — Céréalog', { x: 0.5, y: 0, w: 6, h: 1.05, fontSize: 26, fontFace: 'Georgia', color: C.white, bold: true, valign: 'middle', margin: 0 });
  s.addText('ACTIONS RSE 2024 – 2026', { x: 6, y: 0, w: 3.5, h: 1.05, fontSize: 9, color: 'B8CFEC', bold: true, charSpacing: 3, align: 'right', valign: 'middle', margin: 0 });

  const actions = [
    {
      icon: '🏷️',
      date: 'Mars 2026',
      title: 'Label Numérique Responsable',
      desc: 'Audit obtenu le jeudi 12 mars 2026. Certification attestant d\'une démarche numérique éthique et durable.',
      color: C.midGreen,
      tag: 'CERTIFICATION',
    },
    {
      icon: '📋',
      date: '2026 (en cours)',
      title: '15 Engagements RSE',
      desc: 'Rédaction active de 15 engagements RSE formalisés sur les deux prochaines années, couvrant les axes environnement, social et gouvernance.',
      color: C.blueTech,
      tag: 'EN COURS',
    },
    {
      icon: '🏃',
      date: 'Novembre 2024',
      title: 'Marathon de La Rochelle',
      desc: '8 coureurs engagés dans le Challenge Entreprises — action de cohésion et de promotion du bien-être au travail.',
      color: C.blueOcean,
      tag: 'SOCIAL',
    },
    {
      icon: '🤝',
      date: 'Été 2024',
      title: 'Team Building Annuel',
      desc: 'Réunion annuelle de l\'équipe à Sauternes. Renforcement de la cohésion et de la culture d\'entreprise.',
      color: C.midGreen,
      tag: 'SOCIAL',
    },
  ];

  actions.forEach((a, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 0.3 + col * 4.85;
    const y = 1.28 + row * 2.1;
    const w = 4.5;
    const h = 1.92;

    s.addShape(pres.shapes.RECTANGLE, { x, y, w, h, fill: { color: C.white }, line: { color: C.separator, pt: 1 }, shadow: makeShadow() });
    s.addShape(pres.shapes.RECTANGLE, { x, y, w: 0.11, h, fill: { color: a.color }, line: { color: a.color } });

    // Tag
    s.addShape(pres.shapes.RECTANGLE, { x: x + w - 1.22, y: y + 0.12, w: 1.1, h: 0.28, fill: { color: a.color, transparency: 85 }, line: { color: a.color, pt: 0.5 } });
    s.addText(a.tag, { x: x + w - 1.22, y: y + 0.12, w: 1.1, h: 0.28, fontSize: 7, color: a.color, bold: true, align: 'center', valign: 'middle', margin: 0 });

    // Date
    s.addText(a.date, { x: x + 0.22, y: y + 0.1, w: 2.5, h: 0.3, fontSize: 9, color: a.color, bold: true, margin: 0 });

    // Title
    s.addText(a.title, { x: x + 0.22, y: y + 0.42, w: w - 0.35, h: 0.4, fontSize: 12.5, fontFace: 'Georgia', bold: true, color: C.textDark, margin: 0 });

    // Desc
    s.addText(a.desc, { x: x + 0.22, y: y + 0.86, w: w - 0.35, h: 0.95, fontSize: 9.5, color: C.textMid, margin: 0 });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 5 — CÉRÉALOG : POLITIQUE RSE vs RÉALISATIONS
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.bgLight };

  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 1.05, fill: { color: C.blueTech }, line: { color: C.blueTech } });
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 1.05, w: 10, h: 0.06, fill: { color: C.accent }, line: { color: C.accent } });
  s.addText('01 — Céréalog', { x: 0.5, y: 0, w: 6, h: 1.05, fontSize: 26, fontFace: 'Georgia', color: C.white, bold: true, valign: 'middle', margin: 0 });
  s.addText('POLITIQUE RSE VS RÉALISATIONS', { x: 6, y: 0, w: 3.5, h: 1.05, fontSize: 9, color: 'B8CFEC', bold: true, charSpacing: 3, align: 'right', valign: 'middle', margin: 0 });

  // Colonne gauche : Politique déclarée
  s.addShape(pres.shapes.RECTANGLE, { x: 0.3, y: 1.28, w: 4.4, h: 4.1, fill: { color: C.white }, line: { color: C.separator, pt: 1 }, shadow: makeShadow() });
  s.addShape(pres.shapes.RECTANGLE, { x: 0.3, y: 1.28, w: 4.4, h: 0.48, fill: { color: C.blueTech }, line: { color: C.blueTech } });
  s.addText('📄  Politique RSE déclarée', { x: 0.45, y: 1.28, w: 4.1, h: 0.48, fontSize: 12, color: C.white, bold: true, valign: 'middle', margin: 0 });

  const politique = [
    { txt: 'Favoriser l\'accès à la formation pour tous les salariés', done: true },
    { txt: 'Lutter contre toutes les formes de discrimination', done: true },
    { txt: 'Intégrer la qualité de vie au travail (QVT)', done: true },
    { txt: 'Assurer la sécurité et la gestion des risques', done: true },
    { txt: '15 engagements formalisés sur 2 ans (en rédaction)', done: false },
  ];

  politique.forEach((p, i) => {
    const y = 1.95 + i * 0.63;
    s.addShape(pres.shapes.OVAL, { x: 0.48, y: y + 0.08, w: 0.22, h: 0.22, fill: { color: p.done ? C.midGreen : C.accent }, line: { color: p.done ? C.midGreen : C.accent } });
    s.addText(p.done ? '✓' : '…', { x: 0.48, y: y + 0.04, w: 0.22, h: 0.3, fontSize: 9, color: C.white, align: 'center', valign: 'middle', bold: true, margin: 0 });
    s.addText(p.txt, { x: 0.82, y, w: 3.7, h: 0.55, fontSize: 10, color: C.textDark, valign: 'middle', margin: 0 });
  });

  // Colonne droite : Réalisations 2024-2026
  s.addShape(pres.shapes.RECTANGLE, { x: 5.0, y: 1.28, w: 4.7, h: 4.1, fill: { color: C.white }, line: { color: C.separator, pt: 1 }, shadow: makeShadow() });
  s.addShape(pres.shapes.RECTANGLE, { x: 5.0, y: 1.28, w: 4.7, h: 0.48, fill: { color: C.midGreen }, line: { color: C.midGreen } });
  s.addText('✅  Réalisations 2024–2026', { x: 5.15, y: 1.28, w: 4.4, h: 0.48, fontSize: 12, color: C.white, bold: true, valign: 'middle', margin: 0 });

  const realisations = [
    { txt: 'Label Numérique Responsable obtenu (mars 2026)', align: true },
    { txt: 'Marathon La Rochelle 2024 — 8 coureurs (QVT, cohésion)', align: true },
    { txt: 'Team Building 2024 à Sauternes (cohésion équipe)', align: true },
    { txt: 'Rédaction des 15 engagements RSE formels (en cours)', align: false },
    { txt: 'Transformation digitale responsable des clients PME', align: true },
  ];

  realisations.forEach((r, i) => {
    const y = 1.95 + i * 0.63;
    s.addShape(pres.shapes.RECTANGLE, { x: 5.12, y: y + 0.1, w: 0.2, h: 0.2, fill: { color: r.align ? C.midGreen : C.accent }, line: { color: r.align ? C.midGreen : C.accent } });
    s.addText(r.txt, { x: 5.45, y, w: 4.1, h: 0.55, fontSize: 10, color: C.textDark, valign: 'middle', margin: 0 });
  });

  // Note bas de slide
  s.addText('⚡ Entreprise en structuration active de sa démarche RSE — le Label NR marque un tournant fort en 2026', {
    x: 0.3, y: 5.25, w: 9.4, h: 0.28, fontSize: 8.5, color: C.midGreen, italic: true, align: 'center', margin: 0
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 6 — BÉNÉTEAU : PRÉSENTATION
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.bgLight };

  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 1.05, fill: { color: C.blueOcean }, line: { color: C.blueOcean } });
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 1.05, w: 10, h: 0.06, fill: { color: C.accent }, line: { color: C.accent } });
  s.addText('02 — Groupe Bénéteau', { x: 0.5, y: 0, w: 7, h: 1.05, fontSize: 26, fontFace: 'Georgia', color: C.white, bold: true, valign: 'middle', margin: 0 });
  s.addText('PRÉSENTATION DE L\'ENTREPRISE', { x: 7, y: 0, w: 2.5, h: 1.05, fontSize: 9, color: 'B8D4F0', bold: true, charSpacing: 3, align: 'right', valign: 'middle', margin: 0 });

  // Bloc description
  s.addShape(pres.shapes.RECTANGLE, { x: 0.35, y: 1.28, w: 6.0, h: 2.55, fill: { color: C.white }, line: { color: C.separator, pt: 1 }, shadow: makeShadow() });
  s.addShape(pres.shapes.RECTANGLE, { x: 0.35, y: 1.28, w: 0.12, h: 2.55, fill: { color: C.blueOcean }, line: { color: C.blueOcean } });

  s.addText('Constructeur naval mondial', { x: 0.6, y: 1.45, w: 5.5, h: 0.4, fontSize: 14, bold: true, fontFace: 'Georgia', color: C.blueOcean, margin: 0 });
  s.addText([
    { text: 'Fondé en 1884, le Groupe Bénéteau est leader mondial de la construction de bateaux de plaisance et de l\'habitat de loisirs.', options: { breakLine: true } },
    { text: '\u00a0', options: { breakLine: true, fontSize: 4 } },
    { text: 'Il opère à travers plusieurs marques de renommée mondiale : Bénéteau, Jeanneau, Lagoon, CNB, Prestige, Four Winns, Glastron, Wellcraft.', options: { breakLine: false } },
  ], { x: 0.6, y: 1.9, w: 5.5, h: 1.7, fontSize: 10.5, color: C.textDark, margin: 0 });

  // Chiffres Bénéteau
  const statsB = [
    { val: '1884', label: 'Fondation', color: C.blueOcean },
    { val: '~7 000', label: 'Collaborateurs', color: C.midGreen },
    { val: '45+', label: 'Pays vendeurs', color: C.blueOcean },
  ];
  statsB.forEach((st, i) => {
    const x = 0.35 + i * 2.05;
    const y = 4.0;
    const w = 1.85;
    const h = 1.45;
    s.addShape(pres.shapes.RECTANGLE, { x, y, w, h, fill: { color: C.white }, line: { color: C.separator, pt: 1 }, shadow: makeShadow() });
    s.addShape(pres.shapes.RECTANGLE, { x, y, w, h: 0.08, fill: { color: st.color }, line: { color: st.color } });
    s.addText(st.val, { x, y: y + 0.2, w, h: 0.7, fontSize: 26, fontFace: 'Georgia', bold: true, color: st.color, align: 'center', margin: 0 });
    s.addText(st.label, { x, y: y + 0.88, w, h: 0.45, fontSize: 9.5, color: C.textMid, align: 'center', margin: 0 });
  });

  // Marques
  s.addShape(pres.shapes.RECTANGLE, { x: 6.55, y: 1.28, w: 3.1, h: 4.17, fill: { color: C.blueOcean, transparency: 92 }, line: { color: C.blueOcean, pt: 1 }, shadow: makeShadow() });
  s.addShape(pres.shapes.RECTANGLE, { x: 6.55, y: 1.28, w: 3.1, h: 0.48, fill: { color: C.blueOcean }, line: { color: C.blueOcean } });
  s.addText('⛵  Marques du groupe', { x: 6.65, y: 1.28, w: 2.9, h: 0.48, fontSize: 11, color: C.white, bold: true, valign: 'middle', margin: 0 });

  const marques = ['Bénéteau', 'Jeanneau', 'Lagoon', 'CNB', 'Prestige', 'Four Winns', 'Glastron', 'Wellcraft'];
  marques.forEach((m, i) => {
    s.addText('· ' + m, { x: 6.7, y: 1.95 + i * 0.4, w: 2.8, h: 0.38, fontSize: 10.5, color: C.blueOcean, margin: 0 });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 7 — BÉNÉTEAU : ACTIONS RSE 2024-2025
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.bgLight };

  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 1.05, fill: { color: C.blueOcean }, line: { color: C.blueOcean } });
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 1.05, w: 10, h: 0.06, fill: { color: C.accent }, line: { color: C.accent } });
  s.addText('02 — Groupe Bénéteau', { x: 0.5, y: 0, w: 7, h: 1.05, fontSize: 26, fontFace: 'Georgia', color: C.white, bold: true, valign: 'middle', margin: 0 });
  s.addText('ACTIONS RSE 2024 – 2025', { x: 7, y: 0, w: 2.5, h: 1.05, fontSize: 9, color: 'B8D4F0', bold: true, charSpacing: 3, align: 'right', valign: 'middle', margin: 0 });

  // KPI grands chiffres
  const kpis = [
    { val: '-30%', label: 'Réduction intensité CO₂\n2022 → 2024', color: C.midGreen },
    { val: '45%', label: 'Fournisseurs évalués\nEcoVadis (2024)', color: C.blueOcean },
    { val: '56%', label: 'Achats issus de fournisseurs\névalués RSE (+15 pts)', color: C.blueTech },
    { val: '🥈', label: 'Médaille Argent EcoVadis\nTop 15% mondial', color: C.midGreen },
  ];

  kpis.forEach((k, i) => {
    const x = 0.28 + i * 2.37;
    const y = 1.28;
    const w = 2.18;
    const h = 1.62;
    s.addShape(pres.shapes.RECTANGLE, { x, y, w, h, fill: { color: C.white }, line: { color: C.separator, pt: 1 }, shadow: makeShadow() });
    s.addShape(pres.shapes.RECTANGLE, { x, y, w, h: 0.09, fill: { color: k.color }, line: { color: k.color } });
    s.addText(k.val, { x, y: y + 0.18, w, h: 0.75, fontSize: 30, fontFace: 'Georgia', bold: true, color: k.color, align: 'center', margin: 0 });
    s.addText(k.label, { x, y: y + 0.95, w, h: 0.58, fontSize: 8.5, color: C.textMid, align: 'center', margin: 0 });
  });

  // Actions détaillées - 2 colonnes
  const blocksLeft = [
    { icon: '🌍', title: 'Environnement', items: [
      '-26% d\'émissions CO₂ liées au gaz & électricité sur les sites industriels',
      'Renouvellement certifications ISO sites français (division bateau)',
      'Innovations : résine recyclable Elium© (Oceanis Yacht 60)',
    ], color: C.midGreen },
    { icon: '⚓', title: 'Chaîne d\'approvisionnement', items: [
      'Programme BuySustainable lancé en avril 2025',
      '45% fournisseurs évalués EcoVadis (vs 24% en 2022)',
      '56% des achats issus de fournisseurs évalués RSE',
    ], color: C.blueOcean },
  ];
  const blocksRight = [
    { icon: '👥', title: 'Social & RH', items: [
      'Initiative B-Equal : accélérateur de parité femmes/hommes',
      'Formation en hausse de +4%',
      'Préservation des compétences face au contexte économique',
    ], color: C.blueTech },
    { icon: '🌐', title: 'Gouvernance & Partenariats', items: [
      'Adhésion renouvelée au Pacte Mondial des Nations Unies (2024)',
      'Premier chantier naval signataire (décembre 2020)',
      'Offre de refit Lagoon 620 NEO (économie circulaire)',
    ], color: C.darkGreen },
  ];

  const allBlocks = [...blocksLeft, ...blocksRight];
  allBlocks.forEach((b, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 0.28 + col * 4.87;
    const y = 3.1 + row * 1.22;
    const w = 4.58;
    const h = 1.1;

    s.addShape(pres.shapes.RECTANGLE, { x, y, w, h, fill: { color: C.white }, line: { color: b.color, pt: 0.8 }, shadow: makeShadow() });
    s.addShape(pres.shapes.RECTANGLE, { x, y, w: 0.1, h, fill: { color: b.color }, line: { color: b.color } });
    s.addText(b.icon + '  ' + b.title, { x: x + 0.22, y: y + 0.06, w: w - 0.35, h: 0.32, fontSize: 11, bold: true, color: b.color, margin: 0 });
    b.items.forEach((item, j) => {
      s.addText('‣  ' + item, { x: x + 0.22, y: y + 0.38 + j * 0.25, w: w - 0.35, h: 0.24, fontSize: 8.5, color: C.textDark, margin: 0 });
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 8 — BÉNÉTEAU : STRATÉGIE B-SUSTAINABLE
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.darkGreen };

  // Header
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 1.05, fill: { color: C.blueOcean }, line: { color: C.blueOcean } });
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 1.05, w: 10, h: 0.06, fill: { color: C.accent }, line: { color: C.accent } });
  s.addText('02 — Groupe Bénéteau', { x: 0.5, y: 0, w: 7, h: 1.05, fontSize: 26, fontFace: 'Georgia', color: C.white, bold: true, valign: 'middle', margin: 0 });
  s.addText('STRATÉGIE B-SUSTAINABLE 2030', { x: 7, y: 0, w: 2.5, h: 1.05, fontSize: 9, color: 'B8D4F0', bold: true, charSpacing: 3, align: 'right', valign: 'middle', margin: 0 });

  // Titre central
  s.addText('B·SUSTAINABLE', {
    x: 2.2, y: 1.22, w: 5.6, h: 0.72,
    fontSize: 36, fontFace: 'Georgia', bold: true, color: C.accent, align: 'center', charSpacing: 4, margin: 0
  });
  s.addText('Feuille de route RSE 2030 — 3 piliers stratégiques', {
    x: 1.5, y: 1.88, w: 7, h: 0.35,
    fontSize: 11, color: 'A0C8B0', align: 'center', italic: true, margin: 0
  });

  // 3 piliers
  const piliers = [
    {
      num: '01',
      en: 'ETHICAL GROWTH',
      fr: 'Grandir avec éthique',
      items: ['Achats responsables', 'Programme BuySustainable', '45 % fournisseurs EcoVadis', 'Intégrité & gouvernance'],
      color: C.accent,
    },
    {
      num: '02',
      en: 'ENGAGED CREW',
      fr: 'Agir en équipage',
      items: ['Initiative B-Equal (parité)', 'Formation +4%', 'Qualité de vie au travail', 'Préservation des compétences'],
      color: '5BC8F5',
    },
    {
      num: '03',
      en: 'PRESERVED OCEANS',
      fr: 'Préserver les océans',
      items: ['CO₂ : -30% intensité /M€', 'Résine recyclable Elium©', 'Propulsion hybride électrique', 'Refit & économie circulaire'],
      color: '7FD9A8',
    },
  ];

  piliers.forEach((p, i) => {
    const x = 0.35 + i * 3.18;
    const y = 2.45;
    const w = 2.95;
    const h = 2.95;

    s.addShape(pres.shapes.RECTANGLE, { x, y, w, h, fill: { color: C.midGreen, transparency: 85 }, line: { color: p.color, pt: 1.5 }, shadow: makeShadow() });
    s.addShape(pres.shapes.RECTANGLE, { x, y, w, h: 0.08, fill: { color: p.color }, line: { color: p.color } });

    // Numéro
    s.addText(p.num, { x, y: y + 0.18, w: w, h: 0.55, fontSize: 28, fontFace: 'Georgia', bold: true, color: p.color, align: 'center', margin: 0 });

    // Nom anglais
    s.addText(p.en, { x, y: y + 0.72, w: w, h: 0.35, fontSize: 11, bold: true, charSpacing: 2, color: p.color, align: 'center', margin: 0 });
    // Nom français
    s.addText(p.fr, { x, y: y + 1.05, w: w, h: 0.3, fontSize: 9.5, color: 'C8E8D8', italic: true, align: 'center', margin: 0 });

    // Séparateur
    s.addShape(pres.shapes.RECTANGLE, { x: x + 0.6, y: y + 1.4, w: w - 1.2, h: 0.03, fill: { color: p.color, transparency: 50 }, line: { color: p.color, transparency: 50 } });

    // Items
    p.items.forEach((item, j) => {
      s.addText('· ' + item, { x: x + 0.18, y: y + 1.52 + j * 0.33, w: w - 0.3, h: 0.3, fontSize: 8.5, color: 'D0EAD8', margin: 0 });
    });
  });

  // Objectif 2030
  s.addShape(pres.shapes.RECTANGLE, { x: 0.35, y: 5.52, w: 9.3, h: 0.35, fill: { color: C.accent, transparency: 80 }, line: { color: C.accent, pt: 0.5 } });
  s.addText('🎯  Objectif 2030 : -30% d\'intensité CO₂ · 80% fournisseurs évalués EcoVadis · Parité renforcée', {
    x: 0.35, y: 5.52, w: 9.3, h: 0.35, fontSize: 9, color: C.accent, align: 'center', bold: true, valign: 'middle', margin: 0
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 9 — COMPARAISON RSE
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.bgLight };

  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 1.05, fill: { color: C.darkGreen }, line: { color: C.darkGreen } });
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 1.05, w: 10, h: 0.06, fill: { color: C.accent }, line: { color: C.accent } });
  s.addText('03 — Comparaison RSE', { x: 0.5, y: 0, w: 7, h: 1.05, fontSize: 26, fontFace: 'Georgia', color: C.white, bold: true, valign: 'middle', margin: 0 });
  s.addText('CÉRÉALOG VS GROUPE BÉNÉTEAU', { x: 6.5, y: 0, w: 3.0, h: 1.05, fontSize: 9, color: C.accentLight, bold: true, charSpacing: 3, align: 'right', valign: 'middle', margin: 0 });

  // En-têtes colonnes
  s.addShape(pres.shapes.RECTANGLE, { x: 3.5, y: 1.2, w: 2.95, h: 0.45, fill: { color: C.blueTech }, line: { color: C.blueTech } });
  s.addText('CÉRÉALOG', { x: 3.5, y: 1.2, w: 2.95, h: 0.45, fontSize: 11, bold: true, color: C.white, align: 'center', valign: 'middle', margin: 0 });

  s.addShape(pres.shapes.RECTANGLE, { x: 6.55, y: 1.2, w: 3.1, h: 0.45, fill: { color: C.blueOcean }, line: { color: C.blueOcean } });
  s.addText('BÉNÉTEAU', { x: 6.55, y: 1.2, w: 3.1, h: 0.45, fontSize: 11, bold: true, color: C.white, align: 'center', valign: 'middle', margin: 0 });

  const rows = [
    { critere: 'Taille', cerealog: 'PME · ~50 pers.', beneteau: 'Grand groupe · ~7 000 pers.' },
    { critere: 'Stratégie RSE formalisée', cerealog: 'En cours (15 engagements)', beneteau: 'B-SUSTAINABLE 2030' },
    { critere: 'Certification RSE', cerealog: 'Label Numérique Responsable (mars 2026)', beneteau: 'Médaille Argent EcoVadis (Top 15%)' },
    { critere: 'Axe Environnement', cerealog: 'En structuration', beneteau: '-30% intensité CO₂ · Elium©' },
    { critere: 'Axe Social', cerealog: 'QVT, non-discrim., formation', beneteau: 'B-Equal, parité, formation +4%' },
    { critere: 'Axe Fournisseurs', cerealog: 'Non formalisé', beneteau: '56% achats évalués RSE' },
    { critere: 'Rapport RSE publié', cerealog: 'Non (PME)', beneteau: 'Rapport durabilité annuel' },
    { critere: 'Engagement international', cerealog: 'Local / national', beneteau: 'Pacte Mondial ONU (2024)' },
  ];

  rows.forEach((r, i) => {
    const y = 1.75 + i * 0.47;
    const bgColor = i % 2 === 0 ? 'F8FBF9' : C.white;

    s.addShape(pres.shapes.RECTANGLE, { x: 0.25, y, w: 3.15, h: 0.43, fill: { color: bgColor }, line: { color: C.separator, pt: 0.5 } });
    s.addShape(pres.shapes.RECTANGLE, { x: 3.5, y, w: 2.95, h: 0.43, fill: { color: bgColor }, line: { color: C.separator, pt: 0.5 } });
    s.addShape(pres.shapes.RECTANGLE, { x: 6.55, y, w: 3.1, h: 0.43, fill: { color: bgColor }, line: { color: C.separator, pt: 0.5 } });

    s.addText(r.critere, { x: 0.35, y, w: 2.9, h: 0.43, fontSize: 9.5, bold: true, color: C.textDark, valign: 'middle', margin: 0 });
    s.addText(r.cerealog, { x: 3.6, y, w: 2.75, h: 0.43, fontSize: 8.5, color: C.textDark, valign: 'middle', align: 'center', margin: 0 });
    s.addText(r.beneteau, { x: 6.65, y, w: 2.9, h: 0.43, fontSize: 8.5, color: C.textDark, valign: 'middle', align: 'center', margin: 0 });
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// SLIDE 10 — CONCLUSION
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.darkGreen };

  // Déco
  s.addShape(pres.shapes.OVAL, { x: -1, y: -0.8, w: 3.5, h: 3.5, fill: { color: C.midGreen, transparency: 75 }, line: { color: C.midGreen, transparency: 75 } });
  s.addShape(pres.shapes.OVAL, { x: 7.8, y: 3.5, w: 3, h: 3, fill: { color: C.accent, transparency: 80 }, line: { color: C.accent, transparency: 80 } });

  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 0.18, h: 5.625, fill: { color: C.accent }, line: { color: C.accent } });

  // Titre
  s.addText('04 — Conclusion', { x: 0.45, y: 0.35, w: 9, h: 0.35, fontSize: 11, color: C.accentLight, bold: true, charSpacing: 3, margin: 0 });
  s.addText('Deux démarches RSE,\nune ambition commune', {
    x: 0.45, y: 0.7, w: 8.5, h: 1.4,
    fontSize: 30, fontFace: 'Georgia', bold: true, color: C.white, margin: 0
  });

  // 2 cartes
  const conclCards = [
    {
      title: 'Céréalog',
      content: 'PME en structuration active de sa RSE. L\'obtention du Label Numérique Responsable (mars 2026) et la rédaction de 15 engagements formels marquent un vrai tournant. La politique déclarée (formation, QVT, non-discrimination) se traduit progressivement en actes concrets.',
      color: C.blueTech,
    },
    {
      title: 'Groupe Bénéteau',
      content: 'Grand groupe avec une stratégie RSE mature et chiffrée (B-SUSTAINABLE 2030). Des résultats mesurables : -30% CO₂, médaille Argent EcoVadis, 56% achats RSE. La politique est pleinement alignée avec les réalisations et régulièrement auditée.',
      color: C.accent,
    },
  ];

  conclCards.forEach((c, i) => {
    const x = 0.45 + i * 4.7;
    s.addShape(pres.shapes.RECTANGLE, { x, y: 2.22, w: 4.3, h: 2.65, fill: { color: C.midGreen, transparency: 82 }, line: { color: c.color, pt: 1.5 }, shadow: makeShadow() });
    s.addShape(pres.shapes.RECTANGLE, { x, y: 2.22, w: 4.3, h: 0.48, fill: { color: c.color }, line: { color: c.color } });
    s.addText(c.title, { x: x + 0.15, y: 2.22, w: 4.0, h: 0.48, fontSize: 14, fontFace: 'Georgia', bold: true, color: C.white, valign: 'middle', margin: 0 });
    s.addText(c.content, { x: x + 0.15, y: 2.78, w: 4.0, h: 2.0, fontSize: 9.5, color: 'C8E8D8', margin: 0 });
  });

  // Message final
  s.addShape(pres.shapes.RECTANGLE, { x: 0.45, y: 5.05, w: 9.1, h: 0.42, fill: { color: C.accent, transparency: 85 }, line: { color: C.accent, pt: 0.5 } });
  s.addText('🌱  Quelle que soit leur taille, les deux entreprises intègrent la RSE comme levier de performance et de sens.', {
    x: 0.45, y: 5.05, w: 9.1, h: 0.42, fontSize: 9.5, color: C.accentLight, align: 'center', italic: true, valign: 'middle', margin: 0
  });
}

// ─── EXPORT ─────────────────────────────────────────────────────────────────
const outputPath = path.resolve(process.cwd(), 'RSE_Cerealog_Beneteau_2024-2026.pptx');

pres.writeFile({ fileName: outputPath })
  .then(() => console.log(`✅  Fichier généré avec succès : ${outputPath}`))
  .catch(err => { console.error('❌  Erreur :', err); process.exit(1); });