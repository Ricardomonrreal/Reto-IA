// city-builder.component.ts
import { Component, OnInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as THREE from 'three';

interface BuildingConfig {
  color: number;
  height: number;
  cost: number;
  points: number;
}

interface BuildingUI {
  icon: string;
  name: string;
  cost: number;
  points: number;
}

@Component({
  selector: 'app-city-builder',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="game-container">
      <div #renderCanvas class="canvas-container"></div>
      
      <!-- UI Overlay -->
      <div class="ui-panel">
        <div class="title">🏙️ CONSTRUCTOR DE CIUDAD</div>
        <div class="score">💰 PUNTOS: {{ score }}</div>
        <div class="subtitle">SELECCIONA HERRAMIENTA:</div>
        
        <!-- Eraser button -->
        <button
          (click)="selectBuilding('eraser')"
          [class.selected]="selectedBuilding === 'eraser'"
          class="building-btn eraser-btn"
        >
          🗑️ BORRADOR<br/>
          <span class="building-info">
            Elimina edificios (Del/Supr)
          </span>
        </button>
        
        <!-- Building buttons -->
        <button
          *ngFor="let building of buildingUIData | keyvalue"
          (click)="selectBuilding(building.key)"
          [class.selected]="selectedBuilding === building.key"
          class="building-btn"
        >
          {{ building.value.icon }} {{ building.value.name }}<br/>
          <span class="building-info">
            💵 -{{ building.value.cost }} | ⭐ +{{ building.value.points }}
          </span>
        </button>
        
        <div class="instructions-bottom">
          <strong>Clic izquierdo:</strong> Construir/Borrar<br/>
          <strong>Clic derecho:</strong> Borrar rápido<br/>
          <strong>Tecla Del:</strong> Modo borrador
        </div>
      </div>

      <!-- Instructions -->
      <div class="instructions-panel">
        <div class="instructions-title">📜 CONTROLES:</div>
        • Selecciona herramienta<br/>
        • Clic izquierdo para usar<br/>
        • Clic derecho para borrar<br/>
        • Tecla Delete para borrador<br/>
        • ¡Construye tu ciudad!
      </div>
    </div>
  `,
  styles: [`
    .game-container {
      width: 100%;
      height: 100vh;
      position: relative;
      overflow: hidden;
    }

    .canvas-container {
      width: 100%;
      height: 100%;
    }

    .ui-panel {
      position: absolute;
      top: 20px;
      left: 20px;
      background: rgba(0, 0, 0, 0.8);
      color: #00ff00;
      padding: 20px;
      font-family: 'Courier New', monospace;
      font-size: 16px;
      border: 3px solid #00ff00;
      box-shadow: 0 0 20px rgba(0, 255, 0, 0.5);
      z-index: 100;
      max-height: 90vh;
      overflow-y: auto;
    }

    .title {
      margin-bottom: 15px;
      font-size: 20px;
      text-align: center;
    }

    .score {
      margin-bottom: 10px;
    }

    .subtitle {
      margin-bottom: 10px;
      font-size: 14px;
      color: #ffff00;
    }

    .building-btn {
      display: block;
      width: 100%;
      padding: 10px;
      margin-bottom: 8px;
      background: #333;
      color: #00ff00;
      border: 2px solid #00ff00;
      cursor: pointer;
      font-family: 'Courier New', monospace;
      font-size: 14px;
      font-weight: bold;
      text-align: left;
      transition: all 0.2s;
    }

    .building-btn:hover {
      background: #004400;
    }

    .building-btn.selected {
      background: #00ff00;
      color: #000;
    }

    .eraser-btn {
      border-color: #ff0000;
      color: #ff6666;
    }

    .eraser-btn:hover {
      background: #440000;
    }

    .eraser-btn.selected {
      background: #ff0000;
      color: #fff;
      border-color: #ff0000;
    }

    .building-info {
      font-size: 12px;
    }

    .instructions-bottom {
      margin-top: 15px;
      font-size: 11px;
      color: #888;
      border-top: 1px solid #00ff00;
      padding-top: 10px;
      line-height: 1.6;
    }

    .instructions-panel {
      position: absolute;
      bottom: 20px;
      right: 20px;
      background: rgba(0, 0, 0, 0.8);
      color: #00ff00;
      padding: 15px;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      border: 2px solid #00ff00;
      max-width: 250px;
      z-index: 100;
      line-height: 1.6;
    }

    .instructions-title {
      font-weight: bold;
      margin-bottom: 5px;
    }
  `]
})
export class CityBuilderComponent implements OnInit, OnDestroy {
  @ViewChild('renderCanvas', { static: true }) 
  private canvasRef!: ElementRef<HTMLDivElement>;

  score = 100;
  selectedBuilding = 'house';

  buildingUIData: { [key: string]: BuildingUI } = {
    house: { icon: '🏠', name: 'CASA', cost: 10, points: 5 },
    tower: { icon: '🏢', name: 'TORRE', cost: 20, points: 15 },
    factory: { icon: '🏭', name: 'FÁBRICA', cost: 15, points: 10 },
    park: { icon: '🌳', name: 'PARQUE', cost: 5, points: 3 }
  };

  private scene!: THREE.Scene;
  private camera!: THREE.OrthographicCamera;
  private renderer!: THREE.WebGLRenderer;
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private groundGroup = new THREE.Group();
  private buildingsGroup = new THREE.Group();
  private hoverPreview: THREE.Mesh | null = null;
  private animationId?: number;

  private readonly gridSize = 10;
  private readonly cellSize = 2;
  private gridData: (string | null)[][] = [];

  private buildingTypes: { [key: string]: BuildingConfig } = {
    house: { color: 0x4ecdc4, height: 1.5, cost: 10, points: 5 },
    tower: { color: 0x4ecdc4, height: 3, cost: 20, points: 15 },
    factory: { color: 0xffe66d, height: 2, cost: 15, points: 10 },
    park: { color: 0x95e1d3, height: 0.3, cost: 5, points: 3 }
  };

  ngOnInit(): void {
    this.initScene();
    this.createGround();
    this.animate();
    this.addEventListeners();
  }

  ngOnDestroy(): void {
    this.removeEventListeners();
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    this.renderer?.dispose();
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
    this.scene.fog = new THREE.Fog(0x87CEEB, 20, 50);

    // Camera - Orthographic
    const aspect = window.innerWidth / window.innerHeight;
    const d = 10;
    this.camera = new THREE.OrthographicCamera(
      -d * aspect, d * aspect, d, -d, 1, 1000
    );
    this.camera.position.set(20, 20, 20);
    this.camera.lookAt(0, 0, 0);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: false });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.canvasRef.nativeElement.appendChild(this.renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.2);
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

  private createGround(): void {
    for (let x = 0; x < this.gridSize; x++) {
      for (let z = 0; z < this.gridSize; z++) {
        const geometry = new THREE.BoxGeometry(
          this.cellSize * 0.95, 0.1, this.cellSize * 0.95
        );
        const material = new THREE.MeshLambertMaterial({
          color: (x + z) % 2 === 0 ? 0x4a7c4e : 0x5a8c5e
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

  private createBuilding(type: string, x: number, z: number): THREE.Mesh {
    const config = this.buildingTypes[type];
    const geometry = new THREE.BoxGeometry(
      this.cellSize * 0.8, config.height, this.cellSize * 0.8
    );
    const material = new THREE.MeshLambertMaterial({ color: config.color });
    const building = new THREE.Mesh(geometry, material);
    building.position.set(
      x * this.cellSize - this.gridSize * this.cellSize / 2 + this.cellSize / 2,
      config.height / 2,
      z * this.cellSize - this.gridSize * this.cellSize / 2 + this.cellSize / 2
    );
    building.castShadow = true;
    building.receiveShadow = true;
    building.userData = { type, gridX: x, gridZ: z };

    // Add roof for house and tower
    if (type === 'house' || type === 'tower') {
      const roofGeometry = new THREE.ConeGeometry(this.cellSize * 0.6, 0.5, 4);
      const roofMaterial = new THREE.MeshLambertMaterial({ color: 0x8b4513 });
      const roof = new THREE.Mesh(roofGeometry, roofMaterial);
      roof.position.y = config.height / 2 + 0.25;
      roof.rotation.y = Math.PI / 4;
      roof.castShadow = true;
      building.add(roof);
    }

    return building;
  }

  private removeBuilding(x: number, z: number): void {
    const buildingType = this.gridData[x][z];
    if (!buildingType) return;

    // Find and remove the building from the scene
    const buildingToRemove = this.buildingsGroup.children.find(
      (child) => child.userData['gridX'] === x && child.userData['gridZ'] === z
    );

    if (buildingToRemove) {
      this.buildingsGroup.remove(buildingToRemove);
      
      // Dispose geometry and materials to free memory
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

    // Deduct points (half of what was gained)
    const config = this.buildingTypes[buildingType];
    this.score = Math.max(0, this.score - Math.floor(config.points / 2));
  }

  private onMouseMove = (event: MouseEvent): void => {
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.groundGroup.children);

    if (this.hoverPreview) {
      this.scene.remove(this.hoverPreview);
      this.hoverPreview = null;
    }

    if (intersects.length > 0) {
      const cell = intersects[0].object as THREE.Mesh;
      const { gridX, gridZ } = cell.userData;

      // Show preview only for building mode (not eraser)
      if (this.selectedBuilding !== 'eraser' && !this.gridData[gridX][gridZ]) {
        this.hoverPreview = this.createBuilding(this.selectedBuilding, gridX, gridZ);
        const material = this.hoverPreview.material as THREE.MeshLambertMaterial;
        material.transparent = true;
        material.opacity = 0.5;
        this.scene.add(this.hoverPreview);
      }
      // Show red highlight for eraser mode
      else if (this.selectedBuilding === 'eraser' && this.gridData[gridX][gridZ]) {
        const geometry = new THREE.BoxGeometry(
          this.cellSize * 0.9, 0.2, this.cellSize * 0.9
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

      // Eraser mode - remove building
      if (this.selectedBuilding === 'eraser') {
        if (this.gridData[gridX][gridZ]) {
          this.removeBuilding(gridX, gridZ);
        }
      }
      // Build mode - place building
      else {
        if (!this.gridData[gridX][gridZ]) {
          const config = this.buildingTypes[this.selectedBuilding];
          if (this.score >= config.cost) {
            const building = this.createBuilding(this.selectedBuilding, gridX, gridZ);
            this.buildingsGroup.add(building);
            this.gridData[gridX][gridZ] = this.selectedBuilding;
            this.score = this.score - config.cost + config.points;
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
    // Number keys 1-4 to select buildings quickly
    else if (event.key >= '1' && event.key <= '4') {
      const buildings = ['house', 'tower', 'factory', 'park'];
      this.selectedBuilding = buildings[parseInt(event.key) - 1];
    }
  };

  private onWindowResize = (): void => {
    const aspect = window.innerWidth / window.innerHeight;
    const d = 10;
    this.camera.left = -d * aspect;
    this.camera.right = d * aspect;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  };

  private addEventListeners(): void {
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('click', this.onClick);
    window.addEventListener('contextmenu', this.onRightClick);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('resize', this.onWindowResize);
  }

  private removeEventListeners(): void {
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('click', this.onClick);
    window.removeEventListener('contextmenu', this.onRightClick);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('resize', this.onWindowResize);
  }

  private animate = (): void => {
    this.animationId = requestAnimationFrame(this.animate);
    this.renderer.render(this.scene, this.camera);
  };
}