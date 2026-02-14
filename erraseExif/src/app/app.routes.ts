import { Routes } from '@angular/router';
import { MediaCleanerComponent } from './pages/media-cleaner/media-cleaner.component';

export const routes: Routes = [
     { path: '', redirectTo: '/exif', pathMatch: 'full' },
     { path: 'exif', component: MediaCleanerComponent },
     { path: '**', redirectTo: '/exif' }
];
