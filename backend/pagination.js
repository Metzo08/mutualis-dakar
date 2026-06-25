// Helper de pagination pour les routes GET de l'API.
// Extrait les paramètres `page` et `limit` de la query string avec des bornes sûres.
function parsePagination(req) {
  let page = parseInt(req.query.page, 10);
  let limit = parseInt(req.query.limit, 10);
  if (!Number.isInteger(page) || page < 1) page = 1;
  if (!Number.isInteger(limit) || limit < 1) limit = 50;
  if (limit > 200) limit = 200; // plafond pour éviter les abus
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

module.exports = { parsePagination };
