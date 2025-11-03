import { Component, OnInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

interface EnergySource {
  name: string;
  icon: string;
  cost: number;
  production: number; // kW
  emissions: number; // kg CO2/hora
  color: number;
  height: number;
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

@Component({
  selector: 'app-energy-grid',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './energy-grid.component.html',
  styleUrls: ['./energy-grid.component.css']
})
export class EnergyGridComponent implements OnInit, OnDestroy {
  @ViewChild('renderCanvas', { static: true })
  private canvasRef!: ElementRef<HTMLDivElement>;

  // ===== ESTADO DEL JUEGO =====
  money = 5000;
  selectedSource = 'solar';
  isConnecting = false;
  connectionStart: { x: number, z: number } | null = null;

  // ===== UI DATA =====
  energySourcesUI: { [key: string]: BuildingUI } = {
    solar: { icon: '☀️', name: 'PANEL SOLAR', cost: 150, production: 50 },
    wind: { icon: '💨', name: 'AEROGENERADOR', cost: 300, production: 120 },
    hydro: { icon: '💧', name: 'HIDROELÉCTRICA', cost: 500, production: 200 },
    battery: { icon: '🔋', name: 'BATERÍA', cost: 200, production: 0 },
    nuclear: { icon: '☢️', name: 'NUCLEAR', cost: 2000, production: 500 }
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
  private powerLines: Array<{ from: {x: number, z: number}, to: {x: number, z: number} }> = [];

  // ===== ESTADÍSTICAS =====
  totalProduction = 0;
  totalConsumption = 0;
  totalEmissions = 0;

  // ===== CÁMARA =====
  private isPanning = false;
  private lastMousePosition = { x: 0, y: 0 };

  // ===== CONFIGURACIÓN DETALLADA DE FUENTES =====
  private energySources: { [key: string]: EnergySource } = {
    solar: { name: 'Solar', icon: '☀️', cost: 150, production: 50, emissions: 0, color: 0xFFD700, height: 1.5 },
    wind: { name: 'Eólica', icon: '💨', cost: 300, production: 120, emissions: 0, color: 0xE0E0E0, height: 4 },
    hydro: { name: 'Hidro', icon: '💧', cost: 500, production: 200, emissions: 0, color: 0x4169E1, height: 2.5 },
    battery: { name: 'Batería', icon: '🔋', cost: 200, production: 0, emissions: 0, color: 0x32CD32, height: 1.8 },
    nuclear: { name: 'Nuclear', icon: '☢️', cost: 2000, production: 500, emissions: 250, color: 0x556B2F, height: 6.0 }
  };

  ngOnInit(): void {
    this.initGrid();
    this.initScene();
    this.createGround();
    this.createConsumers();
    this.updateNetworkState();
    this.animate();
    this.addEventListeners();
  }

  ngOnDestroy(): void {
    this.removeEventListeners();
    if (this.animationId) cancelAnimationFrame(this.animationId);
    this.renderer?.dispose();
  }

  // ===== INICIALIZACIÓN =====
  private initGrid(): void {
    this.gridData = Array(this.gridSize).fill(null).map(() => Array(this.gridSize).fill(null));
  }

  private initScene(): void {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87CEEB);

    const aspect = window.innerWidth / window.innerHeight;
    const d = 15;
    this.camera = new THREE.OrthographicCamera(-d * aspect, d * aspect, d, -d, 1, 1000);
    this.camera.position.set(-25, 25, -25);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.canvasRef.nativeElement.appendChild(this.renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 0.5);
    sunLight.position.set(20, 30, 20);
    sunLight.castShadow = true;
    sunLight.shadow.camera.left = -40;
    sunLight.shadow.camera.right = 40;
    sunLight.shadow.camera.top = 40;
    sunLight.shadow.camera.bottom = -40;
    this.scene.add(sunLight);

    this.scene.add(this.groundGroup);
    this.scene.add(this.sourcesGroup);
    this.scene.add(this.consumersGroup);
    this.scene.add(this.linesGroup);
  }

  private createGround(): void {
     const baseColor = new THREE.Color('#ace45d')
    
    for (let x = 0; x < this.gridSize; x++) {
      for (let z = 0; z < this.gridSize; z++) {
        const geometry = new THREE.BoxGeometry(this.cellSize * 0.95, 0.2, this.cellSize * 0.95);
        const color = baseColor.clone();
        color.offsetHSL(0, 0, (Math.random() - 0.5) * 0.15);
        
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

  private createConsumers(): void {
    const positions = [
      { x: 5, z: 5 }, { x: 24, z: 5 }, { x: 5, z: 24 }, { x: 24, z: 24 },
      { x: 15, z: 8 }, { x: 8, z: 15 }, { x: 22, z: 15 }, { x: 15, z: 22 }
    ];

    positions.forEach(pos => {
      const demand = 40 + Math.floor(Math.random() * 60);
      this.consumers.push({ x: pos.x, z: pos.z, demand, connected: false });
      
      const geometry = new THREE.BoxGeometry(1.5, 2, 1.5);
      const material = new THREE.MeshLambertMaterial({ 
        color: 0xFF6B6B,
        emissive: 0xFF0000,
        emissiveIntensity: 0.2
      });
      const house = new THREE.Mesh(geometry, material);
      
      house.position.set(
        pos.x * this.cellSize - this.gridSize * this.cellSize / 2 + this.cellSize / 2,
        1,
        pos.z * this.cellSize - this.gridSize * this.cellSize / 2 + this.cellSize / 2
      );
      
      house.castShadow = true;
      house.userData = { type: 'consumer', x: pos.x, z: pos.z };
      this.consumersGroup.add(house);

      this.createLabel(pos.x, pos.z, `${demand}kW`, 0xFFD700);
    });

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

// ===== CREACIÓN DE FUENTES DE ENERGÍA CON MODELOS GLB =====
  
  private createSource3D(type: string, x: number, z: number): void {
    // Mapear tipos de energía a modelos existentes
    let modelUrl = '';
    switch(type) {
      case 'solar': modelUrl = 'wall-corner-diagonal.glb'; break;  // Parque → Solar
      case 'wind': modelUrl = 'assets/windmill.glb'; break;   // Torre → Eólica
      case 'hydro': modelUrl = 'assets/watermill.glb'; break;  // Fábrica → Hidro
      case 'battery': modelUrl = 'assets/detail-tank.glb'; break; // Casa → Batería
      case 'nuclear': modelUrl = 'assets/chimney-large.glb'; break; // Torre → Nuclear
    }

    this.gltfLoader.load(
      modelUrl,
      (gltf) => {
        const model = gltf.scene;
        
        // Escala ajustada según el tipo
        const scales: { [key: string]: number } = {
          solar: 1.2,
          wind: 2.0,
          hydro: 1.0,
          battery: 1.3,
          nuclear: 2.5
        };
        
        const scale = scales[type] || 1.5;
        model.scale.set(scale, scale, scale);
        
        // ✅ ROTACIONES PERSONALIZADAS POR TIPO
        if (type === 'wind') {
          model.rotation.x = Math.PI / 2;  // 90° horizontal
          // Si necesitas ajustar la altura después de rotar:
          model.position.y = 2;
        }
        
        // Posición centrada en la celda
        model.position.set(
          x * this.cellSize - this.gridSize * this.cellSize / 2 + this.cellSize / 2,
          model.position.y || 0,  // Usa la Y ajustada si existe
          z * this.cellSize - this.gridSize * this.cellSize / 2 + this.cellSize / 2
        );

        // Aplicar sombras (colores originales preservados)
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
        // Fallback: usar geometría básica si falla la carga
        this.createFallbackSource3D(type, x, z, this.energySources[type]);
      }
    );
  }

  /**
   * Fallback: Crea geometría básica si no se puede cargar el modelo GLB
   */
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
    mesh.position.set(
      x * this.cellSize - this.gridSize * this.cellSize / 2 + this.cellSize / 2,
      type === 'solar' ? 0.1 : source.height / 2,
      z * this.cellSize - this.gridSize * this.cellSize / 2 + this.cellSize / 2
    );
    
    mesh.castShadow = true;
    mesh.userData = { gridX: x, gridZ: z, type };
    this.sourcesGroup.add(mesh);
  }
  // ===== LÓGICA DE CONEXIÓN DE RED =====

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
        this.createPowerLine(this.connectionStart.x, this.connectionStart.z, x, z);
        this.powerLines.push({ from: this.connectionStart, to: { x, z } });
        this.updateNetworkState();
      }
      this.connectionStart = null;
    }
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
    
    const geometry = new THREE.BufferGeometry().setFromPoints([pos1, pos2]);
    const material = new THREE.LineBasicMaterial({ color: 0xFFFF00, linewidth: 3 });
    const line = new THREE.Line(geometry, material);
    line.userData = { isPowerLine: true, from: {x: x1, z: z1}, to: {x: x2, z: z2} };
    this.linesGroup.add(line);
  }

  private updateNetworkState(): void {
    // Resetear todas las conexiones
    this.consumers.forEach(c => c.connected = false);

    // Recopilar todos los nodos conectados por cables
    const connectedNodes: Set<string> = new Set();
    this.powerLines.forEach(line => {
      connectedNodes.add(this.getCellKey(line.from.x, line.from.z));
      connectedNodes.add(this.getCellKey(line.to.x, line.to.z));
    });

    // Marcar consumidores como conectados si tienen cable
    this.consumers.forEach(consumer => {
      if (connectedNodes.has(this.getCellKey(consumer.x, consumer.z))) {
        consumer.connected = true;
      }
    });

    // Actualizar apariencia visual de los consumidores
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

  private updateStats(): void {
    this.totalProduction = 0;
    this.totalEmissions = 0;
    
    // Calcular producción total de todas las fuentes
    for (let x = 0; x < this.gridSize; x++) {
      for (let z = 0; z < this.gridSize; z++) {
        const sourceType = this.gridData[x][z];
        if (sourceType) {
          const source = this.energySources[sourceType];
          this.totalProduction += source.production;
          this.totalEmissions += source.emissions;
        }
      }
    }

    // Calcular consumo solo de consumidores conectados
    this.totalConsumption = this.consumers
      .filter(c => c.connected)
      .reduce((sum, c) => sum + c.demand, 0);

    // Ajustar dinero según el balance energético
    const balance = this.energyBalance;
    if (balance < 0) {
      const deficit = Math.abs(balance);
      this.money -= deficit * 0.1;
      this.money = Math.max(0, this.money);
    } else if (balance > 0) {
      this.money += balance * 0.05;
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

  // ===== SELECCIÓN Y CONSTRUCCIÓN =====

  selectSource(type: string): void {
    if (type === 'cable') {
      this.isConnecting = true;
      this.selectedSource = 'cable';
      this.connectionStart = null;
    } else if (type === 'eraser') {
      this.isConnecting = false;
      this.selectedSource = 'eraser';
      this.connectionStart = null;
    } else {
      this.isConnecting = false;
      this.selectedSource = type;
      this.connectionStart = null;
    }
  }

  private placeEnergySource(x: number, z: number): void {
    if (this.gridData[x][z]) return;
    
    const source = this.energySources[this.selectedSource];
    if (this.money < source.cost) return;

    this.money -= source.cost;
    this.gridData[x][z] = this.selectedSource;
    
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
      
      // Limpiar memoria
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

    this.gridData[x][z] = null;
    this.updateNetworkState();
  }

  // ===== EVENTOS =====

  private onMouseMove = (event: MouseEvent): void => {
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    if (this.hoverPreview) {
      this.scene.remove(this.hoverPreview);
      this.hoverPreview = null;
    }

    if (this.isPanning) {
      const dx = event.clientX - this.lastMousePosition.x;
      const dy = event.clientY - this.lastMousePosition.y;
      this.camera.position.x += -dx * 0.02;
      this.camera.position.z += dy * 0.02;
      this.lastMousePosition = { x: event.clientX, y: event.clientY };
    }

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.groundGroup.children);

    if (intersects.length > 0) {
      const cell = intersects[0].object as THREE.Mesh;
      const { gridX, gridZ } = cell.userData;
      
      if (!this.isConnecting && this.selectedSource !== 'eraser' && !this.gridData[gridX][gridZ]) {
        this.showHoverPreview(gridX, gridZ);
      }
    }
  };

  private onClick = (event: MouseEvent): void => {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.groundGroup.children);

    if (intersects.length > 0) {
      const cell = intersects[0].object as THREE.Mesh;
      const { gridX, gridZ } = cell.userData;

      if (this.isConnecting) {
        this.connectPowerLine(gridX, gridZ);
      } else if (this.selectedSource === 'eraser') {
        this.removeSource(gridX, gridZ);
      } else {
        this.placeEnergySource(gridX, gridZ);
      }
    }
  };

  private showHoverPreview(x: number, z: number): void {
    const source = this.energySources[this.selectedSource];
    const previewHeight = source.height < 1 ? 1 : source.height;
    const geometry = new THREE.BoxGeometry(this.cellSize * 0.9, previewHeight, this.cellSize * 0.9);
    const material = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 });
    
    this.hoverPreview = new THREE.Mesh(geometry, material);
    this.hoverPreview.position.set(
      x * this.cellSize - this.gridSize * this.cellSize / 2 + this.cellSize / 2,
      previewHeight / 2,
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
    event.preventDefault();
    const zoomDelta = -event.deltaY * 0.001;
    this.camera.zoom = THREE.MathUtils.clamp(this.camera.zoom + zoomDelta, 0.5, 3.0);
    this.camera.updateProjectionMatrix();
  };

  private onWindowResize = (): void => {
    const aspect = window.innerWidth / window.innerHeight;
    const d = 15;
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
    window.addEventListener('wheel', this.onMouseWheel);
    window.addEventListener('resize', this.onWindowResize);
    window.addEventListener('contextmenu', this.onRightClick);
  }

  private removeEventListeners(): void {
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('click', this.onClick);
    window.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('wheel', this.onMouseWheel);
    window.removeEventListener('resize', this.onWindowResize);
    window.removeEventListener('contextmenu', this.onRightClick);
  }

private lastMoneyUpdate = 0;
  private animate = (): void => {
    this.animationId = requestAnimationFrame(this.animate);
    
    // Animar aerogeneradores (rotación)
    this.sourcesGroup.children.forEach(child => {
      if (child.userData['type'] === 'wind') {
        child.rotation.x += 0.03;
      }
    });
    const now = Date.now();
    if (now - this.lastMoneyUpdate > 1000) {  // Cada 1 segundo
      this.updateStats();
      this.lastMoneyUpdate = now;
  }
    this.renderer.render(this.scene, this.camera);
  };
}