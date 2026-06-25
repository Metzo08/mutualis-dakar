import React, { useState, useEffect } from 'react';

export default function BlogExperts({ lang, portalMode, agentUser }) {
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [comments, setComments] = useState({});
  const [newComment, setNewComment] = useState({ author: '', text: '' });

  // Custom articles list written by admins/experts
  const [customArticles, setCustomArticles] = useState([]);
  const [showEditor, setShowEditor] = useState(false);

  // Likes state: mapping article ID to number of likes, and session tracking
  const [likes, setLikes] = useState({});
  const [likedArticles, setLikedArticles] = useState({});
  const [toastMessage, setToastMessage] = useState('');

  // New Article Form State
  const [newArticle, setNewArticle] = useState({
    title: '',
    author: '',
    role: '',
    avatar: '🩺',
    readTime: '5 min',
    content: ''
  });
  const [newArticleImage, setNewArticleImage] = useState(null);
  const [editorError, setEditorError] = useState('');
  const [editorSuccess, setEditorSuccess] = useState('');

  const dict = {
    fr: {
      title: 'Espace blog & paroles d\'experts',
      subtitle: 'Retrouvez les conseils de professionnels de la santé, des articles sur les réformes de la CSU au Sénégal et des astuces bien-être.',
      commentsTitle: 'Commentaires et échanges',
      commentLabelName: 'Votre prénom & nom',
      commentLabelText: 'Votre commentaire ou question',
      commentBtnSubmit: 'Publier le commentaire',
      commentPlaceholderName: 'Ex: Fatima Sy',
      commentPlaceholderText: 'Saisissez votre avis...',
      alertSuccess: 'Commentaire publié avec succès !',
      sidebarTitle: 'Conseils prévention flash',
      backToList: '← Retour aux articles',
      noComments: 'Aucun commentaire pour le moment. Soyez le premier à réagir !'
    },
    wo: {
      title: 'Blog ak Waxu Docteur yi',
      subtitle: 'Xoolal digle yi doctors yi di def ci wér-gi-yaram, réformes cmu ci Sénégal ak conseils ngir dund bu baax.',
      commentsTitle: 'Leral ak Waxtaan',
      commentLabelName: 'Sa tour ak sant',
      commentLabelText: 'Sa avis walla question',
      commentBtnSubmit: 'Publier commentaire bi',
      commentPlaceholderName: 'Ex: Fatima Sy',
      commentPlaceholderText: 'Mbindal sa xalaat...',
      alertSuccess: 'Commentaire bi soti na !',
      sidebarTitle: 'Digle wér-gi-yaram flash',
      backToList: '← Dellu ci articles yi',
      noComments: 'Amul commentateur tey. Bindal sa xalaat !'
    }
  };

  const t = dict[lang] || dict.fr;

  // Preset articles with numeric timestamps relative to June 22, 2026 (1782155297000)
  const defaultArticles = [
    {
      id: 1,
      title: lang === 'fr' ? 'Prévenir le paludisme en saison des pluies à Dakar' : 'Wanni malaria bi ci hivernage bi ci Ndakaaru',
      author: 'Dr. Aminata Sow',
      role: lang === 'fr' ? 'Épidémiologiste, Dakar' : 'Docteur épidémiologiste',
      avatar: '👩‍⚕️',
      date: new Date('2026-06-15T12:00:00Z').getTime(), // 7 days ago
      readTime: lang === 'fr' ? '4 min de lecture' : '4 min ci jang',
      preview: lang === 'fr' 
        ? 'L\'hivernage est propice au développement des moustiques. Voici les mesures collectives et individuelles indispensables pour protéger votre famille.' 
        : 'Naka la gnu di wanni malaria ak moustiques yi ci saison des pluies bi ci Ndakaaru.',
      content: lang === 'fr' 
        ? `L'hivernage s'installe à Dakar et avec lui, le risque accru de transmission du paludisme. En tant que médecin épidémiologiste, je rappelle que le paludisme reste une des causes majeures de consultation dans nos structures de santé.\n\nVoici 4 conseils simples mais cruciaux :\n1. Dormez sous une moustiquaire imprégnée : C'est le moyen de prévention le plus efficace. Assurez-vous qu'elle est bien fermée et sans trous.\n2. Éliminez les eaux stagnantes : Les moustiques y pondent leurs œufs. Videz les récipients d'eau inutilisés autour de votre maison.\n3. Utilisez des répulsifs corporels : Surtout en fin de journée lorsque l'activité des moustiques augmente.\n4. Consultez au premier symptôme : La fièvre est le premier signe d'alerte. Grâce à la gratuité des soins pour les enfants de moins de 5 ans et à la couverture CMU, le diagnostic et le traitement (ACT) sont immédiats et accessibles dans tous les postes de santé conventionnés.`
        : `Saison des pluies bi dafa ubbil yoon moustiques yi ngir gnu bari. Loolu day andil malaria.\n\nDigle yi gënë rëy :\n1. Moustiquaire : Sangal sa bop ak sa njabot ak moustiquaire bu baax at mi yëpp.\n2. Dindi ndox yi tégu ci bountou keur yi ngir moustiques yi bagn fa egg.\n3. Fajjoo : Soo amé fievre, demal ci poste de santé bi gënë jege téy.`
    },
    {
      id: 2,
      title: lang === 'fr' ? 'Données de santé et RGPD : comment Mutualis protège votre vie privée' : 'Données wér-gi-yaram ak RGPD ci Mutualis',
      author: 'Dr. Ibrahima Diagne',
      role: lang === 'fr' ? 'Expert en e-santé & sécurité' : 'Docteur e-santé & sécurité',
      avatar: '👨‍⚕️',
      date: new Date('2026-06-18T10:00:00Z').getTime(), // 4 days ago
      readTime: lang === 'fr' ? '6 min de lecture' : '6 min ci jang',
      preview: lang === 'fr' 
        ? 'La numérisation de la couverture maladie nécessite une sécurité maximale. Décryptage de nos protocoles d\'isolation et de chiffrement.' 
        : 'Assurance maladie numérique dafa wara am sécurité bu dëgër. Leral naka la gnu di aar sa vie privée.',
      content: lang === 'fr' 
        ? `Avec le lancement de la plateforme Mutualis Dakar, nous passons à une vitesse supérieure dans la numérisation des données médicales. Mais qui dit numérisation dit responsabilité.\n\nDans le cadre de la conformité au RGPD et aux règles sénégalaises de protection des données personnelles :\n- Vos données sont cryptées : Les mots de passe et les informations personnelles sont chiffrés. Aucun tiers ne peut y avoir accès.\n- Jeton d'authentification (JWT) : Chaque connexion génère un jeton temporaire qui authentifie de manière unique l'assuré ou l'agent.\n- Droit à l'oubli : Vous pouvez à tout moment demander la suppression définitive de vos données depuis votre espace profil.\n- Consentement obligatoire : Aucune donnée n'est traitée sans votre acceptation préalable lors de l'adhésion en ligne.`
        : `Mbindu numérique bi dafa wara andak aar askan wi.\n\nCi bir Mutualis Dakar :\n- Sa mot de passe dafa crypté, amul kenn kou koy guiss.\n- Jeton JWT : Day sécurisé sa connexion.\n- Droit à l'oubli : Mën nga dindi sa account ak say données saa soo ko beugué ci sa profil.`
    },
    {
      id: 3,
      title: lang === 'fr' ? 'Nutrition et Hypertension : préserver le cœur au quotidien' : 'Hypertension ak lekk bu baax ngir sa xol',
      author: 'Dr. Ousmane Diagne',
      role: lang === 'fr' ? 'Cardiologue, Hôpital de Dakar' : 'Cardiologue, Hôpital Dakar',
      avatar: '🩺',
      date: new Date('2026-06-20T16:00:00Z').getTime(), // 2 days ago
      readTime: lang === 'fr' ? '5 min de lecture' : '5 min ci jang',
      preview: lang === 'fr' 
        ? 'L\'hypertension artérielle est un fléau silencieux. Découvrez les changements alimentaires simples à adopter pour préserver votre xol.' 
        : 'Hypertension artérielle dafa bari ci Sénégal. Xoolal naka la gnu di lekk ngir aar sa xol.',
      content: lang === 'fr' 
        ? `L'hypertension artérielle (HTA) est souvent surnommée le "tueur silencieux" car elle se développe sans symptômes apparents. Pourtant, elle cause de nombreuses complications cardiologiques et vasculaires.\n\nQuelques conseils simples de cardiologie :\n1. Réduisez le sel : La consommation excessive de sel augmente la tension artérielle. Évitez les bouillons industriels très salés et limitez le sel à table.\n2. Mangez des fruits et légumes : Riches en potassium, ils aident à réguler la tension.\n3. Pratiquez une activité physique : Marcher 30 minutes par jour à un rythme soutenu est excellent pour le cœur.\n4. Contrôlez votre tension régulièrement : Les mutuelles de santé conventionnées organisent régulièrement des campagnes de dépistage gratuites. Profitez-en !`
        : `Hypertension artérielle dafa andil diafé-diafé xol bou bari.\n\nDigle cardiologue :\n1. Wanni xorom : Bagn lekk bouillon industriels yi xorom bi bari.\n2. Lekkal fruits ak légumes.\n3. Doxaal : Defal marche 30 minutes ci at mi ngir sa xol wér.\n4. Saytul sa tension régulièrement ci sa mutuelle.`
    }
  ];

  const flashTips = [
    { title: lang === 'fr' ? 'Sel & coeur' : 'Xorom ak xol', text: lang === 'fr' ? 'Réduire le sel de 2g par jour diminue de 20% le risque d\'accident cardiovasculaire.' : 'Wannil xorom bi ngir sa xol bagn am diafé-diafé.' },
    { title: lang === 'fr' ? 'Moustiquaire' : 'Moustiquaire', text: lang === 'fr' ? 'Bordez bien votre moustiquaire sous le matelas avant la nuit.' : 'Sangal sa moustiquaire bu baax avant nga teud.' },
    { title: lang === 'fr' ? 'Tension' : 'Tension bi', text: lang === 'fr' ? 'Au-delà de 14/9 de tension, il est conseillé de consulter un médecin.' : 'Soo amé tension bu raw 14/9, guissal docteur bi.' }
  ];

  // Utility to trigger dynamic in-UI toast
  const triggerToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage('');
    }, 3000);
  };

  // Load custom articles, comments, and likes from localStorage on mount
  useEffect(() => {
    const storedArticles = localStorage.getItem('cmu-blog-articles');
    if (storedArticles) {
      try {
        setCustomArticles(JSON.parse(storedArticles));
      } catch (e) {
        console.error('Error parsing custom articles:', e);
      }
    }

    const storedComments = localStorage.getItem('cmu-blog-comments');
    if (storedComments) {
      try {
        setComments(JSON.parse(storedComments));
      } catch (e) {
        console.error('Error parsing comments:', e);
      }
    }

    const storedLikes = localStorage.getItem('cmu-blog-likes');
    if (storedLikes) {
      try {
        setLikes(JSON.parse(storedLikes));
      } catch (e) {
        console.error('Error parsing likes:', e);
      }
    }
  }, []);

  // Autofill author details if connected as agent/admin
  useEffect(() => {
    if (portalMode === 'agent' && agentUser) {
      setNewArticle(prev => ({
        ...prev,
        author: `${agentUser.firstName} ${agentUser.lastName}`,
        role: agentUser.role || (lang === 'fr' ? 'Administrateur régional' : 'Njiit gobal')
      }));
    }
  }, [portalMode, agentUser, lang]);

  const allArticles = [...customArticles, ...defaultArticles];

  // Helper to calculate relative time dynamically
  const getRelativeTime = (article) => {
    const dateVal = article.date;
    if (!dateVal) return '';

    let dateObj;
    if (typeof dateVal === 'number') {
      dateObj = new Date(dateVal);
    } else {
      dateObj = new Date(dateVal);
    }

    if (isNaN(dateObj.getTime())) {
      return dateVal;
    }

    // Current local time: June 22, 2026, 19:08:17Z
    const now = new Date('2026-06-22T19:08:17Z');
    const diffMs = now - dateObj;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays <= 0) {
      if (diffHours <= 0) {
        if (diffMins <= 0) {
          return lang === 'fr' ? 'À l\'instant' : 'Léegi léegi';
        }
        return lang === 'fr' ? `Il y a ${diffMins} min` : `Mëj na ${diffMins} min`;
      }
      return lang === 'fr' ? `Il y a ${diffHours} h` : `Mëj na ${diffHours} waxtu`;
    } else if (diffDays === 1) {
      return lang === 'fr' ? 'Hier' : 'Kérbék';
    } else {
      return lang === 'fr' ? `Il y a ${diffDays} jours` : `Mëj na ${diffDays} fan`;
    }
  };

  // Image Upload handler (converts to base64 DataURL)
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        const errorMsg = lang === 'fr' ? 'La taille de l\'image doit être inférieure à 2 Mo.' : 'Photo bi dafa rëy raw 2 Mo.';
        setEditorError(errorMsg);
        triggerToast(errorMsg);
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewArticleImage(reader.result);
        setEditorError('');
      };
      reader.readAsDataURL(file);
    }
  };

  // Dynamic Likes toggle handler
  const handleLike = (articleId, e) => {
    if (e) e.stopPropagation(); // prevent opening details view from list card click

    const isLiked = likedArticles[articleId];
    const currentCount = likes[articleId] || 0;
    
    let newCount = currentCount;
    if (isLiked) {
      newCount = Math.max(0, currentCount - 1);
    } else {
      newCount = currentCount + 1;
    }

    const updatedLikes = {
      ...likes,
      [articleId]: newCount
    };

    const updatedLikedArticles = {
      ...likedArticles,
      [articleId]: !isLiked
    };

    setLikes(updatedLikes);
    setLikedArticles(updatedLikedArticles);
    localStorage.setItem('cmu-blog-likes', JSON.stringify(updatedLikes));

    if (!isLiked) {
      triggerToast(lang === 'fr' ? 'Vous aimez cet article !' : 'Beug nga article bi !');
    }
  };

  // Create article handler
  const handleCreateArticle = (e) => {
    e.preventDefault();
    if (!newArticle.title || !newArticle.author || !newArticle.content) {
      setEditorError(lang === 'fr' ? 'Veuillez remplir les champs obligatoires (Titre, Auteur, Contenu).' : 'Bindal titre, author ak content.');
      return;
    }

    const createdArticle = {
      id: Date.now(),
      title: newArticle.title,
      author: newArticle.author,
      role: newArticle.role || (lang === 'fr' ? 'Expert CSU' : 'Njiit CSU'),
      avatar: newArticle.avatar || '📝',
      date: Date.now(), // Store numeric timestamp for relative time calculation
      readTime: lang === 'fr' ? `${newArticle.readTime} de lecture` : `${newArticle.readTime} ci jang`,
      preview: newArticle.content.substring(0, 160) + '...',
      content: newArticle.content,
      imageUrl: newArticleImage || null
    };

    const updatedList = [createdArticle, ...customArticles];
    setCustomArticles(updatedList);
    localStorage.setItem('cmu-blog-articles', JSON.stringify(updatedList));

    // Reset Form
    setNewArticle({
      title: '',
      author: portalMode === 'agent' && agentUser ? `${agentUser.firstName} ${agentUser.lastName}` : '',
      role: portalMode === 'agent' && agentUser ? (agentUser.role || (lang === 'fr' ? 'Administrateur régional' : 'Njiit gobal')) : '',
      avatar: '🩺',
      readTime: '5 min',
      content: ''
    });
    setNewArticleImage(null);
    setEditorError('');

    const fileInput = document.getElementById('blog-image-input');
    if (fileInput) fileInput.value = '';

    setEditorSuccess(lang === 'fr' ? 'Article publié avec succès !' : 'Article bi soti na !');
    triggerToast(lang === 'fr' ? 'Article publié avec succès !' : 'Article bi soti na !');
    setTimeout(() => {
      setEditorSuccess('');
      setShowEditor(false);
    }, 2000);
  };

  // Add Comment handler
  const handleAddComment = (e) => {
    e.preventDefault();
    if (!newComment.author || !newComment.text || !selectedArticle) return;

    const articleId = selectedArticle.id;
    const list = comments[articleId] || [];
    const updatedList = [
      ...list,
      {
        id: Date.now(),
        author: newComment.author,
        text: newComment.text,
        date: new Date().toLocaleDateString('fr-FR')
      }
    ];

    const updatedComments = {
      ...comments,
      [articleId]: updatedList
    };

    setComments(updatedComments);
    localStorage.setItem('cmu-blog-comments', JSON.stringify(updatedComments));
    setNewComment({ author: '', text: '' });
    triggerToast(t.alertSuccess);
  };

  return (
    <div className="blog-view fade-in-up" style={{ padding: '1rem 0' }}>
      {/* Banner */}
      <section className="banner-mini" style={{
        background: `linear-gradient(to right, rgba(5, 150, 105, 0.7), rgba(5, 150, 105, 0.4)), url("/csu_blog_hero.png") center/cover no-repeat`,
        borderRadius: '16px',
        padding: '2.5rem 2rem',
        marginBottom: '2rem',
        color: '#fff',
        boxShadow: 'var(--shadow-md)',
        textAlign: 'center'
      }}>
        <div className="container" style={{ position: 'relative', zIndex: 2 }}>
          <h1 style={{ color: '#fff', fontSize: '2rem', fontWeight: '800', marginBottom: '0.5rem', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
            {t.title}
          </h1>
          <p style={{ color: '#f8fafc', fontSize: '1rem', fontWeight: '500', maxWidth: '700px', margin: '0 auto', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
            {t.subtitle}
          </p>
        </div>
      </section>

      {/* Editor collapsible form */}
      {(showEditor || (portalMode === 'agent' && agentUser)) && (
        <div className="card text-left fade-in-up" style={{ padding: '2rem', marginBottom: '2rem', borderLeft: '5px solid var(--primary)', borderRadius: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.35rem', fontWeight: '850', color: 'var(--primary)' }}>
              ✍️ {lang === 'fr' ? 'Rédiger et publier un article d\'expert' : 'Bind sa article expert'}
            </h3>
            {!(portalMode === 'agent' && agentUser) && (
              <button 
                className="btn-text" 
                style={{ color: 'var(--text-sub)', fontWeight: 'bold' }} 
                onClick={() => setShowEditor(false)}
              >
                {lang === 'fr' ? 'Masquer' : 'Dindi'}
              </button>
            )}
          </div>

          <form onSubmit={handleCreateArticle}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">{lang === 'fr' ? 'Titre de l\'article *' : 'Titre de l\'article *'}</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder={lang === 'fr' ? 'Ex: Les avancées de la CMU scolaire à Dakar' : 'Ex: CMU ecole ci Dakar'}
                  value={newArticle.title}
                  onChange={(e) => setNewArticle({ ...newArticle, title: e.target.value })}
                  required
                />
              </div>
              <div className="form-group" style={{ maxWidth: '200px' }}>
                <label className="form-label">{lang === 'fr' ? 'Temps de lecture' : 'Temps de lecture'}</label>
                <select 
                  className="form-control"
                  value={newArticle.readTime}
                  onChange={(e) => setNewArticle({ ...newArticle, readTime: e.target.value })}
                >
                  <option value="2 min">2 min</option>
                  <option value="4 min">4 min</option>
                  <option value="5 min">5 min</option>
                  <option value="7 min">7 min</option>
                  <option value="10 min">10 min</option>
                </select>
              </div>
            </div>

            <div className="form-row" style={{ marginTop: '1rem' }}>
              <div className="form-group">
                <label className="form-label">{lang === 'fr' ? 'Auteur *' : 'Auteur *'}</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="Ex: Dr. Moussa Diop"
                  value={newArticle.author}
                  onChange={(e) => setNewArticle({ ...newArticle, author: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">{lang === 'fr' ? 'Titre professionnel' : 'Titre professionnel'}</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="Ex: Directeur Médical, Chef de service"
                  value={newArticle.role}
                  onChange={(e) => setNewArticle({ ...newArticle, role: e.target.value })}
                />
              </div>
              <div className="form-group" style={{ maxWidth: '120px' }}>
                <label className="form-label">Avatar / Icône</label>
                <select 
                  className="form-control"
                  value={newArticle.avatar}
                  onChange={(e) => setNewArticle({ ...newArticle, avatar: e.target.value })}
                >
                  <option value="🩺">🩺 Stéthoscope</option>
                  <option value="👩‍⚕️">👩‍⚕️ Médecin (F)</option>
                  <option value="👨‍⚕️">👨‍⚕️ Médecin (H)</option>
                  <option value="📝">📝 Note / Crayon</option>
                  <option value="🏥">🏥 Hôpital</option>
                  <option value="❤️">❤️ Cœur</option>
                </select>
              </div>
            </div>

            <div className="form-group" style={{ marginTop: '1rem' }}>
              <label className="form-label" style={{ fontWeight: 'bold' }}>
                📷 {lang === 'fr' ? 'Photo d\'illustration (Image de couverture)' : 'Photo d\'illustration (Image de couverture)'}
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <input 
                  id="blog-image-input"
                  type="file" 
                  accept="image/*"
                  onChange={handleImageChange}
                  style={{ display: 'block', padding: '0.35rem 0', fontSize: '0.88rem' }}
                />
                {newArticleImage && (
                  <div style={{ position: 'relative' }}>
                    <img 
                      src={newArticleImage} 
                      alt="Aperçu" 
                      style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--border-color)' }} 
                    />
                    <button 
                      type="button"
                      className="btn-text" 
                      style={{ position: 'absolute', top: '-5px', right: '-5px', backgroundColor: 'var(--danger)', color: '#fff', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', border: 'none', cursor: 'pointer' }}
                      onClick={() => setNewArticleImage(null)}
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-sub)' }}>
                {lang === 'fr' ? 'Téléchargez une vraie photo depuis votre appareil (format JPEG/PNG, max 2 Mo).' : 'Duggalal photo bu réel ci sa appareil (max 2 Mo).'}
              </span>
            </div>

            <div className="form-group" style={{ marginTop: '1.25rem' }}>
              <label className="form-label">{lang === 'fr' ? 'Contenu de l\'article * (Supporte le saut de ligne)' : 'Contenu de l\'article *'}</label>
              <textarea 
                className="form-control" 
                rows="8" 
                placeholder={lang === 'fr' ? 'Rédigez le texte détaillé ici. Vous pouvez structurer vos paragraphes en sautant des lignes...' : 'Bindal sa article fii...'}
                value={newArticle.content}
                onChange={(e) => setNewArticle({ ...newArticle, content: e.target.value })}
                required
              />
            </div>

            {editorError && <div style={{ color: 'var(--danger)', fontWeight: 'bold', marginTop: '1rem', fontSize: '0.88rem' }}>{editorError}</div>}
            {editorSuccess && <div style={{ color: 'var(--success)', fontWeight: 'bold', marginTop: '1rem', fontSize: '0.88rem' }}>{editorSuccess}</div>}

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              <button type="submit" className="btn btn-primary">
                {lang === 'fr' ? 'Publier sur la plateforme' : 'Publier sur la plateforme'}
              </button>
              {!(portalMode === 'agent' && agentUser) && (
                <button type="button" className="btn btn-outline" onClick={() => setShowEditor(false)}>
                  {lang === 'fr' ? 'Annuler' : 'Annuler'}
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      {selectedArticle ? (
        // Full Article Detail View
        <div className="fade-in-up">
          <button 
            className="btn btn-outline btn-sm" 
            style={{ marginBottom: '2rem' }}
            onClick={() => setSelectedArticle(null)}
          >
            {t.backToList}
          </button>

          <div className="grid grid-3" style={{ gap: '2rem', alignItems: 'flex-start' }}>
            {/* Article Content Left (Span 2) */}
            <div style={{ gridColumn: 'span 2' }}>
              <article className="card text-left" style={{ padding: '2.5rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '16px' }}>
                {selectedArticle.imageUrl && (
                  <img 
                    src={selectedArticle.imageUrl} 
                    alt={selectedArticle.title} 
                    style={{ 
                      width: '100%', 
                      maxHeight: '360px', 
                      objectFit: 'cover', 
                      borderRadius: '12px', 
                      border: '1px solid var(--border-color)',
                      marginBottom: '1.5rem'
                    }} 
                  />
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div style={{ fontSize: '2.5rem', background: 'var(--bg-card-subtle)', width: '60px', height: '60px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-color)' }}>
                    {selectedArticle.avatar}
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-main)' }}>{selectedArticle.author}</h4>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-sub)' }}>{selectedArticle.role} — {getRelativeTime(selectedArticle)}</span>
                  </div>
                </div>

                <h2 style={{ fontSize: '1.75rem', fontWeight: '900', color: 'var(--primary)', marginBottom: '1.5rem', lineHeight: '1.3' }}>
                  {selectedArticle.title}
                </h2>

                <div style={{ 
                  fontSize: '1rem', 
                  color: 'var(--text-main)', 
                  lineHeight: '1.7', 
                  whiteSpace: 'pre-line',
                  borderTop: '1px solid var(--border-color)',
                  paddingTop: '1.5rem'
                }}>
                  {selectedArticle.content}
                </div>

                {/* Dynamic Reactions Section (Likes & Comments summary) */}
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between', 
                  marginTop: '2rem', 
                  paddingTop: '1.5rem', 
                  borderTop: '1px solid var(--border-color)' 
                }}>
                  <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                    <button 
                      onClick={() => handleLike(selectedArticle.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.5rem 1rem',
                        borderRadius: '20px',
                        border: '1px solid var(--border-color)',
                        background: likedArticles[selectedArticle.id] ? 'rgba(239, 68, 68, 0.1)' : 'var(--bg-card-subtle)',
                        color: likedArticles[selectedArticle.id] ? 'var(--danger)' : 'var(--text-sub)',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        outline: 'none'
                      }}
                    >
                      {likedArticles[selectedArticle.id] ? '❤️' : '🤍'} {lang === 'fr' ? 'J\'aime' : 'Beug na'} ({likes[selectedArticle.id] || 0})
                    </button>
                    
                    <span style={{ fontSize: '0.88rem', color: 'var(--text-sub)', fontWeight: '500' }}>
                      💬 {comments[selectedArticle.id]?.length || 0} {lang === 'fr' ? 'commentaire(s)' : 'waxtaan'}
                    </span>
                  </div>

                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    ⏱️ {selectedArticle.readTime}
                  </span>
                </div>
              </article>

              {/* Comments Section */}
              <div className="card text-left" style={{ padding: '2rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', marginTop: '2rem', borderRadius: '16px' }}>
                <h3 style={{ fontSize: '1.3rem', fontWeight: '800', color: 'var(--primary)', marginBottom: '1.5rem' }}>
                  💬 {t.commentsTitle} ({comments[selectedArticle.id]?.length || 0})
                </h3>

                {/* Comments List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '2rem' }}>
                  {comments[selectedArticle.id] && comments[selectedArticle.id].length > 0 ? (
                    comments[selectedArticle.id].map(comment => (
                      <div 
                        key={comment.id}
                        style={{
                          background: 'var(--bg-card-subtle)',
                          border: '1px solid var(--border-color)',
                          padding: '1rem 1.25rem',
                          borderRadius: '12px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '0.35rem' }}>
                          <span style={{ color: 'var(--primary)' }}>👤 {comment.author}</span>
                          <span style={{ color: 'var(--text-muted)' }}>{comment.date}</span>
                        </div>
                        <p style={{ fontSize: '0.88rem', color: 'var(--text-sub)', margin: 0, lineHeight: '1.4' }}>
                          {comment.text}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', padding: '1rem 0' }}>
                      {t.noComments}
                    </p>
                  )}
                </div>

                {/* Add Comment Form */}
                <form onSubmit={handleAddComment} style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
                  <div className="form-group">
                    <label className="form-label">{t.commentLabelName}</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder={t.commentPlaceholderName}
                      value={newComment.author}
                      onChange={(e) => setNewComment({ ...newComment, author: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group" style={{ marginTop: '1rem' }}>
                    <label className="form-label">{t.commentLabelText}</label>
                    <textarea 
                      className="form-control" 
                      rows="4" 
                      placeholder={t.commentPlaceholderText}
                      value={newComment.text}
                      onChange={(e) => setNewComment({ ...newComment, text: e.target.value })}
                      style={{ resize: 'none' }}
                      required
                    />
                  </div>
                  <button type="submit" className="btn btn-primary btn-sm" style={{ marginTop: '1.25rem' }}>
                    {t.commentBtnSubmit}
                  </button>
                </form>
              </div>
            </div>

            {/* Sidebar Right: Tips */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div className="card text-left" style={{ padding: '1.5rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--secondary)', marginBottom: '1rem' }}>
                  📢 {t.sidebarTitle}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {flashTips.map((tip, idx) => (
                    <div key={idx} style={{ paddingBottom: '0.75rem', borderBottom: idx < flashTips.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-main)', display: 'block', marginBottom: '0.25rem' }}>{tip.title}</span>
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-sub)', margin: 0 }}>{tip.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        // Articles List Grid
        <div className="grid grid-3" style={{ gap: '2rem' }}>
          {/* Main Articles list (Span 2) */}
          <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {allArticles.map(article => (
              <article 
                key={article.id}
                className="card text-left"
                style={{ 
                  padding: '2rem', 
                  background: 'var(--bg-card)', 
                  border: '1px solid var(--border-color)', 
                  borderRadius: '16px',
                  cursor: 'pointer',
                  transition: 'transform 0.2s, box-shadow 0.2s'
                }}
                onClick={() => setSelectedArticle(article)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-3px)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                }}
              >
                <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap-reverse', alignItems: 'center' }}>
                  <div style={{ flex: 1, minWidth: '220px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                      <span>{article.author} — {getRelativeTime(article)}</span>
                      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                        <span>⏱️ {article.readTime}</span>
                        <span>💬 {comments[article.id]?.length || 0}</span>
                        <button 
                          onClick={(e) => handleLike(article.id, e)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.2rem',
                            padding: 0,
                            color: likedArticles[article.id] ? 'var(--danger)' : 'var(--text-muted)',
                            transition: 'transform 0.2s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.2)'}
                          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                        >
                          {likedArticles[article.id] ? '❤️' : '🤍'} {likes[article.id] || 0}
                        </button>
                      </div>
                    </div>
                    
                    <h3 style={{ fontSize: '1.35rem', fontWeight: '850', color: 'var(--primary)', marginBottom: '0.75rem' }}>
                      {article.title}
                    </h3>
                    
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-sub)', lineHeight: '1.5', margin: 0 }}>
                      {article.preview}
                    </p>
                    
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--secondary)' }}>
                        {lang === 'fr' ? 'Lire l\'article →' : 'Lire article bi →'}
                      </span>
                    </div>
                  </div>

                  {article.imageUrl && (
                    <img 
                      src={article.imageUrl} 
                      alt={article.title} 
                      style={{ 
                        width: '120px', 
                        height: '120px', 
                        objectFit: 'cover', 
                        borderRadius: '12px', 
                        border: '1px solid var(--border-color)',
                        flexShrink: 0
                      }} 
                    />
                  )}
                </div>
              </article>
            ))}
          </div>

          {/* Sidebar right: Info & Tips */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Health Tips */}
            <div className="card text-left" style={{ padding: '1.5rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--secondary)', marginBottom: '1rem' }}>
                📢 {t.sidebarTitle}
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {flashTips.map((tip, idx) => (
                  <div key={idx} style={{ paddingBottom: '0.75rem', borderBottom: idx < flashTips.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-main)', display: 'block', marginBottom: '0.25rem' }}>{tip.title}</span>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-sub)', margin: 0 }}>{tip.text}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* General Blog Note / Contribution trigger */}
            {!(portalMode === 'agent' && agentUser) && (
              <div className="card text-left" style={{ padding: '1.5rem', background: 'var(--bg-card-subtle)', border: '1px dashed var(--border-color)', borderRadius: '16px' }}>
                <span style={{ fontWeight: 'bold', color: 'var(--text-main)', fontSize: '0.85rem', display: 'block', marginBottom: '0.5rem' }}>
                  ✍️ {lang === 'fr' ? 'Participez au débat !' : 'Bokk ci waxtaan bi !'}
                </span>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-sub)', lineHeight: '1.4', marginBottom: '1rem' }}>
                  {lang === 'fr' 
                    ? 'Vous êtes médecin, chercheur ou acteur de la CSU au Sénégal ? Contribuez en publiant votre article d\'analyse.' 
                    : 'Soo doné médecin walla doctor, duggalal sa article ngir leral askan wi.'}
                </p>
                <button 
                  className="btn btn-outline btn-sm" 
                  style={{ width: '100%' }}
                  onClick={() => setShowEditor(!showEditor)}
                >
                  {showEditor 
                    ? (lang === 'fr' ? 'Masquer l\'éditeur' : 'Rédiger un article') 
                    : (lang === 'fr' ? 'Rédiger un article' : 'Rédiger un article')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Dynamic Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          bottom: '2rem',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: 'var(--primary)',
          color: '#fff',
          padding: '0.8rem 1.5rem',
          borderRadius: '30px',
          boxShadow: 'var(--shadow-lg)',
          zIndex: 10000,
          fontWeight: 'bold',
          fontSize: '0.9rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          animation: 'fadeInUp 0.3s ease-out'
        }}>
          <span>✅</span>
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
