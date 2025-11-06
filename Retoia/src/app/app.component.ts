import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `
    <nav style="background: #eee; padding: 10px;">
      <a routerLink="/city" style="margin-right: 10px;">🏙️ Ciudad</a>
      <a routerLink="/energy" style="margin-right: 10px;">⚡ Energía</a>
      <a routerLink="/sustainable-industry">🏭 Parque Industrial Sostenible</a>
    </nav>

    <!-- Aquí se renderizan las páginas -->
    <router-outlet></router-outlet>

    <!-- 🎵 Música global (se reproduce en todas las rutas) -->
    <div class="music-container">
      <iframe
        width="0"
        height="0"
        [src]="videoUrl"
        frameborder="0"
        allow="autoplay; encrypted-media"
        allowfullscreen>
      </iframe>
    </div>
  `,
  styles: [`
    .music-container {
      display: none; /* Oculta el video, pero deja sonar la música */
    }
  `]
})
export class AppComponent {
  videoUrl: SafeResourceUrl;

  constructor(private sanitizer: DomSanitizer) {
    // ✅ URL del video en modo "embed", con autoplay y loop
    this.videoUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
      'https://www.youtube.com/embed/HHYOBwzT4u4?autoplay=1&loop=1&playlist=HHYOBwzT4u4'
    );
  }
}
