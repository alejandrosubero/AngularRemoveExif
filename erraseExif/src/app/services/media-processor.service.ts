// media-processor.service.ts

import { Injectable, inject } from '@angular/core';
import type * as heic2any from 'heic2any';

@Injectable({ providedIn: 'root' })
export class MediaProcessorService {
  // FFmpeg se carga bajo demanda - no está en el bundle inicial
  private ffmpegInstance: any = null;
  private ffmpegLoaded = false;

  // ============ IMÁGENES ============
  
  async processImage(file: File): Promise<string> {
    const ext = this.getExtension(file.name);
    
    try {
      // 1. HEIC → Convertir a JPEG primero
      if (ext === 'heic' || file.type === 'image/heic') {
        return await this.processHeic(file);
      }
      
      // 2. JPEG → Quitar EXIF con piexif (cargado dinámicamente)
      if (ext === 'jpg' || ext === 'jpeg' || file.type === 'image/jpeg') {
        return await this.removeExifJpeg(file);
      }
      
      // 3. PNG/WebP/Otros → Procesar con Canvas (quita toda la metadata)
      return await this.cleanImageWithCanvas(file);
      
    } catch (error) {
      console.error('Error procesando imagen:', error);
      throw new Error(`No se pudo procesar ${file.name}: ${error}`);
    }
  }

  private async processHeic(file: File): Promise<string> {
    // Importación dinámica de heic2any - no va en el bundle principal
    const heic2anyModule = await import('heic2any');
    const heic2any = (heic2anyModule as any).default || heic2anyModule;
    
    // HEIC → JPEG
    const converted = await heic2any({ 
      blob: file, 
      toType: 'image/jpeg', 
      quality: 0.92 
    });
    const blob = Array.isArray(converted) ? converted[0] : converted;
    
    // Crear nuevo File para procesar como JPEG
    const jpegFile = new File([blob], file.name.replace(/\.heic$/i, '.jpg'), { 
      type: 'image/jpeg' 
    });
    
    return this.removeExifJpeg(jpegFile);
  }

  private async removeExifJpeg(file: File): Promise<string> {
    // Cargar piexifjs solo cuando se necesite
    const piexifModule = await import('piexifjs');
    const piexif = (piexifModule as any).default || piexifModule;
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const cleanBase64 = piexif.remove(reader.result as string);
          resolve(cleanBase64);
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  private async cleanImageWithCanvas(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0);
        
        // PNG se mantiene PNG, WebP se convierte a PNG para máxima compatibilidad
        const outputFormat = file.type === 'image/webp' ? 'image/png' : file.type;
        const cleanDataUrl = canvas.toDataURL(outputFormat, 0.92);
        
        URL.revokeObjectURL(url);
        resolve(cleanDataUrl);
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('No se pudo cargar la imagen'));
      };
      
      img.src = url;
    });
  }

  // ============ VIDEOS (Lazy Loading completo) ============
  
  async processVideo(file: File): Promise<string> {
    await this.initFFmpeg();
    
    const { fetchFile } = await import('@ffmpeg/util');
    const inputName = `input_${Date.now()}.${this.getExtension(file.name)}`;
    const outputName = `clean_${Date.now()}.mp4`;
    
    try {
      await this.ffmpegInstance.writeFile(inputName, await fetchFile(file));
      
      // Comando robusto para limpiar metadata de video
      await this.ffmpegInstance.exec([
        '-i', inputName,
        '-map_metadata', '-1',      // Elimina metadata global
        '-metadata', 'title=',       // Limpia título
        '-metadata', 'author=',      // Limpia autor
        '-metadata', 'copyright=',   // Limpia copyright
        '-c:v', 'copy',              // Copia video sin recodificar (rápido)
        '-c:a', 'copy',              // Copia audio sin recodificar
        '-movflags', '+faststart',   // Optimiza para web
        outputName
      ]);
      
      const data = await this.ffmpegInstance.readFile(outputName);
      return URL.createObjectURL(new Blob([data], { type: 'video/mp4' }));
      
    } finally {
      // Limpieza de archivos temporales
      try {
        await this.ffmpegInstance.deleteFile(inputName);
        await this.ffmpegInstance.deleteFile(outputName);
      } catch {}
    }
  }

  private async initFFmpeg(): Promise<void> {
    if (this.ffmpegLoaded) return;
    
    // Importación dinámica de FFmpeg - NO está en el bundle inicial
    const { FFmpeg } = await import('@ffmpeg/ffmpeg');
    const { toBlobURL } = await import('@ffmpeg/util');
    
    this.ffmpegInstance = new FFmpeg();
    
    try {
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
      await this.ffmpegInstance.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });
      this.ffmpegLoaded = true;
    } catch (error) {
      throw new Error('No se pudo cargar FFmpeg. Verifica tu conexión.');
    }
  }

  // ============ UTILIDADES ============
  
  private getExtension(filename: string): string {
    return filename.split('.').pop()?.toLowerCase() || '';
  }

  detectFileType(file: File): 'image' | 'video' | 'unsupported' {
    if (file.type.startsWith('image/') || file.name.toLowerCase().endsWith('.heic')) {
      return 'image';
    }
    if (file.type.startsWith('video/')) {
      return 'video';
    }
    return 'unsupported';
  }
}




