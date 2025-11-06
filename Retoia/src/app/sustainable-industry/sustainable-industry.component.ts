// sustainable-industry.component.ts (Sistema Dinámico ODS 9)
import { Component, ElementRef, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule, KeyValuePipe } from '@angular/common';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

interface IndustrialBuilding {
  name: string;
  cost: number;
  production: number;
  waste: number;
  icon: string;
  resilienceBonus: number; // Nuevo: bonus de resiliencia
  innovationBonus: number; // Nuevo: bonus de innovación
  maintenanceCost: number; // Nuevo: costo de mantenimiento por turno
}

@Component({
  selector: 'app-sustainable-industry',
  templateUrl: './sustainable-industry.component.html',
  styleUrls: ['./sustainable-industry.component.css'],
  standalone: true,
  imports: [CommonModule, KeyValuePipe]
})
export class SustainableIndustryComponent implements OnInit, OnDestroy {
  @ViewChild('renderCanvas', { static: true }) 
  private canvasRef!: ElementRef<HTMLDivElement>;

  // Estadísticas principales
  money = 15000;
  totalProduction = 0;
  totalWaste = 0;
  innovationIndex = 0;
  resilienceIndex = 0; // Nuevo: índice de resiliencia
  maxWasteTarget = 200;
  selectedBuilding: string | null = null;
  
  // Nuevas mecánicas de juego
  turnCount = 0;
  incomePerTurn = 500; // Ingreso base por turno
  productionMultiplier = 1.0; // Multiplicador por innovación
  wasteReductionBonus = 0; // Reducción de residuos por innovación
  showAchievementNotification = false;
  achievementMessage = '';
  achievementTitle = '';
  hasReached50Innovation = false;
  hasReached50Resilience = false;
  
  // Edificios con estadísticas mejoradas
  industrialBuildingsUI: Record<string, IndustrialBuilding> = {
    cleanFactory: { 
      name: 'Fábrica Limpia', 
      cost: 2000, 
      production: 50, 
      waste: 8, 
      icon: '🏭',
      resilienceBonus: 5,
      innovationBonus: 2,
      maintenanceCost: 50
    },
    researchCenter: { 
      name: 'Centro I+D', 
      cost: 3500, 
      production: 10, 
      waste: 2, 
      icon: '🔬',
      resilienceBonus: 3,
      innovationBonus: 15,
      maintenanceCost: 100
    },
    recyclingPlant: { 
      name: 'Planta de Reciclaje', 
      cost: 2500, 
      production: 5, 
      waste: -40, 
      icon: '♻️',
      resilienceBonus: 8,
      innovationBonus: 5,
      maintenanceCost: 80
    },
    warehouse: { 
      name: 'Almacén', 
      cost: 1200, 
      production: 15, 
      waste: 3, 
      icon: '📦',
      resilienceBonus: 10,
      innovationBonus: 1,
      maintenanceCost: 30
    },
    solarPanel: {
      name: 'Panel Solar',
      cost: 1800,
      production: 20,
      waste: 0,
      icon: '☀️',
      resilienceBonus: 12,
      innovationBonus: 8,
      maintenanceCost: 40
    },
    smartHub: {
      name: 'Hub Inteligente',
      cost: 4000,
      production: 30,
      waste: 5,
      icon: '🌐',
      resilienceBonus: 15,
      innovationBonus: 20,
      maintenanceCost: 120
    }
  };

  // Mapeo de modelos 3D
  private industrialBuildingModels: { [key: string]: string } = {
    cleanFactory: 'assets/tercera/building-h.glb',
    researchCenter: 'assets/tercera/building-k.glb',
    recyclingPlant: 'assets/tercera/building-l.glb',
    warehouse: 'assets/tercera/building-k.glb',
    solarPanel: 'assets/tercera/building-q.glb',
    smartHub: 'assets/tercera/building-n.glb'
  };

  private buildingScaleConfig: { [key: string]: { scale: number } } = {
    cleanFactory: { scale: 2 },
    researchCenter: { scale: 2 },
    recyclingPlant: { scale: 2 },
    warehouse: { scale: 1.5 },
    solarPanel: { scale: 1.8 },
    smartHub: { scale: 2.2 }
  };

