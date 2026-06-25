import React from 'react';

export default function Institutionnel({ lang }) {
  const dict = {
    fr: {
      title: 'L\'union régionale (URMSCD)',
      subtitle: 'Découvrez l\'histoire, les missions et le fonctionnement de l\'institution régissant la mutualité à Dakar.',
      section1Title: 'Missions, vision & valeurs',
      historyTitle: 'Notre histoire',
      historyText: 'Créée pour fédérer les mutuelles de santé communautaires de la région de Dakar, l\'Union Régionale (URMSCD) œuvre activement depuis plusieurs années pour garantir un accès équitable aux soins de santé de base. Elle regroupe les unions départementales de Dakar, Pikine, Guédiawaye, Rufisque et Keur Massar.',
      missionTitle: 'Notre mission',
      missionText: 'Accompagner la digitalisation, renforcer les capacités de gestion des mutuelles and négocier des conventions de qualité avec les prestataires de soins.',
      visionTitle: 'Notre vision',
      visionText: 'Parvenir à 80% de couverture maladie communautaire dans la région de Dakar d\'ici 2029 via des services numériques interconnectés.',
      bureauTitle: 'Le bureau exécutif',
      organigramTitle: 'Organigramme institutionnel',
      docsTitle: 'Documents officiels & gouvernance',
      doc1: 'Statuts officiels de l\'URMSCD',
      doc2: 'Règlement intérieur de l\'union régionale',
      doc3: 'Rapport d\'activité annuel 2025 (PDF)',
      doc4: 'Plan stratégique de développement 2026-2029',
      downloadBtn: 'Télécharger',
      downloadSuccess: 'Téléchargement simulé lancé avec succès !'
    },
    wo: {
      title: 'Mbootaay bi (URMSCD)',
      subtitle: 'Xoolal fi mbootaay bi jogge, liggéeyam ak naka lay liggéeyé ci Dakar.',
      section1Title: 'Liggéey bi ak sart yi',
      historyTitle: 'Fi nu jogge',
      historyText: 'URMSCD dafa dajale mutuelle wér-gi-yaram yi nekk ci Ndakaaru, di liggéey ngir ñëpp am accès ci fajj gu baax te yomb. Am na unions départementales ci Dakar, Pikine, Guédiawaye, Rufisque ak Keur Massar.',
      missionTitle: 'Sunu liggéey',
      missionText: 'Japalé mutuelle yi ci wéru technologie bi ak négocier contrat yu baax ak fajukaay yi.',
      visionTitle: 'Sunu gis-gis',
      visionText: 'Yegg ci 80% couverture maladie ci Dakar ci atum 2029 ci jëfandikoo internet ak portable.',
      bureauTitle: 'Bureau bi',
      organigramTitle: 'Naka la mbootaay bi tënkoo',
      docsTitle: 'Mbind yi ak sart yi',
      doc1: 'Sartu URMSCD bi',
      doc2: 'Sartu bi ci biir union bi',
      doc3: 'Rapport liggéey bu atum 2025 (PDF)',
      doc4: 'Plan liggéey 2026-2029',
      downloadBtn: 'Yóbbu',
      downloadSuccess: 'Yóbbu mbind bi tambali na !'
    }
  };

  const t = dict[lang];

  // Génération et téléchargement d'un document texte formaté
  const handleDownload = (docName) => {
    const now = new Date().toLocaleDateString('fr-FR');
    const docContent = [
      '═══════════════════════════════════════════════════════════════',
      '  UNION RÉGIONALE DES MUTUELLES DE SANTÉ',
      '  COMMUNAUTAIRES DE DAKAR (URMSCD)',
      '═══════════════════════════════════════════════════════════════',
      '',
      `  Document : ${docName}`,
      `  Date d'édition : ${now}`,
      '',
      '───────────────────────────────────────────────────────────────',
      '',
      '  Ce document est un exemplaire officiel généré depuis',
      '  la plateforme numérique MUTUALIS DAKAR.',
      '',
      '  L\'URMSCD est l\'organe fédérateur des mutuelles de santé',
      '  communautaires de la région de Dakar. Elle regroupe les',
      '  unions départementales de Dakar, Pikine, Guédiawaye,',
      '  Rufisque et Keur Massar.',
      '',
      '  Pour obtenir la version complète et certifiée de ce',
      '  document, veuillez contacter le secrétariat de l\'URMSCD :',
      '',
      '    📧 contact@urmscd-dakar.sn',
      '    📞 +221 33 800 00 00',
      '    📍 Siège régional, Dakar, Sénégal',
      '',
      '───────────────────────────────────────────────────────────────',
      '',
      '  Bureau exécutif :',
      '    Président      : Birame Fall',
      '    Vice-Présidente: Ndèye Fatou Seye',
      '    Secrétaire Gén.: Ousmane Diop',
      '    Trésorier Gén. : Abdoulaye Sow',
      '',
      '═══════════════════════════════════════════════════════════════',
      '  Document généré automatiquement par MUTUALIS DAKAR.',
      '  © 2026 URMSCD – Tous droits réservés.',
      '═══════════════════════════════════════════════════════════════',
    ].join('\n');

    const blob = new Blob([docContent], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    // Nom de fichier nettoyé à partir du titre du document
    const safeFileName = docName
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .toLowerCase();
    link.href = url;
    link.download = `${safeFileName}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const members = [
    { name: 'Birame Fall', role: lang === 'fr' ? 'Président de l\'URMSCD' : 'Njiitu Mbootaay bi', desc: lang === 'fr' ? 'Plus de 15 ans d\'expérience dans l\'économie sociale et solidaire.' : 'Am na 15 at ci wéru économie sociale.' },
    { name: 'Ndèye Fatou Seye', role: lang === 'fr' ? 'Vice-Présidente' : 'Njiitu-Taat bi', desc: lang === 'fr' ? 'Spécialiste de la santé communautaire et de l\'inclusion des femmes.' : 'Spécialiste ci wér-gi-yaramu jigéen yi.' },
    { name: 'Ousmane Diop', role: lang === 'fr' ? 'Secrétaire Général' : 'Bindakat bi', desc: lang === 'fr' ? 'Gestionnaire de projets de santé et expert en gouvernance associative.' : 'Expert ci wéru yore mbootaay yi.' },
    { name: 'Abdoulaye Sow', role: lang === 'fr' ? 'Trésorier Général' : 'Korekat bi', desc: lang === 'fr' ? 'Comptable agréé dédié à la transparence financière des mutuelles.' : 'Comptable bu liggéey ci wéru xaalis.' }
  ];

  return (
    <div className="institutionnel-view fade-in-up">
      {/* Banner */}
      <section className="banner-mini" style={{
        background: 'linear-gradient(to right, rgba(5, 150, 105, 0.9), rgba(5, 150, 105, 0.7)), url("/inst_hero_real.png") center/cover no-repeat'
      }}>
        <div className="container" style={{ position: 'relative', zIndex: 2 }}>
          <h1>{t.title}</h1>
          <p>{t.subtitle}</p>
        </div>
      </section>

      {/* History and Missions */}
      <section className="container section-padding">
        <div className="grid grid-3">
          <div className="card">
            <h3 style={{ color: 'var(--primary)', marginBottom: '1rem' }}>📜 {t.historyTitle}</h3>
            <p>{t.historyText}</p>
          </div>
          <div className="card">
            <h3 style={{ color: 'var(--primary)', marginBottom: '1rem' }}>🎯 {t.missionTitle}</h3>
            <p>{t.missionText}</p>
          </div>
          <div className="card">
            <h3 style={{ color: 'var(--primary)', marginBottom: '1rem' }}>💡 {t.visionTitle}</h3>
            <p>{t.visionText}</p>
          </div>
        </div>
      </section>

      {/* Executive Bureau */}
      <section className="section-padding" style={{ backgroundColor: 'var(--card-bg-subtle)' }}>
        <div className="container">
          <h2 className="with-underline center" style={{ marginBottom: '3rem' }}>{t.bureauTitle}</h2>
          <div className="grid grid-4">
            {members.map((m, idx) => (
              <div key={idx} className="card text-center" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                {/* SVG avatar mockup */}
                <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', color: '#fff', fontWeight: 'bold', marginBottom: '1.5rem' }}>
                  {m.name.charAt(0)}
                </div>
                <h3 style={{ fontSize: '1.2rem', marginBottom: '0.25rem' }}>{m.name}</h3>
                <span className="badge badge-info" style={{ marginBottom: '1rem' }}>{m.role}</span>
                <p style={{ fontSize: '0.9rem' }}>{m.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Organigram */}
      <section className="container section-padding">
        <h2 className="with-underline center" style={{ marginBottom: '3rem' }}>{t.organigramTitle}</h2>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', position: 'relative' }}>
          <div className="card glass-effect" style={{ padding: '1rem 2rem', fontWeight: 'bold', borderLeft: '4px solid var(--secondary)' }}>
            {lang === 'fr' ? 'Assemblée générale régionale' : 'Daje générale bu région bi'}
          </div>
          <div style={{ width: '2px', height: '30px', backgroundColor: 'var(--border-color)' }}></div>
          <div className="card glass-effect" style={{ padding: '1rem 2rem', fontWeight: 'bold', borderLeft: '4px solid var(--primary)' }}>
            {lang === 'fr' ? 'Conseil d\'Administration (CA)' : 'Conseil d\'Administration bi'}
          </div>
          <div style={{ width: '2px', height: '30px', backgroundColor: 'var(--border-color)' }}></div>
          <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <div className="card" style={{ padding: '1rem 1.5rem', fontSize: '0.9rem' }}>
              {lang === 'fr' ? 'Commission contrôle & surveillance' : 'Commission say-say bi'}
            </div>
            <div className="card" style={{ padding: '1rem 1.5rem', fontSize: '0.9rem', fontWeight: 'bold', borderColor: 'var(--primary)' }}>
              {lang === 'fr' ? 'Bureau exécutif (URMSCD)' : 'Bureau exécutif bi'}
            </div>
            <div className="card" style={{ padding: '1rem 1.5rem', fontSize: '0.9rem' }}>
              {lang === 'fr' ? 'Commission technique de santé' : 'Commission santé bi'}
            </div>
          </div>
        </div>
      </section>

      {/* Docs Downloads */}
      <section className="section-padding" style={{ backgroundColor: 'var(--card-bg-subtle)' }}>
        <div className="container" style={{ maxWidth: '800px' }}>
          <h2 className="with-underline center" style={{ marginBottom: '3rem' }}>{t.docsTitle}</h2>
          <ul className="governance-list">
            <li className="governance-item">
              <div className="doc-info">
                <span className="doc-icon">📁</span>
                <span style={{ fontWeight: '600' }}>{t.doc1}</span>
              </div>
              <button className="btn btn-outline btn-sm" onClick={() => handleDownload(t.doc1)}>{t.downloadBtn}</button>
            </li>
            <li className="governance-item">
              <div className="doc-info">
                <span className="doc-icon">📁</span>
                <span style={{ fontWeight: '600' }}>{t.doc2}</span>
              </div>
              <button className="btn btn-outline btn-sm" onClick={() => handleDownload(t.doc2)}>{t.downloadBtn}</button>
            </li>
            <li className="governance-item">
              <div className="doc-info">
                <span className="doc-icon">📄</span>
                <span style={{ fontWeight: '600' }}>{t.doc3}</span>
              </div>
              <button className="btn btn-outline btn-sm" onClick={() => handleDownload(t.doc3)}>{t.downloadBtn}</button>
            </li>
            <li className="governance-item">
              <div className="doc-info">
                <span className="doc-icon">📋</span>
                <span style={{ fontWeight: '600' }}>{t.doc4}</span>
              </div>
              <button className="btn btn-outline btn-sm" onClick={() => handleDownload(t.doc4)}>{t.downloadBtn}</button>
            </li>
          </ul>
        </div>
      </section>
    </div>
  );
}
