import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from '../config/cloudinaryConfig.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ المسارات المطلقة (للمحافظة على التوافق مع الأنظمة الحالية إذا لزم الأمر)
const uploadsDir = path.join(__dirname, '..', 'uploads');
const videosDir = path.join(__dirname, '..', 'uploads', 'videos');
const avatarsDir = path.join(__dirname, '..', 'uploads', 'avatars');

// ✅ إعداد تخزين Cloudinary للفيديوهات
const videoStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'nojoom/videos',
    resource_type: 'video',
    allowed_formats: ['mp4', 'webm', 'ogg', 'mov'],
    public_id: (req, file) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      return 'video-' + uniqueSuffix;
    }
  },
});

// ✅ إعداد تخزين Cloudinary للصور (الرمز الشخصي)
const avatarStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'nojoom/avatars',
    resource_type: 'image',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    public_id: (req, file) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      return 'avatar-' + uniqueSuffix;
    }
  },
});

const videoFileFilter = (req, file, cb) => {
  const validTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];
  const fileExtension = file.originalname.toLowerCase().split('.').pop();
  const isValidType = validTypes.includes(file.mimetype) ||
    ['mp4', 'webm', 'ogg', 'mov'].includes(fileExtension || '');

  if (isValidType) {
    cb(null, true);
  } else {
    cb(new Error('Only video files are allowed (MP4, WebM, OGG, MOV)'), false);
  }
};

const imageFileFilter = (req, file, cb) => {
  const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

  if (validImageTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed (JPEG, PNG, GIF, WebP)'), false);
  }
};

// ✅ تصدير multer instances
export const upload = multer({
  storage: videoStorage,
  fileFilter: videoFileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024 // زيادة الحد لـ 100MB للفيديوهات السحابية
  }
});

export const uploadAvatar = multer({
  storage: avatarStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // زيادة الحد لـ 10MB للصور السحابية
  }
});

// ✅ دالة مساعدة للتحقق من وجود الملف
export const checkFileExists = (filename) => {
  const filePath = path.join(videosDir, filename);
  return fs.existsSync(filePath);
};

// ✅ دالة للحصول على المسار الكامل للملف
export const getVideoFilePath = (filename) => {
  return path.join(videosDir, filename);
};

// ✅ دالة للحصول على المسار الكامل للصورة
export const getAvatarFilePath = (filename) => {
  return path.join(avatarsDir, filename);
};

// ✅ دالة لفحص حالة المجلدات
export const checkDirectories = () => {
  const directories = [
    { path: uploadsDir, name: 'uploads' },
    { path: videosDir, name: 'videos' },
    { path: avatarsDir, name: 'avatars' }
  ];

  directories.forEach(dir => {
    const exists = fs.existsSync(dir.path);
    const writable = exists ? (fs.statSync(dir.path).mode & 0o200) !== 0 : false;

    console.log(`📁 Directory ${dir.name}:`, {
      path: dir.path,
      exists,
      writable,
      absolutePath: path.resolve(dir.path)
    });

    if (exists) {
      try {
        const files = fs.readdirSync(dir.path);
        console.log(`   Files in ${dir.name}:`, files);
      } catch (error) {
        console.error(`   Cannot read files in ${dir.name}:`, error.message);
      }
    }
  });
};

// فحص المجلدات عند التحميل
checkDirectories();