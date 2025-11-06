// city-builder.component.ts
import { Component, OnInit, OnDestroy, ElementRef, ViewChild, model } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Router } from '@angular/router';

interface BuildingConfig {
  color: number;
  height: number;
  scale: number;
  greenAreaM2?: number;
}

interface BuildingUI {
  thumb: string;
  name: string;
}

interface GridCell {
  type: string;
  isPermanent: boolean;
  rotationY?: number;
  anchorX: number;
  anchorZ: number;
}

@Component({
  selector: 'app-city-builder',
  standalone: true,
  imports: [CommonModule],
  templateUrl: 'city-builder.component.html',
  styleUrls: ['city-builder.component.css']
})

export class CityBuilderComponent implements OnInit, OnDestroy {
  @ViewChild('renderCanvas', { static: true }) 
  private canvasRef!: ElementRef<HTMLDivElement>;
  router: any;
   goToMenu() {
  this.router.navigate(['/niveles']);
  }

  totalInhabitants = 100;
  totalGreenAreaM2 = 0;
  requiredGreenAreaM2 = 900;
  greenAreaDeficit = 0;

  selectedCategory: 'Edificios' | 'Casas' | 'Calles' | 'Decoración' = 'Edificios';
  selectedBuilding = 'buildingA';
  currentBuildingRotationY = 0;

  buildingCategories = {
    'Edificios': [
      'buildingA', 'buildingB', 'buildingC', 'buildingD', 'buildingE', 'buildingF', 'buildingG',
      'buildingH', 'buildingI', 'buildingJ', 'buildingK', 'buildingL', 'buildingM', 'buildingN'
    ],
    'Casas': [
      'casaA', 'casaB', 'casaC', 'casaD', 'casaE', 'casaF', 'casaG', 'casaH', 'casaI'
    ],
    'Calles': [
      'streetA', 'streetB', 'streetC', 'streetE', 'streetF', 'streetG', 'banqueta'
    ],
    'Decoración': [
      'planter', 'arbolA', 'arbolC', 'arbolE', 'banca'
    ]
  };

  buildingUIData: { [key: string]: BuildingUI } = {
    //buildings
    buildingA: { thumb: 'assets/thumbs/building-a.png', name: 'Edificio A'},
    buildingB: { thumb: 'assets/thumbs/building-b.png', name: 'Edificio B'},
    buildingC: { thumb: 'assets/thumbs/building-c.png', name: 'Edificio C'},
    buildingD: { thumb: 'assets/thumbs/building-d.png', name: 'Edificio D'},
    buildingE: { thumb: 'assets/thumbs/building-e.png', name: 'Edificio E'},
    buildingF: { thumb: 'assets/thumbs/building-f.png', name: 'Edificio F'},
    buildingG: { thumb: 'assets/thumbs/building-g.png', name: 'Edificio G'},
    buildingH: { thumb: 'assets/thumbs/building-h.png', name: 'Edificio H'},
    buildingI: { thumb: 'assets/thumbs/building-i.png', name: 'Edificio I'},
    buildingJ: { thumb: 'assets/thumbs/building-j.png', name: 'Edificio J'},
    buildingK: { thumb: 'assets/thumbs/building-k.png', name: 'Edificio K'},
    buildingL: { thumb: 'assets/thumbs/building-l.png', name: 'Edificio L'},
    buildingM: { thumb: 'assets/thumbs/building-m.png', name: 'Edificio M'},
    buildingN: { thumb: 'assets/thumbs/building-n.png', name: 'Edificio N'},

    //calles
    streetA: { thumb: 'assets/thumbs/streetA.png', name: 'Calle A'},
    streetB: { thumb: 'assets/thumbs/streetB.png', name: 'Calle B'},
    streetC: { thumb: 'assets/thumbs/streetC.png', name: 'Calle C'},
    streetD: { thumb: 'assets/thumbs/streetD.png', name: 'Calle D'},
    streetE: { thumb: 'assets/thumbs/streetE.png', name: 'Calle E'},
    streetF: { thumb: 'assets/thumbs/streetG.png', name: 'Calle F'},
    streetG: { thumb: 'assets/thumbs/streetF.png', name: 'Calle G'},
    lightA: { thumb: 'assets/thumbs/lightA.png', name: 'Luz A'},
    lightB: { thumb: 'assets/thumbs/lightB.png', name: 'Luz B'},
    lightC: { thumb: 'assets/thumbs/lightC.png', name: 'Luz C'},
    banqueta: { thumb: 'assets/thumbs/banqueta.png', name: 'Banqueta'},

    //casas
    casaA: { thumb: 'assets/thumbs/casa-a.png', name: 'Casa A'},
    casaB: { thumb: 'assets/thumbs/casa-b.png', name: 'Casa B'},
    casaC: { thumb: 'assets/thumbs/casa-c.png', name: 'Casa C'},
    casaD: { thumb: 'assets/thumbs/casa-d.png', name: 'Casa D'},
    casaE: { thumb: 'assets/thumbs/casa-e.png', name: 'Casa E'},
    casaF: { thumb: 'assets/thumbs/casa-f.png', name: 'Casa F'},
    casaG: { thumb: 'assets/thumbs/casa-g.png', name: 'Casa G'},
    casaH: { thumb: 'assets/thumbs/casa-h.png', name: 'Casa H'},
    casaI: { thumb: 'assets/thumbs/casa-i.png', name: 'Casa I'},

    //decoracion
    planter: { thumb: 'assets/thumbs/planter.png', name: 'Jardinera'},
    arbolA: { thumb: 'assets/thumbs/arbolA.png', name: 'Árbol A' },
    arbolC: { thumb: 'assets/thumbs/arbolC.png', name: 'Árbol B' },
    arbolE: { thumb: 'assets/thumbs/arbolE.png', name: 'Árbol C' }
  };

  private gltfLoader = new GLTFLoader();

  private scene!: THREE.Scene;
  private camera!: THREE.OrthographicCamera;
  private renderer!: THREE.WebGLRenderer;
  private raycaster = new THREE.Raycaster();

  private mouse = new THREE.Vector2();

  private buildingPreviewCache: { [key: string]: THREE.Object3D } = {};
  private currentPreviewType: string | null = null; // Para rastrear el tipo de preview actual

  private groundGroup = new THREE.Group();
  private buildingsGroup = new THREE.Group();
  private hoverPreview: THREE.Object3D | null = null;
  private animationId?: number;

  private clouds: THREE.Object3D[] = [];
  private cloudCount = 50;
  private cloudSpeed = 0.02; // velocidad de movimiento de las nubes

  // FUNCIONES DE MOVIMIENTO DE CÁMARA
  private isPanning = false;
  private lastMousePosition = { x: 0, y: 0 };

  private readonly gridSize = 50;
  private readonly cellSize = 2;
  private gridData: (GridCell | null)[][] = [];

  private buildingTypes: { [key: string]: BuildingConfig } = {
    // Edificios
    buildingA:  { color: 0, height: 1.5, scale: 2},
    buildingB:  { color: 0, height: 3, scale: 2},
    buildingC:  { color: 0, height: 2, scale: 2},
    buildingD:  { color: 0, height: 1.0, scale: 2},
    buildingE:  { color: 0, height: 2.5, scale: 2},
    buildingF:  { color: 0, height: 1.2, scale: 2},
    buildingG:  { color: 0, height: 4.0, scale: 2},
    buildingH:  { color: 0, height: 1.8, scale: 2},
    buildingI:  { color: 0, height: 3.5, scale: 2},
    buildingJ:  { color: 0, height: 1.3, scale: 2},
    buildingK:  { color: 0, height: 4.5, scale: 2},
    buildingL:  { color: 0, height: 2.2, scale: 2},
    buildingM:  { color: 0, height: 3.2, scale: 2},
    buildingN:  { color: 0, height: 1.7, scale: 2},

    // Calles
    streetA: { color: 0, height: 0, scale: 2},
    streetB: { color: 0, height: 0, scale: 2},
    streetC: { color: 0, height: 0, scale: 2},
    streetD: { color: 0, height: 0, scale: 2},
    streetE: { color: 0, height: 0, scale: 2},
    streetF: { color: 0, height: 0, scale: 2},
    streetG: { color: 0, height: 0, scale: 2},
    lightA: {color: 0, height: 2, scale: 2},
    lightB: {color: 0, height: 2, scale: 2},
    lightC: {color: 0, height: 2, scale: 2},
    banqueta: {color: 0, height: 2, scale: 2},

    //Casas
    casaA: { color: 0, height: 2, scale: 1.7},
    casaB: { color: 0, height: 2, scale: 1.7},
    casaC: { color: 0, height: 2, scale: 1.7},
    casaD: { color: 0, height: 2, scale: 1.7},
    casaE: { color: 0, height: 2, scale: 1.7},
    casaF: { color: 0, height: 2, scale: 1.7},
    casaG: { color: 0, height: 2, scale: 1.7},
    casaH: { color: 0, height: 2, scale: 1.7},
    casaI: { color: 0, height: 2, scale: 1.7},

    //Decoracion
    arbolA: { color: 0, height: 2, scale: 1.3 },
    arbolB: { color: 0, height: 2, scale: 1.3 },
    arbolC: { color: 0, height: 2, scale: 1.3 },
    arbolD: { color: 0, height: 2, scale: 1.3 },
    arbolE: { color: 0, height: 2, scale: 1.3 },
    planter: {color: 0, height: 5, scale: 4, greenAreaM2: 100},
    banca: { color: 0, height: 2, scale: 1.2},
    bardaA: { color: 0, height: 2, scale: 2},
    bardaB: { color: 0, height: 2, scale: 1.2}
  };

