// Generic Joi validation middleware
const joiValidate = (schema) => (req, res, next) => {
  const options = { abortEarly: false, allowUnknown: true, stripUnknown: true };
  const { error, value } = schema.validate(req.body, options);
  if (error) {
    return res.status(400).json({
      error: 'Validation failed',
      details: error.details.map((d) => d.message)
    });
  }
  req.body = value;
  return next();
};

module.exports = joiValidate;
