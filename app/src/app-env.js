const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_ADMIN_USER = process.env.DB_ADMIN_USER || 'root';
const DB_ADMIN_PASS = process.env.DB_ADMIN_PASS || '';
const DB_USER = process.env.DB_USER || '';
const DB_PASS = process.env.DB_PASS || '';
const DB_NAME = process.env.DB_NAME || '';

module.exports = {
  DB_HOST,
  DB_ADMIN_USER,
  DB_ADMIN_PASS,
  DB_USER,
  DB_PASS,
  DB_NAME
};
