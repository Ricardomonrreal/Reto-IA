import { Component, OnInit, OnDestroy, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Router } from '@angular/router';

interface EnergySource {
  name: string;
  icon: string;
  cost: number;
  production: number;
  emissions: number;
  color: number;
  height: number;
  maintenanceCost: number;
  degradationRate: number;
}

interface BuildingUI {
  icon: string;
  name: string;
  cost: number;
  production: number;
}

interface Consumer {
  x: number;
  z: number;
  demand: number;
  connected: boolean;
}

interface PlacedSource {
  type: string;
  x: number;
  z: number;
  health: number;
  lastMaintenance: number;
  efficiency: number;
  bonusEfficiency?: number;
  bonusExpiresAt?: number;
  isUnderMaintenance?: boolean;
  maintenanceEndsAt?: number;
}

interface PowerLine {
  from: { x: number, z: number };
  to: { x: number, z: number };
  distance: number;
  efficiency: number;
}

interface MaintenanceType {
  name: string;
  icon: string;
  healthRestore: number;
  costMultiplier: number;
  duration: number;
  bonusEfficiency?: number;
}

@Component({
  selector: 'app-energy-grid',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './energy-grid.component.html',
  styleUrls: ['./energy-grid.component.css']
})
export class EnergyGridComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('renderCanvas', { static: true })
  private canvasRef!: ElementRef<HTMLDivElement>;
  
  constructor(private router: Router) {}
  
  private isOverUI = false;
  gameOver = false;
  gameOverReason = '';
  
  goToMenu() {
    this.router.navigate(['/niveles']);
  }

  // ===== ESTADO DEL JUEGO =====
  money = 5000;
  selectedSource = 'solar';
  isConnecting = false;
  connectionStart: { x: number, z: number } | null = null;
  selectedMaintenanceType: 'basic' | 'standard' | 'premium' | null = null;

  // ===== UI DATA =====
  energySourcesUI: { [key: string]: BuildingUI } = {
    solar: { icon: '☀️', name: 'PANEL SOLAR', cost: 150, production: 50 },
    wind: { icon: '💨', name: 'AEROGENERADOR', cost: 300, production: 120 },
    hydro: { icon: '💧', name: 'HIDROELÉCTRICA', cost: 500, production: 200 },
    battery: { icon: '🔋', name: 'BATERÍA', cost: 200, production: 0 },
    nuclear: { icon: '☢️', name: 'NUCLEAR', cost: 2000, production: 500 }
  };

  maintenanceTypes: Record<'basic' | 'standard' | 'premium', MaintenanceType> = {
    basic: {
      name: 'Básico',
      icon: '🔧',
      healthRestore: 50,
      costMultiplier: 0.5,
      duration: 2000
    },
    standard: {
      name: 'Estándar',
      icon: '⚙️',
      healthRestore: 100,
      costMultiplier: 1.0,
      duration: 3000
    },
    premium: {
      name: 'Premium',
      icon: '✨',
      healthRestore: 100,
      costMultiplier: 1.5,
      duration: 4000,
      bonusEfficiency: 0.1
    }
  };

  // ===== THREE.JS =====
  private gltfLoader = new GLTFLoader();
  private scene!: THREE.Scene;
  private camera!: THREE.OrthographicCamera;
  private renderer!: THREE.WebGLRenderer;
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private groundGroup = new THREE.Group();
  private sourcesGroup = new THREE.Group();
  private consumersGroup = new THREE.Group();
  private linesGroup = new THREE.Group();
  private hoverPreview: THREE.Mesh | null = null;
  private animationId?: number;

  // ===== CONFIGURACIÓN =====
  private readonly gridSize = 30;
  private readonly cellSize = 2;
  private gridData: (string | null)[][] = [];
  private consumers: Consumer[] = [];
  powerLines: PowerLine[] = [];
  private clouds: THREE.Object3D[] = [];
  private cloudCount = 50;
  private cloudSpeed = 0.02;

  placedSources: PlacedSource[] = [];

  get criticalSources(): number {
    return this.placedSources.filter(s => s.health < 30 && !s.isUnderMaintenance).length;
  }

  get warningSources(): number {
    return this.placedSources.filter(s => s.health >= 30 && s.health < 60 && !s.isUnderMaintenance).length;
  }

  get healthySources(): number {
    return this.placedSources.filter(s => s.health >= 60 && !s.isUnderMaintenance).length;
  }

  hasInefficientCables(): boolean {
    return this.powerLines.some(line => line.efficiency < 0.6);
  }

  get sourcesInMaintenance(): number {
    return this.placedSources.filter(s => s.isUnderMaintenance).length;
  }

  get sourcesWithBonus(): number {
    return this.placedSources.filter(s => s.bonusEfficiency && !s.isUnderMaintenance).length;
  }

  private readonly degradationInterval = 1000;
  private lastDegradationUpdate = 0;
  private readonly distanceLossFactor = 0.02;
  private readonly maxDistance = 15;

  // ===== ESTADÍSTICAS =====
  totalProduction = 0;
  totalConsumption = 0;
  totalEmissions = 0;

  // ===== CÁMARA =====
  private isPanning = false;
  private lastMousePosition = { x: 0, y: 0 };

  // ===== CONFIGURACIÓN DETALLADA DE FUENTES =====
  energySources: { [key: string]: EnergySource } = {
    solar: { 
      name: 'Solar', 
      icon: '☀️', 
      cost: 150, 
      production: 50, 
      emissions: 0, 
      color: 0xFFD700, 
      height: 1.5,
      maintenanceCost: 50,
      degradationRate: 0.015
    },
    wind: { 
      name: 'Eólica', 
      icon: '💨', 
      cost: 300, 
      production: 120, 
      emissions: 0, 
      color: 0xE0E0E0, 
      height: 4,
      maintenanceCost: 80,
      degradationRate: 0.02
    },
    hydro: { 
      name: 'Hidro', 
      icon: '💧', 
      cost: 500, 
      production: 200, 
      emissions: 0, 
      color: 0x4169E1, 
      height: 2.5,
      maintenanceCost: 100,
      degradationRate: 0.01
    },
    battery: { 
      name: 'Batería', 
      icon: '🔋', 
      cost: 200, 
      production: 0, 
      emissions: 0, 
      color: 0x32CD32, 
      height: 1.8,
      maintenanceCost: 30,
      degradationRate: 0.025
    },
    nuclear: { 
      name: 'Nuclear', 
      icon: '☢️', 
      cost: 2000, 
      production: 500, 
      emissions: 250, 
      color: 0x556B2F, 
      height: 6.0,
      maintenanceCost: 200,
      degradationRate: 0.005
    }
  };

  // ===== ECONOMÍA =====
  private lastEconomyUpdate = 0;
  private readonly economyInterval = 3000;
  private readonly moneyChangeRate = 0.01;

  ngOnInit(): void {
    this.initGrid();
    this.initScene();
    this.createGround();
    this.createClouds();
    this.createConsumers();
    this.updateNetworkState();
    this.animate();
    this.addEventListeners();
  }

  // ✅ MEJORA: Mover lógica de UI a AfterViewInit
  ngAfterViewInit(): void {
    this.preventUIEventPropagation();
    this.setupScrollIndicator();
  }

  ngOnDestroy(): void {
    this.removeEventListeners();
    if (this.animationId) cancelAnimationFrame(this.animationId);
    this.renderer?.dispose();
  }

  selectMaintenanceType(type: 'basic' | 'standard' | 'premium'): void {
    this.selectedMaintenanceType = type;
    this.isConnecting = false;
    this.selectedSource = 'maintenance';
    this.connectionStart = null;
  }

  selectMaintenanceTypeFromString(type: string): void {
    if (type === 'basic' || type === 'standard' || type === 'premium') {
      this.selectMaintenanceType(type);
    }
  }

  getMaintenanceCost(sourceType: string, maintenanceType: 'basic' | 'standard' | 'premium'): number {
    const source = this.energySources[sourceType];
    const maintenance = this.maintenanceTypes[maintenanceType];
    return Math.round(source.maintenanceCost * maintenance.costMultiplier);
  }

  // ===== NUBES =====
  private createClouds(): void {
    for (let i = 0; i < this.cloudCount; i++) {
      const cloud = new THREE.Group();

      const sphereCount = 5 + Math.floor(Math.random() * 2);
      for (let j = 0; j < sphereCount; j++) {
        const radius = 1 + Math.random() * 2;
        const geometry = new THREE.SphereGeometry(radius, 5, 5);
        const material = new THREE.MeshLambertMaterial({
          color: '#FFFFFF',
          transparent: true,
          opacity: 0.7,
        });
        const sphere = new THREE.Mesh(geometry, material);

        sphere.position.set(
          (Math.random() - 0.5) * 4, 
          (Math.random() - 0.5) * 2, 
          (Math.random() - 0.5) * 4
        );

        cloud.add(sphere);
      }

      cloud.position.set(
        (Math.random() - 0.5) * this.gridSize * this.cellSize,
        18 + Math.random() * 20,
        (Math.random() - 0.5) * this.gridSize * this.cellSize
      );

      this.scene.add(cloud);
      this.clouds.push(cloud);
    }
  }

  // ===== INICIALIZACIÓN =====
  private initGrid(): void {
    this.gridData = Array(this.gridSize).fill(null).map(() => Array(this.gridSize).fill(null));
  }

  private initScene(): void {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87CEEB);

    const aspect = window.innerWidth / window.innerHeight;
    const d = 10;
    this.camera = new THREE.OrthographicCamera(
      -d * aspect, d * aspect, d, -d, 1, 1000
    );

    this.camera.zoom = 0.7;
    this.camera.updateProjectionMatrix();
    this.camera.position.set(-20, 20, -20);
    this.camera.lookAt(1, 0, 1);

    this.renderer = new THREE.WebGLRenderer({ antialias: false });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.canvasRef.nativeElement.appendChild(this.renderer.domElement);

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

    this.scene.add(this.groundGroup);
    this.scene.add(this.sourcesGroup);
    this.scene.add(this.consumersGroup);
    this.scene.add(this.linesGroup);
  }

  private createGround(): void {
    const baseColor = new THREE.Color('#ace45d')
    
    for (let x = 0; x < this.gridSize; x++) {
      for (let z = 0; z < this.gridSize; z++) {
        const geometry = new THREE.BoxGeometry(this.cellSize * 1, 0.5, this.cellSize * 1);
        const color = baseColor.clone();
        color.offsetHSL(0, 0, (Math.random() - 0.6) * 0.2);
        
        const material = new THREE.MeshLambertMaterial({ color });
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

  private createFallbackHouse(x: number, z: number): void {
    const houseGroup = new THREE.Group();
    
    const wallGeometry = new THREE.BoxGeometry(1.5, 1.5, 1.5);
    const wallMaterial = new THREE.MeshLambertMaterial({ 
      color: 0xE0E0E0,
      emissive: 0xFF0000,
      emissiveIntensity: 0.2
    });
    const walls = new THREE.Mesh(wallGeometry, wallMaterial);
    walls.position.y = 1;
    walls.castShadow = true;
    walls.receiveShadow = true;
    houseGroup.add(walls);
    
    const roofGeometry = new THREE.ConeGeometry(1.2, 1, 4);
    const roofMaterial = new THREE.MeshLambertMaterial({ color: 0xD2691E });
    const roof = new THREE.Mesh(roofGeometry, roofMaterial);
    roof.rotation.y = Math.PI / 4;
    roof.position.y = 2.25;
    roof.castShadow = true;
    houseGroup.add(roof);
    
    const groundHeight = 0.5;
    houseGroup.position.set(
      x * this.cellSize - this.gridSize * this.cellSize / 2 + this.cellSize / 2,
      groundHeight / 2,
      z * this.cellSize - this.gridSize * this.cellSize / 2 + this.cellSize / 2
    );
    
    houseGroup.userData = { type: 'consumer', x, z };
    this.consumersGroup.add(houseGroup);
  }

  private createConsumers(): void {
    const numConsumers = 10;
    const usedPositions = new Set<string>();

    const houseModels = [
      'assets/energy/texturas/building-type-q.glb',
      'assets/energy/texturas/building-type-s.glb',
      'assets/energy/texturas/building-type-m.glb',
      'assets/energy/texturas/building-type-f.glb'
    ];

    for (let i = 0; i < numConsumers; i++) {
      let x: number, z: number, posKey: string;
      
      do {
        x = Math.floor(Math.random() * (this.gridSize - 4)) + 2;
        z = Math.floor(Math.random() * (this.gridSize - 4)) + 2;
        posKey = `${x},${z}`;
      } while (usedPositions.has(posKey) || this.gridData[x][z] !== null);
      
      usedPositions.add(posKey);
      
      const demand = 40 + Math.floor(Math.random() * 60);
      this.consumers.push({ x, z, demand, connected: false });
      
      const randomModel = houseModels[Math.floor(Math.random() * houseModels.length)];

      this.gltfLoader.load(
        randomModel,
        (gltf) => {
          const house = gltf.scene;
          
          house.scale.set(1.5, 1.5, 1.5);
          
          const groundHeight = 0.5;
          house.position.set(
            x * this.cellSize - this.gridSize * this.cellSize / 2 + this.cellSize / 2,
            groundHeight / 2,
            z * this.cellSize - this.gridSize * this.cellSize / 2 + this.cellSize / 2
          );

          house.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.castShadow = true;
              child.receiveShadow = true;
              
              if (child.material instanceof THREE.MeshStandardMaterial) {
                child.material.emissiveIntensity = 0.2;
              }
            }
          });

          house.userData = { type: 'consumer', x, z };
          this.consumersGroup.add(house);
        },
        undefined,
        (error) => {
          console.error('Error cargando modelo de casa:', randomModel, error);
          this.createFallbackHouse(x, z);
        }
      );

      this.createLabel(x, z, `${demand}kW`, 0xFFD700);
    }

    this.updateStats();
  }

