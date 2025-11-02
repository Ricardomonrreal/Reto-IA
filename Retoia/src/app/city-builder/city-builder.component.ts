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
  private groundGroup = new THREE.Group();
  private buildingsGroup = new THREE.Group();
  private hoverPreview: THREE.Mesh | null = null;
  private animationId?: number;

  private clouds: THREE.Object3D[] = [];
  private cloudCount = 50;
  private cloudSpeed = 0.02; // velocidad de movimiento de las nubes

  // FUNCIONES DE MOVIMIENTO DE CÁMARA
  private isPanning = false;
  private lastMousePosition = { x: 0, y: 0 };

  private readonly cameraZoomSpeed = 1.1;
  private readonly cameraMinZoom = 5;
  private readonly cameraMaxZoom = 30;

  private readonly gridSize = 50;
  private readonly cellSize = 2;
  private gridData: (string | null)[][] = [];

  private readonly colorPalette: Record<string, string> = {
    house: '#ff00c8ff',
    tower: '#ff00c8ff',
    factory: '#ff00c8ff',
    park: '#95e1d3',
    roof: '#8b4513'
  };

  private buildingTypes: { [key: string]: BuildingConfig } = {
    house:  { color: 0, height: 1.5, cost: 10, points: 5 },
    tower:  { color: 0, height: 3, cost: 20, points: 15 },
    factory:{ color: 0, height: 2, cost: 15, points: 10 },
    park:   { color: 0, height: 0.3, cost: 5, points: 3 }
  };

  ngOnInit(): void {
    this.initScene();
    this.createGround();
    this.createClouds();
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
    this.camera.position.set(-20, 20, -20);
    this.camera.lookAt(0, 0, 0);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: false });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.canvasRef.nativeElement.appendChild(this.renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
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

  private createClouds(): void {
    for (let i = 0; i < this.cloudCount; i++) {
      const cloud = new THREE.Group(); // cada nube es un grupo de esferas

      const sphereCount = 5 + Math.floor(Math.random() * 8); // 5-10 esferas por nube
      for (let j = 0; j < sphereCount; j++) {
        const radius = 1 + Math.random() * 2; // tamaño de cada “bola” de nube
        const geometry = new THREE.SphereGeometry(radius, 16, 16);
        const material = new THREE.MeshLambertMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.6,
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
          this.cellSize * 1, 0.2, this.cellSize * 0.9
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

  private createBuilding3D(type: string, x: number, z: number) {
    let modelUrl = '';
    switch(type) {
      case 'house': modelUrl = 'assets/building-a.glb'; break;
      case 'tower': modelUrl = 'assets/building-b.glb'; break;
      case 'factory': modelUrl = 'assets/building-c.glb'; break;
      case 'park': modelUrl = 'assets/building-d.glb'; break;
    }

    this.loadBuildingModel(modelUrl, (model) => {
      // Ajuste de escala
      model.scale.set(2, 2, 2); 

      // Posición centrada en la celda
      model.position.set(
        x * this.cellSize - this.gridSize * this.cellSize / 2 + this.cellSize / 2,
        0,
        z * this.cellSize - this.gridSize * this.cellSize / 2 + this.cellSize / 2
      );

      model.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;

          if (child.material instanceof THREE.MeshStandardMaterial) {
            child.material.emissive = new THREE.Color(0xffffff);
            child.material.emissiveIntensity = 0.02; // brillo tenue
          }
        }
      });

      //model.userData.x = x;
      //model.userData.gridZ = z;
      this.buildingsGroup.add(model);
      this.gridData[x][z] = type; // mantenemos la referencia
    });
  }

  private showHoverPreview(x: number, z: number) {
    if (this.hoverPreview) {
      this.scene.remove(this.hoverPreview);
      this.hoverPreview = null;
    }

    const geometry = new THREE.BoxGeometry(this.cellSize * 0.9, 1, this.cellSize * 0.9);
    const material = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 });
    this.hoverPreview = new THREE.Mesh(geometry, material);
    this.hoverPreview.position.set(
      x * this.cellSize - this.gridSize * this.cellSize / 2 + this.cellSize / 2,
      0.5, // altura del preview
      z * this.cellSize - this.gridSize * this.cellSize / 2 + this.cellSize / 2
    );
    this.scene.add(this.hoverPreview);
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

    if (this.hoverPreview) {
      this.scene.remove(this.hoverPreview);
      this.hoverPreview = null;
    }

    if (this.isPanning) {
      const dx = event.clientX - this.lastMousePosition.x;
      const dy = event.clientY - this.lastMousePosition.y;

      // mueve la cámara en coordenadas del plano X-Z
      const moveX = -dx * 0.01;
      const moveZ = dy * 0.01;

      this.camera.position.x += moveX;
      this.camera.position.z += moveZ;

      this.lastMousePosition = { x: event.clientX, y: event.clientY };

      this.clampCameraPosition();
    }
    
    if (intersects.length > 0) {
      const cell = intersects[0].object as THREE.Mesh;
      const { gridX, gridZ } = cell.userData;

      // Show preview only for building mode (not eraser)
      if (this.selectedBuilding !== 'eraser' && !this.gridData[gridX][gridZ]) {
        this.showHoverPreview(gridX, gridZ);
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
            this.createBuilding3D(this.selectedBuilding, gridX, gridZ);
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

    const move = 0.5;
    if (event.key === 'w') this.camera.position.z -= move;
    if (event.key === 's') this.camera.position.z += move;
    if (event.key === 'a') this.camera.position.x -= move;
    if (event.key === 'd') this.camera.position.x += move;
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