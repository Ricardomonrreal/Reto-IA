import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `
    <nav style="background: #eee; padding: 10px;">
      <a routerLink="/city" style="margin-right: 10px;">🏙️ Ciudad</a>
      <a routerLink="/energy">⚡ Energía</a>
      <a routerLink="/sustainable-industry">🏭 Parque Industrial Sostenible</a>
    </nav>

    <router-outlet></router-outlet>
  `
  })
export class AppComponent {}