  private initialBuildings: { type: string, x: number, z: number, rotationY?: number }[] = [
    { type: 'buildingA', x: 12, z: 17, rotationY: 3 * Math.PI / 2 },
    { type: 'buildingJ', x: 12, z: 19, rotationY: Math.PI / 2 },
    { type: 'buildingJ', x: 12, z: 21, rotationY: Math.PI / 2 },
    { type: 'buildingA', x: 12, z: 23, rotationY: 3 * Math.PI / 2 },
    { type: 'buildingC', x: 12, z: 24, rotationY: Math.PI },
    { type: 'buildingC', x: 12, z: 25, rotationY: Math.PI },
    { type: 'buildingG', x: 12, z: 26, rotationY: Math.PI },
    { type: 'buildingH', x: 12, z: 27, rotationY: 3 * Math.PI / 2 },
    { type: 'buildingK', x: 12, z: 29, rotationY: 3 * Math.PI / 2 },
    { type: 'buildingL', x: 12, z: 31, rotationY: 3 * Math.PI / 2 },
    { type: 'buildingM', x: 12, z: 33, rotationY: 3 * Math.PI / 2 },
    { type: 'bardaA', x: 13, z: 5, rotationY: 0 },
    { type: 'bardaA', x: 13, z: 6, rotationY: 0 },
    { type: 'bardaA', x: 13, z: 7, rotationY: 0 },
    { type: 'bardaA', x: 13, z: 8, rotationY: 0 },
    { type: 'bardaA', x: 13, z: 9, rotationY: 0 },
    { type: 'bardaA', x: 13, z: 10, rotationY: 0 },
    { type: 'bardaA', x: 13, z: 11, rotationY: 0 },
    { type: 'bardaA', x: 13, z: 12, rotationY: 0 },
    { type: 'bardaA', x: 13, z: 13, rotationY: 0 },
    { type: 'bardaA', x: 13, z: 14, rotationY: 0 },
    { type: 'bardaA', x: 13, z: 15, rotationY: 0 },
    { type: 'bardaA', x: 13, z: 16, rotationY: 0 },
    { type: 'banqueta', x: 13, z: 17, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 13, z: 18, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 13, z: 19, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 13, z: 20, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 13, z: 21, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 13, z: 22, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 13, z: 23, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 13, z: 24, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 13, z: 25, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 13, z: 26, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 13, z: 27, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 13, z: 28, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 13, z: 29, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 13, z: 30, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 13, z: 31, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 13, z: 32, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 13, z: 33, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 13, z: 34, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 13, z: 35, rotationY: 3 * Math.PI / 2 },
    { type: 'bardaA', x: 13, z: 36, rotationY: 0 },
    { type: 'bardaA', x: 13, z: 37, rotationY: 0 },
    { type: 'bardaA', x: 13, z: 38, rotationY: 0 },
    { type: 'bardaA', x: 13, z: 39, rotationY: 0 },
    { type: 'bardaA', x: 13, z: 40, rotationY: 0 },
    { type: 'bardaA', x: 13, z: 41, rotationY: 0 },
    { type: 'bardaA', x: 13, z: 42, rotationY: 0 },
    { type: 'bardaA', x: 13, z: 43, rotationY: 0 },
    { type: 'bardaA', x: 13, z: 44, rotationY: 0 },
    { type: 'bardaA', x: 13, z: 45, rotationY: 0 },
    { type: 'bardaA', x: 13, z: 46, rotationY: 0 },
    { type: 'bardaA', x: 13, z: 47, rotationY: 0 },
    { type: 'bardaA', x: 13, z: 48, rotationY: 0 },
    { type: 'bardaA', x: 14, z: 5, rotationY: Math.PI / 2 },
    { type: 'bardaA', x: 14, z: 7, rotationY: Math.PI / 2 },
    { type: 'bardaA', x: 14, z: 9, rotationY: Math.PI / 2 },
    { type: 'bardaA', x: 14, z: 11, rotationY: Math.PI / 2 },
    { type: 'bardaA', x: 14, z: 13, rotationY: Math.PI / 2 },
    { type: 'bardaA', x: 14, z: 15, rotationY: Math.PI / 2 },
    { type: 'bardaA', x: 14, z: 16, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 14, z: 17, rotationY: Math.PI / 2 },
    { type: 'streetF', x: 14, z: 18, rotationY: Math.PI / 2 },
    { type: 'streetA', x: 14, z: 19, rotationY: Math.PI / 2 },
    { type: 'streetA', x: 14, z: 20, rotationY: Math.PI / 2 },
    { type: 'streetA', x: 14, z: 21, rotationY: Math.PI / 2 },
    { type: 'streetA', x: 14, z: 22, rotationY: Math.PI / 2 },
    { type: 'streetA', x: 14, z: 23, rotationY: Math.PI / 2 },
    { type: 'streetC', x: 14, z: 24, rotationY: Math.PI / 2 },
    { type: 'streetA', x: 14, z: 25, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 14, z: 26, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 14, z: 27, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 14, z: 28, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 14, z: 29, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 14, z: 30, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 14, z: 31, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 14, z: 32, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 14, z: 33, rotationY: 3 * Math.PI / 2 },
    { type: 'streetF', x: 14, z: 34, rotationY: Math.PI },
    { type: 'banqueta', x: 14, z: 35, rotationY: 3 * Math.PI / 2 },
    { type: 'bardaA', x: 14, z: 39, rotationY: Math.PI / 2 },
    { type: 'bardaA', x: 14, z: 40, rotationY: 3 * Math.PI / 2 },
    { type: 'bardaA', x: 14, z: 43, rotationY: Math.PI / 2 },
    { type: 'bardaA', x: 14, z: 44, rotationY: 3 * Math.PI / 2 },
    { type: 'bardaA', x: 14, z: 47, rotationY: Math.PI / 2 },
    { type: 'bardaA', x: 14, z: 49, rotationY: Math.PI / 2 },
    { type: 'bardaA', x: 15, z: 2, rotationY: 3 * Math.PI / 2 },
    { type: 'bardaA', x: 15, z: 3, rotationY: Math.PI },
    { type: 'bardaA', x: 15, z: 4, rotationY: Math.PI },
    { type: 'casaB', x: 15, z: 6, rotationY: 3 * Math.PI / 2 },
    { type: 'casaG', x: 15, z: 8, rotationY: 3 * Math.PI / 2 },
    { type: 'casaE', x: 15, z: 10, rotationY: 3 * Math.PI / 2 },
    { type: 'casaB', x: 15, z: 12, rotationY: 3 * Math.PI / 2 },
    { type: 'casaB', x: 15, z: 14, rotationY: 3 * Math.PI / 2 },
    { type: 'casaA', x: 15, z: 16, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 15, z: 17, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 15, z: 18, rotationY: 0 },
    { type: 'banqueta', x: 15, z: 19, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 15, z: 20, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 15, z: 21, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 15, z: 22, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 15, z: 23, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 15, z: 24, rotationY: 0 },
    { type: 'banqueta', x: 15, z: 25, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 15, z: 26, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 15, z: 27, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 15, z: 28, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 15, z: 29, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 15, z: 30, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 15, z: 31, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 15, z: 32, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 15, z: 33, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 15, z: 34, rotationY: 0 },
    { type: 'banqueta', x: 15, z: 35, rotationY: 3 * Math.PI / 2 },
    { type: 'casaA', x: 15, z: 36, rotationY: 3 * Math.PI / 2 },
    { type: 'casaB', x: 15, z: 38, rotationY: 3 * Math.PI / 2 },
    { type: 'casaD', x: 15, z: 40, rotationY: 3 * Math.PI / 2 },
    { type: 'casaI', x: 15, z: 42, rotationY: 3 * Math.PI / 2 },
    { type: 'bardaA', x: 15, z: 43, rotationY: Math.PI / 2 },
    { type: 'casaG', x: 15, z: 44, rotationY: 3 * Math.PI / 2 },
    { type: 'casaE', x: 15, z: 46, rotationY: 3 * Math.PI / 2 },
    { type: 'bardaA', x: 15, z: 47, rotationY: Math.PI / 2 },
    { type: 'casaF', x: 15, z: 48, rotationY: 3 * Math.PI / 2 },
    { type: 'bardaA', x: 15, z: 49, rotationY: Math.PI / 2 },
    { type: 'bardaA', x: 16, z: 2, rotationY: 3 * Math.PI / 2 },
    { type: 'bardaA', x: 16, z: 3, rotationY: 0 },
    { type: 'casaE', x: 16, z: 4, rotationY: Math.PI },
    { type: 'banqueta', x: 16, z: 5, rotationY: 0 },
    { type: 'banqueta', x: 16, z: 6, rotationY: 0 },
    { type: 'banqueta', x: 16, z: 7, rotationY: 0 },
    { type: 'banqueta', x: 16, z: 8, rotationY: 0 },
    { type: 'banqueta', x: 16, z: 9, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 16, z: 10, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 16, z: 11, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 16, z: 12, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 16, z: 13, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 16, z: 14, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 16, z: 15, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 16, z: 16, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 16, z: 17, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 16, z: 18, rotationY: 0 },
    { type: 'banqueta', x: 16, z: 19, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 16, z: 20, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 16, z: 21, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 16, z: 22, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 16, z: 23, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 16, z: 24, rotationY: 0 },
    { type: 'banqueta', x: 16, z: 25, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 16, z: 26, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 16, z: 27, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 16, z: 28, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 16, z: 29, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 16, z: 30, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 16, z: 31, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 16, z: 32, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 16, z: 33, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 16, z: 34, rotationY: 0 },
    { type: 'banqueta', x: 16, z: 35, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 16, z: 36, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 16, z: 37, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 16, z: 38, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 16, z: 39, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 16, z: 40, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 16, z: 41, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 16, z: 42, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 16, z: 43, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 16, z: 44, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 16, z: 45, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 16, z: 46, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 16, z: 47, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 16, z: 48, rotationY: 3 * Math.PI / 2 },
    { type: 'bardaA', x: 17, z: 2, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 17, z: 5, rotationY: 0 },
    { type: 'streetF', x: 17, z: 6, rotationY: Math.PI / 2 },
    { type: 'streetA', x: 17, z: 7, rotationY: Math.PI / 2 },
    { type: 'streetA', x: 17, z: 8, rotationY: Math.PI / 2 },
    { type: 'streetA', x: 17, z: 9, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 17, z: 10, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 17, z: 11, rotationY: 3 * Math.PI / 2 },
    { type: 'streetC', x: 17, z: 12, rotationY: Math.PI / 2 },
    { type: 'streetA', x: 17, z: 13, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 17, z: 14, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 17, z: 15, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 17, z: 16, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 17, z: 17, rotationY: Math.PI / 2 },
    { type: 'streetB', x: 17, z: 18, rotationY: Math.PI / 2 },
    { type: 'streetA', x: 17, z: 19, rotationY: Math.PI / 2 },
    { type: 'streetA', x: 17, z: 20, rotationY: Math.PI / 2 },
    { type: 'streetA', x: 17, z: 21, rotationY: Math.PI / 2 },
    { type: 'streetA', x: 17, z: 22, rotationY: Math.PI / 2 },
    { type: 'streetA', x: 17, z: 23, rotationY: Math.PI / 2 },
    { type: 'streetB', x: 17, z: 24, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 17, z: 25, rotationY: Math.PI / 2 },
    { type: 'streetA', x: 17, z: 26, rotationY: Math.PI / 2 },
    { type: 'streetA', x: 17, z: 27, rotationY: Math.PI / 2 },
    { type: 'streetA', x: 17, z: 28, rotationY: Math.PI / 2 },
    { type: 'streetA', x: 17, z: 29, rotationY: Math.PI / 2 },
    { type: 'streetA', x: 17, z: 30, rotationY: Math.PI / 2 },
    { type: 'streetA', x: 17, z: 31, rotationY: Math.PI / 2 },
    { type: 'streetA', x: 17, z: 32, rotationY: Math.PI / 2 },
    { type: 'streetA', x: 17, z: 33, rotationY: Math.PI / 2 },
    { type: 'streetB', x: 17, z: 34, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 17, z: 35, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 17, z: 36, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 17, z: 37, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 17, z: 38, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 17, z: 39, rotationY: 3 * Math.PI / 2 },
    { type: 'streetC', x: 17, z: 40, rotationY: Math.PI / 2 },
    { type: 'streetA', x: 17, z: 41, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 17, z: 42, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 17, z: 43, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 17, z: 44, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 17, z: 45, rotationY: 3 * Math.PI / 2 },
    { type: 'streetC', x: 17, z: 46, rotationY: Math.PI / 2 },
    { type: 'streetA', x: 17, z: 47, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 17, z: 48, rotationY: 3 * Math.PI / 2 },
    { type: 'bardaA', x: 18, z: 2, rotationY: 3 * Math.PI / 2 },
    { type: 'bardaA', x: 18, z: 3, rotationY: 0 },
    { type: 'casaI', x: 18, z: 4, rotationY: Math.PI },
    { type: 'banqueta', x: 18, z: 5, rotationY: 0 },
    { type: 'streetA', x: 18, z: 6, rotationY: 0 },
    { type: 'banqueta', x: 18, z: 7, rotationY: Math.PI / 2 },
    { type: 'banqueta', x: 18, z: 8, rotationY: Math.PI / 2 },
    { type: 'banqueta', x: 18, z: 9, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 18, z: 10, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 18, z: 11, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 18, z: 12, rotationY: 0 },
    { type: 'banqueta', x: 18, z: 13, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 18, z: 14, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 18, z: 15, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 18, z: 16, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 18, z: 17, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 18, z: 18, rotationY: Math.PI },
    { type: 'banqueta', x: 18, z: 19, rotationY: 0 },
    { type: 'banqueta', x: 18, z: 20, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 18, z: 21, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 18, z: 22, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 18, z: 23, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 18, z: 24, rotationY: Math.PI },
    { type: 'banqueta', x: 18, z: 25, rotationY: 0 },
    { type: 'banqueta', x: 18, z: 26, rotationY: 0 },
    { type: 'banqueta', x: 18, z: 27, rotationY: 0 },
    { type: 'banqueta', x: 18, z: 28, rotationY: 0 },
    { type: 'banqueta', x: 18, z: 29, rotationY: 0 },
    { type: 'banqueta', x: 18, z: 30, rotationY: 0 },
    { type: 'banqueta', x: 18, z: 31, rotationY: 0 },
    { type: 'banqueta', x: 18, z: 32, rotationY: 0 },
    { type: 'banqueta', x: 18, z: 33, rotationY: 0 },
    { type: 'streetA', x: 18, z: 34, rotationY: Math.PI },
    { type: 'banqueta', x: 18, z: 35, rotationY: 0 },
    { type: 'banqueta', x: 18, z: 36, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 18, z: 37, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 18, z: 38, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 18, z: 39, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 18, z: 40, rotationY: 0 },
    { type: 'banqueta', x: 18, z: 41, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 18, z: 42, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 18, z: 43, rotationY: Math.PI },
    { type: 'banqueta', x: 18, z: 44, rotationY: Math.PI },
    { type: 'banqueta', x: 18, z: 45, rotationY: Math.PI },
    { type: 'streetA', x: 18, z: 46, rotationY: 0 },
    { type: 'banqueta', x: 18, z: 47, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 18, z: 48, rotationY: 3 * Math.PI / 2 },
    { type: 'bardaA', x: 19, z: 2, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 19, z: 5, rotationY: 0 },
    { type: 'streetA', x: 19, z: 6, rotationY: 0 },
    { type: 'banqueta', x: 19, z: 7, rotationY: Math.PI / 2 },
    { type: 'banqueta', x: 19, z: 8, rotationY: Math.PI / 2 },
    { type: 'banqueta', x: 19, z: 9, rotationY: Math.PI / 2 },
    { type: 'banqueta', x: 19, z: 10, rotationY: Math.PI / 2 },
    { type: 'banqueta', x: 19, z: 11, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 19, z: 12, rotationY: 0 },
    { type: 'banqueta', x: 19, z: 13, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 19, z: 14, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 19, z: 15, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 19, z: 16, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 19, z: 17, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 19, z: 18, rotationY: Math.PI },
    { type: 'banqueta', x: 19, z: 19, rotationY: 3 * Math.PI / 2 },
    { type: 'buildingJ', x: 19, z: 20, rotationY: 0 },
    { type: 'banqueta', x: 19, z: 21, rotationY: 3 * Math.PI / 2 },
    { type: 'buildingM', x: 19, z: 22, rotationY: Math.PI / 2 },
    { type: 'banqueta', x: 19, z: 23, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 19, z: 24, rotationY: Math.PI },
    { type: 'banqueta', x: 19, z: 25, rotationY: 0 },
    { type: 'banqueta', x: 19, z: 26, rotationY: 0 },
    { type: 'banqueta', x: 19, z: 27, rotationY: 0 },
    { type: 'banqueta', x: 19, z: 28, rotationY: 0 },
    { type: 'banqueta', x: 19, z: 29, rotationY: 0 },
    { type: 'banqueta', x: 19, z: 30, rotationY: 0 },
    { type: 'banqueta', x: 19, z: 31, rotationY: 0 },
    { type: 'banqueta', x: 19, z: 32, rotationY: 0 },
    { type: 'banqueta', x: 19, z: 33, rotationY: 0 },
    { type: 'streetA', x: 19, z: 34, rotationY: Math.PI },
    { type: 'banqueta', x: 19, z: 35, rotationY: 3 * Math.PI / 2 },
    { type: 'buildingN', x: 19, z: 36, rotationY: 0 },
    { type: 'banqueta', x: 19, z: 37, rotationY: 3 * Math.PI / 2 },
    { type: 'buildingL', x: 19, z: 38, rotationY: Math.PI / 2 },
    { type: 'banqueta', x: 19, z: 39, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 19, z: 40, rotationY: 0 },
    { type: 'banqueta', x: 19, z: 41, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 19, z: 42, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 19, z: 43, rotationY: Math.PI },
    { type: 'banqueta', x: 19, z: 44, rotationY: Math.PI },
    { type: 'banqueta', x: 19, z: 45, rotationY: Math.PI },
    { type: 'streetA', x: 19, z: 46, rotationY: 0 },
    { type: 'banqueta', x: 19, z: 47, rotationY: 3 * Math.PI / 2 },
    { type: 'casaH', x: 19, z: 48, rotationY: 0 },
    { type: 'bardaA', x: 19, z: 49, rotationY: Math.PI / 2 },
    { type: 'bardaA', x: 20, z: 2, rotationY: 3 * Math.PI / 2 },
    { type: 'bardaA', x: 20, z: 3, rotationY: 0 },
    { type: 'casaG', x: 20, z: 4, rotationY: Math.PI },
    { type: 'banqueta', x: 20, z: 5, rotationY: 0 },
    { type: 'streetA', x: 20, z: 6, rotationY: 0 },
    { type: 'banqueta', x: 20, z: 7, rotationY: Math.PI / 2 },
    { type: 'banqueta', x: 20, z: 8, rotationY: Math.PI / 2 },
    { type: 'banqueta', x: 20, z: 9, rotationY: Math.PI / 2 },
    { type: 'banqueta', x: 20, z: 10, rotationY: Math.PI / 2 },
    { type: 'banqueta', x: 20, z: 11, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 20, z: 12, rotationY: 0 },
    { type: 'banqueta', x: 20, z: 13, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 20, z: 14, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 20, z: 15, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 20, z: 16, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 20, z: 17, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 20, z: 18, rotationY: Math.PI },
    { type: 'banqueta', x: 20, z: 19, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 20, z: 21, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 20, z: 22, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 20, z: 23, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 20, z: 24, rotationY: Math.PI },
    { type: 'banqueta', x: 20, z: 25, rotationY: 0 },
    { type: 'banqueta', x: 20, z: 26, rotationY: 0 },
    { type: 'banqueta', x: 20, z: 27, rotationY: 0 },
    { type: 'banqueta', x: 20, z: 28, rotationY: 0 },
    { type: 'banqueta', x: 20, z: 29, rotationY: 0 },
    { type: 'banqueta', x: 20, z: 30, rotationY: 0 },
    { type: 'banqueta', x: 20, z: 31, rotationY: 0 },
    { type: 'banqueta', x: 20, z: 32, rotationY: 0 },
    { type: 'banqueta', x: 20, z: 33, rotationY: 0 },
    { type: 'streetA', x: 20, z: 34, rotationY: Math.PI },
    { type: 'banqueta', x: 20, z: 35, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 20, z: 36, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 20, z: 37, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 20, z: 38, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 20, z: 39, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 20, z: 40, rotationY: 0 },
    { type: 'banqueta', x: 20, z: 41, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 20, z: 42, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 20, z: 43, rotationY: Math.PI },
    { type: 'banqueta', x: 20, z: 44, rotationY: Math.PI },
    { type: 'banqueta', x: 20, z: 45, rotationY: Math.PI },
    { type: 'streetA', x: 20, z: 46, rotationY: 0 },
    { type: 'banqueta', x: 20, z: 47, rotationY: 3 * Math.PI / 2 },
    { type: 'bardaA', x: 20, z: 49, rotationY: Math.PI / 2 },
    { type: 'bardaA', x: 21, z: 2, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 21, z: 5, rotationY: 0 },
    { type: 'streetA', x: 21, z: 6, rotationY: 0 },
    { type: 'banqueta', x: 21, z: 7, rotationY: Math.PI / 2 },
    { type: 'banqueta', x: 21, z: 8, rotationY: Math.PI / 2 },
    { type: 'banqueta', x: 21, z: 9, rotationY: Math.PI / 2 },
    { type: 'banqueta', x: 21, z: 10, rotationY: Math.PI / 2 },
    { type: 'banqueta', x: 21, z: 11, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 21, z: 12, rotationY: 0 },
    { type: 'banqueta', x: 21, z: 13, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 21, z: 14, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 21, z: 15, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 21, z: 16, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 21, z: 17, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 21, z: 18, rotationY: Math.PI },
    { type: 'banqueta', x: 21, z: 19, rotationY: 3 * Math.PI / 2 },
    { type: 'buildingM', x: 21, z: 20, rotationY: 0 },
    { type: 'banqueta', x: 21, z: 21, rotationY: 3 * Math.PI / 2 },
    { type: 'buildingL', x: 21, z: 22, rotationY: Math.PI },
    { type: 'banqueta', x: 21, z: 23, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 21, z: 24, rotationY: Math.PI },
    { type: 'banqueta', x: 21, z: 25, rotationY: 0 },
    { type: 'banqueta', x: 21, z: 26, rotationY: 0 },
    { type: 'banqueta', x: 21, z: 27, rotationY: 0 },
    { type: 'banqueta', x: 21, z: 28, rotationY: 0 },
    { type: 'banqueta', x: 21, z: 29, rotationY: 0 },
    { type: 'banqueta', x: 21, z: 30, rotationY: 0 },
    { type: 'banqueta', x: 21, z: 31, rotationY: 0 },
    { type: 'banqueta', x: 21, z: 32, rotationY: 0 },
    { type: 'banqueta', x: 21, z: 33, rotationY: 0 },
    { type: 'streetA', x: 21, z: 34, rotationY: Math.PI },
    { type: 'banqueta', x: 21, z: 35, rotationY: 3 * Math.PI / 2 },
    { type: 'buildingF', x: 21, z: 36, rotationY: 0 },
    { type: 'banqueta', x: 21, z: 37, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 21, z: 38, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 21, z: 39, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 21, z: 40, rotationY: 0 },
    { type: 'banqueta', x: 21, z: 41, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 21, z: 42, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 21, z: 43, rotationY: Math.PI },
    { type: 'banqueta', x: 21, z: 44, rotationY: Math.PI },
    { type: 'banqueta', x: 21, z: 45, rotationY: Math.PI },
    { type: 'streetA', x: 21, z: 46, rotationY: 0 },
    { type: 'banqueta', x: 21, z: 47, rotationY: 3 * Math.PI / 2 },
    { type: 'casaI', x: 21, z: 48, rotationY: 0 },
    { type: 'bardaA', x: 21, z: 49, rotationY: Math.PI / 2 },
    { type: 'bardaA', x: 22, z: 2, rotationY: 3 * Math.PI / 2 },
    { type: 'bardaA', x: 22, z: 3, rotationY: 0 },
    { type: 'casaB', x: 22, z: 4, rotationY: Math.PI },
    { type: 'banqueta', x: 22, z: 5, rotationY: 0 },
    { type: 'streetA', x: 22, z: 6, rotationY: 0 },
    { type: 'banqueta', x: 22, z: 7, rotationY: Math.PI / 2 },
    { type: 'banqueta', x: 22, z: 8, rotationY: Math.PI / 2 },
    { type: 'banqueta', x: 22, z: 9, rotationY: Math.PI / 2 },
    { type: 'banqueta', x: 22, z: 10, rotationY: Math.PI / 2 },
    { type: 'banqueta', x: 22, z: 11, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 22, z: 12, rotationY: 0 },
    { type: 'banqueta', x: 22, z: 13, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 22, z: 14, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 22, z: 15, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 22, z: 16, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 22, z: 17, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 22, z: 18, rotationY: Math.PI },
    { type: 'banqueta', x: 22, z: 19, rotationY: 3 * Math.PI / 2 },
    { type: 'buildingL', x: 22, z: 20, rotationY: 0 },
    { type: 'banqueta', x: 22, z: 21, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 22, z: 22, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 22, z: 23, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 22, z: 24, rotationY: Math.PI },
    { type: 'banqueta', x: 22, z: 25, rotationY: 0 },
    { type: 'banqueta', x: 22, z: 26, rotationY: 0 },
    { type: 'banqueta', x: 22, z: 27, rotationY: 0 },
    { type: 'banqueta', x: 22, z: 28, rotationY: 0 },
    { type: 'banqueta', x: 22, z: 29, rotationY: 0 },
    { type: 'banqueta', x: 22, z: 30, rotationY: 0 },
    { type: 'banqueta', x: 22, z: 31, rotationY: 0 },
    { type: 'banqueta', x: 22, z: 32, rotationY: 0 },
    { type: 'banqueta', x: 22, z: 33, rotationY: 0 },
    { type: 'streetA', x: 22, z: 34, rotationY: Math.PI },
    { type: 'banqueta', x: 22, z: 35, rotationY: 0 },
    { type: 'banqueta', x: 22, z: 36, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 22, z: 37, rotationY: 3 * Math.PI / 2 },
    { type: 'buildingC', x: 22, z: 38, rotationY: Math.PI },
    { type: 'banqueta', x: 22, z: 39, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 22, z: 40, rotationY: 0 },
    { type: 'banqueta', x: 22, z: 41, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 22, z: 42, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 22, z: 43, rotationY: Math.PI },
    { type: 'banqueta', x: 22, z: 44, rotationY: Math.PI },
    { type: 'banqueta', x: 22, z: 45, rotationY: Math.PI },
    { type: 'streetA', x: 22, z: 46, rotationY: 0 },
    { type: 'banqueta', x: 22, z: 47, rotationY: 3 * Math.PI / 2 },
    { type: 'bardaA', x: 22, z: 49, rotationY: Math.PI / 2 },
    { type: 'bardaA', x: 23, z: 2, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 23, z: 5, rotationY: 0 },
    { type: 'streetA', x: 23, z: 6, rotationY: 0 },
    { type: 'banqueta', x: 23, z: 7, rotationY: Math.PI / 2 },
    { type: 'banqueta', x: 23, z: 8, rotationY: Math.PI / 2 },
    { type: 'banqueta', x: 23, z: 9, rotationY: Math.PI / 2 },
    { type: 'banqueta', x: 23, z: 10, rotationY: Math.PI / 2 },
    { type: 'banqueta', x: 23, z: 11, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 23, z: 12, rotationY: 0 },
    { type: 'banqueta', x: 23, z: 13, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 23, z: 14, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 23, z: 15, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 23, z: 16, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 23, z: 17, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 23, z: 18, rotationY: Math.PI },
    { type: 'banqueta', x: 23, z: 19, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 23, z: 20, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 23, z: 21, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 23, z: 23, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 23, z: 24, rotationY: Math.PI },
    { type: 'banqueta', x: 23, z: 25, rotationY: 0 },
    { type: 'banqueta', x: 23, z: 26, rotationY: 0 },
    { type: 'banqueta', x: 23, z: 27, rotationY: 0 },
    { type: 'banqueta', x: 23, z: 28, rotationY: 0 },
    { type: 'banqueta', x: 23, z: 29, rotationY: 0 },
    { type: 'banqueta', x: 23, z: 30, rotationY: 0 },
    { type: 'banqueta', x: 23, z: 31, rotationY: 0 },
    { type: 'banqueta', x: 23, z: 32, rotationY: 0 },
    { type: 'banqueta', x: 23, z: 33, rotationY: 0 },
    { type: 'streetA', x: 23, z: 34, rotationY: Math.PI },
    { type: 'banqueta', x: 23, z: 35, rotationY: 3 * Math.PI / 2 },
    { type: 'buildingJ', x: 23, z: 36, rotationY: Math.PI },
    { type: 'banqueta', x: 23, z: 37, rotationY: 3 * Math.PI / 2 },
    { type: 'buildingF', x: 23, z: 38, rotationY: Math.PI },
    { type: 'banqueta', x: 23, z: 39, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 23, z: 40, rotationY: 0 },
    { type: 'banqueta', x: 23, z: 41, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 23, z: 42, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 23, z: 43, rotationY: Math.PI },
    { type: 'banqueta', x: 23, z: 44, rotationY: Math.PI },
    { type: 'banqueta', x: 23, z: 45, rotationY: Math.PI },
    { type: 'streetA', x: 23, z: 46, rotationY: 0 },
    { type: 'banqueta', x: 23, z: 47, rotationY: 3 * Math.PI / 2 },
    { type: 'casaF', x: 23, z: 48, rotationY: 0 },
    { type: 'bardaA', x: 23, z: 49, rotationY: Math.PI / 2 },
    { type: 'bardaA', x: 24, z: 2, rotationY: 3 * Math.PI / 2 },
    { type: 'bardaA', x: 24, z: 3, rotationY: 0 },
    { type: 'casaB', x: 24, z: 4, rotationY: Math.PI },
    { type: 'banqueta', x: 24, z: 5, rotationY: 0 },
    { type: 'streetA', x: 24, z: 6, rotationY: 0 },
    { type: 'banqueta', x: 24, z: 7, rotationY: Math.PI / 2 },
    { type: 'banqueta', x: 24, z: 8, rotationY: Math.PI / 2 },
    { type: 'banqueta', x: 24, z: 9, rotationY: Math.PI / 2 },
    { type: 'banqueta', x: 24, z: 10, rotationY: Math.PI / 2 },
    { type: 'banqueta', x: 24, z: 11, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 24, z: 12, rotationY: 0 },
    { type: 'banqueta', x: 24, z: 13, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 24, z: 14, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 24, z: 15, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 24, z: 16, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 24, z: 17, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 24, z: 18, rotationY: Math.PI },
    { type: 'banqueta', x: 24, z: 19, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 24, z: 20, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 24, z: 21, rotationY: 3 * Math.PI / 2 },
    { type: 'buildingJ', x: 24, z: 22, rotationY: 0 },
    { type: 'banqueta', x: 24, z: 23, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 24, z: 24, rotationY: 0 },
    { type: 'banqueta', x: 24, z: 25, rotationY: 0 },
    { type: 'banqueta', x: 24, z: 26, rotationY: 0 },
    { type: 'banqueta', x: 24, z: 27, rotationY: 0 },
    { type: 'banqueta', x: 24, z: 28, rotationY: 0 },
    { type: 'banqueta', x: 24, z: 29, rotationY: 0 },
    { type: 'banqueta', x: 24, z: 30, rotationY: 0 },
    { type: 'banqueta', x: 24, z: 31, rotationY: 0 },
    { type: 'banqueta', x: 24, z: 32, rotationY: 0 },
    { type: 'banqueta', x: 24, z: 33, rotationY: 0 },
    { type: 'streetA', x: 24, z: 34, rotationY: Math.PI },
    { type: 'banqueta', x: 24, z: 35, rotationY: 0 },
    { type: 'banqueta', x: 24, z: 36, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 24, z: 37, rotationY: 3 * Math.PI / 2 },
    { type: 'buildingF', x: 24, z: 38, rotationY: Math.PI },
    { type: 'banqueta', x: 24, z: 39, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 24, z: 40, rotationY: 0 },
    { type: 'banqueta', x: 24, z: 41, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 24, z: 42, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 24, z: 43, rotationY: Math.PI },
    { type: 'banqueta', x: 24, z: 44, rotationY: Math.PI },
    { type: 'banqueta', x: 24, z: 45, rotationY: Math.PI },
    { type: 'streetA', x: 24, z: 46, rotationY: 0 },
    { type: 'banqueta', x: 24, z: 47, rotationY: 3 * Math.PI / 2 },
    { type: 'bardaA', x: 24, z: 49, rotationY: Math.PI / 2 },
    { type: 'bardaA', x: 25, z: 2, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 25, z: 5, rotationY: 0 },
    { type: 'streetA', x: 25, z: 6, rotationY: 0 },
    { type: 'banqueta', x: 25, z: 7, rotationY: Math.PI / 2 },
    { type: 'banqueta', x: 25, z: 8, rotationY: Math.PI / 2 },
    { type: 'banqueta', x: 25, z: 9, rotationY: Math.PI / 2 },
    { type: 'banqueta', x: 25, z: 10, rotationY: Math.PI / 2 },
    { type: 'banqueta', x: 25, z: 11, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 25, z: 12, rotationY: 0 },
    { type: 'banqueta', x: 25, z: 13, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 25, z: 14, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 25, z: 15, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 25, z: 16, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 25, z: 17, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 25, z: 18, rotationY: Math.PI },
    { type: 'banqueta', x: 25, z: 19, rotationY: 3 * Math.PI / 2 },
    { type: 'buildingN', x: 25, z: 20, rotationY: 0 },
    { type: 'banqueta', x: 25, z: 21, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 25, z: 22, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 25, z: 23, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 25, z: 24, rotationY: 0 },
    { type: 'banqueta', x: 25, z: 25, rotationY: 0 },
    { type: 'banqueta', x: 25, z: 26, rotationY: 0 },
    { type: 'banqueta', x: 25, z: 27, rotationY: 0 },
    { type: 'banqueta', x: 25, z: 28, rotationY: 0 },
    { type: 'banqueta', x: 25, z: 29, rotationY: 0 },
    { type: 'banqueta', x: 25, z: 30, rotationY: 0 },
    { type: 'banqueta', x: 25, z: 31, rotationY: 0 },
    { type: 'banqueta', x: 25, z: 32, rotationY: 0 },
    { type: 'banqueta', x: 25, z: 33, rotationY: 0 },
    { type: 'streetA', x: 25, z: 34, rotationY: Math.PI },
    { type: 'banqueta', x: 25, z: 35, rotationY: 3 * Math.PI / 2 },
    { type: 'buildingJ', x: 25, z: 36, rotationY: Math.PI },
    { type: 'banqueta', x: 25, z: 37, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 25, z: 38, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 25, z: 39, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 25, z: 40, rotationY: 0 },
    { type: 'banqueta', x: 25, z: 41, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 25, z: 42, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 25, z: 43, rotationY: Math.PI },
    { type: 'banqueta', x: 25, z: 44, rotationY: Math.PI },
    { type: 'banqueta', x: 25, z: 45, rotationY: Math.PI },
    { type: 'streetA', x: 25, z: 46, rotationY: 0 },
    { type: 'banqueta', x: 25, z: 47, rotationY: 3 * Math.PI / 2 },
    { type: 'casaC', x: 25, z: 48, rotationY: 0 },
    { type: 'bardaA', x: 25, z: 49, rotationY: Math.PI / 2 },
    { type: 'bardaA', x: 26, z: 2, rotationY: 3 * Math.PI / 2 },
    { type: 'bardaA', x: 26, z: 3, rotationY: 0 },
    { type: 'casaH', x: 26, z: 4, rotationY: Math.PI },
    { type: 'banqueta', x: 26, z: 5, rotationY: 0 },
    { type: 'streetA', x: 26, z: 6, rotationY: 0 },
    { type: 'banqueta', x: 26, z: 7, rotationY: Math.PI / 2 },
    { type: 'banqueta', x: 26, z: 8, rotationY: Math.PI / 2 },
    { type: 'banqueta', x: 26, z: 9, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 26, z: 10, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 26, z: 11, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 26, z: 12, rotationY: 0 },
    { type: 'banqueta', x: 26, z: 13, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 26, z: 14, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 26, z: 15, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 26, z: 16, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 26, z: 17, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 26, z: 18, rotationY: Math.PI },
    { type: 'banqueta', x: 26, z: 19, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 26, z: 20, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 26, z: 21, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 26, z: 22, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 26, z: 23, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 26, z: 24, rotationY: 0 },
    { type: 'banqueta', x: 26, z: 25, rotationY: 0 },
    { type: 'banqueta', x: 26, z: 26, rotationY: 0 },
    { type: 'banqueta', x: 26, z: 27, rotationY: 0 },
    { type: 'banqueta', x: 26, z: 28, rotationY: 0 },
    { type: 'banqueta', x: 26, z: 29, rotationY: 0 },
    { type: 'banqueta', x: 26, z: 30, rotationY: 0 },
    { type: 'banqueta', x: 26, z: 31, rotationY: 0 },
    { type: 'banqueta', x: 26, z: 32, rotationY: 0 },
    { type: 'banqueta', x: 26, z: 33, rotationY: 0 },
    { type: 'streetA', x: 26, z: 34, rotationY: Math.PI },
    { type: 'banqueta', x: 26, z: 35, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 26, z: 36, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 26, z: 37, rotationY: 3 * Math.PI / 2 },
    { type: 'buildingE', x: 26, z: 38, rotationY: Math.PI },
    { type: 'banqueta', x: 26, z: 39, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 26, z: 40, rotationY: 0 },
    { type: 'banqueta', x: 26, z: 41, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 26, z: 42, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 26, z: 43, rotationY: Math.PI },
    { type: 'banqueta', x: 26, z: 44, rotationY: Math.PI },
    { type: 'banqueta', x: 26, z: 45, rotationY: Math.PI },
    { type: 'streetA', x: 26, z: 46, rotationY: 0 },
    { type: 'banqueta', x: 26, z: 47, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 26, z: 48, rotationY: 3 * Math.PI / 2 },
    { type: 'bardaA', x: 27, z: 2, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 27, z: 5, rotationY: 0 },
    { type: 'streetF', x: 27, z: 6, rotationY: 0 },
    { type: 'streetA', x: 27, z: 7, rotationY: Math.PI / 2 },
    { type: 'streetA', x: 27, z: 8, rotationY: Math.PI / 2 },
    { type: 'streetA', x: 27, z: 9, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 27, z: 10, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 27, z: 11, rotationY: 3 * Math.PI / 2 },
    { type: 'streetC', x: 27, z: 12, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 27, z: 13, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 27, z: 14, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 27, z: 15, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 27, z: 16, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 27, z: 17, rotationY: Math.PI / 2 },
    { type: 'streetB', x: 27, z: 18, rotationY: Math.PI / 2 },
    { type: 'streetA', x: 27, z: 19, rotationY: Math.PI / 2 },
    { type: 'streetA', x: 27, z: 20, rotationY: Math.PI / 2 },
    { type: 'streetA', x: 27, z: 21, rotationY: Math.PI / 2 },
    { type: 'streetA', x: 27, z: 22, rotationY: Math.PI / 2 },
    { type: 'streetA', x: 27, z: 23, rotationY: Math.PI / 2 },
    { type: 'streetB', x: 27, z: 24, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 27, z: 25, rotationY: Math.PI / 2 },
    { type: 'streetA', x: 27, z: 26, rotationY: Math.PI / 2 },
    { type: 'streetA', x: 27, z: 27, rotationY: Math.PI / 2 },
    { type: 'streetA', x: 27, z: 28, rotationY: Math.PI / 2 },
    { type: 'streetA', x: 27, z: 29, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 27, z: 30, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 27, z: 31, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 27, z: 32, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 27, z: 33, rotationY: 3 * Math.PI / 2 },
    { type: 'streetB', x: 27, z: 34, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 27, z: 35, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 27, z: 36, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 27, z: 37, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 27, z: 38, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 27, z: 39, rotationY: 3 * Math.PI / 2 },
    { type: 'streetC', x: 27, z: 40, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 27, z: 41, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 27, z: 42, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 27, z: 43, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 27, z: 44, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 27, z: 45, rotationY: 3 * Math.PI / 2 },
    { type: 'streetC', x: 27, z: 46, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 27, z: 47, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 27, z: 48, rotationY: 3 * Math.PI / 2 },
    { type: 'bardaA', x: 28, z: 2, rotationY: 3 * Math.PI / 2 },
    { type: 'casaG', x: 28, z: 4, rotationY: Math.PI },
    { type: 'banqueta', x: 28, z: 5, rotationY: 0 },
    { type: 'banqueta', x: 28, z: 6, rotationY: 0 },
    { type: 'banqueta', x: 28, z: 7, rotationY: 0 },
    { type: 'banqueta', x: 28, z: 8, rotationY: 0 },
    { type: 'banqueta', x: 28, z: 9, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 28, z: 10, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 28, z: 11, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 28, z: 12, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 28, z: 13, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 28, z: 14, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 28, z: 15, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 28, z: 16, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 28, z: 17, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 28, z: 18, rotationY: 0 },
    { type: 'banqueta', x: 28, z: 19, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 28, z: 20, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 28, z: 21, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 28, z: 22, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 28, z: 23, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 28, z: 24, rotationY: 0 },
    { type: 'banqueta', x: 28, z: 25, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 28, z: 26, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 28, z: 27, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 28, z: 28, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 28, z: 29, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 28, z: 30, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 28, z: 31, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 28, z: 32, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 28, z: 33, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 28, z: 34, rotationY: 0 },
    { type: 'banqueta', x: 28, z: 35, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 28, z: 36, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 28, z: 37, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 28, z: 38, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 28, z: 39, rotationY: 0 },
    { type: 'banqueta', x: 28, z: 40, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 28, z: 41, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 28, z: 42, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 28, z: 43, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 28, z: 44, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 28, z: 45, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 28, z: 46, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 28, z: 47, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 28, z: 48, rotationY: 3 * Math.PI / 2 },
    { type: 'bardaA', x: 29, z: 2, rotationY: 3 * Math.PI / 2 },
    { type: 'bardaA', x: 29, z: 3, rotationY: 0 },
    { type: 'bardaA', x: 29, z: 4, rotationY: 0 },
    { type: 'casaC', x: 29, z: 6, rotationY: Math.PI / 2 },
    { type: 'casaB', x: 29, z: 8, rotationY: Math.PI / 2 },
    { type: 'casaB', x: 29, z: 10, rotationY: Math.PI / 2 },
    { type: 'casaE', x: 29, z: 12, rotationY: Math.PI / 2 },
    { type: 'casaI', x: 29, z: 14, rotationY: Math.PI / 2 },
    { type: 'casaH', x: 29, z: 16, rotationY: 0 },
    { type: 'banqueta', x: 29, z: 17, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 29, z: 18, rotationY: 0 },
    { type: 'banqueta', x: 29, z: 19, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 29, z: 20, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 29, z: 21, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 29, z: 22, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 29, z: 23, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 29, z: 24, rotationY: 0 },
    { type: 'banqueta', x: 29, z: 25, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 29, z: 26, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 29, z: 27, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 29, z: 28, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 29, z: 29, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 29, z: 30, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 29, z: 31, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 29, z: 32, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 29, z: 33, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 29, z: 34, rotationY: 0 },
    { type: 'banqueta', x: 29, z: 35, rotationY: 3 * Math.PI / 2 },
    { type: 'buildingK', x: 29, z: 36, rotationY: 0 },
    { type: 'casaH', x: 29, z: 38, rotationY: Math.PI / 2 },
    { type: 'bardaA', x: 29, z: 39, rotationY: Math.PI / 2 },
    { type: 'casaG', x: 29, z: 40, rotationY: Math.PI / 2 },
    { type: 'bardaA', x: 29, z: 41, rotationY: Math.PI / 2 },
    { type: 'casaB', x: 29, z: 42, rotationY: Math.PI / 2 },
    { type: 'bardaA', x: 29, z: 43, rotationY: Math.PI / 2 },
    { type: 'casaC', x: 29, z: 44, rotationY: Math.PI / 2 },
    { type: 'bardaA', x: 29, z: 45, rotationY: Math.PI / 2 },
    { type: 'casaA', x: 29, z: 46, rotationY: Math.PI / 2 },
    { type: 'bardaA', x: 29, z: 47, rotationY: Math.PI / 2 },
    { type: 'casaA', x: 29, z: 48, rotationY: Math.PI / 2 },
    { type: 'bardaA', x: 29, z: 49, rotationY: Math.PI / 2 },
    { type: 'bardaA', x: 30, z: 5, rotationY: Math.PI / 2 },
    { type: 'bardaA', x: 30, z: 6, rotationY: 3 * Math.PI / 2 },
    { type: 'bardaA', x: 30, z: 8, rotationY: 3 * Math.PI / 2 },
    { type: 'bardaA', x: 30, z: 10, rotationY: 3 * Math.PI / 2 },
    { type: 'bardaA', x: 30, z: 12, rotationY: 3 * Math.PI / 2 },
    { type: 'bardaA', x: 30, z: 14, rotationY: 3 * Math.PI / 2 },
    { type: 'bardaA', x: 30, z: 16, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 30, z: 17, rotationY: 3 * Math.PI / 2 },
    { type: 'streetF', x: 30, z: 18, rotationY: 0 },
    { type: 'streetA', x: 30, z: 19, rotationY: Math.PI / 2 },
    { type: 'streetA', x: 30, z: 20, rotationY: Math.PI / 2 },
    { type: 'streetA', x: 30, z: 21, rotationY: Math.PI / 2 },
    { type: 'streetA', x: 30, z: 22, rotationY: Math.PI / 2 },
    { type: 'streetA', x: 30, z: 23, rotationY: Math.PI / 2 },
    { type: 'streetC', x: 30, z: 24, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 30, z: 25, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 30, z: 26, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 30, z: 27, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 30, z: 28, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 30, z: 29, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 30, z: 30, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 30, z: 31, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 30, z: 32, rotationY: 3 * Math.PI / 2 },
    { type: 'streetA', x: 30, z: 33, rotationY: 3 * Math.PI / 2 },
    { type: 'streetF', x: 30, z: 34, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 30, z: 35, rotationY: 3 * Math.PI / 2 },
    { type: 'bardaA', x: 30, z: 38, rotationY: 3 * Math.PI / 2 },
    { type: 'bardaA', x: 30, z: 40, rotationY: 3 * Math.PI / 2 },
    { type: 'bardaA', x: 30, z: 42, rotationY: 3 * Math.PI / 2 },
    { type: 'bardaA', x: 30, z: 44, rotationY: 3 * Math.PI / 2 },
    { type: 'bardaA', x: 30, z: 47, rotationY: Math.PI / 2 },
    { type: 'bardaA', x: 30, z: 49, rotationY: Math.PI / 2 },
    { type: 'bardaA', x: 31, z: 5, rotationY: Math.PI },
    { type: 'bardaA', x: 31, z: 6, rotationY: Math.PI },
    { type: 'bardaA', x: 31, z: 7, rotationY: Math.PI },
    { type: 'bardaA', x: 31, z: 8, rotationY: Math.PI },
    { type: 'bardaA', x: 31, z: 9, rotationY: Math.PI },
    { type: 'bardaA', x: 31, z: 10, rotationY: Math.PI },
    { type: 'bardaA', x: 31, z: 11, rotationY: Math.PI },
    { type: 'bardaA', x: 31, z: 12, rotationY: Math.PI },
    { type: 'bardaA', x: 31, z: 13, rotationY: Math.PI },
    { type: 'bardaA', x: 31, z: 14, rotationY: Math.PI },
    { type: 'bardaA', x: 31, z: 15, rotationY: Math.PI },
    { type: 'bardaA', x: 31, z: 16, rotationY: Math.PI },
    { type: 'banqueta', x: 31, z: 17, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 31, z: 18, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 31, z: 19, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 31, z: 20, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 31, z: 21, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 31, z: 22, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 31, z: 23, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 31, z: 24, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 31, z: 25, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 31, z: 26, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 31, z: 27, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 31, z: 28, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 31, z: 29, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 31, z: 30, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 31, z: 31, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 31, z: 32, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 31, z: 33, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 31, z: 34, rotationY: 3 * Math.PI / 2 },
    { type: 'banqueta', x: 31, z: 35, rotationY: 3 * Math.PI / 2 },
    { type: 'buildingJ', x: 31, z: 36, rotationY: 0 },
    { type: 'bardaA', x: 31, z: 38, rotationY: Math.PI },
    { type: 'bardaA', x: 31, z: 39, rotationY: Math.PI },
    { type: 'bardaA', x: 31, z: 40, rotationY: Math.PI },
    { type: 'bardaA', x: 31, z: 41, rotationY: Math.PI },
    { type: 'bardaA', x: 31, z: 42, rotationY: Math.PI },
    { type: 'bardaA', x: 31, z: 43, rotationY: Math.PI },
    { type: 'bardaA', x: 31, z: 44, rotationY: Math.PI },
    { type: 'bardaA', x: 31, z: 45, rotationY: Math.PI },
    { type: 'bardaA', x: 31, z: 46, rotationY: Math.PI },
    { type: 'bardaA', x: 31, z: 47, rotationY: Math.PI },
    { type: 'bardaA', x: 31, z: 48, rotationY: Math.PI },
    { type: 'buildingM', x: 32, z: 17, rotationY: Math.PI / 2 },
    { type: 'buildingK', x: 32, z: 19, rotationY: Math.PI / 2 },
    { type: 'buildingC', x: 32, z: 21, rotationY: Math.PI / 2 },
    { type: 'buildingI', x: 32, z: 22, rotationY: Math.PI / 2 },
    { type: 'buildingE', x: 32, z: 24, rotationY: Math.PI / 2 },
    { type: 'buildingJ', x: 32, z: 26, rotationY: Math.PI / 2 },
    { type: 'buildingJ', x: 32, z: 28, rotationY: Math.PI / 2 },
    { type: 'buildingH', x: 32, z: 30, rotationY: Math.PI / 2 },
    { type: 'buildingH', x: 32, z: 31, rotationY: Math.PI / 2 },
    { type: 'buildingI', x: 32, z: 32, rotationY: Math.PI / 2 },
    { type: 'buildingK', x: 32, z: 34, rotationY: Math.PI / 2 },
];  