  // PROPIEDADES DE THREE.JS
  private gltfLoader = new GLTFLoader();
  private scene!: THREE.Scene;
  private camera!: THREE.OrthographicCamera;
  private renderer!: THREE.WebGLRenderer;
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();

  private buildingPreviewCache: { [key: string]: THREE.Object3D } = {};
  private currentPreviewType: string | null = null;

  private groundGroup = new THREE.Group();
  private buildingsGroup = new THREE.Group();
  private hoverPreview: THREE.Object3D | null = null;
  private animationId?: number;

  private clouds: THREE.Object3D[] = [];
  private cloudCount = 50;
  private cloudSpeed = 0.02;
  private isPanning = false;
  private lastMousePosition = { x: 0, y: 0 };
  private readonly gridSize = 50;
  private readonly cellSize = 2;
  private gridData: (string | null)[][] = [];
  private justSelectedBuilding = false;

  // Nuevo: Contador de edificios
  private buildingCounts: { [key: string]: number } = {};

  // -----------------------------------------------------
  // CICLO DE VIDA
  // -----------------------------------------------------

  ngOnInit(): void {
    this.initScene();
    this.createGround();
    this.createClouds();
    this.preloadBuildingPreviews();
    this.animate();
    this.addEventListeners();
    this.startGameLoop();
  }

  ngOnDestroy(): void {
    this.removeEventListeners();
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    this.renderer?.dispose();
  }

  // -----------------------------------------------------
  // 🎮 NUEVAS MECÁNICAS DE JUEGO
  // -----------------------------------------------------

  private startGameLoop(): void {
    // Cada 10 segundos, procesar un turno
    setInterval(() => {
      this.processTurn();
    }, 40000);
  }

  private processTurn(): void {
    this.turnCount++;
    
    // Calcular ingresos por producción
    const productionIncome = Math.floor(this.totalProduction * this.productionMultiplier * 10);
    
    // Calcular costos de mantenimiento
    let maintenanceCost = 0;
    for (const [buildingType, count] of Object.entries(this.buildingCounts)) {
      if (count > 0) {
        maintenanceCost += this.industrialBuildingsUI[buildingType].maintenanceCost * count;
      }
    }
    
    // Penalización por exceso de residuos
    const wastePenalty = this.totalWaste > this.maxWasteTarget ? 
      Math.floor((this.totalWaste - this.maxWasteTarget) * 5) : 0;
    
    // Bonus por innovación alta
    const innovationBonus = this.innovationIndex > 50 ? 
      Math.floor(this.innovationIndex * 5) : 0;
    
    // Bonus por resiliencia alta
    const resilienceBonus = this.resilienceIndex > 50 ? 
      Math.floor(this.resilienceIndex * 3) : 0;
    
    // Calcular balance del turno
    const turnBalance = this.incomePerTurn + productionIncome + innovationBonus + 
                       resilienceBonus - maintenanceCost - wastePenalty;
    
    this.money += turnBalance;
    
    // Actualizar multiplicadores basados en innovación
    this.productionMultiplier = 1 + (this.innovationIndex / 100) * 0.5;
    this.wasteReductionBonus = Math.floor(this.innovationIndex / 10);
    
    // Mostrar notificación del turno
    this.showTurnNotification(turnBalance, productionIncome, maintenanceCost, 
                             wastePenalty, innovationBonus, resilienceBonus);
  }

  private showTurnNotification(balance: number, income: number, maintenance: number, 
                               penalty: number, innovationBonus: number, resilienceBonus: number): void {
    console.log(`
      ═══════════════════════════════════════
      TURNO ${this.turnCount} COMPLETADO
      ═══════════════════════════════════════
      💰 Ingreso por producción: +${income}€
      🔬 Bonus innovación: +${innovationBonus}€
      🛡️ Bonus resiliencia: +${resilienceBonus}€
      🔧 Mantenimiento: -${maintenance}€
      ⚠️ Penalización residuos: -${penalty}€
      ───────────────────────────────────────
      📊 BALANCE TOTAL: ${balance > 0 ? '+' : ''}${balance}€
      💵 Presupuesto actual: ${this.money}€
      ═══════════════════════════════════════
    `);
  }

