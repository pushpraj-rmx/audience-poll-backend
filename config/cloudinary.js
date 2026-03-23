const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadBufferToCloudinary = (buffer, folder = "audience-poll/profiles") =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: "image" }, // remove overwrite for unique uploads
      (err, res) => {
        if (err) return reject(err);
        resolve({
          url: res.secure_url,      // ✅ always safe
          public_id: res.public_id, // ✅ important for deletion later
          format: res.format,       // optional
          bytes: res.bytes,         // optional
        });
      }
    );
    stream.end(buffer);
  });

module.exports = { cloudinary, uploadBufferToCloudinary };