  private createInitialBuildings(): void {
    this.initialBuildings.forEach(building => {
      const { type, x: anchorX, z: anchorZ, rotationY } = building;
      // Verificar si la celda está vacía antes de construir
      if (type == 'glorieta') {
        this.createBuilding3D(type, anchorX, anchorZ, rotationY);

        for (let x = anchorX - 1; x <= anchorX + 1; x++) {
          for (let z = anchorZ - 1; z <= anchorZ + 1; z++) {
            // Asegurarse de no salir de los límites de la cuadrícula
            if (x >= 0 && x < this.gridSize && z >= 0 && z < this.gridSize) {
              
              // Si la celda está vacía, la marcamos
              if (!this.gridData[x][z]) {
                this.gridData[x][z] = {
                  type: type,
                  isPermanent: true,
                  rotationY: rotationY,
                  anchorX: anchorX, // ⬅️ NUEVO: Apunta al centro (25, 25)
                  anchorZ: anchorZ  // ⬅️ NUEVO: Apunta al centro (25, 25)
                };
              }
            }
          }
        }
      } else {
          if (!this.gridData[anchorX][anchorZ]) {
            this.createBuilding3D(type, anchorX, anchorZ, rotationY);
          
            // Es importante registrarlo inmediatamente ya que createBuilding3D es asíncrono
            this.gridData[anchorX][anchorZ] = {
              type: type,
              isPermanent: false, 
              rotationY: rotationY,
              anchorX: anchorX,
              anchorZ: anchorZ
            };
          } 
        }
    });
  }

