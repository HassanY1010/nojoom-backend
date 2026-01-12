// config/ffmpegConfig.js
import ffmpegPath from 'ffmpeg-static';
import ffmpeg from 'fluent-ffmpeg';

// تعيين مسار FFMPEG
ffmpeg.setFfmpegPath(ffmpegPath);

/**
 * إعدادات الجودة المحسّنة للهواتف الضعيفة
 * تم تحسين الإعدادات للحصول على أفضل توازن بين الجودة والأداء
 */
export const qualityPresets = {
    '360p': {
        resolution: '640x360',
        videoBitrate: '400k',
        audioBitrate: '64k',
        preset: 'veryfast',      // أسرع معالجة
        profile: 'baseline',     // أعلى توافق مع الأجهزة القديمة
        level: '3.0',
        bufsize: '800k',
        maxrate: '450k',
        fps: 24,                 // تقليل FPS للأداء
        description: 'جودة منخفضة - للهواتف الضعيفة والإنترنت البطيء'
    },
    '480p': {
        resolution: '854x480',
        videoBitrate: '800k',
        audioBitrate: '96k',
        preset: 'fast',
        profile: 'main',
        level: '3.1',
        bufsize: '1600k',
        maxrate: '900k',
        fps: 30,
        description: 'جودة متوسطة - للهواتف المتوسطة'
    },
    '720p': {
        resolution: '1280x720',
        videoBitrate: '1500k',
        audioBitrate: '128k',
        preset: 'medium',
        profile: 'high',
        level: '4.0',
        bufsize: '3000k',
        maxrate: '1800k',
        fps: 30,
        description: 'جودة عالية - للهواتف الحديثة والإنترنت السريع'
    }
};

/**
 * إعدادات HLS (HTTP Live Streaming)
 */
export const hlsConfig = {
    segmentDuration: 4,        // مدة كل chunk بالثواني (4 ثواني للتوازن)
    playlistType: 'vod',       // Video on Demand
    hlsTime: 4,
    hlsListSize: 0,            // حفظ جميع الـ segments في الـ playlist
    hlsFlags: 'independent_segments+temp_file',
    format: 'hls',
    outputOptions: [
        '-hls_time 4',
        '-hls_list_size 0',
        '-hls_segment_type mpegts',
        '-hls_flags independent_segments+temp_file',
        '-hls_segment_filename segment_%03d.ts'
    ]
};

/**
 * الحصول على أوامر FFMPEG لجودة معينة
 */
export function getFfmpegOptions(quality) {
    const preset = qualityPresets[quality];

    if (!preset) {
        throw new Error(`Invalid quality preset: ${quality}`);
    }

    return {
        videoCodec: 'libx264',
        audioCodec: 'aac',
        size: preset.resolution,
        videoBitrate: preset.videoBitrate,
        audioBitrate: preset.audioBitrate,
        fps: preset.fps,
        outputOptions: [
            `-preset ${preset.preset}`,
            `-profile:v ${preset.profile}`,
            `-level ${preset.level}`,
            `-bufsize ${preset.bufsize}`,
            `-maxrate ${preset.maxrate}`,
            '-movflags +faststart',        // تحسين للتشغيل السريع
            '-pix_fmt yuv420p',            // توافق أفضل
            '-g 48',                       // GOP size
            '-sc_threshold 0',             // تعطيل scene detection
            '-force_key_frames expr:gte(t,n_forced*2)', // keyframes منتظمة
            ...hlsConfig.outputOptions
        ]
    };
}

/**
 * الحصول على معلومات الفيديو باستخدام ffprobe
 */
export function getVideoInfo(videoPath) {
    return new Promise((resolve, reject) => {
        // ✅ التأكد من وجود الملف قبل التحليل
        const fs = require('fs');
        if (!fs.existsSync(videoPath)) {
            return reject(new Error(`Video file not found: ${videoPath}`));
        }

        ffmpeg.ffprobe(videoPath, (err, metadata) => {
            if (err) {
                reject(err);
            } else {
                const videoStream = metadata.streams.find(s => s.codec_type === 'video');
                const audioStream = metadata.streams.find(s => s.codec_type === 'audio');

                resolve({
                    duration: metadata.format.duration,
                    size: metadata.format.size,
                    bitrate: metadata.format.bit_rate,
                    width: videoStream?.width,
                    height: videoStream?.height,
                    fps: eval(videoStream?.r_frame_rate || '30/1'),
                    hasAudio: !!audioStream,
                    format: metadata.format.format_name
                });
            }
        });
    });
}

export default {
    qualityPresets,
    hlsConfig,
    getFfmpegOptions,
    getVideoInfo
};