// city-builder.component.ts
import { Component, OnInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

interface BuildingConfig {
  color: number;
  height: number;
  cost: number;
  points: number;
  scale: number;
}

interface BuildingUI {
  icon: string;
  name: string;
  cost: number;
  points: number;
}

interface GridCell {
  type: string;
  isPermanent: boolean;
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

  score = 100;
  selectedBuilding = 'house';

  buildingUIData: { [key: string]: BuildingUI } = {
    house: { icon: '🏠', name: 'CASA', cost: 10, points: 5 },
    tower: { icon: '🏢', name: 'TORRE', cost: 20, points: 15 },
    factory: { icon: '🏭', name: 'FÁBRICA', cost: 15, points: 10 },
    park: { icon: '🌳', name: 'PARQUE', cost: 5, points: 3 }
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
    house:  { color: 0, height: 1.5, cost: 10, points: 5, scale: 2},
    tower:  { color: 0, height: 3, cost: 20, points: 15, scale: 2},
    factory:{ color: 0, height: 2, cost: 15, points: 10, scale: 2},
    park:   { color: 0, height: 0.3, cost: 5, points: 3, scale: 1.5},
    glorieta: { color: 0, height: 2, cost: 0, points: 0, scale: 2}
  };

  private initialBuildings: { type: string, x: number, z: number }[] = [
    { type: 'house', x: 20, z: 20 },
    { type: 'tower', x: 25, z: 20 },
    { type: 'glorieta', x: 20, z: 25 },
    { type: 'park', x: 25, z: 25 },
    { type: 'house', x: 30, z: 15 }
  ];

  private createInitialBuildings(): void {
    this.initialBuildings.forEach(building => {
      // Verificar si la celda está vacía antes de construir
      if (!this.gridData[building.x][building.z]) {
        this.createBuilding3D(building.type, building.x, building.z);
        
        // Es importante registrarlo inmediatamente ya que createBuilding3D es asíncrono
        this.gridData[building.x][building.z] = {
          type: building.type,
          isPermanent: true
        };
      }
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

    // Camera - Orthographic
    const aspect = window.innerWidth / window.innerHeight;
    const d = 10;
    this.camera = new THREE.OrthographicCamera(
      -d * aspect, d * aspect, d, -d, 1, 1000
    );

    this.camera.zoom = 1.0;
    this.camera.updateProjectionMatrix();
    this.camera.position.set(-20, 20, -20);
    this.camera.lookAt(0, 0, 0);

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
        10 + Math.random() * 10,
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

  private createBuilding3D(type: string, x: number, z: number, updateGrid: boolean = false) {
    const config = this.buildingTypes[type];

    let modelUrl = '';
    switch(type) {
      case 'house': modelUrl = 'assets/building-a.glb'; break;
      case 'tower': modelUrl = 'assets/building-b.glb'; break;
      case 'factory': modelUrl = 'assets/building-c.glb'; break;
      case 'park': modelUrl = 'assets/skyscraper-c.glb'; break;
      case 'glorieta': modelUrl = 'assets/streets/glorieta1.glb'; break;
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
        case 'house': modelUrl = 'assets/building-a.glb'; break;
        case 'tower': modelUrl = 'assets/building-b.glb'; break;
        case 'factory': modelUrl = 'assets/building-c.glb'; break;
        case 'park': modelUrl = 'assets/skyscraper-c.glb'; break;
        case 'glorieta': modelUrl = 'assets/streets/glorieta1.glb'; break;
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
      this.hoverPreview.position.set(
        x * this.cellSize - this.gridSize * this.cellSize / 2 + this.cellSize / 2,
        0, // Asume que el modelo GLB tiene el origen en la base
        z * this.cellSize - this.gridSize * this.cellSize / 2 + this.cellSize / 2
      );
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

    // Deduct points (half of what was gained)
    const config = this.buildingTypes[buildingType];
    this.score = Math.max(0, this.score + Math.floor(config.points));
  }

  private clampCameraPosition(): void {
    const halfMap = (this.gridSize * this.cellSize) / 2;

    this.camera.position.x = THREE.MathUtils.clamp(this.camera.position.x, -halfMap, halfMap);
    this.camera.position.z = THREE.MathUtils.clamp(this.camera.position.z, -halfMap, halfMap);
  }

  private onMouseMove = (event: MouseEvent): void => {
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.groundGroup.children);

    // Mueve la lógica de remoción del hover para centralizarla en el manejo de intersects
    if (this.hoverPreview && !this.isPanning) { // Solo si no está paneando
      this.scene.remove(this.hoverPreview);
      this.hoverPreview = null;
      this.currentPreviewType = null;
    }
    
    // ... (código de Panning se mantiene) ...

    if (intersects.length > 0) {
      const cell = intersects[0].object as THREE.Mesh;
      const { gridX, gridZ } = cell.userData;

      // Show preview only for building mode (not eraser)
      if (this.selectedBuilding !== 'eraser' && !this.gridData[gridX][gridZ]) {
        // Usamos la nueva función síncrona
        this.showHoverPreview(gridX, gridZ);
      }
      // Show red highlight for eraser mode
      else if (this.selectedBuilding === 'eraser' && this.gridData[gridX][gridZ]) {
        // Si estamos en modo borrador y hay algo, creamos el highlight rojo
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
      // Si no se puede construir/borrar, el preview ya se eliminó al inicio de onMouseMove.
    }
    // Si intersects.length es 0 (mouse fuera del grid), el preview se elimina al inicio.
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
            this.createBuilding3D(this.selectedBuilding, gridX, gridZ);

            this.gridData[gridX][gridZ] = {
              type: this.selectedBuilding,
              isPermanent: false
            };

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
      const buildings = ['factory', 'house', 'park', 'tower'];
      this.selectedBuilding = buildings[parseInt(event.key) - 1];
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
      0.5,   // 🔽 mínimo (más lejos)
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