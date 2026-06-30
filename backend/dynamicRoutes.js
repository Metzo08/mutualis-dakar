const express = require('express');
const router = express.Router();
const { query } = require('./db');
const { authenticateToken, requireRole } = require('./rbac');
const { parsePagination } = require('./pagination');

// 1. Partnerships Espace
// POST /api/partnerships (Public submission)
router.post('/api/partnerships', async (req, res) => {
  try {
    const { companyName, sector, contactPerson, email, phone, message } = req.body;
    if (!companyName || !contactPerson || !email || !phone || !message) {
      return res.status(400).json({ error: 'Veuillez remplir tous les champs obligatoires.' });
    }

    const date = new Date().toLocaleDateString('fr-FR');
    const result = await query(
      `INSERT INTO partnerships (company_name, sector, contact_person, email, phone, message, status, date)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7) RETURNING *`,
      [companyName, sector || 'mécénat', contactPerson, email, phone, message, date]
    );

    // Audit log
    await query(
      `INSERT INTO audit_logs (action, actor, details) VALUES ($1, $2, $3)`,
      ['SOUMISSION_PARTENARIAT', phone, `Nouvelle demande de partenariat déposée par ${companyName} (${contactPerson}).`]
    );

    res.status(201).json({ success: true, request: result.rows[0] });
  } catch (err) {
    console.error('Erreur lors du dépôt de partenariat :', err);
    res.status(500).json({ error: 'Erreur interne du serveur.' });
  }
});

// GET /api/partnerships (Requires agent/admin authentication, list requests)
router.get('/api/partnerships', authenticateToken, requireRole('agent', 'admin'), async (req, res) => {
  try {
    const { page, limit, offset } = parsePagination(req);
    const countRes = await query('SELECT COUNT(*) FROM partnerships');
    const total = parseInt(countRes.rows[0].count || '0', 10);

    const result = await query(
      'SELECT * FROM partnerships ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );

    res.json({
      data: result.rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1, hasNext: page * limit < total, hasPrev: page > 1 }
    });
  } catch (err) {
    console.error('Erreur liste partenariats :', err);
    res.status(500).json({ error: 'Erreur interne du serveur.' });
  }
});

// PUT /api/partnerships/:id/status (Requires agent/admin, update status)
router.put('/api/partnerships/:id/status', authenticateToken, requireRole('agent', 'admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ error: 'Statut requis.' });
    }

    const pRes = await query('SELECT * FROM partnerships WHERE id = $1', [id]);
    if (pRes.rows.length === 0) {
      return res.status(404).json({ error: 'Demande introuvable.' });
    }
    const p = pRes.rows[0];

    const result = await query(
      'UPDATE partnerships SET status = $1 WHERE id = $2 RETURNING *',
      [status, id]
    );

    const actor = req.user.username || 'agent@cmu.sn';
    // Audit log
    await query(
      `INSERT INTO audit_logs (action, actor, details) VALUES ($1, $2, $3)`,
      ['DECISION_PARTENARIAT', actor, `La demande de partenariat de ${p.company_name} a été passée au statut : ${status}.`]
    );

    res.json({ success: true, request: result.rows[0] });
  } catch (err) {
    console.error('Erreur statut partenariat :', err);
    res.status(500).json({ error: 'Erreur interne du serveur.' });
  }
});

