import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ المسارات المطلقة للمجلدات
const uploadsDir = path.join(__dirname, '..', 'uploads');
const videosDir = path.join(__dirname, '..', 'uploads', 'videos');
const avatarsDir = path.join(__dirname, '..', 'uploads', 'avatars');

// ✅ إنشاء المجلدات بشكل متزامن وآمن
const createDirectories = () => {
  const directories = [uploadsDir, videosDir, avatarsDir];
  
  directories.forEach(dir => {
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`✅ Created directory: ${dir}`);
      }
    } catch (error) {
      console.error(`❌ Failed to create directory ${dir}:`, error);
      throw error;
    }
  });
};

// استدعاء الدالة لإنشاء المجلدات
createDirectories();

// ✅ تخزين الفيديوهات - مع المسارات المطلقة
const videoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    console.log('🎬 Storing video in:', videosDir);
    cb(null, videosDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    const filename = 'video-' + uniqueSuffix + extension;
    console.log('📁 Generated video filename:', filename);
    cb(null, filename);
  }
});

// ✅ تخزين الصور - مع المسارات المطلقة والإصلاح هنا
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    console.log('🖼️ Storing avatar in:', avatarsDir);
    
    // ✅ الإصلاح: التأكد من وجود المجلد قبل الحفظ
    if (!fs.existsSync(avatarsDir)) {
      fs.mkdirSync(avatarsDir, { recursive: true });
      console.log('📁 Created avatars directory:', avatarsDir);
    }
    
    cb(null, avatarsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    const filename = 'avatar-' + uniqueSuffix + extension;
    console.log('📁 Generated avatar filename:', filename);
    cb(null, filename);
  }
});

const videoFileFilter = (req, file, cb) => {
  const validTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];
  const fileExtension = file.originalname.toLowerCase().split('.').pop();
  const isValidType = validTypes.includes(file.mimetype) || 
                     ['mp4', 'webm', 'ogg', 'mov'].includes(fileExtension || '');

  console.log('🔍 Video file validation:', {
    originalname: file.originalname,
    mimetype: file.mimetype,
    extension: fileExtension,
    isValid: isValidType
  });

  if (isValidType) {
    cb(null, true);
  } else {
    cb(new Error('Only video files are allowed (MP4, WebM, OGG, MOV)'), false);
  }
};

const imageFileFilter = (req, file, cb) => {
  const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  
  console.log('🔍 Image file validation:', {
    originalname: file.originalname,
    mimetype: file.mimetype,
    isValid: validImageTypes.includes(file.mimetype)
  });

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
    fileSize: 50 * 1024 * 1024 // 50MB
  }
});

export const uploadAvatar = multer({
  storage: avatarStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB للصور
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