// // media-processor.service.ts

// import { Injectable } from '@angular/core';
// import heic2any from 'heic2any';
// import * as piexif from 'piexifjs';

// @Injectable({ providedIn: 'root' })
// export class MediaProcessorService {
//   private ffmpeg: any;
//   private ffmpegLoaded = false;

//   // ============ IMÁGENES ============
  
//   async processImage(file: File): Promise<string> {
//     const ext = this.getExtension(file.name);
    
//     try {
//       // 1. HEIC → Convertir a JPEG primero
//       if (ext === 'heic' || file.type === 'image/heic') {
//         return await this.processHeic(file);
//       }
      
//       // 2. JPEG → Quitar EXIF con piexif
//       if (ext === 'jpg' || ext === 'jpeg' || file.type === 'image/jpeg') {
//         return await this.removeExifJpeg(file);
//       }
      
//       // 3. PNG/WebP/Otros → Procesar con Canvas (quita toda la metadata)
//       return await this.cleanImageWithCanvas(file);
      
//     } catch (error) {
//       console.error('Error procesando imagen:', error);
//       throw new Error(`No se pudo procesar ${file.name}: ${error}`);
//     }
//   }

//   private async processHeic(file: File): Promise<string> {
//     // HEIC → JPEG
//     const converted = await heic2any({ 
//       blob: file, 
//       toType: 'image/jpeg', 
//       quality: 0.92 
//     });
//     const blob = Array.isArray(converted) ? converted[0] : converted;
    
//     // Crear nuevo File para procesar como JPEG
//     const jpegFile = new File([blob], file.name.replace(/\.heic$/i, '.jpg'), { 
//       type: 'image/jpeg' 
//     });
    
//     return this.removeExifJpeg(jpegFile);
//   }

//   private async removeExifJpeg(file: File): Promise<string> {
//     return new Promise((resolve, reject) => {
//       const reader = new FileReader();
//       reader.onload = () => {
//         try {
//           const cleanBase64 = piexif.remove(reader.result as string);
//           resolve(cleanBase64);
//         } catch (e) {
//           reject(e);
//         }
//       };
//       reader.onerror = reject;
//       reader.readAsDataURL(file);
//     });
//   }

//   private async cleanImageWithCanvas(file: File): Promise<string> {
//     return new Promise((resolve, reject) => {
//       const img = new Image();
//       const url = URL.createObjectURL(file);
      
//       img.onload = () => {
//         const canvas = document.createElement('canvas');
//         canvas.width = img.width;
//         canvas.height = img.height;
        
//         const ctx = canvas.getContext('2d');
//         ctx?.drawImage(img, 0, 0);
        
//         // PNG se mantiene PNG, WebP se convierte a PNG para máxima compatibilidad
//         const outputFormat = file.type === 'image/webp' ? 'image/png' : file.type;
//         const cleanDataUrl = canvas.toDataURL(outputFormat, 0.92);
        
//         URL.revokeObjectURL(url);
//         resolve(cleanDataUrl);
//       };
      
//       img.onerror = () => {
//         URL.revokeObjectURL(url);
//         reject(new Error('No se pudo cargar la imagen'));
//       };
      
//       img.src = url;
//     });
//   }

//   // ============ VIDEOS ============
  
//   async processVideo(file: File): Promise<string> {
//     await this.initFFmpeg();
    
//     const { fetchFile } = await import('@ffmpeg/util');
//     const inputName = `input_${Date.now()}.${this.getExtension(file.name)}`;
//     const outputName = `clean_${Date.now()}.mp4`;
    
