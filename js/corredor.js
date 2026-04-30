// 1. VARIABLES GLOBALES
var renderer, scene, camera; 
var clock = new THREE.Clock();

// Variables de estado del juego
let juegoIniciado = false; // Controla si el jugador ha pulsado "Empezar"
let gameOver = false; 

// Constantes dificultad
let velocidadJuego = 0.3; 
const MultVelocidad = 0.00005; 
const velocidadMax = 3.5; 
let framesSinceLastSpawn = 0; 
let distancia = 0; 
let monedasReco = 0; 

// Vidas
let vidas = 3; 
let invulnerableTimer = 0; 

// --- Elementos del Escenario ---
let player; 
let mixer; // El encargado de reproducir las animaciones
let lavaTex;
let conoModel, trailerModel, vallaModel, muroModel;
let obstacles = []; 
let pits = []; 
let monedas = []; 
let extraLives = []; 
const laneWidth = 6; 
let currentLane = 0; 
const CAM_Y = 12; 
const CAM_Z = 18;

// --- Físicas ---
let isJumping = false; 
let velocityY = 0; 
const gravity = 0.02; 
const FuerzaSalto = 0.4; 
const raycaster = new THREE.Raycaster(); 
const downVector = new THREE.Vector3(0, -1, 0); 

// --- Referencias al HTML ---
const distText = document.getElementById('distancia');
const coinsText = document.getElementById('monedas');
const gameOverScreen = document.getElementById('gameOverScreen');
let livesText; 

// ==========================================
// 2. INICIALIZACIÓN
// ==========================================
init();
loadScene();
render();

function init() {

    const loaderGLTF = new THREE.GLTFLoader();

    loaderGLTF.load('./modelos/traffic_cone.glb', (gltf) => {
        conoModel = gltf.scene;
        
        // Ajuste de escala: Los modelos de internet suelen ser gigantes o diminutos
        // Prueba con estos valores y ajusta según necesites
        conoModel.scale.set(7, 7, 5); 
        
        // Hacer que el modelo proyecte sombras
        conoModel.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        
    });

    loaderGLTF.load('./modelos/t_wall_barrier.glb', (gltf) => {
        muroModel = gltf.scene;
        
        // Ajuste de escala: Los modelos de internet suelen ser gigantes o diminutos
        // Prueba con estos valores y ajusta según necesites
        muroModel.scale.set(0.05, 0.03, 0.05);
        
        // Hacer que el modelo proyecte sombras
        muroModel.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        
      
    });

    loaderGLTF.load('./modelos/concrete_road_barrier.glb', (gltf) => {
        vallaModel = gltf.scene;
        
        // Ajuste de escala: Los modelos de internet suelen ser gigantes o diminutos
        // Prueba con estos valores y ajusta según necesites
        vallaModel.scale.set(3, 5, 3.5); 
        
        // Hacer que el modelo proyecte sombras
        vallaModel.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        
      
    });

    loaderGLTF.load('./modelos/20ft_container.glb', (gltf) => {
        trailerModel = gltf.scene;
        
        // Ajuste de escala: Los modelos de internet suelen ser gigantes o diminutos
        // Prueba con estos valores y ajusta según necesites
        trailerModel.scale.set(2, 1.5, 8); 
        
        // Hacer que el modelo proyecte sombras
        trailerModel.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        
      
    });

    loaderGLTF.load('./modelos/runner_running/scene.gltf', (gltf) => {
    player = gltf.scene;
    player.scale.set(1.1, 1.1, 1.1);
    player.position.y = 1;
    player.rotation.y = Math.PI;
    scene.add(player);

    // --- CONFIGURAR ANIMACIÓN ---
    // Comprobamos si el modelo tiene animaciones
    if (gltf.animations && gltf.animations.length > 0) {
        mixer = new THREE.AnimationMixer(player);
        
        // Normalmente la animación 0 es la de "Idle" o "Run". 
        // Si sabes el nombre, puedes usar THREE.AnimationClip.findByName(gltf.animations, 'Run')
        const action = mixer.clipAction(gltf.animations[0]); 
        action.play();
    }

    player.traverse((child) => {
        if (child.isMesh) child.castShadow = true;
    });
});

    // Inyectar contador de vidas
    const ui = document.getElementById('ui');
    if (ui && !document.getElementById('vidas')) {
        const vidasDiv = document.createElement('div');
        vidasDiv.innerHTML = 'Vidas: <span id="vidas">3</span> ❤️';
        vidasDiv.style.color = '#ff6666';
        ui.appendChild(vidasDiv);
    }
    livesText = document.getElementById('vidas');

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(new THREE.Color(0x1a1a2e)); 
    renderer.shadowMap.enabled = true; 
    document.getElementById('container').appendChild(renderer.domElement);

    scene = new THREE.Scene();
    //scene.fog = new THREE.Fog(0x1a1a2e, 60, 250); 

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 300);
    camera.position.set(0, CAM_Y, CAM_Z); 
    camera.lookAt(new THREE.Vector3(0, 0, -40));

    window.addEventListener('resize', updateAspectRatio);

    document.addEventListener('keydown', (event) => {
        if (!juegoIniciado || gameOver) return; // Bloqueo si el juego no ha empezado
        
        if ((event.code === 'ArrowLeft' || event.code === 'KeyA') && currentLane > -1) currentLane--;
        if ((event.code === 'ArrowRight' || event.code === 'KeyD') && currentLane < 1) currentLane++;
        if ((event.code === 'ArrowUp' || event.code === 'Space' || event.code === 'KeyW') && !isJumping && player.position.y >= 1) {
            isJumping = true;
            velocityY = FuerzaSalto; 
        }
    });
}

