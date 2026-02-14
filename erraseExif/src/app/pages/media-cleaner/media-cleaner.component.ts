// media-cleaner.component.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MediaProcessorService } from '../../services/media-processor.service';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { trigger, transition, style, animate } from '@angular/animations';

@Component({
  selector: 'app-media-cleaner',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './media-cleaner.component.html',
  styleUrls: ['./media-cleaner.component.scss'],
  animations: [
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(10px)' }),
        animate('300ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ])
  ]
})
export class MediaCleanerComponent {
  resultUrl: string | SafeUrl | null = null;
  fileType: 'image' | 'video' | null = null;
  isProcessing = false;
  fileName = '';
  today: Date;
  error: string | null = null;

  constructor(
    private processor: MediaProcessorService,
    private sanitizer: DomSanitizer
  ) {
    this.today = new Date();
  }

  async onFileSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    this.error = null;
    this.isProcessing = true;
    this.fileName = file.name;
    
    // Detección mejorada de tipo
    const detectedType = this.processor.detectFileType(file);
    
    if (detectedType === 'unsupported') {
      this.error = 'Formato no soportado. Usa: HEIC, JPG, PNG, WebP, MOV, MP4';
      this.isProcessing = false;
      return;
    }
    
    this.fileType = detectedType;

    try {
      let url: string;
      
      if (this.fileType === 'video') {
        url = await this.processor.processVideo(file);
        this.resultUrl = this.sanitizer.bypassSecurityTrustUrl(url);
      } else {
        url = await this.processor.processImage(file);
        this.resultUrl = url; // Las imágenes ya vienen como data URL segura
      }
    } catch (e: any) {
      this.error = e.message || 'Error en el procesamiento';
      console.error(e);
    } finally {
      this.isProcessing = false;
    }
  }

  download() {
    if (!this.resultUrl) return;
    
    const link = document.createElement('a');
    // Convertir SafeUrl a string si es necesario
    const url = typeof this.resultUrl === 'string' 
      ? this.resultUrl 
      : this.resultUrl.toString();
      
    link.href = url;
    
    // Extensión según el tipo procesado
    const extension = this.fileType === 'video' ? 'mp4' : 'jpg';
    const baseName = this.fileName.replace(/\.[^/.]+$/, '');
    link.download = `${baseName}_.${extension}`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

// import { Component } from '@angular/core';
// import { CommonModule } from '@angular/common';
// import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
// import { trigger, transition, style, animate } from '@angular/animations'; 
// import { MediaProcessorService } from '../../services/media-processor.service';

// @Component({
//   selector: 'app-media-cleaner',
//   standalone: true,
//   imports: [CommonModule],
//   templateUrl: './media-cleaner.component.html',
//   styleUrls: ['./media-cleaner.component.scss'],
//   animations: [  // ✅ Agrega esto
//     trigger('fadeIn', [
//       transition(':enter', [
//         style({ opacity: 0, transform: 'translateY(10px)' }),
//         animate('300ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
//       ])
//     ])
//   ]
// })
// export class MediaCleanerComponent {
//   resultUrl: string | SafeUrl | null = null;
//   fileType: 'image' | 'video' | null = null;
//   isProcessing = false;
//   fileName = '';
//   today: Date;

//   constructor(
//     private processor: MediaProcessorService,
//     private sanitizer: DomSanitizer
//   ) {
//     this.today = new Date();
//   }

//   async onFileSelected(event: any) {
//     const file = event.target.files[0];
//     if (!file) return;

//     this.isProcessing = true;
//     this.fileName = file.name;
//     this.fileType = file.type.includes('video') ? 'video' : 'image';

//     try {
//       if (this.fileType === 'video') {
//         const url = await this.processor.processVideo(file);
//         this.resultUrl = this.sanitizer.bypassSecurityTrustUrl(url);
//       } else {
//         this.resultUrl = await this.processor.processImage(file);
//       }
//     } catch (e) {
//       alert("Error en el procesado. Revisa las cabeceras COOP/COEP.");
//     } finally {
//       this.isProcessing = false;
//     }
//   }

//   download() {
//     const link = document.createElement('a');
//     link.href = this.resultUrl as string;
//     link.download = `cleaned_${this.fileName.split('.')[0]}.` + (this.fileType === 'video' ? 'mp4' : 'jpg');
//     link.click();
//   }
// }