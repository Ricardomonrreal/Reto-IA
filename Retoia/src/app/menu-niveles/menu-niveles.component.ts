// src/app/menu-niveles/menu-niveles.component.ts

import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';


interface Nivel {
  id: number;
  titulo: string;
  objetivo: string;
  ruta: string;
}

@Component({
  selector: 'app-menu-niveles',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './menu-niveles.component.html',
  styleUrls: ['./menu-niveles.component.css']
})
export class MenuNivelesComponent {
  niveles: Nivel[] = [
    {
      id: 1,
      titulo: 'Escena 1: Ciudad Verde',
      objetivo: 'Diseña una ciudad sostenible con áreas verdes y transporte limpio.',
      ruta: '/ciudad-verde'
    },
    {
      id: 2,
      titulo: 'Escena 2: Red de Energía Limpia',
      objetivo: 'Construye una red eléctrica eficiente con energías renovables.',
      ruta: '/red-energia'
    },
    {
      id: 3,
      titulo: 'Escena 3: Innovación Industrial Sostenible',
      objetivo: 'Desarrolla un parque industrial responsable y moderno.',
      ruta: '/industria-sostenible'
    }
  ];

  constructor(public router: Router) {}

  irANivel(ruta: string): void {
    this.router.navigate([ruta]);
  }
}