  private updateStats(): void {
    let totalProd = 0;
    let totalWst = 0;
    let totalInnov = 0;
    let totalResil = 0;
    
    // Resetear contadores
    this.buildingCounts = {};
    
    for (let x = 0; x < this.gridSize; x++) {
      for (let z = 0; z < this.gridSize; z++) {
        const buildingType = this.gridData[x][z];
        if (buildingType) {
          const config = this.industrialBuildingsUI[buildingType];
          totalProd += config.production;
          totalWst += config.waste;
          totalInnov += config.innovationBonus;
          totalResil += config.resilienceBonus;
          
          // Contar edificios
          this.buildingCounts[buildingType] = (this.buildingCounts[buildingType] || 0) + 1;
        }
      }
      this.checkAchievements();
    }
    
    // Aplicar bonus de reducción de residuos por innovación
    totalWst = Math.max(0, totalWst - this.wasteReductionBonus);
    
    // Calcular bonus por sinergia (edificios adyacentes del mismo tipo)
    const synergyBonus = this.calculateSynergyBonus();
    totalInnov += synergyBonus.innovation;
    totalResil += synergyBonus.resilience;
    
    this.totalProduction = totalProd;
    this.totalWaste = totalWst;
    this.innovationIndex = Math.min(100, totalInnov);
    this.resilienceIndex = Math.min(100, totalResil);
  }

  private calculateSynergyBonus(): { innovation: number; resilience: number } {
    let innovationBonus = 0;
    let resilienceBonus = 0;
    
    for (let x = 0; x < this.gridSize; x++) {
      for (let z = 0; z < this.gridSize; z++) {
        const buildingType = this.gridData[x][z];
        if (buildingType) {
          // Verificar edificios adyacentes
          const adjacentCount = this.countAdjacentBuildings(x, z);
          
          // Bonus por cada edificio adyacente
          if (adjacentCount >= 2) {
            innovationBonus += 1;
            resilienceBonus += 2;
          }
          
          // Bonus especial: Centro I+D cerca de Fábricas
          if (buildingType === 'researchCenter') {
            const nearbyFactories = this.countNearbyBuildingsOfType(x, z, 'cleanFactory', 3);
            innovationBonus += nearbyFactories * 2;
          }
          
          // Bonus especial: Planta de Reciclaje cerca de cualquier edificio
          if (buildingType === 'recyclingPlant') {
            const nearbyBuildings = this.countNearbyBuildings(x, z, 2);
            resilienceBonus += nearbyBuildings;
          }
        }
      }
    }
    
    return { innovation: innovationBonus, resilience: resilienceBonus };
  }

  private countAdjacentBuildings(x: number, z: number): number {
    let count = 0;
    const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    
    for (const [dx, dz] of directions) {
      const newX = x + dx;
      const newZ = z + dz;
      if (newX >= 0 && newX < this.gridSize && newZ >= 0 && newZ < this.gridSize) {
        if (this.gridData[newX][newZ]) count++;
      }
    }
    
    return count;
  }

