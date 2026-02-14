// ffmpeg.service.ts - Carga solo cuando se necesita
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class FFmpegService {
  private ffmpeg: any;
  private loaded = false;

  async load(): Promise<any> {
    if (this.loaded) return this.ffmpeg;
    
    // Importación dinámica - NO va en el bundle principal
    const { FFmpeg } = await import('@ffmpeg/ffmpeg');
    const { toBlobURL } = await import('@ffmpeg/util');
    
    this.ffmpeg = new FFmpeg();
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
    
    await this.ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });
    
    this.loaded = true;
    return this.ffmpeg;
  }
}