//     try {
//       await this.ffmpeg.writeFile(inputName, await fetchFile(file));
      
//       // Comando robusto para limpiar metadata de video
//       await this.ffmpeg.exec([
//         '-i', inputName,
//         '-map_metadata', '-1',      // Elimina metadata global
//         '-metadata', 'title=',       // Limpia título
//         '-metadata', 'author=',      // Limpia autor
//         '-metadata', 'copyright=',   // Limpia copyright
//         '-c:v', 'copy',              // Copia video sin recodificar (rápido)
//         '-c:a', 'copy',              // Copia audio sin recodificar
//         '-movflags', '+faststart',   // Optimiza para web
//         outputName
//       ]);
      
//       const data = await this.ffmpeg.readFile(outputName);
//       return URL.createObjectURL(new Blob([data], { type: 'video/mp4' }));
      
//     } finally {
//       // Limpieza de archivos temporales
//       try {
//         await this.ffmpeg.deleteFile(inputName);
//         await this.ffmpeg.deleteFile(outputName);
//       } catch {}
//     }
//   }

//   private async initFFmpeg(): Promise<void> {
//     if (this.ffmpegLoaded) return;
    
//     const { FFmpeg } = await import('@ffmpeg/ffmpeg');
//     const { toBlobURL } = await import('@ffmpeg/util');
    
//     this.ffmpeg = new FFmpeg();
    
//     // Carga con manejo de errores
//     try {
//       const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
//       await this.ffmpeg.load({
//         coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
//         wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
//       });
//       this.ffmpegLoaded = true;
//     } catch (error) {
//       throw new Error('No se pudo cargar FFmpeg. Verifica tu conexión.');
//     }
//   }

//   // ============ UTILIDADES ============
  
//   private getExtension(filename: string): string {
//     return filename.split('.').pop()?.toLowerCase() || '';
//   }

//   detectFileType(file: File): 'image' | 'video' | 'unsupported' {
//     if (file.type.startsWith('image/') || file.name.toLowerCase().endsWith('.heic')) {
//       return 'image';
//     }
//     if (file.type.startsWith('video/')) {
//       return 'video';
//     }
//     return 'unsupported';
//   }
// }







// import { Injectable } from '@angular/core';
// import heic2any from 'heic2any';
// import * as piexif from 'piexifjs';

// @Injectable({ providedIn: 'root' })
// export class MediaProcessorService {
//   private ffmpeg: any;
//   private ffmpegLoaded = false;

//   // Lógica para IMÁGENES (HEIC/JPG)
//   async processImage(file: File): Promise<string> {
//     let blob: Blob = file;
//     if (file.name.toLowerCase().endsWith('.heic') || file.type === 'image/heic') {
//       const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.8 });
//       blob = Array.isArray(converted) ? converted[0] : converted;
//     }
//     const reader = new FileReader();
//     return new Promise((resolve) => {
//       reader.onload = () => {
//         const cleanBase64 = piexif.remove(reader.result as string);
//         resolve(cleanBase64);
//       };
//       reader.readAsDataURL(blob);
//     });
//   }

//   // Lógica para VIDEOS con Carga Perezosa (Lazy Loading) de FFmpeg
//   async processVideo(file: File): Promise<string> {
//     if (!this.ffmpegLoaded) {
//       // Importación dinámica para no inflar el main.js inicial
//       const { FFmpeg } = await import('@ffmpeg/ffmpeg');
//       const { fetchFile, toBlobURL } = await import('@ffmpeg/util');
      
//       this.ffmpeg = new FFmpeg();
//       const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
//       await this.ffmpeg.load({
//         coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
//         wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
//       });
//       this.ffmpegLoaded = true;
//     }

//     const { fetchFile } = await import('@ffmpeg/util');
//     const inputName = `input_${file.name}`;
//     await this.ffmpeg.writeFile(inputName, await fetchFile(file));
    
//     // -map_metadata -1 borra EXIF/GPS/Datos del dueño
//     await this.ffmpeg.exec(['-i', inputName, '-map_metadata', '-1', '-c', 'copy', 'out.mp4']);
    
//     const data = await this.ffmpeg.readFile('out.mp4');
//     return URL.createObjectURL(new Blob([data], { type: 'video/mp4' }));
//   }
// }