// Función para arrancar el juego desde el botón del menú
function startGame() {
    juegoIniciado = true;
    document.getElementById('startScreen').style.display = 'none';
    clock.start();
}

function loadScene() {

    const loader = new THREE.TextureLoader();

    // --- CARGA DE TEXTURAS ---
    const sueloTex = loader.load('./texturas/suelo.webp');
    const paredTex = loader.load('./texturas/pared.webp');
    const cieloTex = loader.load('./texturas/cielo.webp');
    lavaTex = loader.load('./texturas/lava.webp');

    // Configuración de repetición para que no se vean estiradas
    sueloTex.wrapS = sueloTex.wrapT = THREE.RepeatWrapping;
    sueloTex.repeat.set(2, 50); // El suelo se repite 50 veces a lo largo

    paredTex.wrapS = paredTex.wrapT = THREE.RepeatWrapping;
    paredTex.repeat.set(1, 40); // La pared se repite 40 veces a lo largo
    
    lavaTex.wrapS = lavaTex.wrapT = THREE.RepeatWrapping;
    lavaTex.repeat.set(1, 2); 
    // --- LUCES ---
    scene.add(new THREE.AmbientLight(0xffffff, 0.6)); // Luz ambiental más clara
    const light = new THREE.DirectionalLight(0xffffff, 1.0);
    light.position.set(10, 30, 10);
    light.castShadow = true;
    scene.add(light);

    // --- SUELO ---
    const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(laneWidth * 3 + 2, 1000),
        new THREE.MeshPhongMaterial({ map: sueloTex })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.z = -450;
    ground.receiveShadow = true;
    scene.add(ground);

    // --- PAREDES ---
    const wallMat = new THREE.MeshPhongMaterial({ map: paredTex });
    const wallGeo = new THREE.BoxGeometry(2, 10, 1000); 
    
    ground.leftWall = new THREE.Mesh(wallGeo, wallMat);
    ground.leftWall.position.set(-laneWidth * 1.5 - 2, 5, -450);
    scene.add(ground.leftWall);

    ground.rightWall = new THREE.Mesh(wallGeo, wallMat);
    ground.rightWall.position.set(laneWidth * 1.5 + 2, 5, -450);
    scene.add(ground.rightWall);
    scene.groundObj = ground; 

    // --- CIELO
    const skyGeo = new THREE.SphereGeometry(250, 32, 32);
    const skyMat = new THREE.MeshBasicMaterial({
        map: cieloTex,
        side: THREE.BackSide // Para que la textura se vea desde adentro
    });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    scene.add(sky);

    
   
}

// ==========================================
// 3. FUNCIONES DE GENERACIÓN
// ==========================================

