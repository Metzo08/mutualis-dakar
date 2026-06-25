// Middleware de validation Express basé sur zod.
// Utilisation : validate(schema) -> valide req.body et remplace req.body par la version normalisée.
function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const firstError = result.error.issues[0];
      return res.status(400).json({
        error: firstError ? firstError.message : 'Données invalides.',
        details: result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }))
      });
    }
    req.body = result.data; // version normalisée (transformations appliquées)
    next();
  };
}

module.exports = { validate };
