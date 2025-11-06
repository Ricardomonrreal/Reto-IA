import { Component, ElementRef, ViewChild, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import * as THREE from 'three';

// 🔹 Interfaz tipada para las fuentes de energía
interface EnergySource {
  name: string;
  icon: string;
  cost: number;
  production: number;
  maintenanceCost?: number;
}

@Component({
  selector: 'app-energy-grid',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './energy-grid.component.html',
  styleUrls: ['./energy-grid.component.css']
})
export class EnergyGridComponent implements OnInit, OnDestroy {
  @ViewChild('renderCanvas', { static: true }) canvasRef!: ElementRef<HTMLDivElement>;

  // 🔹 Elementos de Three.js
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private animationFrameId: number | null = null;

  // 🔹 Variables de UI
  money = 5000;
  totalProduction = 0;
  totalConsumption = 0;
  energyBalance = 0;
  efficiencyPercent = 0;
  totalEmissions = 0;
  balanceColor = '#ffffff';

  placedSources: any[] = [];
  healthySources = 0;
  warningSources = 0;
  criticalSources = 0;
  selectedSource = '';

  // 🔹 Datos tipados de las fuentes de energía
  energySourcesUI: Record<string, EnergySource> = {
    solar:   { name: 'Solar',   icon: '☀️', cost: 100,  production: 5,  maintenanceCost: 20 },
    wind:    { name: 'Eólica',  icon: '💨', cost: 200,  production: 10, maintenanceCost: 30 },
    hydro:   { name: 'Hidro',   icon: '💧', cost: 500,  production: 25, maintenanceCost: 50 },
    nuclear: { name: 'Nuclear', icon: '☢️', cost: 1000, production: 50, maintenanceCost: 100 },
    battery: { name: 'Batería', icon: '🔋', cost: 300,  production: 0,  maintenanceCost: 15 }
  };

  // 🔹 Versión segura para iterar en la plantilla
  get energySourcesEntries() {
    return Object.entries(this.energySourcesUI).map(([key, value]) => ({ key, value }));
  }

  powerLines: any[] = [];

  constructor(private router: Router) {}

  ngOnInit(): void {
    this.initScene();
  }

  ngOnDestroy(): void {
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    if (this.renderer) this.renderer.dispose();
  }

  // 🔹 Inicializa la escena de Three.js
  private initScene(): void {
    const container = this.canvasRef.nativeElement;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);

    this.camera = new THREE.PerspectiveCamera(
      75,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 5, 10);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(this.renderer.domElement);

    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(10, 10, 10);
    this.scene.add(light);

    const cube = new THREE.Mesh(
      new THREE.BoxGeometry(2, 2, 2),
      new THREE.MeshStandardMaterial({ color: 0x00ff00 })
    );
    this.scene.add(cube);

    const animate = () => {
      cube.rotation.x += 0.01;
      cube.rotation.y += 0.01;
      this.renderer.render(this.scene, this.camera);
      this.animationFrameId = requestAnimationFrame(animate);
    };
    animate();
  }

  // 🔹 Navegar al menú principal
  goToMenu(): void {
    this.router.navigate(['/niveles']);
  }

  // 🔹 Seleccionar tipo de fuente
  selectSource(sourceKey: string): void {
    this.selectedSource = this.selectedSource === sourceKey ? '' : sourceKey;
  }

  // 🔹 Mantenimiento
  performMaintenance(x: number, z: number, source?: any): void {
    console.log('Mantenimiento aplicado a', x, z, source);
  }

  // 🔹 Detecta cables ineficientes
  hasInefficientCables(): boolean {
    return false;
  }
}