  private calculatePopulationAndGreenArea(): void {
    // Configuración de la lógica de población
    const GREEN_AREA_PER_CAPITA = 9; // 9m² por habitante

    let newTotalInhabitants = 500;
    let newTotalGreenAreaM2 = 0;

    for (let x = 0; x < this.gridSize; x++) {
      for (let z = 0; z < this.gridSize; z++) {
        const cell = this.gridData[x][z];

        if (cell) {
          const type = cell.type;
          const config = this.buildingTypes[type];
          
          // 2. Calcular Área Verde
          if (config.greenAreaM2) {
            newTotalGreenAreaM2 += config.greenAreaM2;
          }
        }
      }
    }

    // 3. Actualizar la simulación
    this.totalInhabitants = newTotalInhabitants;
    this.totalGreenAreaM2 = newTotalGreenAreaM2;
    this.requiredGreenAreaM2 = newTotalInhabitants * GREEN_AREA_PER_CAPITA;
    this.greenAreaDeficit = this.totalGreenAreaM2 - this.requiredGreenAreaM2;
  }

  private exportCityData(): void {
    let exportString = "private initialBuildings: { type: string, x: number, z: number, rotationY?: number }[] = [\n";
    let buildingCount = 0;

    for (let x = 0; x < this.gridSize; x++) {
      for (let z = 0; z < this.gridSize; z++) {
        const cellData = this.gridData[x][z];

        if (cellData) {
          // Solo exportamos si el edificio fue colocado por el usuario (isPermanent: false)
          // o si queremos exportar toda la ciudad. Para simplificar la copia, incluiremos
          // la glorieta y calles iniciales si quieres regenerar TODO el nivel.

          // NOTA: Para no exportar el 3x3 de la glorieta 9 veces, solo exportamos la celda ancla.
          if (cellData.anchorX !== x || cellData.anchorZ !== z) {
            // Si no es la celda de anclaje (es una celda adyacente de un 3x3), la ignoramos.
            continue;
          }

          const type = cellData.type;
          const rotation = cellData.rotationY || 0;
          
          // Formatear la rotación para TypeScript
          let rotationString: string;
          if (rotation === 0) {
            rotationString = '0';
          } else if (rotation > 0.01 && rotation < 1.6) { // ~ Math.PI / 2
            rotationString = 'Math.PI / 2';
          } else if (rotation > 3.1 && rotation < 3.2) { // ~ Math.PI
            rotationString = 'Math.PI';
          } else if (rotation > 4.7 && rotation < 4.8) { // ~ 3 * Math.PI / 2
            rotationString = '3 * Math.PI / 2';
          } else {
            rotationString = rotation.toFixed(4).toString(); // Fallback
          }

          exportString += `    { type: '${type}', x: ${x}, z: ${z}, rotationY: ${rotationString} },\n`;
          buildingCount++;
        }
      }
    }

    exportString += "];";

    console.log(`--- EXPORTACIÓN DE CELDAS (${buildingCount} edificios) ---`);
    console.log(exportString);
    console.log('--- FIN EXPORTACIÓN ---');

    // Opcional: Copiar al portapapeles directamente
    navigator.clipboard.writeText(exportString).then(() => {
      console.log('Datos de la ciudad copiados al portapapeles.');
    }).catch(err => {
      console.error('Error al copiar al portapapeles:', err);
    });
  }

