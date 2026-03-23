const path = require('path');

const getFileUrl = (filename) => {
  // Convert backslashes to forward slashes for URL compatibility
  return `/uploads/${filename}`;
};

const getFilePath = (filename) => {
  return path.join(__dirname, '..', 'uploads', filename);
};

module.exports = {
  getFileUrl,
  getFilePath
};