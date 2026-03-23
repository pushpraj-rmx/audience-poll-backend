// const multer = require('multer');
// const path = require('path');

// const storage = multer.diskStorage({
//   destination: function (req, file, cb) {
//     // Determine destination folder based on file field name
//     let uploadPath = path.join(__dirname, '../uploads/userPics');
    
//     if (file.fieldname === 'banner') {
//       uploadPath = path.join(__dirname, '../uploads/contest/banners');
//     } else if (file.fieldname === 'logo') {
//       uploadPath = path.join(__dirname, '../uploads/contest/logos');
//     } else if (file.fieldname === 'profilePic' || file.fieldname === 'profile_pic') {
//       uploadPath = path.join(__dirname, '../uploads/userPics');
//     } else if (file.fieldname === 'qrCode') {
//       uploadPath = path.join(__dirname, '../uploads/qrcodes');
//     }
    
//     cb(null, uploadPath);
//   },
//   filename: function (req, file, cb) {
//     // Create unique filename with timestamp and original extension
//     const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
//     cb(null, uniqueSuffix + path.extname(file.originalname));
//   }
// });

// const fileFilter = (req, file, cb) => {
//   if (/^image\/(png|jpe?g|jpg|webp)$/i.test(file.mimetype)) return cb(null, true);
//   cb(new Error('Only image files are allowed'));
// };

// const upload = multer({
//   storage,
//   limits: { fileSize: 2 * 1024 * 1024 }, // 5MB
//   fileFilter,
// });

// module.exports = upload;


const multer = require('multer');
const path = require('path');
const fs = require('fs')

const ensureDirExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    let uploadPath = path.join(__dirname, '../uploads/userPics');

    if (file.fieldname === 'banner') {
      uploadPath = path.join(__dirname, '../uploads/contest/banners');
    } else if (file.fieldname === 'logo') {
      uploadPath = path.join(__dirname, '../uploads/contest/logos');
    } else if (file.fieldname === 'profilePic' || file.fieldname === 'profile_pic') {
      uploadPath = path.join(__dirname, '../uploads/userPics');
    } else if (file.fieldname === 'qrCode') {
      uploadPath = path.join(__dirname, '../uploads/qrcodes');
    } 
    // 🔽 NEW: CSV upload support
    else if (file.fieldname === 'csv') {
      uploadPath = path.join(__dirname, '../uploads/csv');
    }
    // 🔽 NEW: PDF upload support
    else if (file.fieldname === 'pdf') {
      uploadPath = path.join(__dirname, '../uploads/contest/pdfs');
    }

     ensureDirExists(uploadPath);

    cb(null, uploadPath);
  },

  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

// ✅ Updated fileFilter (images + csv + pdf)
const fileFilter = (req, file, cb) => {
  // image files (existing)
  if (/^image\/(png|jpe?g|jpg|webp)$/i.test(file.mimetype)) {
    return cb(null, true);
  }

  // 🔽 CSV support
  if (
    file.mimetype === 'text/csv' ||
    file.mimetype === 'application/vnd.ms-excel' ||
    path.extname(file.originalname).toLowerCase() === '.csv'
  ) {
    return cb(null, true);
  }

  // 🔽 PDF support
  if (
    file.mimetype === 'application/pdf' ||
    path.extname(file.originalname).toLowerCase() === '.pdf'
  ) {
    return cb(null, true);
  }

  cb(new Error('Only image, CSV, or PDF files are allowed'));
};

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB (CSV + images safe)
  fileFilter,
});

module.exports = upload;