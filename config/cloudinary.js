// const cloudinary = require('cloudinary').v2;
// const { CloudinaryStorage } = require('multer-storage-cloudinary');
// const multer = require('multer');
 
// // Configure Cloudinary with your credentials
// cloudinary.config({
//   cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
//   api_key: process.env.CLOUDINARY_API_KEY,
//   api_secret: process.env.CLOUDINARY_API_SECRET
// });
 
// // Configure storage for images
// const imageStorage = new CloudinaryStorage({
//   cloudinary: cloudinary,
//   params: {
//     folder: 'equitask/proofs/images', // Folder in Cloudinary
//     allowed_formats: ['jpg', 'jpeg', 'png', 'gif'], // Allowed image types
//     transformation: [{ width: 1000, height: 1000, crop: 'limit' }] // Resize large images
//   }
// });
 
// // Configure storage for audio
// const audioStorage = new CloudinaryStorage({
//   cloudinary: cloudinary,
//   params: {
//     folder: 'equitask/proofs/audio', // Folder in Cloudinary
//     allowed_formats: ['mp3', 'wav', 'ogg', 'm4a'], // Allowed audio types
//     resource_type: 'video' // Cloudinary treats audio as video
//   }
// });
 
// // Create upload middleware for images
// const uploadImage = multer({
//   storage: imageStorage,
//   limits: {
//     fileSize: 5 * 1024 * 1024 // 5MB max file size
//   }
// });
 
// // Create upload middleware for audio
// const uploadAudio = multer({
//   storage: audioStorage,
//   limits: {
//     fileSize: 10 * 1024 * 1024 // 10MB max file size
//   }
// });
 
// module.exports = {
//   cloudinary,
//   uploadImage,
//   uploadAudio
// };
 