function createMesh(geo, color, x, y, z, tipo) {
    let objeto;

    // Lógica de selección de modelo
    if (tipo === 'CONO' && conoModel) {
        objeto = conoModel.clone();
        objeto.position.set(x, 0, z);
    } 
    else if (tipo === 'VALLA' && vallaModel) {
        objeto = vallaModel.clone();
        objeto.position.set(x, 0, z);
        objeto.rotation.y = Math.PI / 2;
    } 
    else if (tipo === 'TRAILER' && trailerModel) {
        objeto = trailerModel.clone();
        objeto.position.set(x, 0, z);
    } 
    else if (tipo === 'MURO' && muroModel) {
        objeto = muroModel.clone();
        objeto.position.set(x, 0, z);
    } 
    else {
        // Fallback: si el modelo no ha cargado, usa el cubo original
        objeto = new THREE.Mesh(geo, new THREE.MeshPhongMaterial({ color: color }));
        objeto.position.set(x, y, z);
    }

    objeto.castShadow = true;
    objeto.receiveShadow = true;
    scene.add(objeto);
    obstacles.push(objeto);
    return objeto;
}

function spawnCoin(x, y, z) {
    let moneda = new THREE.Mesh(
        new THREE.CylinderGeometry(0.5, 0.5, 0.15, 16),
        new THREE.MeshPhongMaterial({ color: 0xffd700 })
    );
    moneda.rotation.x = Math.PI / 2;
    moneda.position.set(x, y, z);
    scene.add(moneda);
    monedas.push(moneda);
}

function spawnPit(x, z) {
    let pit = new THREE.Mesh(
        new THREE.PlaneGeometry(laneWidth - 0.2, 20),
        new THREE.MeshStandardMaterial({ 
            map: lavaTex, 
            emissive: 0xff4400, // Color de brillo naranja
            emissiveIntensity: 0.5 
        })
    );
    pit.rotation.x = -Math.PI / 2;
    pit.position.set(x, 0.05, z);
    pit.userData.isPit = true;
    scene.add(pit);
    pits.push(pit);
}

function spawnPattern() {
    const zPos = -220;
    
    // 1. Lógica de Vidas Extra (Mantenida)
    if (Math.random() < 0.005) {
        let randomLane = (Math.floor(Math.random() * 3) - 1) * laneWidth;
        let lifeItem = new THREE.Mesh(new THREE.OctahedronGeometry(0.6), new THREE.MeshPhongMaterial({ color: 0xff0000, emissive: 0x550000 }));
        lifeItem.position.set(randomLane, 1.5, zPos - 15);
        scene.add(lifeItem);
        extraLives.push(lifeItem);
    }

    let patternType = Math.floor(Math.random() * 9); 

    switch (patternType) {
        case 0: // Vagón largo solitario + Monedas
            let laneA = (Math.floor(Math.random() * 3) - 1) * laneWidth;
            // Usamos 'TRAILER' para el objeto largo
            createMesh(new THREE.BoxGeometry(2.8, 3, 60), 0x16213e, laneA, 1.5, zPos, 'TRAILER');
            spawnCoin(laneA, 4.5, zPos + 20);
            spawnCoin(laneA, 4.5, zPos);
            spawnCoin(laneA, 4.5, zPos - 20);
            break;

        case 1: // Muro alto solitario
            let laneB = (Math.floor(Math.random() * 3) - 1) * laneWidth;
            // Usamos 'MURO'
            createMesh(new THREE.BoxGeometry(3, 6.5, 2), 0x8b0000, laneB, 3.25, zPos, 'MURO');
            break;

        case 2: // Dos muros altos y moneda en el carril libre
            let openLane = (Math.floor(Math.random() * 3) - 1);
            for (let i = -1; i <= 1; i++) {
                if (i !== openLane) {
                    createMesh(new THREE.BoxGeometry(3, 6.5, 2), 0x8b0000, i * laneWidth, 3.25, zPos, 'MURO');
                } else {
                    spawnCoin(i * laneWidth, 1.2, zPos);
                }
            }
            break;

        case 3: // Solo un foso (No lleva modelo 3D)
            let laneC = (Math.floor(Math.random() * 3) - 1) * laneWidth;
            spawnPit(laneC, zPos);
            break;

        case 4: // Dos fosos y un obstáculo pequeño con moneda
            let safeLane = (Math.floor(Math.random() * 3) - 1);
            for (let i = -1; i <= 1; i++) {
                if (i !== safeLane) {
                    spawnPit(i * laneWidth, zPos);
                } else {
                    // El obstáculo naranja pequeño ahora es un 'CONO'
                    createMesh(new THREE.BoxGeometry(3, 3, 1), 0xffa500, i * laneWidth, 1.5, zPos, 'CONO');
                    spawnCoin(i * laneWidth, 3.5, zPos);
                }
            }
            break;

        case 5: // Tres obstáculos pequeños seguidos
            let laneD = (Math.floor(Math.random() * 3) - 1) * laneWidth;
            createMesh(new THREE.BoxGeometry(2.8, 3, 8), 0x16213e, laneD, 1.5, zPos + 15, 'CONO');
            createMesh(new THREE.BoxGeometry(2.8, 3, 8), 0x16213e, laneD, 1.5, zPos, 'CONO');
            createMesh(new THREE.BoxGeometry(2.8, 3, 8), 0x16213e, laneD, 1.5, zPos - 15, 'CONO');
            spawnCoin(laneD, 4.5, zPos);
            break;

        case 6: // Vallas en zigzag
            // Usamos 'VALLA'
            createMesh(new THREE.BoxGeometry(3, 1.5, 1), 0xffa500, -laneWidth, 0.75, zPos + 10, 'VALLA');
            createMesh(new THREE.BoxGeometry(3, 1.5, 1), 0xffa500, 0, 0.75, zPos, 'VALLA');
            createMesh(new THREE.BoxGeometry(3, 1.5, 1), 0xffa500, laneWidth, 0.75, zPos - 10, 'VALLA');
            break;

        case 7: // Valla baja seguida de muro alto
            let laneE = (Math.floor(Math.random() * 3) - 1) * laneWidth;
            createMesh(new THREE.BoxGeometry(3, 1.5, 2), 0xffa500, laneE, 0.75, zPos + 5, 'VALLA'); 
            createMesh(new THREE.BoxGeometry(3, 6.5, 2), 0x8b0000, laneE, 3.25, zPos - 10, 'MURO');
            break;

        case 8: // Triple vagón largo + muchas monedas + foso central
            for (let i = -1; i <= 1; i++) {
                let x = i * laneWidth;
                createMesh(new THREE.BoxGeometry(3.5, 3, 80), 0x16213e, x, 1.5, zPos, 'TRAILER');
                spawnCoin(x, 4.5, zPos + 25);
                spawnCoin(x, 4.5, zPos + 10);
                spawnCoin(x, 4.5, zPos - 5);
                spawnCoin(x, 4.5, zPos - 20);
            }
            spawnPit(0, zPos + 45); 
            break;
    }
}

