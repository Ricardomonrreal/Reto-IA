// src/app/app.routes.ts
import { Routes } from '@angular/router';
import { CityBuilderComponent } from './city-builder/city-builder.component';
import { EnergyGridComponent } from './energy-grid/energy-grid.component';
import { SustainableIndustryComponent } from './sustainable-industry/sustainable-industry.component';

export const routes: Routes = [
  { path: '', redirectTo: 'city', pathMatch: 'full' },
  { path: 'city', component: CityBuilderComponent },
  { path: 'energy', component: EnergyGridComponent },
  { path: 'sustainable-industry', component: SustainableIndustryComponent }];
