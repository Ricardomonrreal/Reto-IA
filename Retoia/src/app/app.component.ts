import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  audio = new Audio();
  isPlaying = false;

  ngOnInit(): void {
    // 🔊 Ruta al archivo tal como está en /public/assets/
    this.audio.src = '/assets/fondo-musica.mp3';
    this.audio.loop = true;
    this.audio.volume = 0.4;

    // 🖱️ Esperar interacción del usuario antes de reproducir
    const startMusic = () => {
      this.audio.play()
        .then(() => {
          this.isPlaying = true;
          console.log('🎵 Música iniciada correctamente.');
        })
        .catch(err => console.warn('⚠️ No se pudo reproducir aún:', err));

      window.removeEventListener('click', startMusic);
    };

    window.addEventListener('click', startMusic);
  }

  toggleMusic(): void {
    if (this.isPlaying) {
      this.audio.pause();
    } else {
      this.audio.play().catch(err => console.warn('⚠️ Error al reanudar:', err));
    }
    this.isPlaying = !this.isPlaying;
  }
}