// ==========================================
// 4. BUCLE PRINCIPAL
// ==========================================

function update() {
    if (!juegoIniciado || gameOver || !player) return; 

    // ANIMACIÓN
    let delta = clock.getDelta(); // Obtiene el tiempo pasado desde el último frame
    if (mixer) mixer.update(delta);

    // MOVIMIENTO LATERAL
    player.position.x += (currentLane * laneWidth - player.position.x) * 0.25; 

    // 2. DETECCIÓN DE SUELO (RAYCASTER MEJORADO)
    raycaster.set(player.position, downVector);
    let floorItems = [...obstacles, ...pits];
    
    // CRÍTICO: Añadimos "true" para que detecte mallas dentro de modelos GLTF
    let intersects = raycaster.intersectObjects(floorItems, true); 
    
    let targetFloorY = 1; 
    let objetoPisado = null; // Guardaremos qué obstáculo estamos pisando

    if (intersects.length > 0 && intersects[0].distance < 3.5) {
        let hitObject = intersects[0].object;

        // Si pisamos un foso, muerte instantánea
        if (hitObject.userData.isPit) {
            endGame(true);
            return;
        } 
        
        // Buscamos si el objeto impactado pertenece a uno de nuestros obstáculos
        // (Subimos por la jerarquía del modelo 3D hasta encontrar el padre en la lista)
        let parent = hitObject;
        while (parent) {
            if (obstacles.includes(parent)) {
                objetoPisado = parent;
                break;
            }
            parent = parent.parent;
        }

        // Ajustamos la altura de destino al punto exacto del impacto + offset del personaje
        targetFloorY = intersects[0].point.y + 1; 
    }

    // 3. GRAVEDAD Y SALTO
    player.position.y += velocityY;
    if (player.position.y > targetFloorY) {
        velocityY -= gravity; 
    } else {
        player.position.y = targetFloorY;
        velocityY = 0;
        isJumping = false;
    }

    // 4. CAJAS DE COLISIÓN DEL JUGADOR
    /*let playerBoxFront = new THREE.Box3().setFromObject(player);
    playerBoxFront.min.y += 1.2; // Subimos el margen de daño para no tocar el techo que pisamos
    playerBoxFront.expandByScalar(-0.1); 
    let playerBoxFull = new THREE.Box3().setFromObject(player); */

    let playerBoxFull = new THREE.Box3().setFromCenterAndSize(
    new THREE.Vector3(player.position.x, player.position.y + 1, player.position.z),
    new THREE.Vector3(1.5, 2, 1.5) 
    );
    let playerBoxFront = playerBoxFull.clone().expandByScalar(-0.2);

    // 5. EFECTO DE INVULNERABILIDAD Y CÁMARA
    if (invulnerableTimer > 0) {
        invulnerableTimer--;
        player.visible = (invulnerableTimer % 10 < 5); 
        if (invulnerableTimer > 40) {
            camera.position.x = (Math.random() - 0.5) * 1.5;
            camera.position.y = CAM_Y + (Math.random() - 0.5) * 1.5;
        } else {
            camera.position.set(0, CAM_Y, CAM_Z); 
        }
    }

    // 6. GESTIÓN DE OBSTÁCULOS (CON CLÁUSULA DE INMUNIDAD)
    for (let i = obstacles.length - 1; i >= 0; i--) {
        let obs = obstacles[i];
        obs.position.z += velocidadJuego;

        // REGLA DE ORO: Si es el objeto que estamos pisando, ignoramos el daño lateral
        if (obs === objetoPisado) continue;

        let obsBox = new THREE.Box3().setFromObject(obs);

        if (playerBoxFront.intersectsBox(obsBox)) {
            // Margen de seguridad: Solo daño si estamos claramente por debajo del tope
            if (player.position.y < obsBox.max.y - 0.4) {
                if (invulnerableTimer <= 0) {
                    vidas--;
                    livesText.innerText = vidas;
                    invulnerableTimer = 60;
                    
                    // Eliminamos para evitar múltiples impactos en un mismo frame
                    scene.remove(obs);
                    obstacles.splice(i, 1);
                    
                    if (vidas <= 0) endGame(false);
                }
            }
        } else if (obs.position.z > 100) {
            scene.remove(obs);
            obstacles.splice(i, 1);
        }
    }

    // 7. FOSOS
    for (let i = pits.length - 1; i >= 0; i--) {
        let pit = pits[i];
        pit.position.z += velocidadJuego;
        if (pit.position.z > 100) {
            scene.remove(pit);
            pits.splice(i, 1);
        }
    }

    // 8. ITEMS Y MONEDAS (Sin cambios)
    for (let i = extraLives.length - 1; i >= 0; i--) {
        let lifeItem = extraLives[i];
        lifeItem.position.z += velocidadJuego;
        lifeItem.rotation.y += 0.05;
        if (playerBoxFull.intersectsBox(new THREE.Box3().setFromObject(lifeItem))) {
            if (vidas < 3) vidas++;
            livesText.innerText = vidas;
            scene.remove(lifeItem);
            extraLives.splice(i, 1);
        } else if (lifeItem.position.z > 100) {
            scene.remove(lifeItem);
            extraLives.splice(i, 1);
        }
    }

    for (let i = monedas.length - 1; i >= 0; i--) {
        let coin = monedas[i];
        coin.position.z += velocidadJuego;
        coin.rotation.y += 0.05;
        if (playerBoxFull.intersectsBox(new THREE.Box3().setFromObject(coin))) {
            monedasReco++;
            coinsText.innerText = monedasReco;
            scene.remove(coin);
            monedas.splice(i, 1);
        } else if (coin.position.z > 100) {
            scene.remove(coin);
            monedas.splice(i, 1);
        }
    }

    // 9. GENERACIÓN Y DIFICULTAD
    framesSinceLastSpawn++;
    let spawnRate = Math.max(30, Math.floor(120 - (velocidadJuego * 25))); 
    if (framesSinceLastSpawn > spawnRate) {
        spawnPattern();
        framesSinceLastSpawn = 0;
    }

    if (velocidadJuego < velocidadMax) velocidadJuego += MultVelocidad;
    distancia += velocidadJuego * 0.5;
    distText.innerText = Math.floor(distancia);
}
function endGame(instantDeath) {
    if (instantDeath) {
        vidas = 0;
        livesText.innerText = "0";
    }
    gameOver = true;
    player.visible = true;
    camera.position.set(0, CAM_Y, CAM_Z);
    document.getElementById('finalDist').innerText = Math.floor(distancia);
    document.getElementById('finalCoins').innerText = monedasReco;
    gameOverScreen.style.display = 'flex';
}

function updateAspectRatio() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
}

function render() {
    requestAnimationFrame(render);
    update();
    renderer.render(scene, camera);
}