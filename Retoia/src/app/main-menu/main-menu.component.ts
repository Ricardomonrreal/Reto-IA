import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router'; // 👈 Importamos Router para navegar entre vistas

@Component({
  selector: 'app-main-menu',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './main-menu.component.html',
  styleUrls: ['./main-menu.component.css']
})
export class MainMenuComponent {

  constructor(private router: Router) {}

  // 🟢 Función para ir al menú de niveles
  jugar() {
    this.router.navigate(['/niveles']);
  }

  // 🟢 Función para mostrar instrucciones del juego
  comoJugar() {
    alert('🌱 Bienvenido a ECOPLAN.\n\nTu objetivo es construir una ciudad sostenible gestionando recursos, energía e industria de forma equilibrada.');
  }

  // 🟢 Función para mostrar créditos
  creditos() {
    alert(' Desarrollado por Sofía Herrera\nUniversidad del Caribe - 2025');
  }
}
