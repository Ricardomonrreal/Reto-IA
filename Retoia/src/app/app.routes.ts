// src/app/app.routes.ts

import { Routes } from '@angular/router';

// 🏠 Pantalla principal del juego
import { MainMenuComponent } from './main-menu/main-menu.component';

// 🎮 Menú de niveles
import { MenuNivelesComponent } from './menu-niveles/menu-niveles.component';

// 🌆 Componentes de los niveles
import { CityBuilderComponent } from './city-builder/city-builder.component';
import { EnergyGridComponent } from './energy-grid/energy-grid.component';
import { SustainableIndustryComponent } from './sustainable-industry/sustainable-industry.component';

export const routes: Routes = [
  // Página principal
  { path: '', component: MainMenuComponent },

  // Menú de niveles
  { path: 'niveles', component: MenuNivelesComponent },

  // Niveles del juego
  { path: 'ciudad-verde', component: CityBuilderComponent },
  { path: 'red-energia', component: EnergyGridComponent },
  { path: 'industria-sostenible', component: SustainableIndustryComponent },

  // En caso de ruta inexistente
  { path: '**', redirectTo: '', pathMatch: 'full' }
];
