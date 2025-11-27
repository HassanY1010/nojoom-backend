import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// تعيين مسار ffmpeg
ffmpeg.setFfmpegPath(ffmpegPath);

export class ThumbnailService {
  static async generateThumbnail(videoPath, outputDir, filename) {
    return new Promise((resolve, reject) => {
      try {
        console.log('🖼️ Generating thumbnail for:', videoPath);
        
        // التأكد من وجود مجلد thumbnails
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }

        const thumbnailPath = path.join(outputDir, `${filename}.jpg`);
        
        ffmpeg(videoPath)
          .screenshots({
            timestamps: ['00:00:01'], // ثانية واحدة من بداية الفيديو
            filename: `${filename}.jpg`,
            folder: outputDir,
            size: '640x360' // حجم 16:9
          })
          .on('end', () => {
            console.log('✅ Thumbnail generated successfully:', thumbnailPath);
            resolve(`/thumbnails/${filename}.jpg`);
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
      const defaultThumbnailPath = path.join(outputDir, `${filename}.jpg`);
      
      // إنشاء صورة افتراضية بسيطة (يمكن استبدالها بصورة افتراضية جاهزة)
      const canvas = require('canvas').createCanvas(640, 360);
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
      return `/thumbnails/${filename}.jpg`;
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
            const thumbFilename = `${filename}_${index + 1}.jpg`;
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
                thumbnails.push(`/thumbnails/${thumbFilename}`);
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
        const fullPath = path.join(__dirname, '..', 'thumbnails', filename);
        
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