  private countNearbyBuildings(x: number, z: number, radius: number): number {
    let count = 0;
    
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dz = -radius; dz <= radius; dz++) {
        if (dx === 0 && dz === 0) continue;
        
        const newX = x + dx;
        const newZ = z + dz;
        
        if (newX >= 0 && newX < this.gridSize && newZ >= 0 && newZ < this.gridSize) {
          if (this.gridData[newX][newZ]) count++;
        }
      }
    }
    
    return count;
  }

  private countNearbyBuildingsOfType(x: number, z: number, type: string, radius: number): number {
    let count = 0;
    
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dz = -radius; dz <= radius; dz++) {
        if (dx === 0 && dz === 0) continue;
        
        const newX = x + dx;
        const newZ = z + dz;
        
        if (newX >= 0 && newX < this.gridSize && newZ >= 0 && newZ < this.gridSize) {
          if (this.gridData[newX][newZ] === type) count++;
        }
      }
    }
    
    return count;
  }

  private checkAchievements(): void {
  // Logro de Innovación 50%
  if (this.innovationIndex >= 50 && !this.hasReached50Innovation) {
    this.hasReached50Innovation = true;
    this.showAchievement(
      '🔬 ¡INNOVACIÓN ALCANZADA!',
      'Has alcanzado el 50% de innovación. Tu parque industrial ahora es un centro de desarrollo tecnológico que impulsa la transformación digital y la investigación aplicada. Esto contribuye directamente a la Meta 9.5 de la ODS: "Aumentar la investigación científica y mejorar la capacidad tecnológica de los sectores industriales".'
    );
  }
  
  // Logro de Resiliencia 50%
  if (this.resilienceIndex >= 50 && !this.hasReached50Resilience) {
    this.hasReached50Resilience = true;
    this.showAchievement(
      '🛡️ ¡INFRAESTRUCTURA RESILIENTE!',
      'Has alcanzado el 50% de resiliencia. Tu infraestructura ahora puede resistir crisis y adaptarse a cambios. Estás construyendo instalaciones de calidad, fiables y sostenibles, cumpliendo con la Meta 9.1: "Desarrollar infraestructuras fiables, sostenibles, resilientes y de calidad".'
    );
  }
}

