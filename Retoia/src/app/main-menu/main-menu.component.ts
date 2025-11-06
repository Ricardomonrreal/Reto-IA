import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-main-menu',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './main-menu.component.html',
  styleUrls: ['./main-menu.component.css']
})
export class MainMenuComponent {
  mostrarComoJugar = false;
  mostrarCreditos = false;

  textoComoJugar = '';
  textoCreditos = '';

  private textoOriginalComoJugar = ` Bienvenido a ECOPLAN.

Tu objetivo es construir una ciudad sostenible gestionando recursos, energía e industria de forma equilibrada.

Cada decisión afecta el medio ambiente, la economía y el bienestar ciudadano.`;

  private textoOriginalCreditos = ` Desarrollado por el equipo EcoIA
Integrantes:
- Sofía Herrera
- Ricardo Monrreal
- Gabriela Montiel
- Diego Lopez
- Zuri Alvarez
 Universidad del Caribe - 2025

Proyecto: EcoPlan

Fondo: @anasabdin`;

  constructor(private router: Router) {}

  jugar() {
    this.router.navigate(['/niveles']);
  }

  comoJugar() {
    this.mostrarComoJugar = true;
    this.textoComoJugar = '';
    this.escribirTexto(this.textoOriginalComoJugar, 'como');
  }

  cerrarComoJugar() {
    this.mostrarComoJugar = false;
  }

  creditos() {
    this.mostrarCreditos = true;
    this.textoCreditos = '';
    this.escribirTexto(this.textoOriginalCreditos, 'creditos');
  }

  cerrarCreditos() {
    this.mostrarCreditos = false;
  }

 
  escribirTexto(texto: string, tipo: 'como' | 'creditos', velocidad: number = 25) {
    let i = 0;
    const intervalo = setInterval(() => {
      if (i < texto.length) {
        if (tipo === 'como') this.textoComoJugar += texto.charAt(i);
        else this.textoCreditos += texto.charAt(i);
        i++;
      } else {
        clearInterval(intervalo);
      }
    }, velocidad);
  }
}
