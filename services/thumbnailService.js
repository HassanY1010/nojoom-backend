import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
23
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// تعيين مسار ffmpeg
ffmpeg.setFfmpegPath(ffmpegPath);

export class ThumbnailService {
  static async generateThumbnail(videoPath, outputDir, filename) {
    return new Promise((resolve, reject) => {
      try {
        console.log('🖼️ Generating thumbnail for:', videoPath);

        // ✅ التأكد من وجود الملف قبل البدء
        if (!fs.existsSync(videoPath)) {
          console.error('❌ Video file not found:', videoPath);
          const defaultThumbnail = this.createDefaultThumbnail(outputDir, filename);
          return resolve(defaultThumbnail);
        }

        // التأكد من وجود مجلد thumbnails
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }

        const finalFilename = filename.toLowerCase().endsWith('.jpg') ? filename : `${filename}.jpg`;
        const thumbnailPath = path.join(outputDir, finalFilename);

        ffmpeg(videoPath)
          .screenshots({
            timestamps: ['00:00:01'], // ثانية واحدة من بداية الفيديو
            filename: finalFilename,
            folder: outputDir,
            size: '640x360' // حجم 16:9
          })
          .on('end', () => {
            console.log('✅ Thumbnail generated successfully:', thumbnailPath);
            resolve(`/uploads/videos/thumbnails/${finalFilename}`);
          })
          .on('error', (err) => {
            console.error('❌ Thumbnail generation failed:', err);
            // استخدام صورة افتراضية إذا فشل التوليد
            const defaultThumbnail = this.createDefaultThumbnail(outputDir, filename);
            resolve(defaultThumbnail);
          });
      } catch (error) {
        console.error('❌ Thumbnail service error:', error);
        const defaultThumbnail = this.createDefaultThumbnail(outputDir, filename);
        resolve(defaultThumbnail);
      }
    });
  }

  static createDefaultThumbnail(outputDir, filename) {
    try {
      const finalFilename = filename.toLowerCase().endsWith('.jpg') ? filename : `${filename}.jpg`;
      const defaultThumbnailPath = path.join(outputDir, finalFilename);

      // ✅ التأكد من وجود المجلد
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // ✅ استخدام canvas بشكل صحيح في ES Modules
      import('canvas').then(({ createCanvas }) => {
        const canvas = createCanvas(640, 360);
        const ctx = canvas.getContext('2d');

        // خلفية متدرجة
        const gradient = ctx.createLinearGradient(0, 0, 640, 360);
        gradient.addColorStop(0, '#1e3a8a');
        gradient.addColorStop(1, '#7e22ce');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 640, 360);

        // إضافة أيقونة فيديو
        ctx.fillStyle = 'white';
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('🎬', 320, 180);

        // حفظ الصورة
        const buffer = canvas.toBuffer('image/jpeg');
        fs.writeFileSync(defaultThumbnailPath, buffer);

        console.log('✅ Default thumbnail created:', defaultThumbnailPath);
      }).catch(error => {
        console.error('❌ Canvas import failed:', error);
        // نسخ صورة افتراضية موجودة
        const defaultSource = path.join(__dirname, '..', 'public', 'default-thumbnail.jpg');
        if (fs.existsSync(defaultSource)) {
          fs.copyFileSync(defaultSource, defaultThumbnailPath);
        }
      });


      return `/uploads/videos/thumbnails/${finalFilename}`;
    } catch (error) {
      console.error('❌ Failed to create default thumbnail:', error);
      return '/default-thumbnail.jpg'; // صورة افتراضية ثابتة
    }
  }

  static async generateMultipleThumbnails(videoPath, outputDir, filename, count = 3) {
    return new Promise((resolve, reject) => {
      try {
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }

        // ✅ التأكد من وجود الملف
        if (!fs.existsSync(videoPath)) {
          console.error('❌ Video file not found for multiple thumbnails:', videoPath);
          return resolve([]);
        }

        // الحصول على مدة الفيديو أولاً
        ffmpeg.ffprobe(videoPath, (err, metadata) => {
          if (err) {
            console.error('❌ Error getting video duration:', err);
            return resolve([]);
          }

          const duration = metadata.format.duration;
          const interval = duration / (count + 1);

          const timestamps = [];
          for (let i = 1; i <= count; i++) {
            const time = interval * i;
            const hours = Math.floor(time / 3600);
            const minutes = Math.floor((time % 3600) / 60);
            const seconds = Math.floor(time % 60);
            timestamps.push(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
          }

          const thumbnails = [];
          let completed = 0;

          timestamps.forEach((timestamp, index) => {
            // إزالة .jpg من البداية إذا كان موجوداً لتجنب التكرار عند إضافة _index.jpg
            const baseName = filename.toLowerCase().endsWith('.jpg')
              ? filename.slice(0, -4)
              : filename;
            const thumbFilename = `${baseName}_${index + 1}.jpg`;
            const thumbPath = path.join(outputDir, thumbFilename);

            ffmpeg(videoPath)
              .screenshots({
                timestamps: [timestamp],
                filename: thumbFilename,
                folder: outputDir,
                size: '320x180'
              })
              .on('end', () => {
                console.log(`✅ Thumbnail ${index + 1} generated:`, thumbPath);
                thumbnails.push(`/uploads/videos/thumbnails/${thumbFilename}`);
                completed++;

                if (completed === count) {
                  resolve(thumbnails);
                }
              })
              .on('error', (err) => {
                console.error(`❌ Thumbnail ${index + 1} generation failed:`, err);
                completed++;

                if (completed === count) {
                  resolve(thumbnails);
                }
              });
          });
        });
      } catch (error) {
        console.error('❌ Multiple thumbnails generation failed:', error);
        resolve([]);
      }
    });
  }

  static deleteThumbnail(thumbnailPath) {
    try {
      if (thumbnailPath && !thumbnailPath.includes('default-thumbnail')) {
        const filename = path.basename(thumbnailPath);
        const fullPath = path.join(__dirname, '..', 'uploads', 'videos', 'thumbnails', filename);

        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
          console.log('✅ Thumbnail deleted:', fullPath);
        }
      }
    } catch (error) {
      console.error('❌ Error deleting thumbnail:', error);
    }
  }
}

export default ThumbnailService;