// 2. Blog Espace
// GET /api/blog/articles (Public list)
router.get('/api/blog/articles', async (req, res) => {
  try {
    const result = await query(
      `SELECT a.*, COUNT(c.id)::int as comment_count 
       FROM blog_articles a 
       LEFT JOIN blog_comments c ON c.article_id = a.id 
       GROUP BY a.id 
       ORDER BY a.date DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Erreur liste articles de blog :', err);
    res.status(500).json({ error: 'Erreur interne du serveur.' });
  }
});

// POST /api/blog/articles (Requires agent/admin)
router.post('/api/blog/articles', authenticateToken, requireRole('agent', 'admin'), async (req, res) => {
  try {
    const { titleFr, titleWo, author, roleFr, roleWo, avatar, readTimeFr, readTimeWo, previewFr, previewWo, contentFr, contentWo, imageUrl } = req.body;
    if (!titleFr || !titleWo || !author || !roleFr || !roleWo || !contentFr || !contentWo) {
      return res.status(400).json({ error: 'Veuillez remplir tous les champs obligatoires.' });
    }

    const date = Date.now();
    const result = await query(
      `INSERT INTO blog_articles (title_fr, title_wo, author, role_fr, role_wo, avatar, date, read_time_fr, read_time_wo, preview_fr, preview_wo, content_fr, content_wo, image_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
      [titleFr, titleWo, author, roleFr, roleWo, avatar || '🩺', date, readTimeFr || '5 min', readTimeWo || '5 min', previewFr || '', previewWo || '', contentFr, contentWo, imageUrl || null]
    );

    const actor = req.user.username || 'agent@cmu.sn';
    // Audit log
    await query(
      `INSERT INTO audit_logs (action, actor, details) VALUES ($1, $2, $3)`,
      ['CREATION_ARTICLE_BLOG', actor, `Nouvel article publié par ${author} : "${titleFr}".`]
    );

    res.status(201).json({ success: true, article: result.rows[0] });
  } catch (err) {
    console.error('Erreur lors de la création de l\'article :', err);
    res.status(500).json({ error: 'Erreur interne du serveur.' });
  }
});

// POST /api/blog/articles/:id/like (Increment like count)
router.post('/api/blog/articles/:id/like', async (req, res) => {
  try {
    const { id } = req.params;
    const { decrement } = req.body;
    const step = decrement ? -1 : 1;

    const result = await query(
      'UPDATE blog_articles SET likes = GREATEST(0, likes + $1) WHERE id = $2 RETURNING *',
      [step, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Article introuvable.' });
    }

    res.json({ success: true, likes: result.rows[0].likes });
  } catch (err) {
    console.error('Erreur like article :', err);
    res.status(500).json({ error: 'Erreur interne du serveur.' });
  }
});

// GET /api/blog/articles/:id/comments (Get comments)
router.get('/api/blog/articles/:id/comments', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query('SELECT * FROM blog_comments WHERE article_id = $1 ORDER BY created_at ASC', [id]);
    res.json(result.rows);
  } catch (err) {
    console.error('Erreur liste commentaires :', err);
    res.status(500).json({ error: 'Erreur interne du serveur.' });
  }
});

// POST /api/blog/articles/:id/comments (Post comment)
router.post('/api/blog/articles/:id/comments', async (req, res) => {
  try {
    const { id } = req.params;
    const { author, text } = req.body;
    if (!author || !text) {
      return res.status(400).json({ error: 'Auteur et texte requis.' });
    }

    const result = await query(
      'INSERT INTO blog_comments (article_id, author, text) VALUES ($1, $2, $3) RETURNING *',
      [id, author, text]
    );

    res.status(201).json({ success: true, comment: result.rows[0] });
  } catch (err) {
    console.error('Erreur création commentaire :', err);
    res.status(500).json({ error: 'Erreur interne du serveur.' });
  }
});

// 3. Galerie CSU
// GET /api/gallery (Public list)
router.get('/api/gallery', async (req, res) => {
  try {
    const result = await query('SELECT * FROM gallery_items ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Erreur liste galerie :', err);
    res.status(500).json({ error: 'Erreur interne du serveur.' });
  }
});

// 4. Contenus Dynamiques
// GET /api/dynamic-content/:key
router.get('/api/dynamic-content/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const result = await query('SELECT content FROM dynamic_content WHERE key = $1', [key]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contenu introuvable.' });
    }
    res.json(result.rows[0].content);
  } catch (err) {
    console.error('Erreur contenu dynamique :', err);
    res.status(500).json({ error: 'Erreur interne du serveur.' });
  }
});

module.exports = router;