private createLabel(x: number, z: number, text: string, color: number): void {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, 128, 64);
    ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(text, 64, 40);
    
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(material);
    
    sprite.position.set(
      x * this.cellSize - this.gridSize * this.cellSize / 2 + this.cellSize / 2,
      3,
      z * this.cellSize - this.gridSize * this.cellSize / 2 + this.cellSize / 2
    );
    sprite.scale.set(2, 1, 1);
    
    this.consumersGroup.add(sprite);
  }

  private createSource3D(type: string, x: number, z: number): void {
    let modelUrl = '';
    switch(type) {
      case 'solar': modelUrl = 'assets/energy/texturas/wall-corner-diagonal.glb'; break;
      case 'wind': modelUrl = 'assets/energy/texturas/windmill.glb'; break;
      case 'hydro': modelUrl = 'assets/energy/texturas/watermill.glb'; break;
      case 'battery': modelUrl = 'assets/energy/texturas/detail-tank.glb'; break;
      case 'nuclear': modelUrl = 'assets/energy/texturas/chimney-large.glb'; break;
    }

    this.gltfLoader.load(
      modelUrl,
      (gltf) => {
        const model = gltf.scene;
        
        const scales: { [key: string]: number } = {
          solar: 1.2,
          wind: 2.0,
          hydro: 1.0,
          battery: 1.3,
          nuclear: 2.5
        };
        
        const scale = scales[type] || 1.5;
        model.scale.set(scale, scale, scale);
        
        if (type === 'wind') {
          model.rotation.x = Math.PI / 2;
          model.position.y = 2;
        }
        
        const groundHeight = 0.5;
        model.position.set(
          x * this.cellSize - this.gridSize * this.cellSize / 2 + this.cellSize / 2,
          model.position.y || groundHeight / 2,
          z * this.cellSize - this.gridSize * this.cellSize / 2 + this.cellSize / 2
        );

        model.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        model.userData = { gridX: x, gridZ: z, type };
        this.sourcesGroup.add(model);
      },
      undefined,
      (error) => {
        console.error(`Error cargando modelo GLB para ${type}:`, error);
        this.createFallbackSource3D(type, x, z, this.energySources[type]);
      }
    );
  }

  private createFallbackSource3D(type: string, x: number, z: number, source: EnergySource): void {
    let geometry: THREE.BufferGeometry;
    
    if (type === 'wind') {
      geometry = new THREE.CylinderGeometry(0.3, 0.5, source.height, 6);
    } else if (type === 'solar') {
      geometry = new THREE.BoxGeometry(1.5, 0.2, 1.5);
    } else {
      geometry = new THREE.BoxGeometry(1.2, source.height, 1.2);
    }
    
    const material = new THREE.MeshLambertMaterial({ 
      color: source.color,
      emissive: source.color,
      emissiveIntensity: 0.3
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    const groundHeight = 0.5;
    mesh.position.set(
      x * this.cellSize - this.gridSize * this.cellSize / 2 + this.cellSize / 2,
      type === 'solar' ? groundHeight / 2 + 0.1 : source.height / 2 + groundHeight / 2,
      z * this.cellSize - this.gridSize * this.cellSize / 2 + this.cellSize / 2
    );
    
    mesh.castShadow = true;
    mesh.userData = { gridX: x, gridZ: z, type };
    this.sourcesGroup.add(mesh);
  }

  private getCellKey(x: number, z: number): string {
    return `${x},${z}`;
  }

  private isEntityAt(x: number, z: number): boolean {
    return !!this.gridData[x][z] || !!this.consumers.find(c => c.x === x && c.z === z);
  }

  private connectPowerLine(x: number, z: number): void {
    if (!this.isEntityAt(x, z)) return;

    if (!this.connectionStart) {
      this.connectionStart = { x, z };
    } else {
      if (x !== this.connectionStart.x || z !== this.connectionStart.z) {
        const distance = Math.abs(x - this.connectionStart.x) + Math.abs(z - this.connectionStart.z);
        const efficiency = Math.max(0.3, 1 - (distance * this.distanceLossFactor));
        
        this.createPowerLine(this.connectionStart.x, this.connectionStart.z, x, z);
        this.powerLines.push({ 
          from: this.connectionStart, 
          to: { x, z },
          distance: distance,
          efficiency: efficiency
        });
        this.updateNetworkState();
      }
      this.connectionStart = null;
    }
  }

  private createEfficiencyLabel(x1: number, z1: number, x2: number, z2: number, efficiency: number): void {
    const midX = (x1 + x2) / 2;
    const midZ = (z1 + z2) / 2;
    
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, 128, 64);
    
    const effPercent = Math.round(efficiency * 100);
    ctx.fillStyle = efficiency > 0.6 ? '#FFFF00' : '#FF0000';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`${effPercent}%`, 64, 40);
    
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(material);
    
    sprite.position.set(
      midX * this.cellSize - this.gridSize * this.cellSize / 2 + this.cellSize / 2,
      2,
      midZ * this.cellSize - this.gridSize * this.cellSize / 2 + this.cellSize / 2
    );
    sprite.scale.set(1.5, 0.75, 1);
    sprite.userData = { isEfficiencyLabel: true };
    
    this.linesGroup.add(sprite);
  }

  private createPowerLine(x1: number, z1: number, x2: number, z2: number): void {
    const pos1 = new THREE.Vector3(
      x1 * this.cellSize - this.gridSize * this.cellSize / 2 + this.cellSize / 2, 1,
      z1 * this.cellSize - this.gridSize * this.cellSize / 2 + this.cellSize / 2
    );
    
    const pos2 = new THREE.Vector3(
      x2 * this.cellSize - this.gridSize * this.cellSize / 2 + this.cellSize / 2, 1,
      z2 * this.cellSize - this.gridSize * this.cellSize / 2 + this.cellSize / 2
    );
    
    const distance = Math.abs(x2 - x1) + Math.abs(z2 - z1);
    const efficiency = Math.max(0.3, 1 - (distance * this.distanceLossFactor));
    
    let lineColor = 0x00FF00;
    if (efficiency < 0.8) lineColor = 0xFFFF00;
    if (efficiency < 0.6) lineColor = 0xFF6600;
    if (efficiency < 0.4) lineColor = 0xFF0000;
    
    const geometry = new THREE.BufferGeometry().setFromPoints([pos1, pos2]);
    const material = new THREE.LineBasicMaterial({ color: lineColor, linewidth: 3 });
    const line = new THREE.Line(geometry, material);
    
    line.userData = { 
      isPowerLine: true, 
      from: {x: x1, z: z1}, 
      to: {x: x2, z: z2},
      distance: distance,
      efficiency: efficiency
    };
    
    this.linesGroup.add(line);
    
    if (efficiency < 0.8) {
      this.createEfficiencyLabel(x1, z1, x2, z2, efficiency);
    }
  }

  private updateNetworkState(): void {
    this.consumers.forEach(c => c.connected = false);

    const connectedNodes: Set<string> = new Set();
    this.powerLines.forEach(line => {
      connectedNodes.add(this.getCellKey(line.from.x, line.from.z));
      connectedNodes.add(this.getCellKey(line.to.x, line.to.z));
    });

    this.consumers.forEach(consumer => {
      if (connectedNodes.has(this.getCellKey(consumer.x, consumer.z))) {
        consumer.connected = true;
      }
    });

    this.consumersGroup.children.forEach(mesh => {
      const consumerData = this.consumers.find(c => c.x === mesh.userData['x'] && c.z === mesh.userData['z']);
      if (consumerData && mesh instanceof THREE.Mesh) {
        const meshMaterial = mesh.material as THREE.MeshLambertMaterial;
        meshMaterial.emissive = new THREE.Color(consumerData.connected ? 0x00FF00 : 0xFF0000);
        meshMaterial.emissiveIntensity = consumerData.connected ? 0.4 : 0.2;
      }
    });

    this.updateStats();
  }

  // ✅ MEJORA: Prevenir propagación sin setTimeout
  private preventUIEventPropagation(): void {
    const uiPanels = [
      '.ui-panel',
      '.instructions-panel',
      '.maintenance-cost-table',
      '.health-panel',
      '.alert-panel',
      '.notifications-container',
      '.action-indicator',
      '.help-tooltip',
      '.boton-volver-container'
    ];

    uiPanels.forEach(selector => {
      const panel = document.querySelector(selector) as HTMLElement;
      if (panel) {
        panel.addEventListener('wheel', (e: WheelEvent) => {
          e.stopPropagation();
          const hasScroll = panel.scrollHeight > panel.clientHeight;
          if (!hasScroll) {
            e.preventDefault();
          }
        }, { passive: false });

        panel.addEventListener('mousedown', (e: MouseEvent) => e.stopPropagation());
        panel.addEventListener('mouseup', (e: MouseEvent) => e.stopPropagation());
        panel.addEventListener('click', (e: MouseEvent) => e.stopPropagation());

        panel.addEventListener('mousemove', (e: MouseEvent) => {
          if (e.buttons > 0) {
            e.stopPropagation();
          }
        });

        panel.addEventListener('mouseenter', () => {
          this.isOverUI = true;
        });

        panel.addEventListener('mouseleave', () => {
          this.isOverUI = false;
        });
      }
    });
  }

  private updateStats(): void {
    this.totalProduction = 0;
    this.totalEmissions = 0;
    
    const now = Date.now();
    
    this.placedSources.forEach(placedSource => {
      const source = this.energySources[placedSource.type];
      
      if (placedSource.bonusExpiresAt && now > placedSource.bonusExpiresAt) {
        placedSource.bonusEfficiency = undefined;
        placedSource.bonusExpiresAt = undefined;
      }
      
      let totalEfficiency = placedSource.efficiency;
      if (placedSource.bonusEfficiency && !placedSource.isUnderMaintenance) {
        totalEfficiency += placedSource.bonusEfficiency;
        totalEfficiency = Math.min(1.2, totalEfficiency);
      }
      
      if (placedSource.isUnderMaintenance) {
        totalEfficiency = 0;
      }
      
      let production = source.production * totalEfficiency;
      
      const connectedLine = this.powerLines.find(
        line => (line.from.x === placedSource.x && line.from.z === placedSource.z) ||
                (line.to.x === placedSource.x && line.to.z === placedSource.z)
      );
      
      if (connectedLine) {
        production *= connectedLine.efficiency;
      }
      
      this.totalProduction += production;
      this.totalEmissions += source.emissions * totalEfficiency;
    });

    this.totalConsumption = this.consumers
      .filter(c => c.connected)
      .reduce((sum, c) => sum + c.demand, 0);
  }

  private updateEconomy(): void {
    const now = Date.now();
    if (now - this.lastEconomyUpdate < this.economyInterval) return;
    this.lastEconomyUpdate = now;

    const balance = this.energyBalance;

    if (balance < 0) {
      const deficit = Math.abs(balance);
      this.money -= deficit * this.moneyChangeRate;
      this.money = Math.max(0, Math.round(this.money * 100) / 100);
    } else if (balance > 0) {
      this.money += balance * this.moneyChangeRate;
      this.money = Math.round(this.money * 100) / 100;
    }
  }

  get energyBalance(): number {
    return this.totalProduction - this.totalConsumption;
  }

  get balanceColor(): string {
    return this.energyBalance >= 0 ? '#00ff00' : '#ff0000';
  }

  get efficiencyPercent(): number {
    if (this.totalConsumption === 0) return 0;
    return Math.min(100, Math.round((this.totalProduction / this.totalConsumption) * 100));
  }

  selectSource(type: string): void {
    if (type === 'cable') {
      this.isConnecting = true;
      this.selectedSource = 'cable';
      this.connectionStart = null;
      this.selectedMaintenanceType = null;
    } else if (type === 'eraser') {
      this.isConnecting = false;
      this.selectedSource = 'eraser';
      this.connectionStart = null;
      this.selectedMaintenanceType = null;
    } else {
      this.isConnecting = false;
      this.selectedSource = type;
      this.connectionStart = null;
      this.selectedMaintenanceType = null;
    }
  }

  private placeEnergySource(x: number, z: number): void {
    if (this.gridData[x][z]) return;
    
    const source = this.energySources[this.selectedSource];
    if (!source) return;

    if (this.money < source.cost) {
      console.log(`💸 Necesitas ${source.cost}€ (tienes ${this.money}€)`);
      return;
    }

    this.money -= source.cost;
    this.money = Math.round(this.money * 100) / 100;

    this.gridData[x][z] = this.selectedSource;
    
    this.placedSources.push({
      type: this.selectedSource,
      x: x,
      z: z,
      health: 100,
      lastMaintenance: Date.now(),
      efficiency: 1.0
    });
    
    this.createSource3D(this.selectedSource, x, z);
    this.updateNetworkState();
  }

  private removeSource(x: number, z: number): void {
    if (!this.gridData[x][z]) return;

    const sourceToRemove = this.sourcesGroup.children.find(
      child => child.userData['gridX'] === x && child.userData['gridZ'] === z
    );

    if (sourceToRemove) {
      this.sourcesGroup.remove(sourceToRemove);
      
      sourceToRemove.traverse(child => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach(mat => mat.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
    }

    const index = this.placedSources.findIndex(s => s.x === x && s.z === z);
    if (index !== -1) {
      this.placedSources.splice(index, 1);
    }

    this.gridData[x][z] = null;
    this.updateNetworkState();
  }

  private updateDegradation(): void {
    const now = Date.now();
    if (now - this.lastDegradationUpdate < this.degradationInterval) return;
    
    const deltaTime = (now - this.lastDegradationUpdate) / 1000;
    this.lastDegradationUpdate = now;
    
    this.placedSources.forEach(source => {
      if (source.isUnderMaintenance) return;
      
      const sourceConfig = this.energySources[source.type];
      if (!sourceConfig.degradationRate) return;
      
      source.health -= sourceConfig.degradationRate * deltaTime * 100;
      source.health = Math.max(0, source.health);
      
      source.efficiency = source.health / 100;
      
      this.updateSourceVisual(source);
    });
  }

  // ✅ MEJORA: Visual actualizado con limpieza de humo
  private updateSourceVisual(source: PlacedSource): void {
    const model = this.sourcesGroup.children.find(
      child => child.userData['gridX'] === source.x && child.userData['gridZ'] === source.z
    );
    
    if (!model) return;
    
    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const material = child.material as THREE.MeshLambertMaterial;
        
        if (source.isUnderMaintenance) {
          // ✅ MEJORA: Pulso más suave
          const pulse = Math.sin(Date.now() * 0.003) * 0.3 + 0.5;
          material.emissive = new THREE.Color(0xFFFF00);
          material.emissiveIntensity = 0.2 + pulse * 0.2;
        }
        else if (source.bonusEfficiency) {
          material.emissive = new THREE.Color(0x00AAFF);
          material.emissiveIntensity = 0.4;
        }
        else if (source.health < 30) {
          material.emissive = new THREE.Color(0xFF0000);
          material.emissiveIntensity = 0.5;
        } else if (source.health < 60) {
          material.emissive = new THREE.Color(0xFFAA00);
          material.emissiveIntensity = 0.3;
        } else {
          material.emissive = new THREE.Color(0x00FF00);
          material.emissiveIntensity = 0.1;
        }
      }
    });
    
    // Agregar humo si está crítico
    if (source.health < 30 && !source.isUnderMaintenance && !model.userData['hasSmoke']) {
      this.addSmokeParticles(source.x, source.z, model);
      model.userData['hasSmoke'] = true;
    }
    
    // ✅ MEJORA: Limpiar humo cuando mejora la salud
    if (source.health >= 30 && model.userData['hasSmoke']) {
      const smoke = model.children.find(child => child.userData['isSmoke']);
      if (smoke) {
        smoke.children.forEach(particle => {
          if (particle instanceof THREE.Mesh) {
            particle.geometry.dispose();
            (particle.material as THREE.Material).dispose();
          }
        });
        model.remove(smoke);
        model.userData['hasSmoke'] = false;
      }
    }
  }

  private addSmokeParticles(x: number, z: number, parent: THREE.Object3D): void {
    const particleCount = 20;
    const particles = new THREE.Group();
    
    for (let i = 0; i < particleCount; i++) {
      const geometry = new THREE.SphereGeometry(0.1, 4, 4);
      const material = new THREE.MeshBasicMaterial({ 
        color: 0x555555, 
        transparent: true, 
        opacity: 0.6 
      });
      const particle = new THREE.Mesh(geometry, material);
      
      particle.position.set(
        (Math.random() - 0.5) * 0.5,
        Math.random() * 2,
        (Math.random() - 0.5) * 0.5
      );
      
      particle.userData = { 
        velocity: { y: 0.01 + Math.random() * 0.02 },
        opacity: 0.6
      };
      
      particles.add(particle);
    }
    
    particles.userData = { isSmoke: true };
    parent.add(particles);
  }

  // ✅ MEJORA: Mantenimiento con mejor feedback
  performMaintenance(x: number, z: number, maintenanceType: 'basic' | 'standard' | 'premium'): void {
    const source = this.placedSources.find(s => s.x === x && s.z === z);
    if (!source) {
      console.log('⚠️ No hay fuente en esta posición');
      return;
    }
    
    const sourceConfig = this.energySources[source.type];
    const maintenance = this.maintenanceTypes[maintenanceType];
    const cost = this.getMaintenanceCost(source.type, maintenanceType);
    
    if (this.money < cost) {
      console.log(`💸 Necesitas ${cost}€ (tienes ${this.money}€)`);
      return;
    }
    
    if (source.isUnderMaintenance) {
      console.log('⏳ Esta fuente ya está en mantenimiento');
      return;
    }
    
    this.money -= cost;
    this.money = Math.round(this.money * 100) / 100;
    
    source.isUnderMaintenance = true;
    source.maintenanceEndsAt = Date.now() + maintenance.duration;
    
    console.log(`⏳ Mantenimiento ${maintenance.name} iniciado en ${sourceConfig.icon} (${x},${z})...`);
    
    setTimeout(() => {
      const newHealth = Math.min(100, source.health + maintenance.healthRestore);
      source.health = newHealth;
      source.efficiency = source.health / 100;
      source.lastMaintenance = Date.now();
      source.isUnderMaintenance = false;
      source.maintenanceEndsAt = undefined;
      
      if (maintenance.bonusEfficiency) {
        source.bonusEfficiency = maintenance.bonusEfficiency;
        source.bonusExpiresAt = Date.now() + 30000;
      }
      
      this.updateSourceVisual(source);
      
      const model = this.sourcesGroup.children.find(
        child => child.userData['gridX'] === x && child.userData['gridZ'] === z
      );
      
      if (model) {
        const smoke = model.children.find(child => child.userData['isSmoke']);
        if (smoke) {
          model.remove(smoke);
          model.userData['hasSmoke'] = false;
        }
      }
      
      console.log(`✅ Mantenimiento ${maintenance.name} completado en (${x},${z})`);
    }, maintenance.duration);
  }

  // ✅ MEJORA: Múltiples condiciones de Game Over
  private checkGameOverConditions(): void {
    if (this.gameOver) return;

    // 1. Fuente quemada
    const burnedSources = this.placedSources.filter(s => s.health <= 0);
    if (burnedSources.length > 0) {
      const source = burnedSources[0];
      this.gameOverReason = `¡La fuente ${this.energySources[source.type].icon} ${this.energySources[source.type].name} en (${source.x}, ${source.z}) se quemó completamente!`;
      this.triggerGameOver();
      return;
    }
    
    // 2. Sin dinero y déficit crítico
    if (this.money <= 0 && this.energyBalance < -200) {
      this.gameOverReason = '¡Te quedaste sin dinero con un déficit energético crítico! 💸⚡';
      this.triggerGameOver();
      return;
    }
    
    // 3. Todas las fuentes en estado crítico
    if (this.placedSources.length > 0 && 
        this.placedSources.every(s => s.health < 20 && !s.isUnderMaintenance)) {
      this.gameOverReason = '¡Todas tus fuentes de energía están en estado crítico! 🔥';
      this.triggerGameOver();
      return;
    }
  }

  private triggerGameOver(): void {
    this.gameOver = true;
    
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    
    this.applyGameOverVisuals();
    
    console.log('💀 GAME OVER:', this.gameOverReason);
  }

  private applyGameOverVisuals(): void {
    this.scene.background = new THREE.Color(0x330000);
    
    this.sourcesGroup.children.forEach(child => {
      child.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          const material = obj.material as THREE.MeshLambertMaterial;
          material.emissive = new THREE.Color(0xFF0000);
          material.emissiveIntensity = 0.8;
        }
      });
    });
    
    this.renderer.render(this.scene, this.camera);
  }

  restartGame(): void {
    this.sourcesGroup.clear();
    this.linesGroup.clear();
    
    this.gameOver = false;
    this.gameOverReason = '';
    this.money = 5000;
    this.placedSources = [];
    this.powerLines = [];
    this.gridData = Array(this.gridSize).fill(null).map(() => Array(this.gridSize).fill(null));
    
    this.scene.background = new THREE.Color(0x87CEEB);
    
    this.animate();
    
    console.log('🔄 Juego reiniciado');
  }

  private setupScrollIndicator(): void {
    const panel = document.querySelector('.ui-panel') as HTMLElement;
    if (panel) {
      const checkScroll = () => {
        if (panel.scrollHeight > panel.clientHeight) {
          panel.classList.add('has-scroll');
        } else {
          panel.classList.remove('has-scroll');
        }
      };
      
      checkScroll();
      panel.addEventListener('scroll', checkScroll);
      window.addEventListener('resize', checkScroll);
    }
  }

  private clampCameraPosition(): void {
    const halfMap = (this.gridSize * this.cellSize) / 2;
    this.camera.position.x = THREE.MathUtils.clamp(this.camera.position.x, -halfMap, halfMap);
    this.camera.position.z = THREE.MathUtils.clamp(this.camera.position.z, -halfMap, halfMap);
  }

  private onMouseMove = (event: MouseEvent): void => {
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    if (this.hoverPreview) {
      this.scene.remove(this.hoverPreview);
      this.hoverPreview = null;
    }

    if (this.isPanning && (event.buttons & 4 || event.buttons & 2)) {
      const deltaX = event.clientX - this.lastMousePosition.x;
      const deltaY = event.clientY - this.lastMousePosition.y;

      const panFactor = 0.005 / this.camera.zoom;
      this.camera.position.x -= deltaX * panFactor * this.camera.right;
      this.camera.position.z -= deltaY * panFactor * this.camera.top;

      this.clampCameraPosition();
      this.lastMousePosition = { x: event.clientX, y: event.clientY };
    }

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.groundGroup.children);

    if (intersects.length > 0) {
      const cell = intersects[0].object as THREE.Mesh;
      const { gridX, gridZ } = cell.userData;
      
      if (!this.isConnecting && this.selectedSource !== 'eraser' && 
          this.selectedSource !== 'maintenance' && !this.gridData[gridX][gridZ]) {
        this.showHoverPreview(gridX, gridZ);
      }
    }
  };

  // ✅ MEJORA: Prevenir clicks sobre UI
  private onClick = (event: MouseEvent): void => {
    if (this.isOverUI) {
      return;
}

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.groundGroup.children);

    if (intersects.length > 0) {
      const cell = intersects[0].object as THREE.Mesh;
      const { gridX, gridZ } = cell.userData;

      if (this.selectedSource === 'maintenance' && this.selectedMaintenanceType) {
        if (this.gridData[gridX][gridZ]) {
          this.performMaintenance(gridX, gridZ, this.selectedMaintenanceType);
          return;
        } else {
          console.log('⚠️ No hay ninguna fuente en esta posición para mantener');
          return;
        }
      }

      if (this.isConnecting) {
        this.connectPowerLine(gridX, gridZ);
      } else if (this.selectedSource === 'eraser') {
        this.removeSource(gridX, gridZ);
      } else if (this.selectedSource !== 'maintenance') {
        this.placeEnergySource(gridX, gridZ);
      }
    }
  };

  private showHoverPreview(x: number, z: number): void {
    const source = this.energySources[this.selectedSource];
    const previewHeight = source ? (source.height < 1 ? 1 : source.height) : 1;
    const geometry = new THREE.BoxGeometry(this.cellSize * 0.9, previewHeight, this.cellSize * 0.9);
    const material = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 });
    
    this.hoverPreview = new THREE.Mesh(geometry, material);
    const groundHeight = 0.5;
    this.hoverPreview.position.set(
      x * this.cellSize - this.gridSize * this.cellSize / 2 + this.cellSize / 2,
      previewHeight / 2 + groundHeight / 2,
      z * this.cellSize - this.gridSize * this.cellSize / 2 + this.cellSize / 2
    );
    this.scene.add(this.hoverPreview);
  }

  private onMouseDown = (event: MouseEvent): void => {
    if (event.button === 1 || event.button === 2) {
      this.isPanning = true;
      this.lastMousePosition = { x: event.clientX, y: event.clientY };
      event.preventDefault();
    }
  };

  private onMouseUp = (): void => {
    this.isPanning = false;
  };

  private onMouseWheel = (event: WheelEvent): void => {
    // ✅ MEJORA: No hacer zoom si está sobre UI
    if (this.isOverUI) {
      return;
    }

    event.preventDefault();

    const zoomStrength = 0.25;
    const zoomDelta = -event.deltaY * zoomStrength * 0.001;

    this.camera.zoom = THREE.MathUtils.clamp(
      this.camera.zoom + zoomDelta,
      0.5,
      4.0
    );

    this.camera.updateProjectionMatrix();
  };

  private onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Delete' || event.key === 'Backspace') {
      this.selectedSource = 'eraser';
      this.selectedMaintenanceType = null;
    }

    const move = 0.6;
    if (event.key === 's' || event.key === 'S') this.camera.position.z -= move;
    if (event.key === 'w' || event.key === 'W') this.camera.position.z += move;
    if (event.key === 'd' || event.key === 'D') this.camera.position.x -= move;
    if (event.key === 'a' || event.key === 'A') this.camera.position.x += move;
    
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

  private onRightClick = (event: MouseEvent): void => {
    event.preventDefault();
  };

  private addEventListeners(): void {
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('click', this.onClick);
    window.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('wheel', this.onMouseWheel, { passive: false });
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('resize', this.onWindowResize);
    window.addEventListener('contextmenu', this.onRightClick);
  }

  private removeEventListeners(): void {
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('click', this.onClick);
    window.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('wheel', this.onMouseWheel);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('resize', this.onWindowResize);
    window.removeEventListener('contextmenu', this.onRightClick);
  }

  // ✅ MEJORA: Loop de animación optimizado
  private animate = (): void => {
    if (this.gameOver) return; // No continuar animando si el juego terminó
    
    this.animationId = requestAnimationFrame(this.animate);
    
    // Animar aerogeneradores
    this.sourcesGroup.children.forEach(child => {
      if (child.userData['type'] === 'wind') {
        child.rotation.x += 0.03;
      }
      
      // Animar partículas de humo
      const smoke = child.children.find(c => c.userData['isSmoke']);
      if (smoke) {
        smoke.children.forEach(particle => {
          if (particle.userData['velocity']) {
            particle.position.y += particle.userData['velocity'].y;
            const material = (particle as THREE.Mesh).material as THREE.MeshBasicMaterial;
            material.opacity -= 0.01;
            
            if (particle.position.y > 3 || material.opacity <= 0) {
              particle.position.y = 0;
              material.opacity = 0.6;
            }
          }
        });
      }
    });

    // Animar nubes
    this.clouds.forEach(cloud => {
      cloud.position.x += this.cloudSpeed;
      if (cloud.position.x > this.gridSize * this.cellSize / 2 + 5) {
        cloud.position.x = -this.gridSize * this.cellSize / 2 - 5;
      }
    });

    const now = Date.now();
    
    // ✅ MEJORA: Solo actualizar degradación y stats cada segundo
    if (now - this.lastDegradationUpdate >= this.degradationInterval) {
      this.updateDegradation();
      this.updateStats();
      this.lastDegradationUpdate = now;
    }

    // ✅ MEJORA: Verificar condiciones de Game Over
    this.checkGameOverConditions();

    this.updateEconomy();

    this.renderer.render(this.scene, this.camera);
  };
}