private showAchievement(title: string, message: string): void {
  this.achievementTitle = title;
  this.achievementMessage = message;
  this.showAchievementNotification = true;
  
  // Ocultar después de 10 segundos
  setTimeout(() => {
    this.showAchievementNotification = false;
  }, 10000);
}

  // Método público para forzar siguiente turno (para debugging)
  advanceTurn(): void {
    this.processTurn();
  }

  // -----------------------------------------------------
  // 🎮 MÉTODOS DE INICIALIZACIÓN DE THREE.JS
  // -----------------------------------------------------

  private initScene(): void {
    this.gridData = Array(this.gridSize).fill(null)
      .map(() => Array(this.gridSize).fill(null));

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87CEEB);

    const aspect = window.innerWidth / window.innerHeight;
    const d = 10;
    this.camera = new THREE.OrthographicCamera(
      -d * aspect, d * aspect, d, -d, 1, 1000
    );

    this.camera.zoom = 1.0;
    this.camera.updateProjectionMatrix();
    this.camera.position.set(-20, 20, -20);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
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
    this.scene.add(this.buildingsGroup);
  }

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
        10 + Math.random() * 10,
        (Math.random() - 0.5) * this.gridSize * this.cellSize
      );

      this.scene.add(cloud);
      this.clouds.push(cloud);
    }
  }

  private createGround(): void {
    const baseColor = new THREE.Color('#388E3C');

    for (let x = 0; x < this.gridSize; x++) {
      for (let z = 0; z < this.gridSize; z++) {
        const geometry = new THREE.BoxGeometry(
          this.cellSize * 1, 0.5, this.cellSize * 1
        );

        const color = baseColor.clone();
        color.offsetHSL(0, 0, (Math.random() - 0.6) * 0.2);

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

  // -----------------------------------------------------
  // 🏗️ GESTIÓN DE EDIFICIOS 3D (GLB)
  // -----------------------------------------------------

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
    const scaleConfig = this.buildingScaleConfig[type];
    const modelUrl = this.industrialBuildingModels[type];

    this.loadBuildingModel(modelUrl, (model) => {
      model.scale.set(scaleConfig.scale, scaleConfig.scale, scaleConfig.scale);

      model.position.set(
        x * this.cellSize - this.gridSize * this.cellSize / 2 + this.cellSize / 2,
        0,
        z * this.cellSize - this.gridSize * this.cellSize / 2 + this.cellSize / 2
      );

      model.userData['gridX'] = x;
      model.userData['gridZ'] = z;

      model.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
            child.material = child.material.clone();
            child.material.emissive = new THREE.Color(0xffffff);
            child.material.emissiveIntensity = 0.02;
        }
      });

      this.buildingsGroup.add(model);
      this.gridData[x][z] = type;
      this.updateStats();
    });
  }

  private preloadBuildingPreviews(): void {
    const buildingKeys = Object.keys(this.industrialBuildingsUI);

    for (const type of buildingKeys) {
      const scaleConfig = this.buildingScaleConfig[type];
      const modelUrl = this.industrialBuildingModels[type];

      if (modelUrl) {
        this.loadBuildingModel(modelUrl, (model) => {
          const preview = model.clone(true);

          preview.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.castShadow = false;
              child.receiveShadow = false;

              const transparentMaterial = new THREE.MeshLambertMaterial({
                color: 0x00FF00,
                transparent: true,
                opacity: 0.6,
                depthWrite: false
              });

              if (Array.isArray(child.material)) {
                child.material = child.material.map(() => transparentMaterial);
              } else {
                child.material = transparentMaterial;
              }
            }
          });

          preview.scale.set(scaleConfig.scale, scaleConfig.scale, scaleConfig.scale);
          this.buildingPreviewCache[type] = preview;
        });
      }
    }
  }

  private showHoverPreview(x: number, z: number, isAllowed: boolean): void {
    const type = this.selectedBuilding;
    if (!type) return;

    let cachedPreview = this.buildingPreviewCache[type];
    
    if (type === 'eraser' || !cachedPreview) {
      if (this.currentPreviewType !== type || !this.hoverPreview) {
        if (this.hoverPreview) this.scene.remove(this.hoverPreview);
        
        const color = isAllowed ? 0xFF0000 : 0xAAAAAA;
        const geometry = new THREE.BoxGeometry(this.cellSize * 1, 0.2, this.cellSize * 1);
        const material = new THREE.MeshBasicMaterial({ 
          color: color,
          transparent: true,
          opacity: 0.6
        });
        this.hoverPreview = new THREE.Mesh(geometry, material);
        this.scene.add(this.hoverPreview);
        this.currentPreviewType = type;
      }
    } else {
      if (this.currentPreviewType !== type || !this.hoverPreview) {
        if (this.hoverPreview) this.scene.remove(this.hoverPreview);
        
        this.hoverPreview = cachedPreview.clone(true);
        this.scene.add(this.hoverPreview);
        this.currentPreviewType = type;
      }
      
      this.hoverPreview.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const material = Array.isArray(child.material) ? child.material[0] : child.material;
          if (material instanceof THREE.MeshLambertMaterial) {
            material.color.setHex(isAllowed ? 0x00FF00 : 0xFF0000);
            material.needsUpdate = true;
          }
        }
      });
    }
    
    if (this.hoverPreview) {
        this.hoverPreview.position.set(
            x * this.cellSize - this.gridSize * this.cellSize / 2 + this.cellSize / 2,
            type === 'eraser' ? 0.25 : 0,
            z * this.cellSize - this.gridSize * this.cellSize / 2 + this.cellSize / 2
        );
    }
  }

  private removeBuilding(x: number, z: number): void {
    const buildingType = this.gridData[x][z];
    if (!buildingType) return;

    const buildingToRemove = this.buildingsGroup.children.find(
      (child) => child.userData['gridX'] === x && child.userData['gridZ'] === z
    );

    if (buildingToRemove) {
      this.buildingsGroup.remove(buildingToRemove);
      
      buildingToRemove.traverse((child) => {
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
    const config = this.industrialBuildingsUI[buildingType];
    
    this.money += Math.floor(config.cost * 0.5);
    this.updateStats();
  }

  // -----------------------------------------------------
  // 🌐 CONTROLES Y EVENTOS
  // -----------------------------------------------------

  selectBuilding(type: string): void {
    this.justSelectedBuilding = true;
    
    if (this.selectedBuilding === type) {
      this.selectedBuilding = null;
      this.currentPreviewType = null;
      if (this.hoverPreview) {
        this.scene.remove(this.hoverPreview);
        this.hoverPreview = null;
      }
      return;
    }
    
    this.selectedBuilding = type;
    
    if (this.hoverPreview) {
      this.scene.remove(this.hoverPreview);
      this.hoverPreview = null;
      this.currentPreviewType = null;
    }
    
    setTimeout(() => {
      this.justSelectedBuilding = false;
    }, 100);
  }

  private clampCameraPosition(): void {
    const halfMap = (this.gridSize * this.cellSize) / 2;

    this.camera.position.x = THREE.MathUtils.clamp(this.camera.position.x, -halfMap, halfMap);
    this.camera.position.z = THREE.MathUtils.clamp(this.camera.position.z, -halfMap, halfMap);
  }

  private onMouseMove = (event: MouseEvent): void => {
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    if (this.isPanning) {
      const deltaX = event.clientX - this.lastMousePosition.x;
      const deltaY = event.clientY - this.lastMousePosition.y;

      const panSpeed = 0.03 * this.camera.zoom;

      this.camera.position.x -= deltaX * panSpeed;
      this.camera.position.z -= deltaY * panSpeed;

      this.clampCameraPosition();

      this.lastMousePosition = { x: event.clientX, y: event.clientY };
      return;
    }

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.groundGroup.children);

    if (this.hoverPreview && intersects.length === 0) {
      this.scene.remove(this.hoverPreview);
      this.hoverPreview = null;
      this.currentPreviewType = null;
    }

    if (intersects.length > 0 && this.selectedBuilding) {
      const cell = intersects[0].object as THREE.Mesh;
      const { gridX, gridZ } = cell.userData;
      const existingBuilding = this.gridData[gridX][gridZ];
      
      if (this.selectedBuilding === 'eraser') {
        if (existingBuilding) {
          this.showHoverPreview(gridX, gridZ, true);
        } else if (this.hoverPreview) {
          this.scene.remove(this.hoverPreview);
          this.hoverPreview = null;
          this.currentPreviewType = null;
        }
      } else {
        const config = this.industrialBuildingsUI[this.selectedBuilding];
        const canBuild = !existingBuilding && this.money >= config.cost;
        this.showHoverPreview(gridX, gridZ, canBuild);
      }
    }
  };

  private onClick = (event: MouseEvent): void => {
    if (this.isPanning) return;
    
    if (this.justSelectedBuilding) {
      return;
    }
    
    const target = event.target as HTMLElement;
    if (target.tagName === 'BUTTON' || 
        target.closest('button') || 
        target.closest('.ui-panel') || 
        target.closest('.instructions-panel') ||
        target.closest('.alert-panel') ||
        target.closest('.action-indicator')) {
      return;
    }
    
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2+ 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.groundGroup.children);

    if (intersects.length > 0 && this.selectedBuilding) {
      const cell = intersects[0].object as THREE.Mesh;
      const { gridX, gridZ } = cell.userData;

      if (this.selectedBuilding === 'eraser') {
        if (this.gridData[gridX][gridZ]) {
          this.removeBuilding(gridX, gridZ);
        }
      } else {
        if (!this.gridData[gridX][gridZ]) {
          const config = this.industrialBuildingsUI[this.selectedBuilding];
          
          if (this.money >= config.cost) {
            this.createBuilding3D(this.selectedBuilding, gridX, gridZ);
            this.money -= config.cost;
          }
        }
      }
    }
  };

  private onRightClick = (event: MouseEvent): void => {
    event.preventDefault();
    
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.groundGroup.children);

    if (intersects.length > 0) {
      const cell = intersects[0].object as THREE.Mesh;
      const { gridX, gridZ } = cell.userData;

      if (this.gridData[gridX][gridZ]) {
        this.removeBuilding(gridX, gridZ);
      }
    }
  };

  private onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Delete' || event.key === 'Backspace') {
      this.selectBuilding('eraser');
    }

    if (event.key === 'Escape') {
      this.selectedBuilding = null;
      if (this.hoverPreview) {
        this.scene.remove(this.hoverPreview);
        this.hoverPreview = null;
        this.currentPreviewType = null;
      }
    }

    const move = 0.5 * this.camera.zoom;
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
    if (event.button === 1 || event.button === 2) {
      this.isPanning = true;
      this.lastMousePosition = { x: event.clientX, y: event.clientY };
    }
  };

  private onMouseUp = (): void => {
    this.isPanning = false;
  };

  private onMouseWheel = (event: WheelEvent): void => {
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
        cloud.position.x = -this.gridSize * this.cellSize / 2 - 5;
      }
    });

    this.renderer.render(this.scene, this.camera);
  };
}