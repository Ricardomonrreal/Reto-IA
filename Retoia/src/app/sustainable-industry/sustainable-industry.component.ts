import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { CommonModule, KeyValuePipe } from '@angular/common';
import * as BABYLON from 'babylonjs';

interface IndustrialBuilding {
  name: string;
  cost: number;
  production: number;
  waste: number;
  icon: string;
}

@Component({
  selector: 'app-sustainable-industry',
  templateUrl: './sustainable-industry.component.html',
  styleUrls: ['./sustainable-industry.component.css'],
  standalone: true,
  imports: [CommonModule, KeyValuePipe]
})
export class SustainableIndustryComponent implements OnInit {
  @ViewChild('renderCanvas', { static: true }) renderCanvas!: ElementRef<HTMLCanvasElement>;
  private engine!: BABYLON.Engine;
  private scene!: BABYLON.Scene;
  private camera!: BABYLON.ArcRotateCamera;
  private light!: BABYLON.HemisphericLight;

  // Estadísticas
  money = 10000;
  totalProduction = 0;
  totalWaste = 0;
  innovationIndex = 0;
  maxWasteTarget = 200;

  // Gestión de Edificios
  selectedBuilding: string | null = null;
  industrialBuildingsUI: Record<string, IndustrialBuilding> = {
    cleanFactory: {
      name: 'Fábrica Limpia',
      cost: 1500,
      production: 50,
      waste: 10,
      icon: '🏭'
    },
    researchCenter: {
      name: 'Centro I+D',
      cost: 2000,
      production: 20,
      waste: 5,
      icon: '🔬'
    },
    recyclingPlant: {
      name: 'Planta de Reciclaje',
      cost: 1200,
      production: 0,
      waste: -30,
      icon: '♻️'
    },
    warehouse: {
      name: 'Almacén',
      cost: 800,
      production: 10,
      waste: 2,
      icon: '📦'
    }
  };

  ngOnInit(): void {
    this.createScene();
    this.engine.runRenderLoop(() => this.scene.render());
    window.addEventListener('resize', () => this.engine.resize());
  }

  // 🎮 Inicialización de la escena Babylon.js
  private createScene(): void {
    this.engine = new BABYLON.Engine(this.renderCanvas.nativeElement, true);
    this.scene = new BABYLON.Scene(this.engine);
    this.scene.clearColor = new BABYLON.Color4(0, 0.05, 0, 1);

    this.camera = new BABYLON.ArcRotateCamera('camera', Math.PI / 3, Math.PI / 3, 50, BABYLON.Vector3.Zero(), this.scene);
    this.camera.attachControl(this.renderCanvas.nativeElement, true);

    this.light = new BABYLON.HemisphericLight('light', new BABYLON.Vector3(1, 1, 0), this.scene);
    this.light.intensity = 0.9;

    // Terreno base
    const ground = BABYLON.MeshBuilder.CreateGround('ground', { width: 100, height: 100 }, this.scene);
    const groundMaterial = new BABYLON.StandardMaterial('groundMat', this.scene);
    groundMaterial.diffuseColor = new BABYLON.Color3(0, 0.3, 0);
    ground.material = groundMaterial;
  }

  // 🏗️ Selección de Edificios
  selectBuilding(buildingKey: string): void {
    if (this.selectedBuilding === buildingKey) {
      this.selectedBuilding = null;
      return;
    }
    this.selectedBuilding = buildingKey;
  }

  // 🧱 Colocación de edificios
  placeBuilding(position: BABYLON.Vector3): void {
    if (!this.selectedBuilding) return;
    const building = this.industrialBuildingsUI[this.selectedBuilding];

    if (this.money < building.cost) return;

    const box = BABYLON.MeshBuilder.CreateBox(this.selectedBuilding, { size: 3 }, this.scene);
    box.position = position;
    box.material = new BABYLON.StandardMaterial('mat', this.scene);
    (box.material as BABYLON.StandardMaterial).diffuseColor = new BABYLON.Color3(Math.random(), Math.random(), Math.random());

    this.money -= building.cost;
    this.totalProduction += building.production;
    this.totalWaste += building.waste;
    if (this.selectedBuilding === 'researchCenter') {
      this.innovationIndex = Math.min(this.innovationIndex + 10, 100);
    }
  }
}