  ngOnInit(): void {
    this.initScene();
    this.createGround();
    this.createClouds();
    this.preloadBuildingPreviews();
    this.createInitialBuildings();
    this.animate();
    this.addEventListeners();
    this.calculatePopulationAndGreenArea();
  }

  ngOnDestroy(): void {
    this.removeEventListeners();
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    this.renderer?.dispose();
  }

  selectCategory(category: 'Edificios' | 'Casas' | 'Calles' | 'Decoración'): void {
    this.selectedCategory = category;
    
    // Opcional: Al cambiar de categoría, selecciona el primer edificio de esa categoría
    const firstBuilding = this.buildingCategories[category][0];
    if (firstBuilding) {
      this.selectBuilding(firstBuilding);
    }
  }

  selectBuilding(type: string): void {
    this.selectedBuilding = type;
  }

  private initScene(): void {
    // Initialize grid data
    this.gridData = Array(this.gridSize).fill(null)
      .map(() => Array(this.gridSize).fill(null));

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87CEEB);

    // Camera - Orthographic
    const aspect = window.innerWidth / window.innerHeight;
    const d = 10;
    this.camera = new THREE.OrthographicCamera(
      -d * aspect, d * aspect, d, -d, 1, 1000
    );

    this.camera.zoom = 0.5;
    this.camera.updateProjectionMatrix();
    this.camera.position.set(-20, 20, -20);
    this.camera.lookAt(1, 0, 1);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: false });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.canvasRef.nativeElement.appendChild(this.renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(10, 20, 10);
    directionalLight.castShadow = true;
    directionalLight.shadow.camera.left = -20;
    directionalLight.shadow.camera.right = 20;
    directionalLight.shadow.camera.top = 20;
    directionalLight.shadow.camera.bottom = -20;
    this.scene.add(directionalLight);

    // Add groups
    this.scene.add(this.groundGroup);
    this.scene.add(this.buildingsGroup);
  }

  private createClouds(): void {
    for (let i = 0; i < this.cloudCount; i++) {
      const cloud = new THREE.Group(); // cada nube es un grupo de esferas

      const sphereCount = 5 + Math.floor(Math.random() * 2); // 5-10 esferas por nube
      for (let j = 0; j < sphereCount; j++) {
        const radius = 1 + Math.random() * 2; // tamaño de cada “bola” de nube
        const geometry = new THREE.SphereGeometry(radius, 5, 5);
        const material = new THREE.MeshLambertMaterial({
          color: '#FFFFFF',
          transparent: true,
          opacity: 0.7,
        });
        const sphere = new THREE.Mesh(geometry, material);

        // posición relativa dentro de la nube
        sphere.position.set(
          (Math.random() - 0.5) * 4, 
          (Math.random() - 0.5) * 2, 
          (Math.random() - 0.5) * 4
        );

        cloud.add(sphere);
      }

      // posición inicial aleatoria en la escena
      cloud.position.set(
        (Math.random() - 0.5) * this.gridSize * this.cellSize,
        18 + Math.random() * 20,
        (Math.random() - 0.5) * this.gridSize * this.cellSize
      );

      this.scene.add(cloud);
      this.clouds.push(cloud);
    }
  }

  private createGround(): void {
    const baseColor = new THREE.Color('#ace45d'); // verde pasto

    for (let x = 0; x < this.gridSize; x++) {
      for (let z = 0; z < this.gridSize; z++) {
        const geometry = new THREE.BoxGeometry(
          this.cellSize * 1, 0.5, this.cellSize * 1
        );

        // Creamos una copia del color para poder modificarlo ligeramente
        const color = baseColor.clone();
        color.offsetHSL(0, 0, (Math.random() - 0.6) * 0.2); // variación ligera de brillo

        const material = new THREE.MeshLambertMaterial({
          color: color
        });

        const cell = new THREE.Mesh(geometry, material);
        cell.position.set(
          x * this.cellSize - this.gridSize * this.cellSize / 2 + this.cellSize / 2,
          0,
          z * this.cellSize - this.gridSize * this.cellSize / 2 + this.cellSize / 2
        );
        cell.receiveShadow = true;
        cell.userData = { gridX: x, gridZ: z };
        this.groundGroup.add(cell);
      }
    }
  }

  private loadBuildingModel(url: string, onLoaded: (model: THREE.Object3D) => void) {
    this.gltfLoader.load(
      url,
      (gltf) => {
        const model = gltf.scene;
        model.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        onLoaded(model);
      },
      undefined,
      (error) => {
        console.error('Error cargando modelo GLB:', error);
      }
    );
  }

  private createBuilding3D(type: string, x: number, z: number, rotationY: number = 0) {
    const config = this.buildingTypes[type];

    let modelUrl = '';
    switch(type) {
      // Edificios
      case 'buildingA': modelUrl = 'assets/buildings/building-a.glb'; break;
      case 'buildingB': modelUrl = 'assets/buildings/building-b.glb'; break;
      case 'buildingC': modelUrl = 'assets/buildings/building-c.glb'; break;
      case 'buildingD': modelUrl = 'assets/buildings/building-d.glb'; break;
      case 'buildingE': modelUrl = 'assets/buildings/building-e.glb'; break;
      case 'buildingF': modelUrl = 'assets/buildings/building-f.glb'; break;
      case 'buildingG': modelUrl = 'assets/buildings/building-g.glb'; break;
      case 'buildingH': modelUrl = 'assets/buildings/building-h.glb'; break;
      case 'buildingI': modelUrl = 'assets/buildings/building-i.glb'; break;
      case 'buildingJ': modelUrl = 'assets/buildings/building-j.glb'; break;
      case 'buildingK': modelUrl = 'assets/buildings/building-k.glb'; break;
      case 'buildingL': modelUrl = 'assets/buildings/building-l.glb'; break;
      case 'buildingM': modelUrl = 'assets/buildings/building-m.glb'; break;
      case 'buildingN': modelUrl = 'assets/buildings/building-n.glb'; break;

      // Calles
      case 'streetA': modelUrl = 'assets/streets/streetA.glb'; break;
      case 'streetB': modelUrl = 'assets/streets/streetB.glb'; break;
      case 'streetC': modelUrl = 'assets/streets/streetC.glb'; break;
      case 'streetD': modelUrl = 'assets/streets/streetD.glb'; break;
      case 'streetE': modelUrl = 'assets/streets/streetE.glb'; break;
      case 'streetF': modelUrl = 'assets/streets/streetF.glb'; break;
      case 'streetG': modelUrl = 'assets/streets/streetG.glb'; break;
      case 'lightA': modelUrl = 'assets/streets/lightA.glb'; break;
      case 'lightB': modelUrl = 'assets/streets/lightB.glb'; break;
      case 'lightC': modelUrl = 'assets/streets/lightC.glb'; break;
      case 'banqueta': modelUrl = 'assets/streets/banqueta.glb'; break;


      // Casas
      case 'casaA': modelUrl = 'assets/casas/casa-a.glb'; break;
      case 'casaB': modelUrl = 'assets/casas/casa-b.glb'; break;
      case 'casaC': modelUrl = 'assets/casas/casa-c.glb'; break;
      case 'casaD': modelUrl = 'assets/casas/casa-d.glb'; break;
      case 'casaE': modelUrl = 'assets/casas/casa-e.glb'; break;
      case 'casaF': modelUrl = 'assets/casas/casa-f.glb'; break;
      case 'casaG': modelUrl = 'assets/casas/casa-g.glb'; break;
      case 'casaH': modelUrl = 'assets/casas/casa-h.glb'; break;
      case 'casaI': modelUrl = 'assets/casas/casa-i.glb'; break;

      // Decoración
      case 'arbolA': modelUrl = 'assets/decoracion/arbolA.glb'; break;
      case 'arbolB': modelUrl = 'assets/decoracion/arbolB.glb'; break;
      case 'arbolC': modelUrl = 'assets/decoracion/arbolC.glb'; break;
      case 'arbolD': modelUrl = 'assets/decoracion/arbolD.glb'; break;
      case 'arbolE': modelUrl = 'assets/decoracion/arbolE.glb'; break;
      case 'banca': modelUrl = 'assets/decoracion/banca.glb'; break;
      case 'bardaA': modelUrl = 'assets/decoracion/bardaA.glb'; break;
      case 'bardaB': modelUrl = 'assets/decoracion/bardaB.glb'; break;

      case 'planter': modelUrl = 'assets/casas/planter.glb'; break;

    }

    this.loadBuildingModel(modelUrl, (model) => {
      // Ajuste de escala
      model.scale.set(config.scale, config.scale, config.scale); 

      const groundHeight = 0.5;

      // Posición centrada en la celda
      model.position.set(
        x * this.cellSize - this.gridSize * this.cellSize / 2 + this.cellSize / 2,
        groundHeight / 2,
        z * this.cellSize - this.gridSize * this.cellSize / 2 + this.cellSize / 2
      );
      model.rotation.y = rotationY;

      model.userData['gridX'] = x;
      model.userData['gridZ'] = z;

      model.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;

          if (child.material instanceof THREE.MeshStandardMaterial) {
            child.material.emissive = new THREE.Color('#2f00ffff');
            child.material.emissiveIntensity = 0.02; // brillo tenue
          }
        }
      });

      this.buildingsGroup.add(model);
    });
  }

  private preloadBuildingPreviews(): void {
    const buildingKeys = Object.keys(this.buildingTypes);

    for (const type of buildingKeys) {
      const config = this.buildingTypes[type];
      
      let modelUrl = '';
      switch(type) {
        // Edificios
        case 'buildingA': modelUrl = 'assets/buildings/building-a.glb'; break;
        case 'buildingB': modelUrl = 'assets/buildings/building-b.glb'; break;
        case 'buildingC': modelUrl = 'assets/buildings/building-c.glb'; break;
        case 'buildingD': modelUrl = 'assets/buildings/building-d.glb'; break;
        case 'buildingE': modelUrl = 'assets/buildings/building-e.glb'; break;
        case 'buildingF': modelUrl = 'assets/buildings/building-f.glb'; break;
        case 'buildingG': modelUrl = 'assets/buildings/building-g.glb'; break;
        case 'buildingH': modelUrl = 'assets/buildings/building-h.glb'; break;
        case 'buildingI': modelUrl = 'assets/buildings/building-i.glb'; break;
        case 'buildingJ': modelUrl = 'assets/buildings/building-j.glb'; break;
        case 'buildingK': modelUrl = 'assets/buildings/building-k.glb'; break;
        case 'buildingL': modelUrl = 'assets/buildings/building-l.glb'; break;
        case 'buildingM': modelUrl = 'assets/buildings/building-m.glb'; break;
        case 'buildingN': modelUrl = 'assets/buildings/building-n.glb'; break;

        // Calles ⬅️ ¡CASOS FALTANTES AÑADIDOS!
        case 'streetA': modelUrl = 'assets/streets/streetA.glb'; break;
        case 'streetB': modelUrl = 'assets/streets/streetB.glb'; break;
        case 'streetC': modelUrl = 'assets/streets/streetC.glb'; break;
        case 'streetD': modelUrl = 'assets/streets/streetD.glb'; break;
        case 'streetE': modelUrl = 'assets/streets/streetE.glb'; break;
        case 'streetF': modelUrl = 'assets/streets/streetF.glb'; break;
        case 'streetG': modelUrl = 'assets/streets/streetG.glb'; break;
        case 'lightA': modelUrl = 'assets/streets/lightA.glb'; break;
        case 'lightB': modelUrl = 'assets/streets/lightB.glb'; break;
        case 'lightC': modelUrl = 'assets/streets/lightC.glb'; break;
        case 'banqueta': modelUrl = 'assets/streets/banqueta.glb'; break;

        // Casas ⬅️ ¡CASOS FALTANTES AÑADIDOS!
        case 'casaA': modelUrl = 'assets/casas/casa-a.glb'; break;
        case 'casaB': modelUrl = 'assets/casas/casa-b.glb'; break;
        case 'casaC': modelUrl = 'assets/casas/casa-c.glb'; break;
        case 'casaD': modelUrl = 'assets/casas/casa-d.glb'; break;
        case 'casaE': modelUrl = 'assets/casas/casa-e.glb'; break;
        case 'casaF': modelUrl = 'assets/casas/casa-f.glb'; break;
        case 'casaG': modelUrl = 'assets/casas/casa-g.glb'; break;
        case 'casaH': modelUrl = 'assets/casas/casa-h.glb'; break;
        case 'casaI': modelUrl = 'assets/casas/casa-i.glb'; break;
        case 'planter': modelUrl = 'assets/casas/planter.glb'; break;

        // Decoracion
        case 'arbolA': modelUrl = 'assets/decoracion/arbolA.glb'; break;
        case 'arbolB': modelUrl = 'assets/decoracion/arbolB.glb'; break;
        case 'arbolC': modelUrl = 'assets/decoracion/arbolC.glb'; break;
        case 'arbolD': modelUrl = 'assets/decoracion/arbolD.glb'; break;
        case 'arbolE': modelUrl = 'assets/decoracion/arbolE.glb'; break;
        case 'banca': modelUrl = 'assets/decoracion/banca.glb'; break;
        case 'bardaA': modelUrl = 'assets/decoracion/bardaA.glb'; break;
        case 'bardaB': modelUrl = 'assets/decoracion/bardaB.glb'; break;
      }

      if (modelUrl) {
        this.loadBuildingModel(modelUrl, (model) => {
          // Clonar, ajustar materiales y guardar en cache
          const preview = model.clone(true);

          preview.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.castShadow = false;
              child.receiveShadow = false;

              //Controladores de transparencia
              const transparentMaterial = new THREE.MeshLambertMaterial({
                color: 0x00FF00, // Color verde fijo para el preview
                transparent: true,
                opacity: 0.8, // Reducimos opacidad
                depthWrite: true // Mejora la visualización transparente
              });

              if (Array.isArray(child.material)) {
                child.material = child.material.map(() => transparentMaterial);
              } else {
                child.material = transparentMaterial;
              }
            }
          });

          preview.scale.set(config.scale, config.scale, config.scale); 
          this.buildingPreviewCache[type] = preview;
        });
      }
    }
  }

  private showHoverPreview(x: number, z: number): void {
    // 1. Si está en modo borrador, no hacer nada
    if (this.selectedBuilding === 'eraser') return;

    const type = this.selectedBuilding;

    // 2. Verificar si el modelo de preview está en el cache
    const cachedPreview = this.buildingPreviewCache[type];
    if (!cachedPreview) {
      // Si no está cargado (aún cargando), salimos para evitar bugs asíncronos
      return; 
    }

    // 3. Si el tipo de preview ha cambiado, o no hay preview actual:
    if (this.currentPreviewType !== type || !this.hoverPreview) {
      if (this.hoverPreview) {
        this.scene.remove(this.hoverPreview);
      }
      
      // Usamos un CLON del modelo cacheado para poder posicionarlo sin afectar el original
      this.hoverPreview = cachedPreview.clone(true);
      this.scene.add(this.hoverPreview);
      this.currentPreviewType = type;
    }

    // 4. Posicionar el preview (siempre síncrono)
    if (this.hoverPreview) {

      const groundHeight = 0.5;

      this.hoverPreview.position.set(
        x * this.cellSize - this.gridSize * this.cellSize / 2 + this.cellSize / 2,
        groundHeight / 2,
        z * this.cellSize - this.gridSize * this.cellSize / 2 + this.cellSize / 2
      );

      this.hoverPreview.rotation.y = this.currentBuildingRotationY;
    }
  }

  private removeBuilding(x: number, z: number): void {
    const cellData = this.gridData[x][z];

    // 1. Si no hay nada o el objeto está incompleto, sal
    if (!cellData) return;
    
    // 2. ⬅️ VERIFICACIÓN CLAVE: Si es permanente, ¡detente!
    if (cellData.isPermanent) {
      console.log(`Intento de borrar un edificio permanente en (${x}, ${z}).`);
      return;
    }

    // Si llegamos aquí, el edificio es mutable (construido por el usuario).
    
    const buildingType = cellData.type; // Obtener el tipo de edificio
    
    // Find and remove the building from the scene
    const buildingToRemove = this.buildingsGroup.children.find(
      (child) => child.userData['gridX'] === x && child.userData['gridZ'] === z
    );

    if (buildingToRemove) {
      this.buildingsGroup.remove(buildingToRemove);
      
      // Dispose geometry and materials to free memory (esto se mantiene igual)
      if (buildingToRemove instanceof THREE.Mesh) {
        buildingToRemove.geometry.dispose();
        if (Array.isArray(buildingToRemove.material)) {
          buildingToRemove.material.forEach(mat => mat.dispose());
        } else {
          buildingToRemove.material.dispose();
        }
      }
    }

    // Clear grid data
    this.gridData[x][z] = null;
    this.calculatePopulationAndGreenArea();

    // Deduct points (half of what was gained)
    const config = this.buildingTypes[buildingType];
  }

  private clampCameraPosition(): void {
    const halfMap = (this.gridSize * this.cellSize) / 2;

    this.camera.position.x = THREE.MathUtils.clamp(this.camera.position.x, -halfMap, halfMap);
    this.camera.position.z = THREE.MathUtils.clamp(this.camera.position.z, -halfMap, halfMap);
  }

  // Reemplaza la función onMouseMove existente:
  private onMouseMove = (event: MouseEvent): void => {
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.groundGroup.children);

    // Lógica de Panning (mantener)
    if (this.isPanning && (event.buttons & 4 || event.buttons & 2)) {
        const deltaX = event.clientX - this.lastMousePosition.x;
        const deltaY = event.clientY - this.lastMousePosition.y;

        const panFactor = 0.005 / this.camera.zoom;
        this.camera.position.x -= deltaX * panFactor * this.camera.right;
        this.camera.position.z -= deltaY * panFactor * this.camera.top;

        this.clampCameraPosition();
        this.lastMousePosition = { x: event.clientX, y: event.clientY };
    }

    // --- Lógica de Hover Preview y DRAG-TO-BUILD ---
    
    // 1. Manejo del Hover Preview (Eliminación)
    if (this.hoverPreview && !this.isPanning) { 
      this.scene.remove(this.hoverPreview);
      this.hoverPreview = null;
      this.currentPreviewType = null;
    }
    
    if (intersects.length > 0) {
      const cell = intersects[0].object as THREE.Mesh;
      const { gridX, gridZ } = cell.userData;
      
      const existingCellData = this.gridData[gridX][gridZ]; // Obtener datos      
      // Condición para mostrar el preview:
      // a) No es borrador.
      // b) La celda está vacía O (es una banqueta Y no es permanente).
      const canPlaceOver = !existingCellData || (existingCellData.type === 'banqueta' && !existingCellData.isPermanent);
      
      if (this.selectedBuilding !== 'eraser' && canPlaceOver) {
        // Si el edificio seleccionado es un objeto que PUEDE colocarse, mostramos el preview.
        this.showHoverPreview(gridX, gridZ); 
      }
      // Show red highlight for eraser mode
      else if (this.selectedBuilding === 'eraser' && existingCellData && !existingCellData.isPermanent) {
        // Si estamos en modo borrador y hay algo no permanente, creamos el highlight rojo
        const geometry = new THREE.BoxGeometry(
          this.cellSize * 1, 1, this.cellSize * 1
        );
        const material = new THREE.MeshBasicMaterial({ 
          color: 0xff0000,
          transparent: true,
          opacity: 0.6
        });
        this.hoverPreview = new THREE.Mesh(geometry, material);
        this.hoverPreview.position.set(
          gridX * this.cellSize - this.gridSize * this.cellSize / 2 + this.cellSize / 2,
          0.15,
          gridZ * this.cellSize - this.gridSize * this.cellSize / 2 + this.cellSize / 2
        );
        this.scene.add(this.hoverPreview);
      }
      // Si la celda está ocupada por algo distinto a una banqueta, o es permanente,
      // no se muestra el preview (ya que se eliminó al inicio de la función).
    }
  };

  private onClick = (event: MouseEvent): void => {
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.groundGroup.children);

    if (intersects.length > 0) {
      const cell = intersects[0].object as THREE.Mesh;
      const { gridX, gridZ } = cell.userData;
      
      const existingCellData = this.gridData[gridX][gridZ]; // ⬅️ Obtener los datos existentes

      // Eraser mode - remove building
      if (this.selectedBuilding === 'eraser') {
        if (existingCellData) {
          this.removeBuilding(gridX, gridZ);
        }
      }
      // Build mode - place building
      else {
        // 1. Condición ACEPTABLE: La celda está vacía.
        // 2. Condición ACEPTABLE: La celda no es permanente Y el tipo es 'banqueta'.
        if (!existingCellData || (existingCellData.type === 'banqueta' && !existingCellData.isPermanent)) { // ⬅️ LÓGICA CLAVE MODIFICADA AQUÍ
          
          // 1. Si ya existe un elemento (una banqueta), lo eliminamos primero
          if (existingCellData) {
            this.removeBuilding(gridX, gridZ);
          }

          const config = this.buildingTypes[this.selectedBuilding];
          if (true) {
            this.createBuilding3D(
              this.selectedBuilding,
              gridX,
              gridZ,
              this.currentBuildingRotationY
            );

            this.gridData[gridX][gridZ] = {
              type: this.selectedBuilding,
              isPermanent: false,
              rotationY: this.currentBuildingRotationY,
              anchorX: gridX,
              anchorZ: gridZ
            };

            this.calculatePopulationAndGreenArea();
          }
        }
      }
    }
  };

  private onRightClick = (event: MouseEvent): void => {
    event.preventDefault(); // Prevent context menu

    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.groundGroup.children);

    if (intersects.length > 0) {
      const cell = intersects[0].object as THREE.Mesh;
      const { gridX, gridZ } = cell.userData;

      // Right click always removes building
      if (this.gridData[gridX][gridZ]) {
        this.removeBuilding(gridX, gridZ);
      }
    }
  };

  private onKeyDown = (event: KeyboardEvent): void => {
    // Delete or Backspace key to activate eraser
    if (event.key === 'Delete' || event.key === 'Backspace') {
      this.selectedBuilding = 'eraser';
    }

    if (event.key === 'e' || event.key === 'E') {
        this.exportCityData();
        return; 
    }

    // Number keys 1-4 to select buildings quickly
    else if (event.key >= '1' && event.key <= '4') {
      const categories: ('Edificios' | 'Casas' | 'Calles' | 'Decoración')[] = [
        'Edificios', 
        'Casas', 
        'Calles', 
        'Decoración'
      ];
      
      const index = parseInt(event.key) - 1;
      
      // Asegúrate de que el índice sea válido antes de llamar
      if (index >= 0 && index < categories.length) {
        this.selectCategory(categories[index]);
        return; // Detiene el procesamiento de la tecla
      }
    }

    if (event.key === 'r' || event.key === 'R') {
        // Incrementa la rotación en 90 grados (Math.PI / 2 radianes)
        this.currentBuildingRotationY += Math.PI / 2; 
        
        // Mantiene el valor entre 0 y 2*PI (opcional, pero limpio)
        if (this.currentBuildingRotationY >= Math.PI * 2) {
            this.currentBuildingRotationY = 0;
        }
        
        this.onMouseMove(event as unknown as MouseEvent); // Reutilizamos el evento del mouse
        return; // Evita que la tecla 'R' interfiera con el movimiento
    }

    const move = 0.6;
    if (event.key === 's') this.camera.position.z -= move;
    if (event.key === 'w') this.camera.position.z += move;
    if (event.key === 'd') this.camera.position.x -= move;
    if (event.key === 'a') this.camera.position.x += move;
    this.clampCameraPosition();
  };

  private onWindowResize = (): void => {
    const aspect = window.innerWidth / window.innerHeight;
    const d = 10;
    this.camera.left = -d * aspect;
    this.camera.right = d * aspect;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  };

  private onMouseDown = (event: MouseEvent): void => {
    if (event.button === 1 || event.button === 2) { // middle or right button
      this.isPanning = true;
      this.lastMousePosition = { x: event.clientX, y: event.clientY };
    }
  };

  private onMouseUp = (): void => {
    this.isPanning = false;
  };

  private onMouseWheel = (event: WheelEvent): void => {
    event.preventDefault(); // ⛔ Evitamos zoom del navegador y scrolling

    // Sensibilidad del zoom (ajústalo si lo sientes muy rápido/lento)
    const zoomStrength = 0.25;

    // event.deltaY > 0 = alejar, < 0 = acercar
    const zoomDelta = -event.deltaY * zoomStrength * 0.001;

    // Aplicamos zoom progresivo (suave)
    this.camera.zoom = THREE.MathUtils.clamp(
      this.camera.zoom + zoomDelta,
      0.4,   // 🔽 mínimo (más lejos)
      4.0    // 🔼 máximo (más cerca)
    );

    this.camera.updateProjectionMatrix();
  };

  private addEventListeners(): void {
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('click', this.onClick);
    window.addEventListener('contextmenu', this.onRightClick);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('resize', this.onWindowResize);

    window.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('wheel', this.onMouseWheel);
  }

  private removeEventListeners(): void {
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('click', this.onClick);
    window.removeEventListener('contextmenu', this.onRightClick);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('resize', this.onWindowResize);

    window.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('wheel', this.onMouseWheel);
  }

  private animate = (): void => {
    this.animationId = requestAnimationFrame(this.animate);
    this.clouds.forEach(cloud => {
      cloud.position.x += this.cloudSpeed;

      if (cloud.position.x > this.gridSize * this.cellSize / 2 + 5) {
        cloud.position.x = -this.gridSize * this.cellSize / 2 - 5; // loop
      }
    });

    this.renderer.render(this.scene, this.camera);
  };
}
